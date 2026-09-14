// SafeBet Guardian — Enforcement Policy & Authorisation (ARCH-V4-C8). Synthetic.
//   node --test tests/guardian/guardianAuthorisation.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  evaluatePolicyApplicability, evaluateAuthorisation, syntheticProposedAction, SYNTHETIC_POLICY_VERSIONS,
  GuardianAuthorisationWorker, AuthorisationPoisonMessageError, buildAuthPersistencePlan,
  toAuthorisedActionContract, isEligibleForOrchestration,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-11T00:00:00Z');
// distinct synthetic principals with a completed legal review + a human Authorising Officer.
const WHO = { investigatorId: 'syn-inv', legalReviewerId: 'syn-leg', legalReviewOutcome: 'SUFFICIENT_FOR_AUTHORISATION_REVIEW', authorisingOfficerId: 'syn-auth', authorisingOfficerRole: 'AUTHORISING_OFFICER', now: NOW };
const ev = (o) => evaluateAuthorisation(syntheticProposedAction(o), WHO);

test('scenario 1/10: active policy + verified evidence + legal review + distinct human authoriser → AUTHORISED (no external action)', () => {
  const d = ev();
  assert.equal(d.outcome, 'AUTHORISED'); assert.equal(d.authorisationStatus, 'AUTHORISED');
  assert.deepEqual(d.reasonCodes, []); assert.equal(d.authorisingOfficer, 'syn-auth');
  assert.ok(d.expiresAt); assert.equal(d.isEnforcementExecuted, false); assert.equal(d.isProviderNotified, false); assert.equal(d.isLegalDetermination, false);
});
test('scenario 2: expired policy → BLOCKED', () => {
  const d = ev({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0002-1'] });
  assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED'); assert.ok(d.reasonCodes.includes('POLICY_EXPIRED'));
});
test('scenario 3: superseded policy → BLOCKED (old version cannot authorise)', () => {
  const d = ev({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0003-1'] });
  assert.ok(d.reasonCodes.includes('POLICY_SUPERSEDED')); assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED');
});
test('scenario 4: evidence missing → BLOCKED', () => {
  assert.ok(ev({ evidence: [] }).reasonCodes.includes('EVIDENCE_MISSING'));
});
test('scenario 5: evidence INTEGRITY_FAILED → BLOCKED', () => {
  assert.ok(ev({ evidence: [{ evidenceReference: 'EV-REF-0001', integrityStatus: 'INTEGRITY_FAILED', jurisdiction: 'ZA-GP' }] }).reasonCodes.includes('EVIDENCE_INTEGRITY_FAILED'));
});
test('scenario 6: wrong-jurisdiction evidence → JURISDICTION_MISMATCH BLOCKED', () => {
  assert.ok(ev({ evidence: [{ evidenceReference: 'EV-REF-0100', integrityStatus: 'VERIFIED', jurisdiction: 'ZA-WC' }] }).reasonCodes.includes('JURISDICTION_MISMATCH'));
});
test('scenario 7: Investigator attempts final authorisation → DENIED', () => {
  const d = evaluateAuthorisation(syntheticProposedAction(), { ...WHO, authorisingOfficerId: 'syn-inv', authorisingOfficerRole: 'INVESTIGATOR' });
  assert.ok(d.reasonCodes.includes('AUTHORISER_NOT_PERMITTED')); assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED');
});
test('scenario 8: same principal as Investigator and Legal Reviewer → SOD_VIOLATION', () => {
  const d = evaluateAuthorisation(syntheticProposedAction(), { ...WHO, legalReviewerId: 'syn-inv' });
  assert.ok(d.reasonCodes.includes('SOD_VIOLATION'));
});
test('scenario 9: Legal Reviewer as Authorising Officer where SoD forbids → DENIED', () => {
  const d = evaluateAuthorisation(syntheticProposedAction(), { ...WHO, authorisingOfficerId: 'syn-leg', authorisingOfficerRole: 'LEGAL_REVIEWER' });
  assert.ok(d.reasonCodes.includes('AUTHORISER_NOT_PERMITTED') || d.reasonCodes.includes('SOD_VIOLATION'));
  assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED');
});
test('scenario 11: action type outside policy permission → DENIED', () => {
  const d = ev({ actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-REF-0001' });
  assert.ok(d.reasonCodes.includes('ACTION_TYPE_NOT_PERMITTED'));
});
test('scenario 12: policy exception MANUAL_ESCALATION_REQUIRED → BLOCKED/escalation', () => {
  const d = ev({ policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0004-1'] });
  assert.ok(d.reasonCodes.includes('POLICY_EXCEPTION_ESCALATION')); assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED');
});
test('scenario 13: authorised scope change → different scope snapshot (new authorisation required)', () => {
  const a = ev(); const b = ev({ targetReference: 'different-target-999.test' });
  assert.notEqual(a.scopeSnapshot.targetReference, b.scopeSnapshot.targetReference);
});
test('scenario 14/15: expiry + withdrawal → C9 eligibility false', () => {
  const d = ev(); const c = toAuthorisedActionContract(d, { authorisationReference: 'AUTH-1', authorityReference: 'SYN-AUTH-REF-0001', authorisedAt: NOW.toISOString() });
  assert.equal(isEligibleForOrchestration(c, NOW), true);
  assert.equal(isEligibleForOrchestration(c, new Date('2027-01-01T00:00:00Z')), false); // expired
  assert.equal(isEligibleForOrchestration({ ...c, status: 'WITHDRAWN' }, NOW), false);    // withdrawn
});
test('scenario 16: historical decision keeps its exact policy version id', () => {
  assert.equal(ev().policyVersionId, 'POLV-0001-1');
});
test('scenario 19: SYSTEM_SERVICE attempts final authorisation → DENIED (machine authorisation impossible)', () => {
  const d = evaluateAuthorisation(syntheticProposedAction(), { ...WHO, authorisingOfficerId: 'guardian-authorisation-worker', authorisingOfficerRole: 'SYSTEM_SERVICE' });
  assert.ok(d.reasonCodes.includes('AUTHORISER_NOT_PERMITTED')); assert.equal(d.outcome, 'AUTHORIZATION_BLOCKED');
});
test('scenario 20 + boundary: AUTHORISED never executes/notifies; module has NO outbound provider client', () => {
  assert.equal(ev().isEnforcementExecuted, false);
  const dir = new URL('../../products/guardian/src/authorisation/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/\bfetch\s*\(|node:http|node:https|axios|net\.connect|dns\.|nodemailer|\.send\s*\(/.test(src), `${f} must have no outbound/provider client`);
  }
});
test('worker: prepares proposed action, never authorises; idempotent; poison→error', () => {
  const w = new GuardianAuthorisationWorker();
  const m = { product: 'GUARDIAN', schemaVersion: 'c8', eventType: 'guardian.authorisation.evaluate', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), fixtureProposedActionRef: 'PA-VALID' };
  const a = w.process(m), b = w.process(m);
  assert.equal(a.result.machineAuthorisationBlocked, true);
  assert.ok(['READY_FOR_LEGAL_REVIEW', 'LEGAL_REVIEW_REQUIRED', 'DRAFT'].includes(a.result.preparedStatus));
  assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
  assert.throws(() => w.process({ ...m, idempotencyKey: 'k2', fixtureProposedActionRef: 'REAL-ACTION' }), AuthorisationPoisonMessageError);
});
test('worker persistence: proposed_action + history only (no legal_review/authorisation rows)', () => {
  const w = new GuardianAuthorisationWorker();
  const out = w.process({ product: 'GUARDIAN', schemaVersion: 'c8', eventType: 'guardian.authorisation.evaluate', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk1', occurredAt: NOW.toISOString(), fixtureProposedActionRef: 'PA-VALID' });
  const plan = buildAuthPersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk1', prepared: out.result });
  const tables = plan.rows.map((r) => r.table);
  assert.ok(tables.includes('proposed_action') && tables.includes('proposed_action_history'));
  assert.ok(!tables.includes('action_authorisation') && !tables.includes('legal_review'));
});
test('applicability: active→REQUIRES_LEGAL_REVIEW; expired→EXPIRED; wrong-jur→NOT_APPLICABLE', () => {
  const p = SYNTHETIC_POLICY_VERSIONS['POLV-0001-1'];
  assert.equal(evaluatePolicyApplicability(p, { jurisdiction: 'ZA-GP', actionType: 'DOMAIN_BLOCK', now: NOW }), 'REQUIRES_LEGAL_REVIEW');
  assert.equal(evaluatePolicyApplicability(SYNTHETIC_POLICY_VERSIONS['POLV-0002-1'], { jurisdiction: 'ZA-GP', actionType: 'DOMAIN_BLOCK', now: NOW }), 'EXPIRED');
  assert.equal(evaluatePolicyApplicability(p, { jurisdiction: 'ZA-WC', actionType: 'DOMAIN_BLOCK', now: NOW }), 'NOT_APPLICABLE');
});
