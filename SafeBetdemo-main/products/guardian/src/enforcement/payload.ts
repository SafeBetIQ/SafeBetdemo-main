// ─── SafeBet Guardian — provider request payload + hashing (ARCH-V4-C9) ───────
// Data minimisation: the provider payload contains ONLY what the authorised request needs —
// target, jurisdiction, authority/policy reference, authorisation reference, bounded evidence
// manifest reference/hash. NO full case/notes/evidence/intelligence/consumer data. Canonicalised
// + SHA-256 hashed so retries reuse the exact immutable authorised payload.

import { createHash } from 'node:crypto';
import type { AuthorisedActionSnapshot } from './types.ts';

export interface ProviderPayload {
  authorisationReference: string;
  actionType: string;
  targetType: string;
  targetReference: string;
  jurisdiction: string;
  authorityReference: string | null;
  policyReference: string | null;
  evidenceManifestReference: string | null;
  evidenceManifestHash: string | null;
  requestVersion: number;
}

/** Build the minimised provider payload from the bounded authorised-action snapshot. */
export function buildProviderPayload(a: AuthorisedActionSnapshot, requestVersion = 1): ProviderPayload {
  return {
    authorisationReference: a.authorisationReference, actionType: a.actionType, targetType: a.targetType,
    targetReference: a.targetReference, jurisdiction: a.jurisdiction, authorityReference: a.authorityReference,
    policyReference: a.policyReference, evidenceManifestReference: a.evidenceManifestReference,
    evidenceManifestHash: a.evidenceManifestHash, requestVersion,
  };
}

/** Deterministic canonicalisation (sorted keys) → SHA-256. Same payload → same hash on retry. */
export function hashProviderPayload(p: ProviderPayload): string {
  const canonical = JSON.stringify(p, Object.keys(p).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
