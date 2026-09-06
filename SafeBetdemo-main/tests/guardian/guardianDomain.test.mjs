// SafeBet Guardian — Domain & Website Intelligence (ARCH-V4-C2). Synthetic only.
// Proves discovery→signals→registry-comparison→review, NO_MATCH!=ILLEGAL, mismatch/
// stale/conflict→review, normalisation, idempotency, poison→DLQ, history (non-destructive).
//   node --test tests/guardian/guardianDomain.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_REGISTRY, SYNTHETIC_DOMAIN_FIXTURES,
  analyseDomain, normaliseHostname, technicalSignals, contentSignals,
  GuardianDomainWorker, PoisonMessageError,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-06T00:00:00Z');
const analyse = (host, obs = 'OBS-T') => analyseDomain(SYNTHETIC_REGISTRY, SYNTHETIC_DOMAIN_FIXTURES[host], { observationId: obs, now: NOW });

// ── Scenario 1/2: licensed brand domain + explicit licence → matched, low priority ─
test('scenario 1/2: licensed brand+licence domain → REFERENCE_MATCHED, low priority, LICENSED', () => {
  const r = analyse('licensed-example-003.test');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.licenceVerificationState, 'LICENSED');
  assert.equal(r.reviewPriority, 'LOW_REVIEW_PRIORITY');
  assert.equal(r.reviewRequired, false);
  assert.equal(r.classification, 'REFERENCE_MATCHED');
  assert.equal(r.isIllegalDetermination, false);
});

// ── Scenario 3: unknown gambling-themed → NO_MATCH → review, NOT illegal ──────
test('scenario 3: unknown gambling domain → NO_MATCH, high review priority, NOT illegal', () => {
  const r = analyse('unknown-example-004.test');
  assert.equal(r.registryMatchState, 'NO_MATCH');
  assert.equal(r.reviewRequired, true);
  assert.equal(r.reviewPriority, 'HIGH_REVIEW_PRIORITY');
  assert.ok(r.reasonCodes.includes('NO_AUTHORITATIVE_REGISTRY_MATCH'));
  assert.ok(r.reasonCodes.includes('CONTENT_GAMBLING_SIGNAL'));
  assert.equal(r.classification, 'POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION');
  assert.equal(r.isIllegalDetermination, false);
});

// ── Scenario 4: mismatched licence/operator claim → mismatch reason → review ──
test('scenario 4: brand/licence mismatch → mismatch reason codes → review', () => {
  const r = analyse('mismatch-example-005.test');
  assert.ok(r.reasonCodes.includes('BRAND_OPERATOR_MISMATCH'));
  assert.ok(r.reasonCodes.includes('LICENCE_REFERENCE_MISMATCH'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
});

// ── Scenario 5: stale licence → stale warning → review ───────────────────────
test('scenario 5: stale licence reference → LICENCE_RECORD_STALE → review', () => {
  const r = analyse('stale-example-009.test');
  assert.ok(r.reasonCodes.includes('LICENCE_RECORD_STALE'));
  assert.equal(r.registryFreshness, 'STALE');
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
});

// ── Scenario 6: conflicting registry source → SOURCE_CONFLICT → review ────────
test('scenario 6: conflicting source → SOURCE_CONFLICT reason → review', () => {
  const r = analyse('conflict-example-002.test');
  assert.ok(r.reasonCodes.includes('SOURCE_CONFLICT'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
});

// ── Scenario 7: wrong jurisdiction → no cross-jurisdiction match ─────────────
test('scenario 7: ZA-WC domain analysed under its own jurisdiction only', () => {
  const fx = SYNTHETIC_DOMAIN_FIXTURES['western-example-100.test'];
  assert.equal(fx.jurisdiction, 'ZA-WC');
  // Analysing it as ZA-WC resolves; a ZA-GP registry lookup for it would not match (registry test covers cross-jur).
  const r = analyseDomain(SYNTHETIC_REGISTRY, fx, { observationId: 'OBS-WC', now: NOW });
  assert.equal(r.jurisdiction, 'ZA-WC');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-WC-0100');
});

// ── Scenario 8: duplicate observation → idempotent, no duplicate ─────────────
test('scenario 8: duplicate message → idempotent (no duplicate authoritative observation)', () => {
  const w = new GuardianDomainWorker();
  const msg = { product: 'GUARDIAN', schemaVersion: 'c2', eventType: 'guardian.domain.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), fixtureHostname: 'licensed-example-003.test' };
  const a = w.process(msg), b = w.process(msg);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(w.processedCount(), 1);
});

// ── Scenario 9: poison message → PoisonMessageError (→ DLQ) ───────────────────
test('scenario 9: poison/unknown message → PoisonMessageError (routes to DLQ)', () => {
  const w = new GuardianDomainWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c2', eventType: 'guardian.domain.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureHostname: 'does-not-exist.test' }), PoisonMessageError);
  assert.throws(() => w.process({ product: 'SAFEBET_IQ' }), PoisonMessageError);
});

// ── Scenario 10: content hash change → new observation (non-destructive history) ─
test('scenario 10: different idempotency key/hash → distinct observation (history preserved)', () => {
  const w = new GuardianDomainWorker();
  const base = { product: 'GUARDIAN', schemaVersion: 'c2', eventType: 'guardian.domain.observe', jurisdiction: 'ZA-GP', correlationId: 'c', occurredAt: NOW.toISOString(), fixtureHostname: 'licensed-example-003.test' };
  const o1 = w.process({ ...base, idempotencyKey: 'obs-1' });
  const o2 = w.process({ ...base, idempotencyKey: 'obs-2' });
  assert.notEqual(o1.result.observationId, o2.result.observationId);
  assert.equal(w.processedCount(), 2); // two distinct observations, none overwritten
});

// ── Normalisation + signals + invariants ──────────────────────────────────────
test('normalisation: scheme/path/port/www stripped deterministically', () => {
  assert.equal(normaliseHostname('HTTPS://WWW.Example-001.test:443/path?q=1').canonical, 'example-001.test');
  assert.equal(normaliseHostname('sub.example.test.').canonical, 'sub.example.test');
});

test('signals: gambling content + licence text detected deterministically', () => {
  const fx = SYNTHETIC_DOMAIN_FIXTURES['licensed-example-003.test'];
  const c = contentSignals(fx);
  assert.equal(c.find((x) => x.signalType === 'GAMBLING_TERMINOLOGY').present, true);
  assert.equal(c.find((x) => x.signalType === 'LICENCE_TEXT_PRESENT').present, true);
  assert.ok(technicalSignals(fx).some((x) => x.signalType === 'CONTENT_FINGERPRINT'));
});

test('invariant: no domain result ever asserts illegality', () => {
  for (const host of Object.keys(SYNTHETIC_DOMAIN_FIXTURES)) {
    const fx = SYNTHETIC_DOMAIN_FIXTURES[host];
    const r = analyseDomain(SYNTHETIC_REGISTRY, fx, { observationId: 'OBS-INV', now: NOW });
    assert.equal(r.isIllegalDetermination, false);
    assert.notEqual(r.classification, 'ILLEGAL');
  }
});

test('boundary: domain worker performs no network/crawl (fixtures only)', () => {
  // The worker throws on any hostname not in the synthetic fixture set — it cannot reach out.
  const w = new GuardianDomainWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c2', eventType: 'guardian.domain.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureHostname: 'https://real-site.example' }), PoisonMessageError);
});
