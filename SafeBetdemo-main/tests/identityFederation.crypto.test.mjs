// Milestone 4.2 — Pilot Federation Cryptographic Operations.
// Run: node --test tests/identityFederation.crypto.test.mjs
//
// HMAC behaviour, secret provider, rotation + dual-version transition, caching,
// security/secret-leakage, compromise response, fail-closed, version governance.
// All inputs synthetic. No production secrets. No secret value in any output.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FederationCryptoProvider, PepperOperations, InMemoryPilotSecretStore,
  InMemoryCryptoAuditSink, CryptoError, sameCryptoVersion,
  canonicalHashInput, HMAC_ALGORITHM, CANONICAL_FORMAT_VERSION,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const ADMIN = { actorRef: 'regulator:keyadmin', roles: ['key-admin', 'rotation-authority'] };
const REVOKER = { actorRef: 'regulator:security', roles: ['revocation-authority'] };

function setup(jurisdictions = ['ZA', 'NA', 'BW', 'KE']) {
  const store = new InMemoryPilotSecretStore({ jurisdictions, now: CLOCK });
  const auditSink = new InMemoryCryptoAuditSink();
  const provider = new FederationCryptoProvider({ store, auditSink, now: CLOCK, cacheTtlMs: 30_000 });
  const ops = new PepperOperations(store, provider, CLOCK);
  return { store, auditSink, provider, ops };
}

// ─── HMAC behaviour ──────────────────────────────────────────────────────────

test('HMAC is deterministic and sensitive to input/type/jurisdiction/version', () => {
  const { provider } = setup();
  const a = provider.hashAttribute('ZA', 'national_id', '8001015009087');
  const b = provider.hashAttribute('ZA', 'national_id', '8001015009087');
  assert.equal(a.hash, b.hash, 'same input → same hash');
  assert.notEqual(a.hash, provider.hashAttribute('ZA', 'national_id', '9001015009088').hash, 'different value → different hash');
  assert.notEqual(a.hash, provider.hashAttribute('ZA', 'phone', '8001015009087').hash, 'different attribute type → different hash');
  assert.equal(a.pepperKeyVersion, 'p1');
  assert.equal(a.stamp.algorithm, HMAC_ALGORITHM);
  // no plaintext appears in the produced hash record
  assert.equal(JSON.stringify(a).includes('8001015009087'), false, 'no plaintext in output');
});

test('jurisdiction pepper isolation: same synthetic value differs across jurisdictions', () => {
  const { provider } = setup();
  const za = provider.hashAttribute('ZA', 'national_id', 'SAME-VALUE').hash;
  const bw = provider.hashAttribute('BW', 'national_id', 'SAME-VALUE').hash;
  const ke = provider.hashAttribute('KE', 'national_id', 'SAME-VALUE').hash;
  assert.notEqual(za, bw); assert.notEqual(za, ke); assert.notEqual(bw, ke);
});

test('canonical input is collision-safe and Unicode-deterministic', () => {
  // length-prefixed → boundary shifts do not collide
  assert.notEqual(canonicalHashInput('ZA', 'national_id', 'AB'), canonicalHashInput('ZA', 'phone', 'AB'));
  // NFC normalisation: composed vs decomposed é are equal
  const composed = 'é'; const decomposed = 'é';
  assert.equal(canonicalHashInput('ZA', 'national_id', composed), canonicalHashInput('ZA', 'national_id', decomposed));
  assert.ok(canonicalHashInput('ZA', 'national_id', 'X').startsWith(`${'cf-1'.length}:cf-1|`));
});

// ─── Secret provider ─────────────────────────────────────────────────────────

test('secret provider: approved attribute only; unknown/disabled versions rejected', () => {
  const { provider } = setup();
  assert.throws(() => provider.hashAttribute('ZA', 'passport', 'X'), CryptoError);      // passport not enabled in ZA
  assert.throws(() => provider.hashAttributeVersion('ZA', 'national_id', 'X', 'p99'), /unsupported-version/);
});

test('secret provider never exposes raw pepper material', () => {
  const { store } = setup();
  // no getter for raw material; metadata carries no value
  assert.equal(typeof store.pepper, 'undefined');
  assert.equal(typeof store.raw, 'undefined');
  const meta = store.metadata('ZA', 'p1');
  assert.equal(JSON.stringify(meta).toLowerCase().includes('pepper') && !JSON.stringify(meta).includes('secretRef') ? true : false, false);
  for (const k of Object.keys(meta)) assert.equal(/value|secret(?!Ref)|material|key$/i.test(k), false, `metadata leaks '${k}'`);
});

// ─── Rotation + dual-version transition ──────────────────────────────────────

test('rotation: new primary version, previous kept as transition, outputs NOT equal', () => {
  const { provider, ops } = setup();
  const before = provider.hashAttribute('ZA', 'national_id', 'ID-1');
  assert.equal(before.pepperKeyVersion, 'p1');
  const r = ops.rotate(ADMIN, 'ZA', 'p2');
  assert.deepEqual([r.previous, r.active], ['p1', 'p2']);
  const after = provider.hashAttribute('ZA', 'national_id', 'ID-1');
  assert.equal(after.pepperKeyVersion, 'p2', 'new contributions use the new primary');
  // dual-version: both recognised; the old-version hash is still computable during transition
  assert.equal(provider.verifyVersion('ZA', 'p1'), true);
  assert.equal(provider.verifyVersion('ZA', 'p2'), true);
  const oldAgain = provider.hashAttributeVersion('ZA', 'national_id', 'ID-1', 'p1');
  assert.notEqual(after.hash, oldAgain.hash, 'old and new HMAC outputs are NOT equal');
  assert.equal(sameCryptoVersion(after, oldAgain), false, 'version stamps differ → not comparable');
});

test('rotation: retiring the previous version rejects new hashing on it; failed rotation rolls back', () => {
  const { provider, ops } = setup();
  ops.rotate(ADMIN, 'ZA', 'p2');
  ops.retire(ADMIN, 'ZA', 'p1');
  assert.equal(provider.verifyVersion('ZA', 'p1'), false, 'retired version not recognised for new hashing');
  assert.throws(() => provider.hashAttributeVersion('ZA', 'national_id', 'X', 'p1'), /unsupported-version/);
  // failed rotation (version already exists) rolls back — p2 remains active, no change
  assert.throws(() => ops.rotate(ADMIN, 'ZA', 'p2'), CryptoError);
  assert.equal(provider.rotationState('ZA').activeVersion, 'p2');
});

test('rotation requires an authorised role', () => {
  const { ops } = setup();
  assert.throws(() => ops.rotate({ actorRef: 'x', roles: ['auditor'] }, 'ZA', 'p2'), /unauthorised/);
});

// ─── Caching ─────────────────────────────────────────────────────────────────

test('cache invalidates on rotation and is jurisdiction-isolated', () => {
  const { provider, ops } = setup();
  provider.hashAttribute('ZA', 'national_id', 'ID');           // warms ZA cache (active p1)
  ops.rotate(ADMIN, 'ZA', 'p2');                               // must invalidate ZA cache
  assert.equal(provider.hashAttribute('ZA', 'national_id', 'ID').pepperKeyVersion, 'p2', 'cache invalidated → new version used');
  // NA unaffected
  assert.equal(provider.hashAttribute('NA', 'passport', 'P').pepperKeyVersion, 'p1');
});

// ─── Fail-closed ─────────────────────────────────────────────────────────────

test('fail-closed: disabled jurisdiction rejects new contributions (no fallback)', () => {
  const { provider, ops } = setup();
  ops.disableJurisdiction(REVOKER, 'ZA');
  assert.throws(() => provider.hashAttribute('ZA', 'national_id', 'X'), CryptoError);
  // other jurisdictions still work
  assert.ok(provider.hashAttribute('NA', 'passport', 'X').hash);
});

test('fail-closed: no unkeyed / demo / global fallback exists', () => {
  const { provider } = setup();
  assert.equal(typeof provider.fallback, 'undefined');
  assert.equal(typeof provider.sha256, 'undefined');
  // an unusable version throws rather than silently degrading
  assert.throws(() => provider.hashAttributeVersion('ZA', 'national_id', 'X', 'nonexistent'), CryptoError);
});

// ─── Compromise response ─────────────────────────────────────────────────────

test('compromise: marks version, disables new contributions, preserves audit; reactivation requires approval', () => {
  const { provider, ops, store } = setup();
  ops.markCompromised(REVOKER, 'ZA', 'p1', 'suspected leak');
  assert.throws(() => provider.hashAttribute('ZA', 'national_id', 'X'), CryptoError, 'no active pepper → fail closed');
  assert.equal(store.metadata('ZA', 'p1').state, 'compromised');
  // historical metadata preserved (not deleted)
  assert.ok(store.allMetadata('ZA').some((m) => m.version === 'p1' && m.state === 'compromised'));
  // recover: provision + activate a NEW version through the approved path
  ops.provision(ADMIN, 'ZA', 'p2');
  const reactivated = ops.reactivateJurisdiction(ADMIN, 'ZA', 'p2', true);
  assert.equal(reactivated.state, 'active');
  assert.ok(provider.hashAttribute('ZA', 'national_id', 'X').hash);
  // reactivation without approval is rejected
  ops.provision(ADMIN, 'NA', 'n2');
  assert.throws(() => ops.reactivateJurisdiction(ADMIN, 'NA', 'n2', false), /reactivation-not-approved/);
});

// ─── Cryptographic audit (no secrets) ────────────────────────────────────────

test('cryptographic audit records lifecycle events and contains no secret values', () => {
  const { provider, ops } = setup();
  ops.rotate(ADMIN, 'ZA', 'p2');
  ops.markCompromised(REVOKER, 'ZA', 'p2', 'incident');
  const trail = provider.auditTrail();
  assert.ok(trail.some((e) => e.action === 'rotation-completed'));
  assert.ok(trail.some((e) => e.action === 'pepper-compromised'));
  const blob = JSON.stringify(trail);
  assert.equal(/pepperValue|secret[^R]|keyMaterial|plaintext/i.test(blob), false, 'no secret fields in audit');
  assert.throws(() => { trail[0].action = 'x'; }, TypeError, 'audit entries immutable');
});

// ─── Version governance ──────────────────────────────────────────────────────

test('every hash carries a full cryptographic version stamp', () => {
  const { provider } = setup();
  const s = provider.hashAttribute('ZA', 'national_id', 'X').stamp;
  for (const k of ['jurisdiction', 'attributeType', 'algorithm', 'canonicalFormatVersion', 'normalisationVersion', 'pepperVersion', 'contributionSchemaVersion'])
    assert.ok(s[k], `stamp missing ${k}`);
  assert.equal(s.algorithm, HMAC_ALGORITHM);
  assert.equal(s.canonicalFormatVersion, CANONICAL_FORMAT_VERSION);
});

// ─── Secret / PII leakage ────────────────────────────────────────────────────

test('no secret value or plaintext PII in provider/store serialisation', () => {
  const { provider, store, auditSink } = setup();
  provider.hashAttribute('ZA', 'national_id', 'SECRET-PII-8001015009087');
  const blob = JSON.stringify({ health: provider.health(), meta: store.allMetadata(), audit: auditSink.list() });
  assert.equal(blob.includes('SECRET-PII'), false, 'no plaintext attribute value');
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false, 'no email');
  // metadata exposes only opaque non-production secret references, never material
  assert.ok(store.metadata('ZA', 'p1').secretRef.startsWith('pilot-nonproduction/'));
});
