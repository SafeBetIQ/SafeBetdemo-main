// Milestone 3.6 — National Policy Platform Extension (v2.0, ADR-006).
// Run: node --test tests/identityFederation.policy.test.mjs
//
// Proves configuration-driven (policy-as-data), deterministic, jurisdiction-
// specific national policy evaluation over read-only Correlation Layer outputs:
// self-exclusion / cooling-off / harm-escalation / investigation-trigger /
// notification / intervention-threshold policies, full explainability, manual
// review + override + appeal governance, conflict detection, policy integrity,
// role-based deny-by-default access, and no operator-runtime mutation.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine,
  getJurisdictionProfile, InMemoryAuditSink,
  EnterpriseCorrelationLayer, InMemoryCorrelationProvider, AccessDeniedError,
  NationalPolicyEngine, NationalPolicyStore, PolicyValidationError, PolicyEngineError,
  validatePolicyDefinition, POLICY_OUTCOMES, NATIONAL_POLICY_ENGINE_VERSION,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const decisionEngine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');
const FIXED = () => '2026-07-16T00:00:00.000Z';
const ROLES = ['evaluator', 'reviewer', 'override-authority', 'appeal-reviewer'];
const REG = { plane: 'regulator', jurisdiction: 'ZA', roles: ROLES };

const h = (t, x) => ({ attributeType: t, hash: x, pepperKeyVersion: 'v1' });
const contrib = (casinoId, sbPlr, attrs, j = 'ZA') => ({ jurisdiction: j, casinoId, sbPlr, attributes: attrs, contributedAt: '2026-07-16T00:00:00Z' });
function orderedClock(s = 1_700_000_000_000) { let t = 0; return () => new Date(s + (t++) * 1000).toISOString(); }
function approved(p1, opA, p2, opB, nid = 'N1', j = 'ZA') {
  const profile = getJurisdictionProfile(j);
  const c = matcher.generateCandidates(profile, [contrib(opA, p1, [h('national_id', nid)], j), contrib(opB, p2, [h('national_id', nid)], j)]).candidates[0];
  return decisionEngine.decide(profile, c).decision;
}

// Base ZA scenario: 2 operators, active self-exclusion + conflicting activity,
// escalating risk (low→high), a loss, an intervention, an investigation ref.
function seed(extra = {}) {
  return {
    operators: [{ operatorId: 'op-A', jurisdiction: 'ZA' }, { operatorId: 'op-B', jurisdiction: 'ZA' }],
    players: [
      { sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-03-01T00:00:00Z' },
      { sbPlr: 'SB-PLR-B', operatorId: 'op-B', jurisdiction: 'ZA', firstObservedAt: '2026-02-01T00:00:00Z', lastObservedAt: '2026-04-01T00:00:00Z' },
    ],
    events: [
      { eventId: 'e1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'session', at: '2026-01-05T10:00:00Z' },
      { eventId: 'e2', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'deposit', at: '2026-01-05T11:00:00Z' },
      { eventId: 'e3', sbPlr: 'SB-PLR-B', operatorId: 'op-B', category: 'wager', at: '2026-02-10T09:00:00Z' },
      { eventId: 'e4', sbPlr: 'SB-PLR-B', operatorId: 'op-B', category: 'loss', at: '2026-02-10T09:30:00Z' },
    ],
    risks: [
      { riskId: 'r1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', at: '2026-01-05T12:00:00Z', tier: 'low' },
      { riskId: 'r2', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-10T10:00:00Z', tier: 'high' },
    ],
    interventions: [{ interventionId: 'i1', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-11T00:00:00Z', type: 'reality-check', outcome: 'acknowledged' }],
    selfExclusions: [{ exclusionId: 'x1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', kind: 'self-exclusion', startAt: '2026-01-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z', status: 'active' }],
    compliance: [], investigations: [{ investigationId: 'v1', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-12T00:00:00Z', ref: 'INV-9' }], twins: [],
    ...extra,
  };
}

function scenario(seedOverride) {
  const registry = new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });
  const rec = registry.create(approved('SB-PLR-A', 'op-A', 'SB-PLR-B', 'op-B'));
  const provider = new InMemoryCorrelationProvider(seedOverride ?? seed());
  const correlationLayer = new EnterpriseCorrelationLayer({ registry, provider, now: FIXED });
  const store = new NationalPolicyStore();
  const engine = new NationalPolicyEngine({ correlationLayer, store, now: FIXED });
  return { registry, provider, correlationLayer, store, engine, sbNat: rec.sbNat };
}

function mkPolicy(o = {}) {
  return {
    policyId: o.policyId ?? 'POL-1', name: o.name ?? 'Test Policy', jurisdiction: o.jurisdiction ?? 'ZA',
    category: o.category ?? 'national-self-exclusion', policyVersion: o.policyVersion ?? '1.0', ruleSetVersion: o.ruleSetVersion ?? 'NP-01',
    effectiveDate: o.effectiveDate ?? '2026-01-01T00:00:00Z', expiryDate: o.expiryDate ?? null, status: 'draft',
    requiredInputs: o.requiredInputs ?? [], requiredEvidence: o.requiredEvidence ?? [], conditions: o.conditions ?? [],
    thresholds: o.thresholds ?? {}, outcomeRules: o.outcomeRules ?? [], defaultOutcome: o.defaultOutcome ?? 'No Action',
    manualReview: o.manualReview ?? { requiredWhen: [], outcomesRequiringReview: [] },
    approvalRequirements: o.approvalRequirements ?? { requiresApproval: false, role: null },
    overridePermissions: o.overridePermissions ?? { allowed: true, roles: ['override-authority'] },
    appealPermissions: o.appealPermissions ?? { allowed: true, roles: ['appeal-reviewer'] },
    auditRetention: o.auditRetention ?? '7y', legalReference: o.legalReference ?? 'NGB-1',
    requiresIntegrity: o.requiresIntegrity ?? true, allowedOutcomes: o.allowedOutcomes ?? [...POLICY_OUTCOMES],
  };
}
function activate(store, def) { store.add(def); return store.activate(def.policyId, def.policyVersion); }

// ─── Architecture boundaries ─────────────────────────────────────────────────

test('policy evaluation modifies nothing and exposes no matching/decision/mint', () => {
  const { registry, store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ conditions: [{ id: 'c', description: 'active SE', input: 'activeSelfExclusions', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'National Self-Exclusion Confirmed', reason: 'active' }] }));
  const before = JSON.stringify(registry.diagnostics());
  engine.evaluatePolicy(REG, sbNat, 'POL-1');
  assert.equal(JSON.stringify(registry.diagnostics()), before, 'registry unchanged');
  assert.equal(registry.list().length, 1, 'no SB-NAT created');
  for (const m of ['generateCandidates', 'decide', 'mint', 'create', 'split', 'merge'])
    assert.equal(typeof engine[m], 'undefined', `policy engine must not expose ${m}`);
});

// ─── Policy configuration (policy-as-data) ───────────────────────────────────

test('valid policy loads; invalid policy is rejected by strict schema validation', () => {
  const store = new NationalPolicyStore();
  assert.doesNotThrow(() => activate(store, mkPolicy()));
  assert.throws(() => validatePolicyDefinition(mkPolicy({ category: 'nonsense' })), PolicyValidationError);
  assert.throws(() => validatePolicyDefinition(mkPolicy({ conditions: [{ id: 'c', description: '', input: 'x', operator: 'MAGIC' }] })), PolicyValidationError);
  assert.throws(() => validatePolicyDefinition(mkPolicy({ outcomeRules: [{ id: 'r', requires: ['missing'], outcome: 'No Action', reason: '' }] })), PolicyValidationError);
});

test('activated policy is immutable; changes require a new version (version replacement)', () => {
  const store = new NationalPolicyStore();
  const v1 = activate(store, mkPolicy({ policyVersion: '1.0' }));
  assert.throws(() => { v1.name = 'x'; }, TypeError);
  assert.throws(() => store.add(mkPolicy({ policyVersion: '1.0' })), PolicyValidationError, 're-adding a version is rejected');
  activate(store, mkPolicy({ policyVersion: '2.0' }));
  assert.equal(store.getActive('POL-1').policyVersion, '2.0');
  assert.equal(store.get('POL-1', '1.0').status, 'retired', 'prior version auto-retired');
});

test('effective/expiry windows and jurisdiction isolation are enforced by the store', () => {
  const store = new NationalPolicyStore();
  activate(store, mkPolicy({ policyId: 'ZA-1', jurisdiction: 'ZA', effectiveDate: '2026-01-01T00:00:00Z', expiryDate: '2026-12-31T00:00:00Z' }));
  activate(store, mkPolicy({ policyId: 'KE-1', jurisdiction: 'KE' }));
  assert.equal(store.getActive('ZA-1', '2025-06-01T00:00:00Z'), undefined, 'before effective date');
  assert.ok(store.getActive('ZA-1', '2026-06-01T00:00:00Z'));
  assert.deepEqual(store.listActive('ZA').map((p) => p.policyId), ['ZA-1']);
  assert.deepEqual(store.listActive('KE').map((p) => p.policyId), ['KE-1']);
});

test('a policy cannot evaluate another jurisdiction’s identity', () => {
  const { store, engine, sbNat } = scenario();          // ZA SB-NAT
  activate(store, mkPolicy({ jurisdiction: 'KE', policyId: 'KE-P' }));
  // A KE regulator is access-denied for a ZA identity...
  assert.throws(() => engine.evaluatePolicy({ plane: 'regulator', jurisdiction: 'KE', roles: ROLES }, sbNat, 'KE-P'), AccessDeniedError);
  // ...and even a dual-sovereign regulator is stopped by the engine's own jurisdiction guard.
  const dual = { plane: 'regulator', jurisdiction: 'KE', roles: ROLES, sovereignJurisdictions: ['KE', 'ZA'] };
  assert.throws(() => engine.evaluatePolicy(dual, sbNat, 'KE-P'), PolicyEngineError);
});

// ─── National self-exclusion policy ──────────────────────────────────────────

test('national self-exclusion: active exclusion + conflicting activity → investigation (review required)', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({
    policyId: 'SE', category: 'national-self-exclusion',
    conditions: [
      { id: 'active', description: 'active self-exclusion', input: 'activeSelfExclusions', operator: 'gte', value: 1 },
      { id: 'conflict', description: 'conflicting activity', input: 'selfExclusionConflictingActivity', operator: 'gte', value: 1 },
    ],
    outcomeRules: [
      { id: 'r1', requires: ['active', 'conflict'], outcome: 'National Investigation Recommended', reason: 'activity during active exclusion' },
      { id: 'r2', requires: ['active'], outcome: 'National Self-Exclusion Confirmed', reason: 'active exclusion' },
    ],
    manualReview: { requiredWhen: [], outcomesRequiringReview: ['National Investigation Recommended'] },
  }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'SE');
  assert.equal(ev.outcome, 'National Investigation Recommended');
  assert.equal(ev.reviewState, 'pending-review');
  assert.deepEqual(ev.conditionsPassed, ['active', 'conflict']);
});

test('national self-exclusion: expired-only exclusion → default outcome', () => {
  const { store, engine, sbNat } = scenario(seed({
    selfExclusions: [{ exclusionId: 'x9', sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', kind: 'self-exclusion', startAt: '2025-01-01T00:00:00Z', endAt: '2025-06-01T00:00:00Z', status: 'expired' }],
  }));
  activate(store, mkPolicy({ policyId: 'SE', conditions: [{ id: 'active', description: 'x', input: 'activeSelfExclusions', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['active'], outcome: 'National Self-Exclusion Confirmed', reason: 'x' }], defaultOutcome: 'No Action' }));
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'SE').outcome, 'No Action');
});

test('insufficient evidence when a required input is unavailable', () => {
  const noRisk = scenario(seed({ risks: [] }));           // currentRiskTier → null
  activate(noRisk.store, mkPolicy({ policyId: 'RQ', requiredInputs: ['currentRiskTier'], conditions: [{ id: 'c', description: 'x', input: 'currentRiskTier', operator: 'eq', value: 'high' }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Operator Notification Required', reason: 'x' }] }));
  assert.equal(noRisk.engine.evaluatePolicy(REG, noRisk.sbNat, 'RQ').outcome, 'Insufficient Evidence');
});

// ─── Cooling-off policy ──────────────────────────────────────────────────────

test('cooling-off: active cooling-off period → national cooling-off recommended', () => {
  const { store, engine, sbNat } = scenario(seed({
    selfExclusions: [
      { exclusionId: 'x1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', kind: 'cooling-off', startAt: '2026-02-01T00:00:00Z', endAt: '2026-02-20T00:00:00Z', status: 'active' },
    ],
  }));
  activate(store, mkPolicy({ policyId: 'CO', category: 'national-cooling-off', thresholds: { minCoolingOff: 1 }, conditions: [{ id: 'c', description: 'cooling-off present', input: 'coolingOffPeriods', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'National Cooling-Off Recommended', reason: 'active cooling-off' }] }));
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'CO').outcome, 'National Cooling-Off Recommended');
});

// ─── Harm escalation policy ──────────────────────────────────────────────────

test('harm escalation: deterministic threshold evaluation across outcomes', () => {
  const def = mkPolicy({
    policyId: 'HE', category: 'cross-operator-harm-escalation', thresholds: { minOperators: 2 },
    conditions: [
      { id: 'multi', description: '>=2 operators', input: 'participatingOperators', operator: 'gte', value: 2 },
      { id: 'esc', description: 'risk escalating', input: 'riskEscalating', operator: 'isTrue' },
      { id: 'harm', description: 'loss indicators', input: 'repeatedHarmIndicators', operator: 'gte', value: 1 },
    ],
    outcomeRules: [
      { id: 'r3', requires: ['multi', 'esc', 'harm'], outcome: 'Cross-Operator Escalation Required', reason: 'multi-operator escalation with harm' },
      { id: 'r2', requires: ['multi', 'esc'], outcome: 'Regulator Review Required', reason: 'multi-operator escalation' },
    ],
    defaultOutcome: 'Continue Monitoring',
  });
  const full = scenario(); activate(full.store, def);
  assert.equal(full.engine.evaluatePolicy(REG, full.sbNat, 'HE').outcome, 'Cross-Operator Escalation Required');

  // No escalation: single operator, no risk → default
  const calm = scenario(seed({ operators: [{ operatorId: 'op-A', jurisdiction: 'ZA' }], players: [{ sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-01-02T00:00:00Z' }, { sbPlr: 'SB-PLR-B', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-01-02T00:00:00Z' }], events: [], risks: [], interventions: [], selfExclusions: [], investigations: [] }));
  activate(calm.store, def);
  assert.equal(calm.engine.evaluatePolicy(REG, calm.sbNat, 'HE').outcome, 'Continue Monitoring');
});

// ─── Investigation trigger + notification + intervention threshold ───────────

test('investigation trigger fires on behaviour escalation; notification + intervention policies evaluate', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'IT', category: 'national-investigation-trigger', conditions: [{ id: 'beh', description: 'behaviour escalation', input: 'behaviourEscalation', operator: 'isTrue' }], outcomeRules: [{ id: 'r', requires: ['beh'], outcome: 'National Investigation Recommended', reason: 'behaviour escalation' }] }));
  activate(store, mkPolicy({ policyId: 'NT', category: 'regulator-notification', conditions: [{ id: 'hi', description: 'risk high', input: 'currentRiskTier', operator: 'eq', value: 'high' }], outcomeRules: [{ id: 'r', requires: ['hi'], outcome: 'Operator Notification Required', reason: 'high national risk' }] }));
  activate(store, mkPolicy({ policyId: 'IV', category: 'cross-operator-intervention-threshold', conditions: [{ id: 'iv', description: 'interventions present', input: 'interventionCount', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['iv'], outcome: 'Intervention Review Required', reason: 'prior interventions' }] }));
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'IT').outcome, 'National Investigation Recommended');
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'NT').outcome, 'Operator Notification Required');
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'IV').outcome, 'Intervention Review Required');
});

test('data integrity failure short-circuits the outcome', () => {
  // SB-PLR-B has no player reference → correlation integrity fails
  const { store, engine, sbNat } = scenario(seed({ players: [{ sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-03-01T00:00:00Z' }] }));
  activate(store, mkPolicy({ policyId: 'HE', requiresIntegrity: true, conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Continue Monitoring', reason: 'x' }] }));
  assert.equal(engine.evaluatePolicy(REG, sbNat, 'HE').outcome, 'Data Integrity Failure');
});

// ─── Explainability ──────────────────────────────────────────────────────────

test('every evaluation is fully explainable, versioned (9-part) and deterministic', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'EX', thresholds: { t: 2 }, conditions: [
    { id: 'p', description: 'pass', input: 'participatingOperators', operator: 'gte', value: 2 },
    { id: 'f', description: 'fail', input: 'participatingOperators', operator: 'gt', value: 9 },
    { id: 's', description: 'skip', input: 'unknownFact', operator: 'exists' },
  ], outcomeRules: [{ id: 'r', requires: ['p'], outcome: 'Continue Monitoring', reason: 'ok' }] }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'EX');
  assert.deepEqual(ev.conditionsPassed, ['p']);
  assert.deepEqual(ev.conditionsFailed, ['f']);
  assert.deepEqual(ev.conditionsSkipped, ['s']);
  assert.equal(ev.conditionsEvaluated.length, 3);
  assert.deepEqual(ev.thresholdsUsed, { t: 2 });
  const v = ev.versions;
  for (const k of ['nationalPolicyEngineVersion', 'policyVersion', 'ruleSetVersion', 'jurisdictionVersion', 'correlationEngineVersion', 'federationAlgorithmVersion', 'matchingEngineVersion', 'decisionEngineVersion'])
    assert.ok(v[k], `missing version ${k}`);
  assert.equal(v.nationalPolicyEngineVersion, NATIONAL_POLICY_ENGINE_VERSION);
  assert.equal(JSON.stringify(ev.conditionsEvaluated), JSON.stringify(engine.evaluatePolicy(REG, sbNat, 'EX').conditionsEvaluated));
});

// ─── Manual review workflow (immutable) ──────────────────────────────────────

test('review workflow transitions are immutable and history-preserving', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'RV', conditions: [{ id: 'c', description: 'x', input: 'activeSelfExclusions', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Regulator Review Required', reason: 'x' }], manualReview: { requiredWhen: [], outcomesRequiringReview: ['Regulator Review Required'] } }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'RV');
  assert.equal(ev.reviewState, 'pending-review');
  const approved = engine.review(REG, ev, 'approve', 'regulator:r1', 'confirmed');
  assert.equal(approved.reviewState, 'approved');
  assert.equal(ev.reviewState, 'pending-review', 'original not mutated');
  assert.equal(approved.decisionHistory.length, 2);
  assert.throws(() => { approved.reviewState = 'x'; }, TypeError);
  // a not-required evaluation cannot be reviewed
  const naPolicy = activate(store, mkPolicy({ policyId: 'NR', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'No Action', reason: 'x' }] }));
  void naPolicy;
  const notReq = engine.evaluatePolicy(REG, sbNat, 'NR');
  assert.equal(notReq.reviewState, 'not-required');
  assert.throws(() => engine.review(REG, notReq, 'approve', 'r', 'x'), PolicyEngineError);
});

test('review requires the reviewer role (deny-by-default)', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'RV', conditions: [{ id: 'c', description: 'x', input: 'activeSelfExclusions', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Regulator Review Required', reason: 'x' }], manualReview: { requiredWhen: [], outcomesRequiringReview: ['Regulator Review Required'] } }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'RV');
  assert.throws(() => engine.review({ plane: 'regulator', jurisdiction: 'ZA', roles: ['evaluator'] }, ev, 'approve', 'r', 'x'), AccessDeniedError);
});

// ─── Override + appeal ───────────────────────────────────────────────────────

test('override records original + new and preserves history; unauthorised override denied', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'OV', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 2 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Cross-Operator Escalation Required', reason: 'x' }], overridePermissions: { allowed: true, roles: ['override-authority'] } }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'OV');
  const ov = engine.override(REG, ev, 'Regulator Review Required', 'regulator:chief', 'senior-authority', 'context re-assessed', 'DOC-7');
  assert.equal(ov.outcome, 'Regulator Review Required');
  assert.equal(ov.overrideStatus, 'overridden');
  assert.equal(ov.overrideHistory[0].from, 'Cross-Operator Escalation Required');
  assert.equal(ev.outcome, 'Cross-Operator Escalation Required', 'original preserved');
  assert.throws(() => engine.override({ plane: 'regulator', jurisdiction: 'ZA', roles: ['evaluator'] }, ev, 'No Action', 'r', 'a', 'x', 'y'), AccessDeniedError);
});

test('appeal lifecycle preserves complete history', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'AP', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Continue Monitoring', reason: 'x' }] }));
  let ev = engine.evaluatePolicy(REG, sbNat, 'AP');
  ev = engine.appeal(REG, ev, 'open', 'regulator:r1', 'subject disputes');
  assert.equal(ev.appealState, 'open');
  ev = engine.appeal(REG, ev, 'review', 'regulator:r2', 'reviewing');
  ev = engine.appeal(REG, ev, 'uphold', 'regulator:r2', 'insufficient basis');
  assert.equal(ev.appealState, 'upheld');
  assert.equal(ev.appealHistory.length, 3);
});

// ─── Conflict detection ──────────────────────────────────────────────────────

test('conflict detection flags incompatible outcomes, duplicate versions, and stale data', () => {
  const { engine } = scenario();
  const base = { jurisdiction: 'ZA', sbNat: 'SB-NAT-ZA-000001', integrityStatus: true, dataFreshness: '2026-03-01T00:00:00Z' };
  const conflicts = engine.detectConflicts([
    { ...base, evaluationId: 'e1', policyId: 'SE', policyVersion: '1.0', outcome: 'National Self-Exclusion Confirmed' },
    { ...base, evaluationId: 'e2', policyId: 'HE', policyVersion: '1.0', outcome: 'No Action' },
    { ...base, evaluationId: 'e3', policyId: 'SE', policyVersion: '2.0', outcome: 'Continue Monitoring' },
    { ...base, evaluationId: 'e4', policyId: 'DQ', policyVersion: '1.0', outcome: 'Continue Monitoring', integrityStatus: false },
  ]);
  const kinds = conflicts.map((c) => c.kind);
  assert.ok(kinds.includes('incompatible-outcomes'));
  assert.ok(kinds.includes('duplicate-active-policy'));
  assert.ok(kinds.includes('stale-or-incomplete-data'));
  for (const c of conflicts) assert.equal(c.recommendedOutcome, 'Policy Conflict Detected');
});

// ─── Security + audit ────────────────────────────────────────────────────────

test('deny-by-default: operators and wrong-jurisdiction regulators are denied; no PII in output', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'S', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 1 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Continue Monitoring', reason: 'x' }] }));
  assert.throws(() => engine.evaluatePolicy({ plane: 'operator', jurisdiction: 'ZA', roles: ROLES }, sbNat, 'S'), AccessDeniedError);
  assert.throws(() => engine.evaluatePolicy({ plane: 'regulator', jurisdiction: 'NA', roles: ROLES }, sbNat, 'S'), AccessDeniedError);
  assert.throws(() => engine.evaluatePolicy({ plane: 'regulator', jurisdiction: 'ZA', roles: [] }, sbNat, 'S'), AccessDeniedError);
  const ev = engine.evaluatePolicy(REG, sbNat, 'S');
  const blob = JSON.stringify(ev);
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false);
  assert.equal(/\d{7,}/.test(blob), false);
  assert.ok(engine.auditTrail().length >= 1, 'append-only policy audit recorded');
});

// ─── Policy integrity ────────────────────────────────────────────────────────

test('policy integrity verifier passes on a valid evaluation and is reproducible', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'PI', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 2 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Continue Monitoring', reason: 'x' }] }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'PI');
  const report = engine.verifyPolicyIntegrity(REG, ev);
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((c) => !c.passed)));
  assert.equal(report.reproducible, true);
});

test('policy integrity detects a missing (retired) policy', () => {
  const { store, engine, sbNat } = scenario();
  activate(store, mkPolicy({ policyId: 'PI', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 2 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Continue Monitoring', reason: 'x' }] }));
  const ev = engine.evaluatePolicy(REG, sbNat, 'PI');
  // retiring removes the active version; the specific version still exists, so use a fresh store to simulate absence
  const orphan = new NationalPolicyEngine({ correlationLayer: scenario().correlationLayer, store: new NationalPolicyStore(), now: FIXED });
  const report = orphan.verifyPolicyIntegrity(REG, ev);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((c) => c.name === 'policy-exists').passed, false);
});

// ─── Performance (deterministic, batch) ──────────────────────────────────────

test('performance: batch evaluation of many policies is bounded and deterministic', () => {
  const { store, engine, sbNat } = scenario();
  for (let i = 0; i < 50; i++) activate(store, mkPolicy({ policyId: `P-${i}`, category: 'cross-operator-harm-escalation', conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 2 }], outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Regulator Review Required', reason: 'x' }] }));
  const t0 = Date.now();
  const evals = engine.evaluateCategory(REG, sbNat, 'cross-operator-harm-escalation');
  const ms = Date.now() - t0;
  assert.equal(evals.length, 50);
  assert.ok(evals.every((e) => e.outcome === 'Regulator Review Required'));
  assert.ok(ms < 2000, `batch evaluation should be fast (was ${ms}ms)`);
  const again = engine.evaluateCategory(REG, sbNat, 'cross-operator-harm-escalation');
  assert.deepEqual(again.map((e) => e.outcome), evals.map((e) => e.outcome));
});
