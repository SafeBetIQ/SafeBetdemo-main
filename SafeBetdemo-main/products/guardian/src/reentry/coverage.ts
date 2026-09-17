// ─── SafeBet Guardian — authority-coverage assessment (ARCH-V4-C10 §16/§17/§18) ─
//
// C10 does NOT make the final legal authority determination — this is an INTERNAL ROUTING
// assessment. Standing authority is NEVER inferred from same operator / similar domain / same
// brand / same payment reference / same infrastructure / same app name alone. Coverage may be
// treated as EXPLICITLY_COVERED ONLY when the C8 authority/policy scope EXPLICITLY says so
// (machine-readable coverage metadata). Absent explicit coverage => COVERAGE_UNCLEAR => C8 review.

import type { AuthorityCoverageMetadata, CoverageState, ReentryReasonCode, ReentryRelationshipType } from './types.ts';

export interface CoverageAssessment {
  coverageState: CoverageState;
  reasonCodes: ReentryReasonCode[];
  authorisationReference: string | null;
  // Always false — C10 never renders the final legal determination.
  isFinalLegalDetermination: false;
}

export interface CoverageInput {
  coverage: AuthorityCoverageMetadata | null | undefined;
  candidateTargetReference: string;
  relationshipType: ReentryRelationshipType;
  jurisdiction: string;
}

export function assessCoverage(inp: CoverageInput): CoverageAssessment {
  const c = inp.coverage;
  const reasonCodes: ReentryReasonCode[] = [];

  // No existing authority metadata at all → unclear, must go to C8 review.
  if (!c) {
    return { coverageState: 'COVERAGE_UNCLEAR', reasonCodes: ['AUTHORITY_COVERAGE_UNKNOWN'], authorisationReference: null, isFinalLegalDetermination: false };
  }

  // Authority no longer live → explicit expired/withdrawn/superseded → requires new C8 review.
  if (c.status === 'EXPIRED') return { coverageState: 'AUTHORITY_EXPIRED', reasonCodes: ['EXISTING_AUTHORITY_EXPIRED'], authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };
  if (c.status === 'WITHDRAWN') return { coverageState: 'AUTHORITY_WITHDRAWN', reasonCodes: ['EXISTING_AUTHORITY_WITHDRAWN'], authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };
  if (c.status === 'SUPERSEDED') return { coverageState: 'AUTHORITY_SUPERSEDED', reasonCodes: ['EXISTING_AUTHORITY_WITHDRAWN'], authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };

  // Jurisdiction must match exactly.
  if (c.jurisdiction !== inp.jurisdiction) {
    return { coverageState: 'REQUIRES_C8_REVIEW', reasonCodes: ['NEW_TARGET_OUTSIDE_SCOPE'], authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };
  }

  // EXPLICIT coverage only: the C8 scope must explicitly name this relationship class AND the
  // exact candidate target reference. Missing either → COVERAGE_UNCLEAR (never inferred).
  const coversRelationship = (c.explicitlyCoversRelationshipTypes ?? []).includes(inp.relationshipType);
  const coversTarget = (c.explicitlyCoversTargetReferences ?? []).includes(inp.candidateTargetReference);
  if (coversRelationship && coversTarget) {
    return { coverageState: 'EXPLICITLY_COVERED', reasonCodes: ['PRIOR_VERIFIED_ACTION_EXISTS'], authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };
  }

  // A live authority exists but does NOT explicitly cover this candidate → unclear, C8 review.
  reasonCodes.push('AUTHORITY_COVERAGE_UNKNOWN');
  if (!coversTarget) reasonCodes.push('NEW_TARGET_OUTSIDE_SCOPE');
  return { coverageState: 'COVERAGE_UNCLEAR', reasonCodes, authorisationReference: c.authorisationReference, isFinalLegalDetermination: false };
}
