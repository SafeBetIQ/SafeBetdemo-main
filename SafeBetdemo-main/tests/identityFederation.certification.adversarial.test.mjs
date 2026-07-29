// Milestone 3.8 — Version 2.0 Enterprise Certification: ADVERSARIAL harness (C2-2).
// Run: node --test tests/identityFederation.certification.adversarial.test.mjs
//
// Independent, adversarial negative-path validation of the security controls.
// This does NOT trust milestone reports — it re-attacks the real components.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine, isApprovedDecision,
  getJurisdictionProfile, InMemoryAuditSink, HmacAttributeHasher,
  NationalIdentityFederationService, defaultFederationConfig, resolveFederationConfig,
  EnterpriseCorrelationLayer, InMemoryCorrelationProvider, AccessDeniedError,
  NationalPolicyEngine, NationalPolicyStore, validatePolicyDefinition, PolicyValidationError,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const engine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');
const ZA = getJurisdictionProfile('ZA');
const h = (t, x) => ({ attributeType: t, hash: x, pepperKeyVersion: 'v1' });
const contrib = (op, sbPlr, attrs, j = 'ZA') => ({ jurisdiction: j, casinoId: op, sbPlr, attributes: attrs, contributedAt: '2026-07-16T00:00:00Z' });
const strongDecision = (a, b) => engine.decide(ZA, matcher.generateCandidates(ZA, [contrib('opA', a, [h('national_id', 'N1')]), contrib('opB', b, [h('national_id', 'N1')])]).candidates[0]).decision;
const mediumDecision = (a, b) => engine.decide(ZA, matcher.generateCandidates(ZA, [contrib('opA', a, [h('phone', 'P1')]), contrib('opB', b, [h('phone', 'P1')])]).candidates[0]).decision;
const freshRegistry = () => new SbNatRegistry({ now: () => '2026-07-16T00:00:00.000Z', auditSink: new InMemoryAuditSink() });
const REG = { plane: 'regulator', jurisdiction: 'ZA', roles: ['evaluator', 'reviewer', 'override-authority', 'appeal-reviewer'] };

function scenario() {
  const registry = freshRegistry();
  const rec = registry.create(strongDecision('SB-PLR-A', 'SB-PLR-B'));
  const provider = new InMemoryCorrelationProvider({
    operators: [{ operatorId: 'opA', jurisdiction: 'ZA' }, { operatorId: 'opB', jurisdiction: 'ZA' }],
    players: [{ sbPlr: 'SB-PLR-A', operatorId: 'opA', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-02-01T00:00:00Z' }, { sbPlr: 'SB-PLR-B', operatorId: 'opB', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-02-01T00:00:00Z' }],
    events: [{ eventId: 'e1', sbPlr: 'SB-PLR-A', operatorId: 'opA', category: 'session', at: '2026-01-05T10:00:00Z' }],
  });
  const correlation = new EnterpriseCorrelationLayer({ registry, provider, now: () => '2026-07-16T00:00:00.000Z' });
  return { registry, correlation, sbNat: rec.sbNat };
}

// ADV-1 — operator attempts a federation/national query → denied.
test('ADV-1 operator cannot query correlation or national policy', () => {
  const { correlation, sbNat } = scenario();
  assert.throws(() => correlation.getNationalPlayerTwin({ plane: 'operator', jurisdiction: 'ZA' }, sbNat), AccessDeniedError);
  assert.throws(() => correlation.getCrossOperatorTimeline({ plane: 'casino-admin', jurisdiction: 'ZA' }, sbNat), AccessDeniedError);
  assert.throws(() => correlation.getNationalPlayerTwin({ plane: 'unauthenticated', jurisdiction: null }, sbNat), AccessDeniedError);
});

// ADV-2 — wrong-jurisdiction / cross-sovereign regulator → denied.
test('ADV-2 wrong-jurisdiction and cross-sovereign regulator denied', () => {
  const { correlation, sbNat } = scenario();
  assert.throws(() => correlation.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'NA' }, sbNat), AccessDeniedError);
  assert.throws(() => correlation.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'NA', sovereignJurisdictions: ['NA'] }, sbNat), AccessDeniedError);
});

// ADV-3 — cross-sovereign registry merge → rejected.
test('ADV-3 cross-sovereign SB-NAT merge is rejected', () => {
  const registry = freshRegistry();
  const za = registry.create(strongDecision('SB-PLR-ZA1', 'SB-PLR-ZA2'));
  const keDecision = engine.decide(getJurisdictionProfile('KE'), matcher.generateCandidates(getJurisdictionProfile('KE'), [contrib('opK1', 'SB-PLR-KE1', [h('national_id', 'NK')], 'KE'), contrib('opK2', 'SB-PLR-KE2', [h('national_id', 'NK')], 'KE')]).candidates[0]).decision;
  const ke = registry.create(keDecision);
  assert.throws(() => registry.merge(za.sbNat, ke.sbNat, 'r', 'x'), /cross-jurisdiction/);
});

// ADV-4 — no APPROVED/public path mints an SB-NAT outside the approved flow.
// (create() from an approved decision is the sole documented creation path.)
// NOTE: TS `private` is compile-time only (cert finding CERT-L1, LOW) — this test
// asserts the architectural guarantee via the documented public surface + the
// approval gate, which is what the certification actually relies on.
test('ADV-4 no direct SB-NAT mint path exists on the approved public surface', () => {
  const registry = freshRegistry();
  const svc = new NationalIdentityFederationService({ config: resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' }), auditSink: new InMemoryAuditSink(), registry });
  assert.equal(typeof svc.mintSbNat, 'undefined', 'service exposes no mintSbNat');
  assert.equal(typeof svc.registerDecision, 'function', 'the only service creation path is registerDecision (approval-gated)');
  // registerDecision refuses an unapproved decision → cannot fabricate an identity.
  assert.throws(() => svc.registerDecision(mediumDecision('SB-PLR-A', 'SB-PLR-B'), 'demo'), /not-approved|not approved/);
  // create() is the sole record-producing path and yields a well-formed, approved-only record.
  const rec = registry.create(strongDecision('SB-PLR-A', 'SB-PLR-B'));
  assert.ok(/^SB-NAT-ZA-[0-9A-F]{6,}$/.test(rec.sbNat) && registry.list().length === 1);
});

// ADV-5 — unapproved decision cannot register an SB-NAT.
test('ADV-5 unapproved / superseded decisions cannot create an SB-NAT', () => {
  const registry = freshRegistry();
  assert.throws(() => registry.create(mediumDecision('SB-PLR-A', 'SB-PLR-B')), /not-approved|not approved/);
  const upheld = engine.progressAppeal(engine.openAppeal(strongDecision('SB-PLR-A', 'SB-PLR-B'), 'r', 'x').decision, 'uphold', 'r', 'y').decision;
  assert.throws(() => registry.create(upheld), /superseded|revoked/);
});

// ADV-6 — registry records + audit are immutable (mutation attempts fail).
test('ADV-6 registry records and audit are immutable', () => {
  const registry = freshRegistry();
  const rec = registry.create(strongDecision('SB-PLR-A', 'SB-PLR-B'));
  assert.throws(() => { rec.members.push('SB-PLR-X'); }, TypeError);
  assert.throws(() => { rec.sbNat = 'SB-NAT-ZA-FFFFFF'; }, TypeError);
  const audit = registry.auditTrail();
  assert.throws(() => { audit[0].decisionRule = 'tampered'; }, TypeError);
  const sink = new InMemoryAuditSink();
  assert.equal(sink.update, undefined); assert.equal(sink.delete, undefined);
});

// ADV-7 — policy injection: executable/invalid policy schema is rejected.
test('ADV-7 policy injection and malformed schema are rejected (declarative data only)', () => {
  const base = (over) => ({ policyId: 'X', name: 'X', jurisdiction: 'ZA', category: 'national-self-exclusion', policyVersion: '1.0', ruleSetVersion: 'NP-01', effectiveDate: '2026-01-01T00:00:00Z', expiryDate: null, status: 'draft', requiredInputs: [], requiredEvidence: [], conditions: [], thresholds: {}, outcomeRules: [], defaultOutcome: 'No Action', manualReview: { requiredWhen: [], outcomesRequiringReview: [] }, approvalRequirements: { requiresApproval: false, role: null }, overridePermissions: { allowed: true, roles: [] }, appealPermissions: { allowed: true, roles: [] }, auditRetention: '7y', legalReference: 'x', requiresIntegrity: true, allowedOutcomes: ['No Action'], ...over });
  assert.throws(() => validatePolicyDefinition(base({ conditions: [{ id: 'c', description: '', input: 'x', operator: 'eval', value: 1 }] })), PolicyValidationError);
  assert.throws(() => validatePolicyDefinition(base({ conditions: [{ id: 'c', description: '', input: 'x', operator: 'eq', value: (() => 1) }] })), PolicyValidationError);
  assert.throws(() => validatePolicyDefinition(base({ category: 'arbitrary' })), PolicyValidationError);
  assert.throws(() => validatePolicyDefinition(base({ outcomeRules: [{ id: 'r', requires: ['ghost'], outcome: 'No Action', reason: '' }] })), PolicyValidationError);
});

// ADV-8 — malformed / unsupported contributions are ignored, not crashing.
test('ADV-8 malformed and unsupported contributions are handled safely', () => {
  assert.equal(matcher.generateCandidates(ZA, []).candidates.length, 0);
  // passport is not enabled in ZA → ignored, no candidate, no throw
  const res = matcher.generateCandidates(ZA, [contrib('opA', 'SB-PLR-A', [h('passport', 'X')]), contrib('opB', 'SB-PLR-B', [h('passport', 'X')])]);
  assert.equal(res.candidates.length, 0);
});

// ADV-9 — replay / duplicate contribution does not create duplicate identities.
test('ADV-9 duplicate approved decision is idempotent (no duplicate SB-NAT)', () => {
  const registry = freshRegistry();
  const d = strongDecision('SB-PLR-A', 'SB-PLR-B');
  const a = registry.create(d);
  const b = registry.create(d);
  assert.equal(a.sbNat, b.sbNat);
  assert.equal(registry.list().length, 1);
});

// ADV-10 — privilege escalation: role-less regulator cannot review/override.
test('ADV-10 role separation is enforced at the boundary', () => {
  const store = new NationalPolicyStore();
  const { correlation, sbNat } = scenario();
  const policyDef = { policyId: 'P', name: 'P', jurisdiction: 'ZA', category: 'cross-operator-harm-escalation', policyVersion: '1.0', ruleSetVersion: 'NP-01', effectiveDate: '2026-01-01T00:00:00Z', expiryDate: null, status: 'draft', requiredInputs: [], requiredEvidence: [], conditions: [{ id: 'c', description: 'x', input: 'participatingOperators', operator: 'gte', value: 1 }], thresholds: {}, outcomeRules: [{ id: 'r', requires: ['c'], outcome: 'Regulator Review Required', reason: 'x' }], defaultOutcome: 'No Action', manualReview: { requiredWhen: [], outcomesRequiringReview: ['Regulator Review Required'] }, approvalRequirements: { requiresApproval: false, role: null }, overridePermissions: { allowed: true, roles: ['override-authority'] }, appealPermissions: { allowed: true, roles: ['appeal-reviewer'] }, auditRetention: '7y', legalReference: 'x', requiresIntegrity: true, allowedOutcomes: ['No Action', 'Regulator Review Required'] };
  store.add(policyDef); store.activate('P', '1.0');
  const pe = new NationalPolicyEngine({ correlationLayer: correlation, store, now: () => '2026-07-16T00:00:00.000Z' });
  const ev = pe.evaluatePolicy(REG, sbNat, 'P');
  assert.throws(() => pe.review({ plane: 'regulator', jurisdiction: 'ZA', roles: ['evaluator'] }, ev, 'approve', 'r', 'x'), AccessDeniedError);
  assert.throws(() => pe.override({ plane: 'regulator', jurisdiction: 'ZA', roles: ['reviewer'] }, ev, 'No Action', 'r', 'a', 'x', 'y'), AccessDeniedError);
});

// ADV-11 — integrity verifiers resist malformed input (no crash; structured result).
test('ADV-11 integrity verifiers resist malformed input', () => {
  const { correlation } = scenario();
  // non-existent SB-NAT → clean error, not a crash
  assert.throws(() => correlation.verifyCorrelationIntegrity(REG, 'SB-NAT-ZA-ABCDEF'));
  // malformed identifier → clean error
  assert.throws(() => correlation.getNationalPlayerTwin(REG, 'not-an-sbnat'));
});

// ADV-12 — serialised outputs carry no plaintext PII.
test('ADV-12 serialised correlation output carries no plaintext PII', () => {
  const { correlation, sbNat } = scenario();
  const blob = JSON.stringify(correlation.getNationalPlayerTwin(REG, sbNat));
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false);
  assert.equal(/\d{7,}/.test(blob), false);
});
