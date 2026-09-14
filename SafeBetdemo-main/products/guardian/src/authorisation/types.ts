// ─── SafeBet Guardian — Enforcement Policy & Authorisation types (ARCH-V4-C8) ─
//
// The HUMAN/legal authority layer BEFORE any future enforcement orchestration (C9). C8
// may create a human-approved AUTHORISED ACTION RECORD; it NEVER executes it, NEVER
// notifies a provider, NEVER performs an external action.
//
// INTELLIGENCE/CASE/EVIDENCE/POLICY MATCH != LEGAL DETERMINATION · LEGAL REVIEW !=
// ENFORCEMENT EXECUTION · AUTHORISATION != EXTERNAL PROVIDER ACTION.

/** AUTHORISABLE action types — NOT executable in C8 (no provider adapter, no outbound). */
export type ActionType = 'DOMAIN_BLOCK' | 'DNS_POLICY' | 'HOSTING_REFERRAL' | 'REGISTRAR_REFERRAL' | 'APP_PLATFORM_REFERRAL' | 'PAYMENT_REFERRAL' | 'GEO_RESTRICTION' | 'MONITOR_ONLY';
export type TargetType = 'DOMAIN' | 'MOBILE_APP' | 'MERCHANT' | 'PAYMENT_CHANNEL' | 'GEO_SERVICE_REFERENCE' | 'OPERATOR' | 'OTHER';
export type PolicyStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED_FOR_SYNTHETIC_USE' | 'ACTIVE' | 'SUSPENDED' | 'SUPERSEDED' | 'EXPIRED' | 'WITHDRAWN';
export type AuthorityReferenceType = 'REGULATORY_POLICY' | 'STATUTORY_REFERENCE' | 'COURT_ORDER_REFERENCE' | 'LICENSING_CONDITION' | 'INTERNAL_REGULATOR_DELEGATION' | 'EMERGENCY_AUTHORITY_REFERENCE' | 'OTHER';

export type PolicyApplicability = 'APPLICABLE' | 'POTENTIALLY_APPLICABLE' | 'NOT_APPLICABLE' | 'EXPIRED' | 'SUPERSEDED' | 'INSUFFICIENT_CONTEXT' | 'REQUIRES_LEGAL_REVIEW';
export type LegalReviewOutcome = 'SUFFICIENT_FOR_AUTHORISATION_REVIEW' | 'INSUFFICIENT_EVIDENCE' | 'POLICY_NOT_APPLICABLE' | 'AUTHORITY_NOT_ESTABLISHED' | 'JURISDICTION_MISMATCH' | 'RETURN_TO_INVESTIGATION' | 'ADDITIONAL_INFORMATION_REQUIRED';
export type AuthorisationStatus = 'PENDING' | 'AUTHORISED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED' | 'SUPERSEDED';

export type AuthReasonCode =
  | 'POLICY_NOT_FOUND' | 'POLICY_EXPIRED' | 'POLICY_SUPERSEDED' | 'AUTHORITY_NOT_ESTABLISHED'
  | 'JURISDICTION_MISMATCH' | 'EVIDENCE_MISSING' | 'EVIDENCE_INTEGRITY_FAILED' | 'LEGAL_REVIEW_REQUIRED'
  | 'LEGAL_REVIEW_INCOMPLETE' | 'SOD_VIOLATION' | 'SCOPE_INVALID' | 'AUTHORISER_NOT_PERMITTED'
  | 'CONDITION_NOT_MET' | 'ACTION_TYPE_NOT_PERMITTED' | 'AUTHORIZATION_EXPIRED' | 'POLICY_EXCEPTION_ESCALATION';

/** SYNTHETIC policy version fixture (registry input). */
export interface PolicyVersionFixture {
  policyId: string;
  versionId: string;
  jurisdiction: string;
  status: PolicyStatus;
  authorityReference: string;
  effectiveFrom: string;
  effectiveUntil: string;
  permittedActions: { actionType: ActionType; permitted: boolean; reviewRequired: boolean }[];
  minEvidenceTypes: number;
  requiredLegalReview: boolean;
  exceptions: ('COURT_REVIEW_REQUIRED' | 'CROSS_JURISDICTION_REVIEW' | 'INSUFFICIENT_AUTHORITY' | 'EXEMPT_CATEGORY' | 'MANUAL_ESCALATION_REQUIRED')[];
  maxAuthorisationDays: number;
}

/** A synthetic proposed enforcement action awaiting review + human authorisation. */
export interface ProposedActionInput {
  proposedActionId: string;
  caseReference: string;
  jurisdiction: string;
  actionType: ActionType;
  targetType: TargetType;
  targetReference: string;
  policyVersion: PolicyVersionFixture | null;
  evidence: { evidenceReference: string; integrityStatus: 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED'; jurisdiction: string }[];
  evidenceManifestReference?: string | null;
  evidenceManifestHash?: string | null;
  proposedBy: string;
}

/** The three synthetic principals for a single controlled authorisation decision. */
export interface AuthorisationPrincipals {
  investigatorId: string;
  legalReviewerId: string;
  legalReviewOutcome: LegalReviewOutcome | null;
  authorisingOfficerId: string;
  authorisingOfficerRole: 'INVESTIGATOR' | 'LEGAL_REVIEWER' | 'AUTHORISING_OFFICER' | 'SYSTEM_SERVICE';
  now?: Date;
}

export interface AuthorisationDecision {
  product: 'GUARDIAN';
  jurisdiction: string;
  proposedActionId: string;
  caseReference: string;
  actionType: ActionType;
  targetReference: string;
  policyVersionId: string | null;
  policyApplicability: PolicyApplicability;
  outcome: 'AUTHORISED' | 'AUTHORIZATION_BLOCKED';
  authorisationStatus: AuthorisationStatus;
  reasonCodes: AuthReasonCode[];
  authorisingOfficer: string | null;
  expiresAt: string | null;
  scopeSnapshot: { actionType: ActionType; targetType: TargetType; targetReference: string; jurisdiction: string; policyVersionId: string | null; caseReference: string; evidenceManifestHash: string | null };
  evidenceManifestHash: string | null;
  // C8 authorises; it NEVER executes or notifies a provider.
  isLegalDetermination: false;         // C8 records a human legal/regulatory AUTHORISATION, not an automated legal determination
  isEnforcementExecuted: false;        // ALWAYS false — no execution in C8
  isProviderNotified: false;           // ALWAYS false — no external side effect
  note: string;
}
