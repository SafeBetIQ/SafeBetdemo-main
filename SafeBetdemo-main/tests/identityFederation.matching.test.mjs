// Milestone 3.2 — Identity Matching Engine (v2.0, ADR-006).
// Run: node --test tests/identityFederation.matching.test.mjs
//
// Proves deterministic candidate generation, confidence SCORING (no decision),
// full explainability, cross-jurisdiction isolation, policy-driven rules,
// invalid-input handling, and the boundary: NO decisions / SB-NAT / merge.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IdentityMatchingEngine, getJurisdictionProfile,
  resolveFederationConfig, NationalIdentityFederationService, InMemoryAuditSink,
  FederationNotEnabledError, MilestoneNotImplementedError, defaultFederationConfig,
} from '../lib/identityFederation/index.ts';

const engine = new IdentityMatchingEngine();
const ZA = getJurisdictionProfile('ZA');   // national_id(1.0) phone(0.6) device_fingerprint(0.3)
const NA = getJurisdictionProfile('NA');   // passport(1.0) phone(0.6)

// helpers
const h = (attributeType, hash) => ({ attributeType, hash, pepperKeyVersion: 'v1' });
const contrib = (casinoId, sbPlr, attributes, jurisdiction = 'ZA') =>
  ({ jurisdiction, casinoId, sbPlr, attributes, contributedAt: '2026-07-16T00:00:00Z' });

// ─── Exact / strong match ────────────────────────────────────────────────────

test('exact strong match across two operators → one candidate, score 1.0', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('casinoA', 'SB-PLR-A', [h('national_id', 'NID#1'), h('phone', 'PH#1')]),
    contrib('casinoB', 'SB-PLR-B', [h('national_id', 'NID#1'), h('phone', 'PH#2')]),
  ]);
  assert.equal(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.equal(c.confidenceScore, 1.0);                       // national_id matched (weight 1.0)
  assert.deepEqual(c.evidenceUsed.map(e => e.attributeType), ['national_id']);
  const nm = c.evidenceNotMatched.map(e => [e.attributeType, e.ignoredReason]);
  assert.deepEqual(nm, [['phone', 'different-hash']]);        // both have phone, different hash
  assert.deepEqual(c.rulesSkipped.map(r => r.ruleId), ['ZA-MATCH-device_fingerprint']); // neither provided device
  assert.deepEqual(c.ruleEvaluationOrder, ['ZA-MATCH-national_id', 'ZA-MATCH-phone', 'ZA-MATCH-device_fingerprint']);
  assert.equal(c.casinoA, 'casinoA'); assert.equal(c.casinoB, 'casinoB');
});

// ─── Partial / medium match ──────────────────────────────────────────────────

test('partial medium match → score 0.6, one-sided evidence recorded', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('casinoA', 'SB-PLR-A', [h('phone', 'PH#9'), h('device_fingerprint', 'DEV#1')]),
    contrib('casinoB', 'SB-PLR-B', [h('phone', 'PH#9')]),   // no device
  ]);
  assert.equal(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.equal(c.confidenceScore, 0.6);
  assert.deepEqual(c.evidenceUsed.map(e => e.attributeType), ['phone']);
  assert.deepEqual(c.evidenceNotMatched.map(e => [e.attributeType, e.ignoredReason]), [['device_fingerprint', 'one-sided']]);
  assert.deepEqual(c.rulesSkipped.map(r => r.ruleId), ['ZA-MATCH-national_id']);
});

// ─── No match ────────────────────────────────────────────────────────────────

test('no shared hash → zero candidates', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('casinoA', 'SB-PLR-A', [h('national_id', 'NID#1')]),
    contrib('casinoB', 'SB-PLR-B', [h('national_id', 'NID#2')]),
  ]);
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesGenerated, 0);
  assert.equal(res.diagnostics.distinctPlayers, 2);
});

// ─── Multiple candidates (deterministic ordering) ────────────────────────────

test('three players sharing an attribute → three ordered candidates', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('c3', 'SB-PLR-C', [h('phone', 'PH#5')]),
    contrib('c1', 'SB-PLR-A', [h('phone', 'PH#5')]),
    contrib('c2', 'SB-PLR-B', [h('phone', 'PH#5')]),
  ]);
  assert.equal(res.candidates.length, 3);
  assert.deepEqual(res.candidates.map(c => [c.sbPlrA, c.sbPlrB]),
    [['SB-PLR-A', 'SB-PLR-B'], ['SB-PLR-A', 'SB-PLR-C'], ['SB-PLR-B', 'SB-PLR-C']]);
});

// ─── Cross-jurisdiction isolation ────────────────────────────────────────────

test('cross-jurisdiction isolation: same hash in another jurisdiction never links', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('za1', 'SB-PLR-ZA', [h('national_id', 'SHARED')], 'ZA'),
    contrib('na1', 'SB-PLR-NA', [h('national_id', 'SHARED')], 'NA'),  // ignored for ZA
  ]);
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.contributions, 1, 'only ZA contribution counted');
});

// ─── Policy-driven rule loading (attributes not in the profile are ignored) ──

test('rules are policy-driven: NA has no device rule; device hashes are ignored', () => {
  const res = engine.generateCandidates(NA, [
    contrib('na1', 'SB-PLR-1', [h('passport', 'P#1'), h('device_fingerprint', 'DEV#X')], 'NA'),
    contrib('na2', 'SB-PLR-2', [h('passport', 'P#2'), h('device_fingerprint', 'DEV#X')], 'NA'),
  ]);
  assert.equal(res.candidates.length, 0, 'device is not an enabled attribute in NA → not indexed → no link');
});

// ─── Determinism ─────────────────────────────────────────────────────────────

test('deterministic: identical inputs → identical output (incl. ordering & scores)', () => {
  const input = [
    contrib('cB', 'SB-PLR-B', [h('national_id', 'N#1'), h('phone', 'P#1')]),
    contrib('cA', 'SB-PLR-A', [h('national_id', 'N#1'), h('phone', 'P#1')]),
  ];
  const a = JSON.stringify(engine.generateCandidates(ZA, input));
  const b = JSON.stringify(engine.generateCandidates(ZA, [...input].reverse()));
  assert.equal(a, b, 'input order does not affect output');
});

// ─── Immutability of evidence ────────────────────────────────────────────────

test('candidate + evidence are frozen (immutable)', () => {
  const res = engine.generateCandidates(ZA, [
    contrib('cA', 'SB-PLR-A', [h('national_id', 'N#1')]),
    contrib('cB', 'SB-PLR-B', [h('national_id', 'N#1')]),
  ]);
  assert.throws(() => { res.candidates[0].confidenceScore = 5; }, TypeError);
  assert.throws(() => { res.candidates[0].evidenceUsed.push({}); }, TypeError);
});

// ─── Invalid / empty input ───────────────────────────────────────────────────

test('empty and malformed input handled gracefully', () => {
  assert.equal(engine.generateCandidates(ZA, []).candidates.length, 0);
  // unknown attribute type is ignored (not in profile)
  const res = engine.generateCandidates(ZA, [
    contrib('cA', 'SB-PLR-A', [h('email', 'E#1')]),   // email not enabled in ZA
    contrib('cB', 'SB-PLR-B', [h('email', 'E#1')]),
  ]);
  assert.equal(res.candidates.length, 0);
});

// ─── Performance sanity (deterministic, not timing-asserted strictly) ────────

test('performance sanity: 600 players, one shared cluster of 4, completes fast', () => {
  const contribs = [];
  for (let i = 0; i < 600; i++) contribs.push(contrib(`c${i}`, `SB-PLR-${i}`, [h('national_id', `UNIQUE-${i}`)]));
  // a cluster of 4 sharing a phone
  for (const id of ['X1', 'X2', 'X3', 'X4']) contribs.push(contrib('cx', `SB-PLR-${id}`, [h('phone', 'CLUSTER')]));
  const t0 = Date.now();
  const res = engine.generateCandidates(ZA, contribs);
  const ms = Date.now() - t0;
  assert.equal(res.candidates.length, 6, '4 players → C(4,2)=6 candidates');
  assert.ok(ms < 1000, `matching should be fast (was ${ms}ms)`);
});

// ─── Service integration + boundary (no decision / SB-NAT / merge) ───────────

test('service gates matching by enablement and never decides/mints', () => {
  const off = new NationalIdentityFederationService({ config: defaultFederationConfig(), auditSink: new InMemoryAuditSink() });
  assert.throws(() => off.generateCandidates('ZA', []), FederationNotEnabledError);

  const cfg = resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' });
  const on = new NationalIdentityFederationService({ config: cfg, auditSink: new InMemoryAuditSink() });
  const res = on.generateCandidates('ZA', [
    contrib('cA', 'SB-PLR-A', [h('national_id', 'N#1')]),
    contrib('cB', 'SB-PLR-B', [h('national_id', 'N#1')]),
  ]);
  assert.equal(res.candidates.length, 1);
  // a candidate is not a decision: no tier / accepted / SB-NAT fields
  assert.equal(res.candidates[0].suggestedTier, undefined);
  assert.equal(res.candidates[0].sbNat, undefined);
  // the full pipeline is wired through Milestone 3.6 (policy engine factory present)
  assert.equal(typeof on.nationalPolicyEngine, 'function');
});
