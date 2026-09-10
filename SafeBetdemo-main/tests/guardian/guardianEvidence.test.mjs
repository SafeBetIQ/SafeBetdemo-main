// SafeBet Guardian — Digital Evidence Vault & Chain-of-Custody (ARCH-V4-C7). Synthetic.
//   node --test tests/guardian/guardianEvidence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_EVIDENCE_FIXTURES, registerEvidence, deriveEvidence,
  GuardianEvidenceWorker, EvidencePoisonMessageError, buildEvidencePersistencePlan, deriveEvidenceIds,
  hashEvidenceContent, verifyEvidenceContent, appendCustodyEvent, verifyCustodyChain, CUSTODY_GENESIS,
  evaluateEvidenceAccess, mayPerformHoldAction, dispositionBlockedByHold, buildExportManifest,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-08T00:00:00Z');
const reg = (ref, id = 'GEV-T') => registerEvidence(SYNTHETIC_EVIDENCE_FIXTURES[ref], { evidenceId: id, now: NOW });

test('scenario 1: synthetic web evidence → register → hash → store → verify', () => {
  const r = reg('EV-REF-0001');
  assert.equal(r.hashAlgorithm, 'SHA-256');
  assert.equal(r.contentHash, hashEvidenceContent(SYNTHETIC_EVIDENCE_FIXTURES['EV-REF-0001'].syntheticBody));
  assert.equal(r.integrityStatus, 'VERIFIED');
  assert.ok(r.storageReference.startsWith('synthetic://evidence/ZA-GP/'));
  assert.equal(r.isLegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
});

test('scenario 2: synthetic screenshot → integrity verified', () => {
  const r = reg('EV-REF-0002');
  assert.equal(r.evidenceType, 'SCREENSHOT');
  assert.equal(r.integrityStatus, 'VERIFIED');
});

test('scenario 3: multiple evidence items keep distinct references + custody', () => {
  const a = reg('EV-REF-0001', 'GEV-A'); const b = reg('EV-REF-0002', 'GEV-B');
  assert.notEqual(a.evidenceId, b.evidenceId);
  assert.notEqual(a.contentHash, b.contentHash);
  assert.ok(verifyCustodyChain(a.custodyChain).ok && verifyCustodyChain(b.custodyChain).ok);
});

test('scenario 4: wrong-jurisdiction access → DENIED', () => {
  const d = evaluateEvidenceAccess({ role: 'INVESTIGATOR', principalJurisdiction: 'ZA-GP', evidenceJurisdiction: 'ZA-WC', classification: 'RESTRICTED', purpose: 'CASE_INVESTIGATION' });
  assert.equal(d.decision, 'DENY'); assert.equal(d.reason, 'CROSS_JURISDICTION');
});

test('scenario 7: content tampered → INTEGRITY_FAILED', () => {
  const h = hashEvidenceContent('synthetic-original-body');
  assert.equal(verifyEvidenceContent(h, 'synthetic-original-body'), 'VERIFIED');
  assert.equal(verifyEvidenceContent(h, 'synthetic-tampered-body'), 'INTEGRITY_FAILED');
});

test('scenario 8: duplicate delivery → no duplicate authoritative evidence', () => {
  const w = new GuardianEvidenceWorker();
  const m = { product: 'GUARDIAN', schemaVersion: 'c7', eventType: 'guardian.evidence.register', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), fixtureEvidenceReference: 'EV-REF-0001' };
  const a = w.process(m), b = w.process(m);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});

test('scenario 9: derived evidence → parent linkage preserved; never masquerades as original', () => {
  const parent = reg('EV-REF-0003', 'GEV-P');
  const d = deriveEvidence(parent, { derivedEvidenceId: 'GEV-D', derivationMethod: 'TEXT_EXTRACTION', syntheticBody: 'extracted-text', now: NOW });
  assert.equal(d.parentEvidenceId, 'GEV-P');
  assert.equal(d.isOriginal, false);
  assert.notEqual(d.contentHash, parent.contentHash);
  assert.equal(d.custodyEvent.eventType, 'DERIVED');
});

test('scenario 10: custody sequence append-only + verifiable hash chain; tamper detected', () => {
  const r = reg('EV-REF-0001', 'GEV-C10');
  assert.equal(verifyCustodyChain(r.custodyChain).ok, true);
  assert.equal(r.custodyChain[0].previousEventHash, CUSTODY_GENESIS);
  // tamper: flip an event_type without recomputing → chain verification must fail
  const tampered = r.custodyChain.map((e, i) => i === 1 ? { ...e, eventType: 'ACCESSED' } : e);
  assert.equal(verifyCustodyChain(tampered).ok, false);
});

test('scenario 11: classification access violation → DENIED (Investigator vs HIGHLY_RESTRICTED)', () => {
  const inv = evaluateEvidenceAccess({ role: 'INVESTIGATOR', principalJurisdiction: 'ZA-GP', evidenceJurisdiction: 'ZA-GP', classification: 'HIGHLY_RESTRICTED', purpose: 'CASE_INVESTIGATION' });
  assert.equal(inv.decision, 'DENY'); assert.equal(inv.reason, 'CLASSIFICATION_ABOVE_ROLE');
  // Legal Reviewer has a bounded higher profile → ALLOW
  const leg = evaluateEvidenceAccess({ role: 'LEGAL_REVIEWER', principalJurisdiction: 'ZA-GP', evidenceJurisdiction: 'ZA-GP', classification: 'HIGHLY_RESTRICTED', purpose: 'LEGAL_REVIEW_PREPARATION' });
  assert.equal(leg.decision, 'ALLOW');
  // no purpose → DENY (no arbitrary browsing)
  assert.equal(evaluateEvidenceAccess({ role: 'INVESTIGATOR', principalJurisdiction: 'ZA-GP', evidenceJurisdiction: 'ZA-GP', classification: 'INTERNAL', purpose: null }).decision, 'DENY');
});

test('scenario 12: legal/preservation hold → disposition blocked; release SoD bounded', () => {
  assert.equal(dispositionBlockedByHold('HELD'), true);
  assert.equal(dispositionBlockedByHold('NONE'), false);
  // any random consumer (Investigator) cannot RELEASE a hold; Legal Reviewer can
  assert.equal(mayPerformHoldAction('RELEASE', 'INVESTIGATOR'), false);
  assert.equal(mayPerformHoldAction('RELEASE', 'LEGAL_REVIEWER'), true);
  assert.equal(mayPerformHoldAction('PLACE', 'INVESTIGATOR'), true);
});

test('scenario 13: export package → manifest + hashes + custody; hashed + verifiable', () => {
  const a = reg('EV-REF-0001', 'GEV-E1'); const b = reg('EV-REF-0002', 'GEV-E2');
  const items = [a, b].map((r) => ({ evidenceId: r.evidenceId, evidenceReference: r.evidenceReference, contentHash: r.contentHash, classification: r.classification, integrityStatus: r.integrityStatus, capturedAt: null, sourceReference: r.sourceReference, custodyHead: r.custodyChain[r.custodyChain.length - 1].eventHash }));
  const m1 = buildExportManifest({ jurisdiction: 'ZA-GP', caseReference: 'GC-INTAKE-0001', exportActor: 'syn-leg', exportedAt: NOW.toISOString(), items });
  const m2 = buildExportManifest({ jurisdiction: 'ZA-GP', caseReference: 'GC-INTAKE-0001', exportActor: 'syn-leg', exportedAt: NOW.toISOString(), items });
  assert.equal(m1.manifestHash, m2.manifestHash);         // deterministic
  assert.equal(m1.manifestHash.length, 64);               // SHA-256
  assert.equal(m1.items.length, 2);
  assert.equal(m1.isLegalDetermination, false);
  assert.equal(m1.isEnforcementAuthorised, false);
});

test('scenario 14: source observation changes later → historic evidence hash unchanged', () => {
  const r = reg('EV-REF-0001', 'GEV-C14');
  const original = r.contentHash;
  // a later, different capture is a NEW evidence/version — the original hash is immutable
  const laterCapture = registerEvidence({ ...SYNTHETIC_EVIDENCE_FIXTURES['EV-REF-0001'], syntheticBody: 'synthetic-web-capture:licensed-example-003.test:v2-CHANGED' }, { evidenceId: 'GEV-C14b', now: NOW });
  assert.notEqual(laterCapture.contentHash, original);
  assert.equal(reg('EV-REF-0001', 'GEV-C14').contentHash, original); // re-derive → same
});

test('scenario 17: poison evidence message → error (→ DLQ), no authoritative evidence', () => {
  const w = new GuardianEvidenceWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c7', eventType: 'guardian.evidence.register', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureEvidenceReference: 'REAL-EVIDENCE-999' }), EvidencePoisonMessageError);
  // wrong-jurisdiction also poisons (scenario 4 worker path)
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c7', eventType: 'guardian.evidence.register', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k2', occurredAt: NOW.toISOString(), fixtureEvidenceReference: 'EV-REF-0100' }), EvidencePoisonMessageError);
});

test('invariant: no evidence result asserts legality OR enforcement', () => {
  for (const ref of Object.keys(SYNTHETIC_EVIDENCE_FIXTURES)) {
    const r = registerEvidence(SYNTHETIC_EVIDENCE_FIXTURES[ref], { evidenceId: 'GEV-INV', now: NOW });
    assert.equal(r.isLegalDetermination, false);
    assert.equal(r.isEnforcementAuthorised, false);
  }
});

test('persistence: deterministic idempotent plan + custody chain rows + no legality/enforcement', () => {
  const r = reg('EV-REF-0001', 'GEV-gk-1');
  const inp = { jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'gk-1', createdBy: 'syn', result: r };
  const a = buildEvidencePersistencePlan(inp); const b = buildEvidencePersistencePlan(inp);
  assert.deepEqual(a.rows.map((x) => x.id), b.rows.map((x) => x.id));
  assert.equal(deriveEvidenceIds('gk-1').evidenceId, 'GEV-gk-1');
  assert.ok(a.rows.some((x) => x.table === 'guardian_evidence_custody_event'));
  const ev = a.rows.find((x) => x.table === 'guardian_evidence');
  assert.equal(ev.row.is_legal_determination, false);
  assert.equal(ev.row.is_enforcement_authorised, false);
});
