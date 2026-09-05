// SafeBet Guardian — foundation behaviour (ARCH-V4-C0). Synthetic only.
//   node --test tests/guardian/guardianFoundation.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  GUARDIAN_PRODUCT, GUARDIAN_INVARIANTS, GUARDIAN_MUST_NOT_SELF_EXECUTE,
  makeGuardianPrincipal, assertNotSafebetIqIdentity, isRealPrivilegedHuman,
  MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE,
  evaluateSod, makeCase, makeEvidenceReference, validateGuardianEvidencePage,
  makeEnvelope, GuardianFoundationWorker, GUARDIAN_QUEUE_PREFIX,
  principalMayAccessGuardianResource, assertMayAccess,
  guardianChainScope, hashGuardianEvent, verifyGuardianChain, toAuditEventFields,
  guardianHealth, guardianVersion, guardianFoundationDescriptor,
} from '../../products/guardian/src/index.ts';

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const JUR = 'ZA-GP';
const syn = (id, role) => makeGuardianPrincipal({ principalId: id, jurisdiction: JUR, role, authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });

// ── Identity ────────────────────────────────────────────────────────────────
test('identity: synthetic principal is accepted with product=GUARDIAN', () => {
  const p = syn('inv', 'INVESTIGATOR');
  assert.equal(p.product, GUARDIAN_PRODUCT);
  assert.equal(p.isSynthetic, true);
});

test('identity: a REAL privileged human is blocked at C0 (MFA hard gate)', () => {
  assert.equal(MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE, true);
  assert.throws(() => makeGuardianPrincipal({ principalId: 'real', jurisdiction: JUR, role: 'AUTHORISING_OFFICER', authAssurance: 'PASSWORD_ONLY', purpose: 'x', isSynthetic: false }), /MFA enforcement not yet proven|not authorised at C0/);
});

test('identity: even MFA_VERIFIED real privileged human is not authorised at C0 (synthetic only)', () => {
  assert.throws(() => makeGuardianPrincipal({ principalId: 'real', jurisdiction: JUR, role: 'INVESTIGATOR', authAssurance: 'MFA_VERIFIED', purpose: 'x', isSynthetic: false }), /not authorised at C0/);
});

test('identity: SafeBet IQ roles can never access Guardian', () => {
  for (const r of ['casino_admin', 'super_admin', 'regulator', 'player']) {
    assert.throws(() => assertNotSafebetIqIdentity(r), /cannot access Guardian/);
  }
});

test('identity: isRealPrivilegedHuman flags non-synthetic human roles only', () => {
  assert.equal(isRealPrivilegedHuman({ isSynthetic: false, role: 'INVESTIGATOR' }), true);
  assert.equal(isRealPrivilegedHuman({ isSynthetic: true, role: 'INVESTIGATOR' }), false);
  assert.equal(isRealPrivilegedHuman({ isSynthetic: false, role: 'SYSTEM_SERVICE' }), false);
});

// ── Separation of Duties ──────────────────────────────────────────────────────
test('SoD: three distinct synthetic principals pass', () => {
  const r = evaluateSod({ caseId: 'c1', investigator: syn('a', 'INVESTIGATOR'), legalReviewer: syn('b', 'LEGAL_REVIEWER'), authorisingOfficer: syn('c', 'AUTHORISING_OFFICER') });
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('SoD: same principal in two duties is rejected', () => {
  const dual = syn('a', 'INVESTIGATOR');
  const dualAsOfficer = { ...dual, role: 'AUTHORISING_OFFICER' };
  const r = evaluateSod({ caseId: 'c1', investigator: dual, legalReviewer: syn('b', 'LEGAL_REVIEWER'), authorisingOfficer: dualAsOfficer });
  assert.equal(r.ok, false);
  assert.match(r.violations.join(';'), /holds both/);
});

test('SoD: mixed jurisdictions on one decision is rejected', () => {
  const officerB = makeGuardianPrincipal({ principalId: 'c', jurisdiction: 'ZA-WC', role: 'AUTHORISING_OFFICER', authAssurance: 'SYNTHETIC_TEST', purpose: 'x', isSynthetic: true });
  const r = evaluateSod({ caseId: 'c1', investigator: syn('a', 'INVESTIGATOR'), legalReviewer: syn('b', 'LEGAL_REVIEWER'), authorisingOfficer: officerB });
  assert.equal(r.ok, false);
  assert.match(r.violations.join(';'), /mixed jurisdictions/);
});

// ── Jurisdiction / product boundary ───────────────────────────────────────────
test('jurisdiction: same-jurisdiction access permitted, cross-jurisdiction denied', () => {
  const p = syn('inv', 'INVESTIGATOR');
  assert.equal(principalMayAccessGuardianResource(p, { product: GUARDIAN_PRODUCT, jurisdiction: JUR }), true);
  assert.equal(principalMayAccessGuardianResource(p, { product: GUARDIAN_PRODUCT, jurisdiction: 'ZA-WC' }), false);
  assert.throws(() => assertMayAccess(p, { product: GUARDIAN_PRODUCT, jurisdiction: 'ZA-WC' }), /cross-jurisdiction access denied/);
});

test('jurisdiction: a non-Guardian resource is refused', () => {
  const p = syn('inv', 'INVESTIGATOR');
  assert.throws(() => assertMayAccess(p, { product: 'SAFEBET_IQ', jurisdiction: JUR }), /not a Guardian resource/);
});

// ── Envelope ──────────────────────────────────────────────────────────────────
test('envelope: valid envelope carries product=GUARDIAN and a payload reference', () => {
  const e = makeEnvelope({ eventType: 't', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'i', occurredAt: new Date().toISOString(), payloadReference: 'ref' });
  assert.equal(e.product, GUARDIAN_PRODUCT);
  assert.equal(e.payloadReference, 'ref');
});

test('envelope: inline evidence/payload is forbidden (must use payloadReference)', () => {
  assert.throws(() => makeEnvelope({ eventType: 't', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'i', occurredAt: new Date().toISOString(), payloadReference: 'ref', evidence: { body: 'x' } }), /forbidden/);
});

// ── Case ──────────────────────────────────────────────────────────────────────
test('case: synthetic case primitive is created; non-synthetic rejected', () => {
  const c = makeCase({ caseId: 'k1', jurisdiction: JUR, createdAt: new Date().toISOString(), actorPrincipalId: 'inv', correlationId: 'c' });
  assert.equal(c.product, GUARDIAN_PRODUCT);
  assert.equal(c.status, 'OPEN');
  assert.throws(() => makeCase({ caseId: 'k2', jurisdiction: JUR, createdAt: new Date().toISOString(), actorPrincipalId: 'inv', correlationId: 'c', isSynthetic: false }), /synthetic/);
});

// ── Audit context (Shared contract, product=GUARDIAN) ─────────────────────────
test('audit: Guardian chain scope is product-prefixed + jurisdiction-bound', () => {
  assert.equal(guardianChainScope(JUR), 'guardian:ZA-GP');
});

test('audit: a Guardian chain verifies via the shared verifier', () => {
  const ctx = { product: 'GUARDIAN', actorPrincipalId: 'inv', actorRole: 'INVESTIGATOR', jurisdiction: JUR, eventType: 'guardian.case.opened', correlationId: 'c', occurredAt: '2026-09-05T10:00:00.000Z', caseReference: 'k1' };
  const h1 = hashGuardianEvent(ctx, 1, '0'.repeat(64), 'evt-1', sha256);
  const f1 = { ...toAuditEventFields(ctx, 1, '0'.repeat(64), 'evt-1'), hash: h1 };
  const res = verifyGuardianChain(JUR, [f1], sha256);
  assert.equal(res.status, 'verified');
  assert.equal(res.eventsChecked, 1);
});

test('audit: an event outside Guardian scope is rejected (no IQ event smuggling)', () => {
  const iqEvent = { chain_scope: 'iq:casino-123', chain_sequence: 1, previous_hash: '0'.repeat(64), event_id: 'e', event_type: 'x', user_id: null, user_role: null, casino_id: 'c', resource_type: null, resource_id: null, outcome: null, created_at: '2026-09-05T10:00:00Z', correlation_id: null, metadata: {}, hash: 'x' };
  const res = verifyGuardianChain(JUR, [iqEvent], sha256);
  assert.equal(res.status, 'broken');
  assert.match(res.reason, /not in Guardian scope/);
});

// ── Evidence (Shared framework) ───────────────────────────────────────────────
test('evidence: synthetic reference built; non-synthetic rejected; pagination bounded', () => {
  const e = makeEvidenceReference({ evidenceId: 'ev1', jurisdiction: JUR, caseReference: 'k1', classification: 'SENSITIVE', integrityHash: sha256('x'), retentionUntil: '2030-01-01T00:00:00Z', accessPurpose: 'demo', createdAt: new Date().toISOString() });
  assert.equal(e.product, GUARDIAN_PRODUCT);
  assert.throws(() => makeEvidenceReference({ evidenceId: 'ev2', jurisdiction: JUR, caseReference: 'k1', classification: 'PUBLIC', integrityHash: 'h', retentionUntil: '2030-01-01T00:00:00Z', accessPurpose: 'd', createdAt: new Date().toISOString(), isSynthetic: false }), /synthetic/);
  assert.throws(() => validateGuardianEvidencePage(1, 100000), /exceeds maximum/);
  assert.equal(validateGuardianEvidencePage(2, 50).offset, 50);
});

// ── Worker idempotency ────────────────────────────────────────────────────────
test('worker: replaying the same idempotency key is a no-effect duplicate', () => {
  const w = new GuardianFoundationWorker();
  const env = makeEnvelope({ eventType: 't', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'k', occurredAt: new Date().toISOString(), payloadReference: 'ref' });
  const a = w.process(env), b = w.process(env);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(w.processedCount(), 1);
  assert.ok(GUARDIAN_QUEUE_PREFIX.startsWith('guardian-'));
});

test('worker: refuses a non-Guardian message', () => {
  const w = new GuardianFoundationWorker();
  assert.throws(() => w.process({ product: 'SAFEBET_IQ', schemaVersion: 'c0', eventType: 't', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'k', occurredAt: new Date().toISOString(), payloadReference: 'r' }), /product must be GUARDIAN|non-Guardian/);
});

// ── Health / version / invariants ─────────────────────────────────────────────
test('health/version: product=GUARDIAN, synthetic, independent of IQ runtime', () => {
  const h = guardianHealth();
  assert.equal(h.product, GUARDIAN_PRODUCT);
  assert.equal(h.dependsOnSafebetIqRuntime, false);
  const v = guardianVersion({ gitCommit: 'abc', deploymentVersion: 'guardian-c0-test' });
  assert.equal(v.product, GUARDIAN_PRODUCT);
  assert.equal(v.service, 'safebet-guardian');
  assert.equal(v.dataClass, 'synthetic');
  assert.equal(v.gitCommit, 'abc');
});

test('invariants: enforcement-safety + no-automatic-legal-decision encoded', () => {
  assert.equal(GUARDIAN_INVARIANTS.automatedSignalIsNotLegalFinding, true);
  assert.equal(GUARDIAN_INVARIANTS.detectionIsNotEnforcementAuthorisation, true);
  assert.equal(GUARDIAN_INVARIANTS.noAutomaticBlocking, true);
  assert.ok(GUARDIAN_MUST_NOT_SELF_EXECUTE.includes('suspend-domain'));
  assert.ok(GUARDIAN_MUST_NOT_SELF_EXECUTE.includes('remove-mobile-app'));
});

test('descriptor: foundation self-describes standalone with no IQ dependency', () => {
  const d = guardianFoundationDescriptor();
  assert.equal(d.standalone, true);
  assert.equal(d.dependsOnSafebetIqBusinessData, false);
  assert.equal(d.dependsOnSafebetIqRuntime, false);
});
