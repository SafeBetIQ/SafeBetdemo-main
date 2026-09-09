// ─── SafeBet Guardian — Case & Investigation Management types (ARCH-V4-C6) ────
//
// The governed HUMAN investigation layer between Guardian intelligence (C1–C5) and any
// FUTURE legal/enforcement workflow. SYNTHETIC ONLY. Produces a STRUCTURED case
// recommendation/record that is NEITHER a legal finding NOR an enforcement authorisation.
//
// INTELLIGENCE RESULT != LEGAL FINDING · CASE OPENED != ILLEGAL OPERATOR · HIGH PRIORITY
// CASE != ENFORCEMENT AUTHORISATION · INVESTIGATOR FINDING != FINAL LEGAL DETERMINATION ·
// CASE CLOSED != PROVIDER ACTION. No block/referral/takedown/enforcement.

export type CaseType = 'UNAUTHORISED_OPERATION_REVIEW' | 'DOMAIN_REVIEW' | 'MOBILE_APP_REVIEW' | 'PAYMENT_CHANNEL_REVIEW' | 'GEO_JURISDICTION_REVIEW' | 'ENTITY_RESOLUTION_REVIEW' | 'MULTI_SIGNAL_INVESTIGATION' | 'OTHER';
export type CaseStatus = 'DRAFT' | 'OPEN' | 'TRIAGE' | 'INVESTIGATING' | 'AWAITING_INFORMATION' | 'AWAITING_REVIEW' | 'REVIEWED' | 'CLOSED' | 'CANCELLED';
export type CasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CaseIntakeSource = 'MANUAL_SYNTHETIC_INTAKE' | 'INTELLIGENCE_REVIEW_PROMOTION' | 'SYSTEM_RECOMMENDED_CASE';

export type CaseSubjectType = 'OPERATOR' | 'BRAND' | 'LICENCE' | 'DOMAIN' | 'MOBILE_APP' | 'MERCHANT' | 'PAYMENT_CHANNEL' | 'GEO_SERVICE_REFERENCE' | 'OTHER_GUARDIAN_SUBJECT';
export type CaseSourceDomain = 'C1_REGISTRY' | 'C2_DOMAIN' | 'C3_APP' | 'C4_PAYMENT' | 'C5_GEO';

/** Bounded analyst finding states — NO ILLEGAL_OPERATOR_CONFIRMED. */
export type CaseFindingState = 'FACT_CONFIRMED' | 'REFERENCE_CONFIRMED' | 'INCONSISTENCY_CONFIRMED' | 'SOURCE_INSUFFICIENT' | 'SOURCE_CONFLICT' | 'ENTITY_RELATIONSHIP_CONFIRMED' | 'REQUIRES_FURTHER_INVESTIGATION' | 'FALSE_POSITIVE' | 'UNRESOLVED';
/** Bounded legal/regulatory review outcomes — NO external action. */
export type CaseReviewOutcome = 'SUFFICIENT_FOR_FURTHER_REVIEW' | 'INSUFFICIENT_EVIDENCE' | 'RETURN_TO_INVESTIGATION' | 'REFERENCE_VALIDATED' | 'CONFLICT_REQUIRES_RESOLUTION';
export type CaseClosureReason = 'FALSE_POSITIVE' | 'INSUFFICIENT_EVIDENCE' | 'DUPLICATE' | 'REFERENCE_RESOLVED' | 'NO_FURTHER_ACTION_AT_THIS_STAGE' | 'TRANSFERRED_FOR_FURTHER_REVIEW' | 'OTHER';
export type CaseRelationshipType = 'DUPLICATE_OF' | 'RELATED_TO' | 'PARENT_CASE' | 'CHILD_CASE' | 'COMMON_ENTITY' | 'COMMON_SIGNAL';
export type CaseRecommendation = 'CASE_REVIEW_RECOMMENDED' | 'ESCALATION_REVIEW_RECOMMENDED' | 'NO_CASE_RECOMMENDED';

export type CaseReasonCode =
  | 'MULTI_SIGNAL_CORRELATION'
  | 'NO_AUTHORITATIVE_REGISTRY_MATCH'
  | 'DOMAIN_REFERENCE_INCONSISTENCY'
  | 'APP_REFERENCE_INCONSISTENCY'
  | 'PAYMENT_REFERENCE_INCONSISTENCY'
  | 'GEO_JURISDICTION_INCONSISTENCY'
  | 'REGISTRY_SOURCE_CONFLICT'
  | 'INVESTIGATION_REQUIRED';

/** A synthetic intelligence reference carried into an intake (what was known at the time). */
export interface CaseIntelligenceReference {
  sourceDomain: CaseSourceDomain;
  sourceReference: string;
  referenceType: string;
  referenceState: string;                  // e.g. REFERENCED / NO_MATCH / SOURCE_CONFLICT / INCONSISTENT
  sourceAsOf?: string | null;
}

/** SYNTHETIC case intake fixture — references only (no duplicated entity/evidence body). */
export interface CaseIntakeFixture {
  intakeReference: string;
  jurisdiction: string;
  title: string;
  intelligenceReferences: CaseIntelligenceReference[];
  evidenceReference?: string | null;
  evidenceIntegrityHash?: string | null;
  contentHash: string;
}

export interface CaseSubjectRef { subjectType: CaseSubjectType; subjectReference: string; sourceDomain: CaseSourceDomain }

export interface CaseRecommendationResult {
  product: 'GUARDIAN';
  jurisdiction: string;
  caseReference: string;
  title: string;
  caseType: CaseType;
  priority: CasePriority;
  recommendation: CaseRecommendation;
  reviewRequired: boolean;
  reasonCodes: CaseReasonCode[];
  subjects: CaseSubjectRef[];
  intelligenceReferences: CaseIntelligenceReference[];
  provenance: { evidenceReferences: string[]; sourceReferences: string[] };
  isLegalDetermination: false;             // ALWAYS false
  isEnforcementAuthorised: false;          // ALWAYS false
  note: string;
}
