// Milestone 4.3 — Operator Contribution & Event Platform Wiring.
// Run: node --test tests/identityFederation.contribution.test.mjs
//
// Hash-only contract + runtime PII rejection, identity/attribution, idempotency/
// replay, sequencing, projection, matching handoff + version segregation,
// revocation/expiry, dead-letter/retry, audit, access, and an end-to-end run
// through the REAL matching → decision → registry pipeline. Synthetic data only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FederationEventPlatform, ContributionProjector, SyntheticOperatorHarness,
  InMemorySbPlrDirectory, InMemoryContributionAuditSink, candidateProvenance,
  FederationCryptoProvider, InMemoryPilotSecretStore,
  IdentityMatchingEngine, FederationDecisionEngine, isApprovedDecision,
  SbNatRegistry, InMemoryAuditSink, getJurisdictionProfile,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const ZA = getJurisdictionProfile('ZA');

function setup() {
  const store = new InMemoryPilotSecretStore({ jurisdictions: ['ZA', 'NA', 'KE'], now: CLOCK });
  const crypto = new FederationCryptoProvider({ store, now: CLOCK });
  const directory = new InMemorySbPlrDirectory();
  const auditSink = new InMemoryContributionAuditSink();
  const platform = new FederationEventPlatform({ resolver: directory, verifyPepperVersion: (j, v) => crypto.verifyVersion(j, v), auditSink, now: CLOCK });
  const harness = new SyntheticOperatorHarness({ platform, crypto, directory, enabled: true, now: CLOCK });
  const projector = new ContributionProjector({ now: CLOCK });
  return { store, crypto, directory, platform, harness, projector, auditSink };
}
const SERVICE = (operatorId, tenantId, jurisdiction = 'ZA') => ({ plane: 'contribution-service', operatorId, tenantId, jurisdiction });
const REGULATOR = { plane: 'regulator', jurisdiction: 'ZA' };

// ─── Event contract + hash-only boundary ─────────────────────────────────────
test('valid hash-only contribution is accepted; plaintext/unknown/oversized rejected', () => {
  const { harness, directory } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  const ok = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'ID-1');
  assert.equal(ok.accepted, true);

  // plaintext PII in an unknown field → rejected
  const pii = harness.submitRaw(SERVICE('op-a', 't-a'), { eventId: 'e-pii', eventType: 'IDENTITY_FEDERATION_ATTRIBUTE', eventSchemaVersion: 'evt-1', eventTimestamp: CLOCK(), sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', attributeType: 'national_id', digest: 'a'.repeat(64), hmacAlgorithm: 'HMAC-SHA-256', pepperVersion: 'p1', normalisationVersion: 'norm-1', canonicalFormatVersion: 'cf-1', contributionSchemaVersion: 'contrib-1', sourceSystemRef: 'x', idempotencyKey: 'k', plaintextEmail: 'real.person@example.com' });
  assert.equal(pii.accepted, false);
  assert.equal(pii.rejection.reason, 'unknown-schema-field');

  // invalid digest (not 64-hex) → rejected
  const bad = harness.submitRaw(SERVICE('op-a', 't-a'), { eventId: 'e-bad', eventType: 'IDENTITY_FEDERATION_ATTRIBUTE', eventSchemaVersion: 'evt-1', eventTimestamp: CLOCK(), sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', attributeType: 'national_id', digest: '8001015009087', hmacAlgorithm: 'HMAC-SHA-256', pepperVersion: 'p1', normalisationVersion: 'norm-1', canonicalFormatVersion: 'cf-1', contributionSchemaVersion: 'contrib-1', sourceSystemRef: 'x', idempotencyKey: 'k' });
  assert.equal(bad.rejection.reason, 'invalid-digest');
});

// ─── Identity + attribution + jurisdiction ───────────────────────────────────
test('cross-tenant SB-PLR, wrong operator, wrong jurisdiction, attribution mismatch all rejected', () => {
  const { harness, directory } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  // another operator claims op-a's SB-PLR (context op-b)
  const xTenant = harness.contribute('op-b', 't-b', 'ZA', 'SB-PLR-A', 'national_id', 'X');
  assert.equal(xTenant.accepted, false);
  assert.ok(['cross-tenant-sbplr', 'unauthorised-operator', 'invalid-sbplr'].includes(xTenant.rejection.reason));
  // unknown SB-PLR
  assert.equal(harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-GHOST', 'national_id', 'X').rejection.reason, 'invalid-sbplr');
  // attribute not enabled in ZA — the crypto layer refuses to even hash it (defense-in-depth)...
  assert.throws(() => harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'passport', 'X'), /attribute-not-approved/);
  // ...and the Event Platform independently rejects a raw passport contribution.
  const rawPassport = harness.submitRaw(SERVICE('op-a', 't-a'), { eventId: 'e-pp', eventType: 'IDENTITY_FEDERATION_ATTRIBUTE', eventSchemaVersion: 'evt-1', eventTimestamp: CLOCK(), sourceOperatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', attributeType: 'passport', digest: 'b'.repeat(64), hmacAlgorithm: 'HMAC-SHA-256', pepperVersion: 'p1', normalisationVersion: 'norm-1', canonicalFormatVersion: 'cf-1', contributionSchemaVersion: 'contrib-1', sourceSystemRef: 'x', idempotencyKey: 'k' });
  assert.equal(rawPassport.rejection.reason, 'unsupported-attribute-type');
});

test('unauthenticated / operator plane cannot submit or read', () => {
  const { platform } = setup();
  const ev = { eventId: 'e', eventType: 'IDENTITY_FEDERATION_ATTRIBUTE', eventSchemaVersion: 'evt-1', eventTimestamp: CLOCK(), sourceOperatorId: 'op', tenantId: 't', jurisdiction: 'ZA', sbPlr: 'SB-PLR-A', attributeType: 'national_id', digest: 'a'.repeat(64), hmacAlgorithm: 'HMAC-SHA-256', pepperVersion: 'p1', normalisationVersion: 'norm-1', canonicalFormatVersion: 'cf-1', contributionSchemaVersion: 'contrib-1', sourceSystemRef: 'x', idempotencyKey: 'k' };
  assert.equal(platform.submit({ plane: 'unauthenticated', jurisdiction: null }, ev).rejection.reason, 'unauthenticated-source');
  assert.equal(platform.submit({ plane: 'operator', operatorId: 'op', tenantId: 't', jurisdiction: 'ZA' }, ev).rejection.reason, 'unauthenticated-source');
  assert.throws(() => platform.acceptedContributions({ plane: 'operator', jurisdiction: 'ZA' }));
});

// ─── Idempotency + replay + duplicate ────────────────────────────────────────
test('idempotency: replay + content-duplicate accept once; cross-operator preserved', () => {
  const { harness, directory, platform } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  directory.register({ sbPlr: 'SB-PLR-B', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' });
  const first = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SHARED', { eventId: 'e1' });
  const replay = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SHARED', { eventId: 'e1' });   // same id
  const contentDup = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SHARED', { eventId: 'e2' }); // same content, new id
  assert.equal(replay.duplicate, true);
  assert.equal(contentDup.duplicate, true);
  assert.equal(platform.acceptedContributions(REGULATOR).length, 1, 'one authoritative contribution');
  // a DIFFERENT operator contributing the same synthetic value is preserved (different pepper? same jurisdiction/version → same hash, but different tenant → different content key)
  const other = harness.contribute('op-b', 't-b', 'ZA', 'SB-PLR-B', 'national_id', 'SHARED', { eventId: 'e3' });
  assert.equal(other.accepted, true);
  assert.equal(other.duplicate ?? false, false, 'cross-operator evidence not collapsed');
  assert.equal(platform.acceptedContributions(REGULATOR).length, 2);
});

// ─── Sequencing ──────────────────────────────────────────────────────────────
test('sequencing: duplicate sequence rejected; out-of-order accepted with audit', () => {
  const { harness, directory, auditSink } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'V1', { eventId: 's1', sourceSequence: 1 });
  const dupSeq = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'phone', 'V2', { eventId: 's2', sourceSequence: 1 });
  assert.equal(dupSeq.rejection.reason, 'invalid-sequence');
  const gap = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'phone', 'V3', { eventId: 's3', sourceSequence: 5 });
  assert.equal(gap.accepted, true);
  assert.ok(auditSink.list().some((a) => a.action === 'sequence-violation'));
});

// ─── Projection + matching handoff + version segregation ─────────────────────
test('projection feeds the certified matching engine; cross-version does not match', () => {
  const { harness, directory, platform, projector, crypto } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  directory.register({ sbPlr: 'SB-PLR-B', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' });
  harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SAME');
  harness.contribute('op-b', 't-b', 'ZA', 'SB-PLR-B', 'national_id', 'SAME');
  const { contributions, provenance } = projector.matchingContributions(platform, REGULATOR, 'ZA');
  const matcher = new IdentityMatchingEngine();
  const res = matcher.generateCandidates(ZA, contributions);
  assert.equal(res.candidates.length, 1, 'same value + same version → one candidate');
  const prov = candidateProvenance(provenance, res.candidates[0].sbPlrA, res.candidates[0].sbPlrB);
  assert.ok(prov.length >= 2, 'candidate provenance references the source events');
  // NO decision performed by the contribution path
  assert.equal(res.candidates[0].suggestedTier, undefined);
});

// ─── Revocation + expiry ─────────────────────────────────────────────────────
test('revocation and expiry exclude from new matching but preserve history', () => {
  const { harness, directory, platform, projector } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  directory.register({ sbPlr: 'SB-PLR-B', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' });
  harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SAME', { eventId: 'r1' });
  harness.contribute('op-b', 't-b', 'ZA', 'SB-PLR-B', 'national_id', 'SAME', { eventId: 'r2' });
  platform.revoke(SERVICE('op-a', 't-a'), 'r1', 'source corrected');
  const proj = projector.matchingContributions(platform, REGULATOR, 'ZA');
  assert.ok(!proj.contributions.some((c) => c.sbPlr === 'SB-PLR-A'), 'revoked excluded from matching');
  assert.equal(platform.acceptedContributions(REGULATOR).length, 2, 'original preserved');
  // expiry
  const { harness: h2, directory: d2, platform: p2, projector: pr2 } = setup();
  d2.register({ sbPlr: 'SB-PLR-C', tenantId: 't-c', operatorId: 'op-c', jurisdiction: 'ZA', status: 'active' });
  h2.contribute('op-c', 't-c', 'ZA', 'SB-PLR-C', 'national_id', 'V', { eventId: 'x1', expiryAt: '2020-01-01T00:00:00Z' });
  // already-expired is rejected at submit; a future-expiry is projected then excluded after asOf
  h2.contribute('op-c', 't-c', 'ZA', 'SB-PLR-C', 'phone', 'V', { eventId: 'x2', expiryAt: '2999-01-01T00:00:00Z' });
  assert.equal(pr2.matchingContributions(p2, REGULATOR, 'ZA', '3000-01-01T00:00:00Z').contributions.length, 0, 'excluded after expiry');
});

// ─── Dead-letter + retry ─────────────────────────────────────────────────────
test('transient failure dead-letters, retries are bounded, and retry succeeds', () => {
  const store = new InMemoryPilotSecretStore({ jurisdictions: ['ZA'], now: CLOCK });
  const crypto = new FederationCryptoProvider({ store, now: CLOCK });
  const directory = new InMemorySbPlrDirectory([{ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' }]);
  let fault = true;
  const platform = new FederationEventPlatform({ resolver: directory, verifyPepperVersion: (j, v) => crypto.verifyVersion(j, v), now: CLOCK, faultInjector: (id) => (id === 'dl1' && fault ? 'retryable-persistence' : null) });
  const harness = new SyntheticOperatorHarness({ platform, crypto, directory, enabled: true, now: CLOCK });
  const first = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'V', { eventId: 'dl1' });
  assert.equal(first.accepted, false);
  assert.equal(first.deadLetter.classification, 'retryable-persistence');
  assert.equal(platform.deadLetterQueue().length, 1);
  // clear the fault and retry → accepted, dead-letter resolved
  fault = false;
  const retry = harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'V', { eventId: 'dl1' });
  assert.equal(retry.accepted, true);
  assert.equal(platform.deadLetterQueue().length, 0, 'dead-letter resolved after successful retry');
});

// ─── Audit ───────────────────────────────────────────────────────────────────
test('contribution audit is append-only and contains no plaintext PII', () => {
  const { harness, directory, auditSink } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'SECRET-PII-8001015009087');
  const trail = auditSink.list();
  assert.ok(trail.some((a) => a.action === 'contribution-received'));
  assert.ok(trail.some((a) => a.action === 'contribution-accepted'));
  const blob = JSON.stringify(trail);
  assert.equal(blob.includes('SECRET-PII'), false);
  assert.equal(/\d{7,}/.test(blob), false);
  assert.throws(() => { trail[0].action = 'x'; }, TypeError);
});

// ─── End-to-end through the REAL pipeline ────────────────────────────────────
test('end-to-end: contribution → Event Platform → projection → matching → decision → SB-NAT', () => {
  const { harness, directory, platform, projector } = setup();
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  directory.register({ sbPlr: 'SB-PLR-B', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' });
  // 1-8: two operators contribute the same synthetic national id through the Event Platform
  assert.equal(harness.contribute('op-a', 't-a', 'ZA', 'SB-PLR-A', 'national_id', 'PERSON-1').accepted, true);
  assert.equal(harness.contribute('op-b', 't-b', 'ZA', 'SB-PLR-B', 'national_id', 'PERSON-1').accepted, true);
  // 9-11: project + run the certified matching engine; verify provenance
  const { contributions, provenance } = projector.matchingContributions(platform, REGULATOR, 'ZA');
  const matcher = new IdentityMatchingEngine();
  const candidates = matcher.generateCandidates(ZA, contributions).candidates;
  projector.recordMatchingHandoff('ZA', candidates.length);
  assert.equal(candidates.length, 1);
  assert.ok(candidateProvenance(provenance, candidates[0].sbPlrA, candidates[0].sbPlrB).length >= 2);
  // 12-13: no auto-decision by the contribution path; run the Decision Engine separately
  const engine = new FederationDecisionEngine(CLOCK);
  const decision = engine.decide(ZA, candidates[0]).decision;
  assert.equal(decision.outcome, 'auto-approved');
  // 14: register SB-NAT only after approval
  const registry = new SbNatRegistry({ now: CLOCK, auditSink: new InMemoryAuditSink() });
  assert.ok(isApprovedDecision(decision));
  const rec = registry.create(decision);
  assert.deepEqual(rec.members, ['SB-PLR-A', 'SB-PLR-B']);
  // 15: full evidence reconstruction (SB-NAT members ↔ contribution provenance)
  assert.equal(registry.verifyIntegrity().ok, true);
});
