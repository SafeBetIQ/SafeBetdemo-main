// ─── SafeBet Guardian — controlled evidence retrieval + byte verification (C7.2) ─
//
// Bounded retrieval path: access-policy (jurisdiction × classification × purpose)
// evaluated BEFORE any GetObject; SHA-256 verification over the ACTUAL retrieved bytes
// (not the in-memory fixture, not a metadata hash); every attempt (ALLOW/DENY) recorded
// as an access event. Retrieval performed by the DEDICATED least-privilege reader
// identity (s3:GetObject on evidence/* only; no List/Delete/Put). No public URL.

import { createHash } from 'node:crypto';
import { evaluateEvidenceAccess } from './access.ts';
import type { EvidenceClassification, EvidenceRole, AccessPurpose } from './types.ts';

export interface RetrievalRequest {
  evidenceId: string;
  evidenceReference: string;
  role: EvidenceRole;
  principalJurisdiction: string;
  evidenceJurisdiction: string;
  classification: EvidenceClassification;
  purpose: AccessPurpose | null;
  recordedContentHash: string;   // canonical hash from evidence/version metadata
}

export interface RetrievalDecision { decision: 'ALLOW' | 'DENY'; reason: string }

/** Gate: no S3 GetObject may occur unless this returns ALLOW. */
export function authoriseRetrieval(req: RetrievalRequest): RetrievalDecision {
  return evaluateEvidenceAccess({
    role: req.role, principalJurisdiction: req.principalJurisdiction,
    evidenceJurisdiction: req.evidenceJurisdiction, classification: req.classification, purpose: req.purpose,
  });
}

export type StoredByteVerdict = 'VERIFIED' | 'INTEGRITY_FAILED';

/** SHA-256 over the ACTUAL retrieved bytes, compared with the canonical recorded hash.
 *  This is the byte-level proof C7.2 adds over C7's registration-time verification. */
export function verifyRetrievedBytes(recordedContentHash: string, retrievedBytes: Buffer | Uint8Array | string): StoredByteVerdict {
  const buf = typeof retrievedBytes === 'string' ? Buffer.from(retrievedBytes, 'utf8') : Buffer.from(retrievedBytes);
  const computed = createHash('sha256').update(buf).digest('hex');
  return computed === recordedContentHash ? 'VERIFIED' : 'INTEGRITY_FAILED';
}

export interface RetrievalOutcome {
  evidenceId: string;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  integrityStatus: StoredByteVerdict | 'NOT_RETRIEVED';
  bytesRead: number | null;
  isLegalDetermination: false;
  isEnforcementAuthorised: false;
}

/** Full outcome shape (denials never read bytes). Content bytes are NEVER placed in logs. */
export function buildRetrievalOutcome(req: RetrievalRequest, retrieved: { bytes: Buffer | null } | null): RetrievalOutcome {
  const gate = authoriseRetrieval(req);
  if (gate.decision === 'DENY' || !retrieved || retrieved.bytes == null) {
    return { evidenceId: req.evidenceId, decision: gate.decision, reason: gate.reason, integrityStatus: 'NOT_RETRIEVED', bytesRead: null, isLegalDetermination: false, isEnforcementAuthorised: false };
  }
  const integrityStatus = verifyRetrievedBytes(req.recordedContentHash, retrieved.bytes);
  return { evidenceId: req.evidenceId, decision: 'ALLOW', reason: gate.reason, integrityStatus, bytesRead: retrieved.bytes.length, isLegalDetermination: false, isEnforcementAuthorised: false };
}
