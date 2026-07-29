// Milestone 3.3 — Federation Decision Engine (v2.0, ADR-006).
// Run: node --test tests/identityFederation.decision.test.mjs
//
// Proves policy-driven decisions (auto/review/reject), manual-review + appeal +
// override governance workflows, immutable audit, six-part version governance,
// determinism, explainability, and the boundary: decisions create NO SB-NAT.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IdentityMatchingEngine, FederationDecisionEngine, isApprovedDecision,
  getJurisdictionProfile, resolveFederationConfig, NationalIdentityFederationService,
  InMemoryAuditSink, MilestoneNotImplementedError,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const matcher = new IdentityMatchingEngine();
const engine = new FederationDecisionEngine(CLOCK);
const ZA = getJurisdictionProfile('ZA');

const h = (attributeType, hash) => ({ attributeType, hash, pepperKeyVersion: 'v1' });
const contrib = (casinoId, sbPlr, attributes, jurisdiction = 'ZA') =>
  ({ jurisdiction, casinoId, sbPlr, attributes, contributedAt: '2026-07-16T00:00:00Z' });
const oneCandidate = (profile, contribs) => matcher.generateCandidates(profile, contribs).candidates[0];

// ─── Decision outcomes (policy-driven) ───────────────────────────────────────

test('strong match (national_id) → auto-approved', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1')])]);
  const { decision } = engine.decide(ZA, c);
  assert.equal(decision.outcome, 'auto-approved');
  assert.equal(decision.reviewState, null);
  assert.ok(decision.rulesPassed.includes('DEC-AUTO-THRESHOLD'));
  assert.ok(isApprovedDecision(decision));
});

test('single medium match (phone 0.6) → manual-review (pending)', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('phone', 'P1')]), contrib('b', 'SB-PLR-B', [h('phone', 'P1')])]);
  const { decision } = engine.decide(ZA, c);
  assert.equal(decision.outcome, 'manual-review');
  assert.equal(decision.reviewState, 'pending-review');
  assert.ok(decision.rulesFailed.includes('DEC-AUTO-THRESHOLD'));
  assert.equal(isApprovedDecision(decision), false);
});

test('two medium attributes (KE phone+email = 1.2) → auto-approved without a strong id', () => {
  const KE = getJurisdictionProfile('KE');
  const c = oneCandidate(KE, [
    contrib('k1', 'SB-PLR-1', [h('phone', 'P'), h('email', 'E')], 'KE'),
    contrib('k2', 'SB-PLR-2', [h('phone', 'P'), h('email', 'E')], 'KE'),
  ]);
  assert.equal(engine.decide(KE, c).decision.outcome, 'auto-approved');
});

test('soft-only match forces manual review (mandatoryReviewIfOnlySoft)', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('device_fingerprint', 'D1')]), contrib('b', 'SB-PLR-B', [h('device_fingerprint', 'D1')])]);
  const { decision } = engine.decide(ZA, c);
  assert.equal(decision.outcome, 'manual-review');
  assert.ok(decision.rulesFailed.includes('DEC-NOT-SOFT-ONLY'));
});

test('rejected when below the review floor (policy-driven, no candidate hardcoding)', () => {
  const strictZA = { ...ZA, decision: { autoApproveMinScore: 1.0, manualReviewMinScore: 0.5, minMatchedAttributes: 1, mandatoryReviewIfOnlySoft: false } };
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('device_fingerprint', 'D1')]), contrib('b', 'SB-PLR-B', [h('device_fingerprint', 'D1')])]); // score 0.3
  const { decision } = engine.decide(strictZA, c);
  assert.equal(decision.outcome, 'rejected');
  assert.ok(decision.rulesFailed.includes('DEC-REVIEW-FLOOR'));
});

// ─── Explainability ──────────────────────────────────────────────────────────

test('every decision is fully explainable', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1'), h('phone', 'P1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1'), h('phone', 'P2')])]);
  const { decision } = engine.decide(ZA, c);
  assert.ok(decision.reason.length > 0);
  assert.equal(decision.rulesEvaluated.length, 4);
  assert.deepEqual(decision.evidenceAccepted.map(e => e.attributeType), ['national_id']);
  assert.deepEqual(decision.evidenceRejected.map(e => e.attributeType), ['phone']);
  // six-part version governance
  const v = decision.versions;
  assert.ok(v.federationAlgorithmVersion && v.matchingEngineVersion && v.decisionEngineVersion && v.matchingPolicyVersion && v.ruleSetVersion && v.jurisdictionVersion);
});

// ─── Determinism ─────────────────────────────────────────────────────────────

test('deterministic: same candidate → identical decision (fixed clock)', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1')])]);
  assert.equal(JSON.stringify(engine.decide(ZA, c).decision), JSON.stringify(engine.decide(ZA, c).decision));
});

// ─── Manual review workflow (immutable transitions) ──────────────────────────

test('manual review approve → new immutable decision, history appended, original untouched', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('phone', 'P1')]), contrib('b', 'SB-PLR-B', [h('phone', 'P1')])]);
  const { decision } = engine.decide(ZA, c);
  const { decision: reviewed } = engine.applyReview(decision, 'approve', 'regulator:r1', 'verified same individual');
  assert.equal(reviewed.reviewState, 'approved');
  assert.equal(reviewed.decisionHistory.length, 2);
  assert.equal(decision.reviewState, 'pending-review', 'original decision is not mutated');
  assert.ok(isApprovedDecision(reviewed));
  assert.throws(() => { reviewed.reviewState = 'x'; }, TypeError, 'immutable');
});

test('review states: return + escalate transition correctly', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('phone', 'P1')]), contrib('b', 'SB-PLR-B', [h('phone', 'P1')])]);
  const { decision } = engine.decide(ZA, c);
  assert.equal(engine.applyReview(decision, 'return', 'regulator:r1', 'need more evidence').decision.reviewState, 'returned');
  assert.equal(engine.applyReview(decision, 'escalate', 'regulator:r1', 'senior review').decision.reviewState, 'escalated');
  assert.throws(() => engine.applyReview(decision, 'bogus', 'r', 'x'), /invalid review action/);
});

// ─── Appeal workflow ─────────────────────────────────────────────────────────

test('appeal lifecycle open → under-review → upheld, history preserved', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1')])]);
  let d = engine.decide(ZA, c).decision;
  d = engine.openAppeal(d, 'regulator:r1', 'subject disputes link').decision;
  assert.equal(d.appealState, 'open');
  d = engine.progressAppeal(d, 'review', 'regulator:r2', 'reviewing').decision;
  assert.equal(d.appealState, 'under-review');
  d = engine.progressAppeal(d, 'uphold', 'regulator:r2', 'evidence insufficient').decision;
  assert.equal(d.appealState, 'upheld');
  assert.equal(d.appealHistory.length, 3);
});

// ─── Override workflow (never deletes history) ───────────────────────────────

test('regulator override records original + new and preserves history', () => {
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1')])]);
  const { decision } = engine.decide(ZA, c);      // auto-approved
  const { decision: overridden } = engine.applyOverride(decision, 'rejected', 'regulator:chief', 'known data-entry error');
  assert.equal(overridden.outcome, 'rejected');
  assert.equal(overridden.overrideStatus, 'overridden');
  assert.equal(overridden.overrideHistory.length, 1);
  assert.equal(overridden.overrideHistory[0].from, 'auto-approved');
  assert.equal(overridden.overrideHistory[0].to, 'rejected');
  assert.equal(decision.outcome, 'auto-approved', 'original preserved');
});

// ─── Immutable audit + service integration + NO SB-NAT ───────────────────────

test('service.decide appends immutable audit per candidate and creates NO SB-NAT', () => {
  const sink = new InMemoryAuditSink();
  const cfg = resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' });
  const svc = new NationalIdentityFederationService({ config: cfg, auditSink: sink, decisionEngine: engine });
  const cands = matcher.generateCandidates(ZA, [
    contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]),
    contrib('b', 'SB-PLR-B', [h('national_id', 'N1')]),
    contrib('c', 'SB-PLR-C', [h('phone', 'P1')]),
    contrib('d', 'SB-PLR-D', [h('phone', 'P1')]),
  ]).candidates;
  const { decisions, diagnostics } = svc.decide('ZA', cands);
  assert.equal(decisions.length, 2);
  assert.equal(diagnostics.autoApproved, 1);
  assert.equal(diagnostics.manualReview, 1);
  assert.equal(sink.count(), 2, 'one immutable audit per decision');
  // decisions carry no SB-NAT — the Registry (3.4) mints; this engine never does
  for (const d of decisions) assert.equal(d.sbNat, undefined);
  assert.equal(typeof svc.nationalPolicyEngine, 'function');   // full pipeline wired through 3.6
  // audit records are immutable
  assert.throws(() => { sink.list()[0].decisionRule = 'x'; }, TypeError);
});

test('audit sink remains append-only (no update/delete) across decisions', () => {
  const sink = new InMemoryAuditSink();
  assert.equal(sink.update, undefined);
  assert.equal(sink.delete, undefined);
  const c = oneCandidate(ZA, [contrib('a', 'SB-PLR-A', [h('national_id', 'N1')]), contrib('b', 'SB-PLR-B', [h('national_id', 'N1')])]);
  const r = engine.decide(ZA, c);
  sink.append(r.audit);
  assert.equal(sink.count(), 1);
});
