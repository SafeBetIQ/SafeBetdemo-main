// ─── SafeBet Guardian — Case Reference Contract (ARCH-V4-C7) ──────────────────
//
// The GOVERNED interface by which OTHER Guardian modules (e.g. the Digital Evidence
// Vault) obtain a bounded Case reference — WITHOUT depending on Case Management's
// persistence implementation or base tables. Parallel to the Domain/App/Payment/Geo
// Reference Contracts.
//
//   Owner:     Case & Investigation Management (C6)
//   Consumers: Digital Evidence Vault (C7), future modules
//   Returns:   ONLY the bounded fields below. Jurisdiction-scoped.
//
// Two aligned implementations: this pure TS function (over the synthetic case fixtures)
// and the bounded DB view `guardian.case_reference`. Neither exposes the C6 base tables.

import { SYNTHETIC_CASE_FIXTURES } from './fixtures.ts';
import { analyseCaseIntake } from './correlation.ts';

export type CaseReferenceMatchState = 'REFERENCED' | 'CASE_REFERENCE_NOT_FOUND';

export interface CaseReferenceQuery { caseReference: string; jurisdiction: string; correlationId?: string }

export interface CaseReference {
  matchState: CaseReferenceMatchState;
  caseReferenceId: string | null;
  jurisdiction: string;
  caseStatus: string;
  classification: string;
  referenceStatus: 'REFERENCED' | 'NOT_FOUND';
}

/** Resolve a bounded Case reference for one case reference in one jurisdiction.
 *  Jurisdiction-scoped: a case known only in another jurisdiction returns
 *  CASE_REFERENCE_NOT_FOUND (never cross-jurisdiction data). */
export function resolveCaseReference(q: CaseReferenceQuery): CaseReference {
  const fx = SYNTHETIC_CASE_FIXTURES[q.caseReference];
  if (!fx || fx.jurisdiction !== q.jurisdiction) {
    return { matchState: 'CASE_REFERENCE_NOT_FOUND', caseReferenceId: null, jurisdiction: q.jurisdiction, caseStatus: 'UNKNOWN', classification: 'INTERNAL', referenceStatus: 'NOT_FOUND' };
  }
  analyseCaseIntake(fx); // deterministic derivation (no raw base-table access)
  return { matchState: 'REFERENCED', caseReferenceId: null, jurisdiction: q.jurisdiction, caseStatus: 'DRAFT', classification: 'RESTRICTED', referenceStatus: 'REFERENCED' };
}
