// ─── SafeBet Guardian — resolveLegalReference contract (ARCH-V4-C1) ───────────
//
// The future-safe internal contract that later Guardian intelligence modules call
// instead of depending on raw tables. It returns a STRUCTURED legal standing +
// provenance, and it can NEVER return ILLEGAL.
//
//   ABSENCE FROM LEGAL OPERATOR REGISTRY  !=  ILLEGAL OPERATOR
//
// Ambiguity (multiple candidates / source conflict) → REQUIRES_REVIEW. Stale but
// matched → MATCHED_BUT_STALE. Unknown subject → NO_MATCH (explicitly NOT illegal).

import type { RegistrySnapshot, LegalStanding, ResolutionState, FreshnessStatus } from './types.ts';
import { matchOperator, type MatchQuery } from './matching.ts';
import { detectConflict, freshness, DEFAULT_FRESHNESS, type FreshnessPolicy } from './sources.ts';

export interface LegalReferenceResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  subject: MatchQuery;
  resolutionState: ResolutionState;
  matchState: string;
  legalStanding: LegalStanding;
  resolvedOperatorId: string | null;
  candidateOperatorIds: string[];
  licenceId: string | null;
  freshness: FreshnessStatus;
  requiresHumanReview: boolean;
  provenance: { sourceRecordIds: string[]; evidenceReferences: string[] };
  /** ALWAYS false at C1 — encoded so no caller can read an illegal determination here. */
  isIllegalDetermination: false;
  note: string;
}

export function resolveLegalReference(
  snapshot: RegistrySnapshot,
  subject: MatchQuery,
  now: Date = new Date(),
  policy: FreshnessPolicy = DEFAULT_FRESHNESS,
): LegalReferenceResult {
  const base = {
    product: 'GUARDIAN' as const,
    jurisdiction: subject.jurisdiction,
    subject,
    isIllegalDetermination: false as const,
  };

  const m = matchOperator(snapshot, subject);

  // No authoritative registry match — explicitly NOT illegal.
  if (m.matchState === 'NO_MATCH') {
    return {
      ...base, resolutionState: 'NO_MATCH', matchState: m.matchState, legalStanding: 'NO_MATCH',
      resolvedOperatorId: null, candidateOperatorIds: [], licenceId: null, freshness: 'UNKNOWN',
      requiresHumanReview: false, provenance: { sourceRecordIds: [], evidenceReferences: [] },
      note: 'No authoritative registry match found. This is NOT a determination of illegality.',
    };
  }

  // Ambiguous → human review, never a silent pick.
  if (m.matchState === 'MULTIPLE_CANDIDATES' || m.requiresReview) {
    return {
      ...base, resolutionState: 'MULTIPLE_MATCHES', matchState: m.matchState, legalStanding: 'REQUIRES_HUMAN_REVIEW',
      resolvedOperatorId: null, candidateOperatorIds: m.candidateOperatorIds, licenceId: null, freshness: 'UNKNOWN',
      requiresHumanReview: true, provenance: { sourceRecordIds: [], evidenceReferences: [] },
      note: 'Multiple authoritative candidates — routed to human review.',
    };
  }

  const operatorId = m.resolvedOperatorId as string;
  const licences = snapshot.licences.filter((l) => l.operatorId === operatorId && l.jurisdiction === subject.jurisdiction);
  const licence = licences[0] ?? null;
  const relatedSources = snapshot.sourceRecords.filter(
    (r) => licence && (r.subjectReference === licence.licenceReference) && r.jurisdiction === subject.jurisdiction,
  );

  // Source conflict on the matched licence → never silently resolved.
  const conflict = detectConflict(relatedSources);
  if (conflict.conflict) {
    return {
      ...base, resolutionState: conflict.requiresHumanReview ? 'REQUIRES_REVIEW' : 'SOURCE_CONFLICT',
      matchState: m.matchState, legalStanding: conflict.requiresHumanReview ? 'REQUIRES_HUMAN_REVIEW' : 'CONFLICTING_SOURCE_DATA',
      resolvedOperatorId: operatorId, candidateOperatorIds: m.candidateOperatorIds, licenceId: licence?.licenceId ?? null,
      freshness: 'UNKNOWN', requiresHumanReview: true,
      provenance: { sourceRecordIds: conflict.records, evidenceReferences: relatedSources.map((r) => r.evidenceReference ?? '').filter(Boolean) },
      note: 'Conflicting authoritative source data — not silently resolved.',
    };
  }

  // Standing derives from the authoritative licence status ONLY.
  const standing = licenceToStanding(licence?.status);
  const fresh = freshness(licence?.lastVerifiedAt, now, policy);
  const stale = fresh === 'STALE';
  return {
    ...base,
    resolutionState: stale ? 'MATCHED_BUT_STALE' : 'MATCHED_AUTHORITATIVE',
    matchState: m.matchState,
    legalStanding: standing,
    resolvedOperatorId: operatorId,
    candidateOperatorIds: m.candidateOperatorIds,
    licenceId: licence?.licenceId ?? null,
    freshness: fresh,
    requiresHumanReview: false,
    provenance: { sourceRecordIds: relatedSources.map((r) => r.recordId), evidenceReferences: relatedSources.map((r) => r.evidenceReference ?? '').filter(Boolean) },
    note: stale ? 'Matched authoritative record, but verification is stale.' : 'Matched authoritative registry record.',
  };
}

/** Map an authoritative licence status to a legal standing. There is deliberately
 *  no path to `ILLEGAL`. SUSPENDED/REVOKED only ever come from the licence status,
 *  which is only set from an authoritative regulator record. */
function licenceToStanding(status: string | undefined): LegalStanding {
  switch (status) {
    case 'LICENSED': return 'LICENSED';
    case 'EXPIRED': return 'EXPIRED';
    case 'LAPSED': return 'LAPSED';
    case 'SUSPENDED': return 'SUSPENDED';
    case 'REVOKED': return 'REVOKED';
    case 'UNKNOWN': return 'UNKNOWN';
    default: return 'NOT_CURRENTLY_VERIFIED';
  }
}
