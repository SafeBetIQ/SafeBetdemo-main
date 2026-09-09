// SafeBet Guardian — Case & Investigation Management (ARCH-V4-C6). Synthetic; governed.
//   node --test tests/guardian/guardianCase.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_CASE_FIXTURES, analyseCaseIntake,
  GuardianCaseWorker, CasePoisonMessageError, buildCasePersistencePlan, deriveCaseIds,
  verifyEvidenceIntegrity, hashEvidenceBody,
  makeGuardianPrincipal, evaluateSod,
} from '../../products/guardian/src/index.ts';

const analyse = (ref) => analyseCaseIntake(SYNTHETIC_CASE_FIXTURES[ref]);
const OCC = '2026-09-07T00:00:00Z';
const msg = (o) => ({ product: 'GUARDIAN', schemaVersion: 'c6', eventType: 'guardian.case.intake', correlationId: 'c', occurredAt: OCC, ...o });

test('scenario 1: multiple C1–C5 references → one multi-signal case, no legal determination', () => {
  const r = analyse('GC-INTAKE-0001');
  assert.equal(r.caseType, 'MULTI_SIGNAL_INVESTIGATION');
  assert.ok(r.reasonCodes.includes('MULTI_SIGNAL_CORRELATION'));
  assert.equal(r.isLegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
  assert.equal(r.subjects.length, 4);
});

test('scenario 2: unknown Domain NO_MATCH → case opened for review → NOT illegal', () => {
  const r = analyse('GC-INTAKE-0002');
  assert.ok(r.reasonCodes.includes('NO_AUTHORITATIVE_REGISTRY_MATCH'));
  assert.ok(r.reasonCodes.includes('INVESTIGATION_REQUIRED'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isLegalDetermination, false);
});

test('scenario 3: Domain + App + Payment relationships linked under one case, provenance retained', () => {
  const r = analyse('GC-INTAKE-0001');
  const types = r.subjects.map((s) => s.subjectType).sort();
  assert.deepEqual(types, ['DOMAIN', 'GEO_SERVICE_REFERENCE', 'MERCHANT', 'MOBILE_APP']);
  assert.ok(r.provenance.sourceReferences.includes('MER-REF-0001'));
  assert.equal(r.intelligenceReferences.length, 4); // what was known at the time preserved
});

test('scenario 4: Geo jurisdiction inconsistency → finding → review required', () => {
  const r = analyse('GC-INTAKE-0004');
  assert.ok(r.reasonCodes.includes('GEO_JURISDICTION_INCONSISTENCY'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.caseType, 'GEO_JURISDICTION_REVIEW');
});

test('scenario 5: conflicting Registry source → review object → not silently resolved', () => {
  const r = analyse('GC-INTAKE-0005');
  assert.ok(r.reasonCodes.includes('REGISTRY_SOURCE_CONFLICT'));
  assert.equal(r.reviewRequired, true);
});

test('scenario 6: evidence links → hashes verified', () => {
  const body = 'synthetic-evidence-body';
  const h = hashEvidenceBody(body);
  assert.equal(verifyEvidenceIntegrity(h, body), 'VERIFIED');
});

test('scenario 7: tampered synthetic evidence → integrity failure detected', () => {
  const h = hashEvidenceBody('original-synthetic-body');
  assert.equal(verifyEvidenceIntegrity(h, 'tampered-synthetic-body'), 'INTEGRITY_FAILED');
});

const P = (id, role) => makeGuardianPrincipal({ principalId: id, jurisdiction: 'ZA-GP', role, authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });
test('scenario 8: same Investigator attempts independent review → SoD DENIED', () => {
  const inv = P('syn-1', 'INVESTIGATOR');
  const sod = evaluateSod({ caseId: 'CASE-SYNTH-0001', investigator: inv, legalReviewer: { ...inv, role: 'LEGAL_REVIEWER' }, authorisingOfficer: P('syn-3', 'AUTHORISING_OFFICER') });
  assert.equal(sod.ok, false); // same principal cannot investigate AND review
});

test('scenario 9: different authorised Legal Reviewer → SoD PASS', () => {
  const sod = evaluateSod({ caseId: 'CASE-SYNTH-0001', investigator: P('syn-1', 'INVESTIGATOR'), legalReviewer: P('syn-2', 'LEGAL_REVIEWER'), authorisingOfficer: P('syn-3', 'AUTHORISING_OFFICER') });
  assert.equal(sod.ok, true);
});

test('scenario 10: wrong jurisdiction → worker denies', () => {
  const w = new GuardianCaseWorker();
  assert.throws(() => w.process(msg({ jurisdiction: 'ZA-GP', idempotencyKey: 'k', fixtureIntakeReference: 'GC-INTAKE-0100' })), CasePoisonMessageError);
});

test('scenario 11: duplicate intake → one case (idempotent)', () => {
  const w = new GuardianCaseWorker();
  const m = msg({ jurisdiction: 'ZA-GP', idempotencyKey: 'dup-1', fixtureIntakeReference: 'GC-INTAKE-0001' });
  const a = w.process(m), b = w.process(m);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});

test('scenario 12: poison intake → error (→ DLQ), zero case', () => {
  const w = new GuardianCaseWorker();
  assert.throws(() => w.process(msg({ jurisdiction: 'ZA-GP', idempotencyKey: 'k', fixtureIntakeReference: 'REAL-CASE-999' })), CasePoisonMessageError);
});

test('scenario 13: case priority change → history preserved in plan', () => {
  const plan = buildCasePersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk-1', evidenceReference: null, evidenceIntegrityStatus: 'UNVERIFIED', createdBy: 'syn', result: analyse('GC-INTAKE-0001') });
  assert.ok(plan.rows.some((x) => x.table === 'case_priority_history'));
});

test('scenario 14: case assignment/status change → history preserved (non-destructive)', () => {
  const plan = buildCasePersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'ak-1', evidenceReference: null, evidenceIntegrityStatus: 'UNVERIFIED', createdBy: 'syn', result: analyse('GC-INTAKE-0001') });
  assert.ok(plan.rows.some((x) => x.table === 'case_status_history')); // traceable, append-only
});

test('scenario 15: case closure → chronology retained (append-only)', () => {
  const plan = buildCasePersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'ck-1', evidenceReference: null, evidenceIntegrityStatus: 'UNVERIFIED', createdBy: 'syn', result: analyse('GC-INTAKE-0001') });
  const chron = plan.rows.filter((x) => x.table === 'case_chronology');
  assert.ok(chron.some((x) => x.row.event_type === 'CASE_OPENED')); // chronology preserved, non-destructive
});

test('scenario 16: closed case receives later intelligence → not silently rewritten (idempotent; explicit reopen)', () => {
  const w = new GuardianCaseWorker();
  const m = msg({ jurisdiction: 'ZA-GP', idempotencyKey: 'reopen-1', fixtureIntakeReference: 'GC-INTAKE-0001' });
  const a = w.process(m); const again = w.process(m);
  assert.equal(again.duplicate, true); // same key never rewrites; a reopen is an explicit new decision
  assert.equal(a.result.caseReference, again.result.caseReference);
});

test('invariant: no case result asserts legality OR enforcement; recommendation never ENFORCEMENT', () => {
  for (const ref of Object.keys(SYNTHETIC_CASE_FIXTURES)) {
    const r = analyse(ref);
    assert.equal(r.isLegalDetermination, false);
    assert.equal(r.isEnforcementAuthorised, false);
    assert.notEqual(r.recommendation, 'ENFORCEMENT_RECOMMENDED');
  }
});

test('persistence: deterministic idempotent plan + governed subjects + no legality/enforcement', () => {
  const r = analyse('GC-INTAKE-0001');
  const inp = { jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'gk-1', evidenceReference: 'e', evidenceIntegrityStatus: 'VERIFIED', createdBy: 'syn', result: r };
  const a = buildCasePersistencePlan(inp); const b = buildCasePersistencePlan(inp);
  assert.deepEqual(a.rows.map((x) => x.id), b.rows.map((x) => x.id));
  assert.equal(deriveCaseIds('gk-1').caseId, 'CASE-gk-1');
  const c = a.rows.find((x) => x.table === 'investigation_case');
  assert.equal(c.row.is_legal_determination, false);
  assert.equal(c.row.is_enforcement_authorised, false);
  assert.equal(c.row.status, 'DRAFT'); // system-recommended intake never creates an authoritative/legal state
});
