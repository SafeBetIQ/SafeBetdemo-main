// SafeBet Guardian — Controlled Evidence Retrieval & byte verification (ARCH-V4-C7.2).
//   node --test tests/guardian/guardianEvidenceRetrieval.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  authoriseRetrieval, verifyRetrievedBytes, buildRetrievalOutcome,
} from '../../products/guardian/src/index.ts';

const base = {
  evidenceId: 'GEV-X', evidenceReference: 'EV-REF-0001', role: 'LEGAL_REVIEWER',
  principalJurisdiction: 'ZA-GP', evidenceJurisdiction: 'ZA-GP', classification: 'RESTRICTED',
  purpose: 'LEGAL_REVIEW_PREPARATION', recordedContentHash: createHash('sha256').update('stored-bytes').digest('hex'),
};

test('1: authorised retrieval gate ALLOW (jurisdiction+classification+purpose ok)', () => {
  assert.equal(authoriseRetrieval(base).decision, 'ALLOW');
});
test('2: wrong-jurisdiction retrieval DENIED before GetObject', () => {
  assert.equal(authoriseRetrieval({ ...base, evidenceJurisdiction: 'ZA-WC' }).decision, 'DENY');
});
test('3: classification above role DENIED (Investigator vs HIGHLY_RESTRICTED)', () => {
  assert.equal(authoriseRetrieval({ ...base, role: 'INVESTIGATOR', classification: 'HIGHLY_RESTRICTED' }).reason, 'CLASSIFICATION_ABOVE_ROLE');
});
test('4: missing purpose DENIED', () => {
  assert.equal(authoriseRetrieval({ ...base, purpose: null }).decision, 'DENY');
});
test('7: actual stored bytes hash VERIFIED', () => {
  assert.equal(verifyRetrievedBytes(base.recordedContentHash, Buffer.from('stored-bytes')), 'VERIFIED');
});
test('8: tampered stored bytes INTEGRITY_FAILED (not silently repaired)', () => {
  assert.equal(verifyRetrievedBytes(base.recordedContentHash, Buffer.from('TAMPERED-bytes')), 'INTEGRITY_FAILED');
});
test('outcome: DENY never reads bytes (integrityStatus NOT_RETRIEVED)', () => {
  const o = buildRetrievalOutcome({ ...base, evidenceJurisdiction: 'ZA-WC' }, { bytes: Buffer.from('stored-bytes') });
  assert.equal(o.decision, 'DENY'); assert.equal(o.integrityStatus, 'NOT_RETRIEVED'); assert.equal(o.bytesRead, null);
});
test('outcome: ALLOW + matching bytes → VERIFIED with byte count; no legal/enforce', () => {
  const o = buildRetrievalOutcome(base, { bytes: Buffer.from('stored-bytes') });
  assert.equal(o.decision, 'ALLOW'); assert.equal(o.integrityStatus, 'VERIFIED'); assert.equal(o.bytesRead, Buffer.from('stored-bytes').length);
  assert.equal(o.isLegalDetermination, false); assert.equal(o.isEnforcementAuthorised, false);
});
test('outcome: ALLOW + tampered bytes → INTEGRITY_FAILED', () => {
  const o = buildRetrievalOutcome(base, { bytes: Buffer.from('different') });
  assert.equal(o.integrityStatus, 'INTEGRITY_FAILED');
});
