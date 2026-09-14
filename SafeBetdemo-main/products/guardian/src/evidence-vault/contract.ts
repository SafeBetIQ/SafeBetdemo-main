// ─── SafeBet Guardian — Evidence Reference Contract (ARCH-V4-C8) ──────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. the Enforcement Policy /
// Authorisation workflow) obtain a bounded Evidence reference — WITHOUT depending on the
// Evidence Vault's base tables. Parallel to the Domain/App/Payment/Geo/Case Contracts.
//
//   Owner:     Digital Evidence Vault (C7)
//   Consumers: Enforcement Policy & Authorisation (C8), future modules
//   Returns:   ONLY the bounded fields below (incl. integrity + hold state for the
//              authorisation evidence gate). Jurisdiction-scoped.
//
// Two aligned implementations: this pure TS function (over the synthetic evidence fixtures)
// and the bounded DB view `guardian.evidence_reference`. Neither exposes the C7 base tables.

import { SYNTHETIC_EVIDENCE_FIXTURES } from './fixtures.ts';
import { registerEvidence } from './registration.ts';

export type EvidenceReferenceMatchState = 'REFERENCED' | 'EVIDENCE_REFERENCE_NOT_FOUND';

export interface EvidenceReferenceQuery { evidenceReference: string; jurisdiction: string; correlationId?: string }

export interface EvidenceReference {
  matchState: EvidenceReferenceMatchState;
  evidenceReferenceId: string | null;
  jurisdiction: string;
  classification: string;
  integrityStatus: 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED';
  holdState: 'NONE' | 'HELD';
  sourceDomain: string | null;
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

/** Resolve a bounded Evidence reference in one jurisdiction. NOT_FOUND is a bounded no-match
 *  (never cross-jurisdiction data). integrityStatus is the authorisation evidence gate input. */
export function resolveEvidenceReference(q: EvidenceReferenceQuery): EvidenceReference {
  const fx = SYNTHETIC_EVIDENCE_FIXTURES[q.evidenceReference];
  if (!fx || fx.jurisdiction !== q.jurisdiction) {
    return { matchState: 'EVIDENCE_REFERENCE_NOT_FOUND', evidenceReferenceId: null, jurisdiction: q.jurisdiction, classification: 'INTERNAL', integrityStatus: 'UNVERIFIED', holdState: 'NONE', sourceDomain: null, referenceStatus: 'NOT_FOUND' };
  }
  const r = registerEvidence(fx, { evidenceId: `GEV-${q.evidenceReference}` });
  return { matchState: 'REFERENCED', evidenceReferenceId: null, jurisdiction: q.jurisdiction, classification: fx.classification, integrityStatus: r.integrityStatus, holdState: 'NONE', sourceDomain: fx.sourceDomain, referenceStatus: 'REFERENCED' };
}
