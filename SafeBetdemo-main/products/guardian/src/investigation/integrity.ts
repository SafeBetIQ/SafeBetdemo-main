// ─── SafeBet Guardian — case evidence integrity (ARCH-V4-C6) ──────────────────
// Deterministic integrity check for synthetic evidence references. A case must not
// silently accept tampered evidence: a mismatch between the recorded integrity hash and
// the recomputed hash is DETECTED and surfaced (INTEGRITY_FAILED).

import { createHash } from 'node:crypto';

export type EvidenceIntegrityStatus = 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED';

export function hashEvidenceBody(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/** Verify a synthetic evidence reference: recompute the hash of the (synthetic) body and
 *  compare with the recorded integrity hash. No body → UNVERIFIED. Mismatch → detected. */
export function verifyEvidenceIntegrity(recordedHash: string | null | undefined, syntheticBody: string | null | undefined): EvidenceIntegrityStatus {
  if (!recordedHash) return 'UNVERIFIED';
  if (syntheticBody == null) return 'UNVERIFIED';
  return hashEvidenceBody(syntheticBody) === recordedHash ? 'VERIFIED' : 'INTEGRITY_FAILED';
}
