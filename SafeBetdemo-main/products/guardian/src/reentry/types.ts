// ─── SafeBet Guardian — Re-entry Intelligence & Continuous Verification types (ARCH-V4-C10) ─
//
// C10 is the POST-ORCHESTRATION lifecycle: provider follow-up, continuous verification, and
// re-entry monitoring. It produces INTELLIGENCE + VERIFICATION + ROUTING only. It never
// enforces, never sets provider states, never creates C8 authority, never widens C8 scope, and
// cannot enqueue C9 enforcement.
//
// SAFETY IDENTITIES (encoded + tested):
//   RE-ENTRY DETECTED != ILLEGALITY DETERMINED · RE-ENTRY DETECTED != EXISTING AUTHORITY APPLIES
//   SIMILAR TARGET != SAME OPERATOR · SHARED INFRASTRUCTURE != SAME ENTITY
//   EXISTING AUTHORITY != AUTOMATIC NEW PROVIDER REQUEST · HISTORIC VERIFIED != PERMANENTLY VERIFIED

/** Bounded C9 Orchestration Reference Contract snapshot C10 consumes (never C9 base tables). */
export interface OrchestrationReferenceSnapshot {
  orchestrationReference: string;
  authorisationReference: string;
  actionType: string;
  targetType: string;
  targetReference: string;
  jurisdiction: string;
  providerChannel: string | null;
  orchestrationStatus: string;
  latestProviderState: string | null;
  latestVerificationState: string | null;   // VERIFIED | NOT_VERIFIED | INCONCLUSIVE | null
  createdAt: string | null;
  closedAt: string | null;
  referenceStatus: 'ACTIVE' | 'REFERENCE_NOT_FOUND';
}

// §7 — bounded observational verification states (factual/synthetic; never an "illegal-again" state).
export type VerificationObservationResult =
  | 'EXPECTED_STATE_OBSERVED' | 'EXPECTED_STATE_NOT_OBSERVED' | 'INCONCLUSIVE'
  | 'TARGET_UNAVAILABLE' | 'TARGET_AVAILABLE' | 'TARGET_CHANGED' | 'REFERENCE_NOT_FOUND' | 'REQUIRES_REVIEW';

export type VerificationType =
  | 'DOMAIN_UNAVAILABLE' | 'DNS_POLICY_OBSERVED' | 'HOSTING_STATUS_CHANGED' | 'REGISTRAR_STATUS_CHANGED'
  | 'APP_LISTING_CHANGED' | 'PAYMENT_CHANNEL_STATUS_CHANGED' | 'GEO_RESTRICTION_OBSERVED' | 'OTHER';

export type ObservationKind = 'INITIAL' | 'FOLLOWUP' | 'PERIODIC';

// §10 — deterministic correlation labels (NOT legal findings).
export type ReentryRelationshipType =
  | 'SAME_TARGET_REAPPEARED' | 'KNOWN_ALIAS' | 'MIRROR_REFERENCE' | 'REDIRECT_RELATIONSHIP'
  | 'BRAND_RELATIONSHIP' | 'ENTITY_RELATIONSHIP' | 'INFRASTRUCTURE_REUSE' | 'APP_RELISTING'
  | 'PAYMENT_REFERENCE_REUSE' | 'GEO_AVAILABILITY_CHANGE' | 'UNKNOWN_RELATIONSHIP';

// §12 — re-entry reason codes (no automatic legal conclusion).
export type ReentryReasonCode =
  | 'ORIGINAL_TARGET_REAPPEARED' | 'KNOWN_ALIAS_OBSERVED' | 'MIRROR_TARGET_OBSERVED'
  | 'REDIRECT_RELATIONSHIP_OBSERVED' | 'COMMON_BRAND_REFERENCE' | 'COMMON_OPERATOR_REFERENCE'
  | 'COMMON_PAYMENT_REFERENCE' | 'COMMON_APP_REFERENCE' | 'COMMON_INFRASTRUCTURE_REFERENCE'
  | 'GEO_AVAILABILITY_CHANGED' | 'PRIOR_VERIFIED_ACTION_EXISTS' | 'AUTHORITY_COVERAGE_UNKNOWN'
  | 'EXISTING_AUTHORITY_EXPIRED' | 'EXISTING_AUTHORITY_WITHDRAWN' | 'NEW_TARGET_OUTSIDE_SCOPE'
  | 'SOURCE_CONFLICT' | 'INSUFFICIENT_EVIDENCE';

// §11 — deterministic REVIEW PRIORITY (never an illegality / re-enforcement / enforcement score).
export type ReviewPriority = 'LOW' | 'MEDIUM' | 'HIGH';

// §22 — candidate state machine (never BLOCKED/REMOVED/ENFORCED as a detection state).
export type ReentryCandidateState =
  | 'DETECTED' | 'TRIAGED' | 'REQUIRES_REVIEW' | 'RELATIONSHIP_CONFIRMED' | 'FALSE_POSITIVE'
  | 'COVERAGE_REVIEW_REQUIRED' | 'EXISTING_AUTHORITY_PATH' | 'NEW_INVESTIGATION_REQUIRED'
  | 'ROUTED_TO_C8' | 'CLOSED';

// §16 — authority-coverage assessment (internal routing assessment; never the final legal call).
export type CoverageState =
  | 'EXPLICITLY_COVERED' | 'NOT_COVERED' | 'COVERAGE_UNCLEAR' | 'AUTHORITY_EXPIRED'
  | 'AUTHORITY_WITHDRAWN' | 'AUTHORITY_SUPERSEDED' | 'REQUIRES_C8_REVIEW';

// §21 — human review outcomes (no AUTO_BLOCK_APPROVED).
export type ReentryReviewOutcome =
  | 'SAME_TARGET_CONFIRMED' | 'RELATED_TARGET_CONFIRMED' | 'RELATIONSHIP_UNRESOLVED' | 'FALSE_POSITIVE'
  | 'EXISTING_AUTHORITY_REVIEW_REQUIRED' | 'NEW_INVESTIGATION_REQUIRED' | 'INSUFFICIENT_EVIDENCE';

// §20 — routing outcomes (C10 records routing only; never authorises or dispatches).
export type ReentryRoutingOutcome =
  | 'EXISTING_AUTHORITY_REVIEW' | 'NEW_INVESTIGATION' | 'NEW_C8_AUTHORISATION_REQUIRED'
  | 'COVERAGE_REVIEW' | 'CLOSED_FALSE_POSITIVE';

export type RoutingTargetModule = 'C6_INVESTIGATION' | 'C8_AUTHORISATION' | 'NONE';

export type HumanReviewState = 'PENDING_REVIEW' | 'IN_REVIEW' | 'REVIEW_COMPLETE';

/** A synthetic re-entry signal (fixture/adapter only — never a real crawl/DNS/provider query). */
export interface ReentrySignal {
  signalType:
    | 'ORIGINAL_TARGET_REAPPEARED' | 'ALIAS' | 'MIRROR' | 'REDIRECT' | 'BRAND' | 'OPERATOR'
    | 'INFRASTRUCTURE' | 'APP_RELISTING' | 'PAYMENT_REUSE' | 'GEO_CHANGE' | 'NONE';
  candidateTargetType: string;
  candidateTargetReference: string;
  observedState: string;                     // synthetic observed state (e.g. TARGET_AVAILABLE)
  sourceReference: string;                    // synthetic source reference
  evidenceReference: string | null;          // C7 evidence reference (no body duplication)
  sharedReferences?: Partial<Record<'operator' | 'brand' | 'domain' | 'app' | 'payment' | 'infrastructure', string>>;
}

/** Explicit authority-coverage metadata (only an EXPLICIT statement can support coverage). */
export interface AuthorityCoverageMetadata {
  authorisationReference: string;
  status: 'AUTHORISED' | 'EXPIRED' | 'WITHDRAWN' | 'SUPERSEDED';
  // Explicit machine-readable coverage statement from C8 policy/authority scope. Absent => unclear.
  explicitlyCoversRelationshipTypes?: ReentryRelationshipType[];
  explicitlyCoversTargetReferences?: string[];
  jurisdiction: string;
}

export interface ReentryDetectionInput {
  jurisdiction: string;
  orchestration: OrchestrationReferenceSnapshot;
  signal: ReentrySignal;
  coverage?: AuthorityCoverageMetadata | null;   // existing authority metadata, if any
  now?: Date;
}

export interface VerificationObservationOutcome {
  verificationType: VerificationType;
  observationKind: ObservationKind;
  observedState: string;
  result: VerificationObservationResult;
}

export interface ReentryDecision {
  product: 'GUARDIAN';
  jurisdiction: string;
  reentryCandidateId: string | null;         // null => no candidate (expected state still holds)
  originalOrchestrationReference: string;
  originalTargetType: string;
  originalTargetReference: string;
  candidateTargetType: string | null;
  candidateTargetReference: string | null;
  candidateCreated: boolean;
  candidateState: ReentryCandidateState | null;
  relationshipType: ReentryRelationshipType | null;
  reasonCodes: ReentryReasonCode[];
  reviewPriority: ReviewPriority;
  coverageState: CoverageState;
  humanReviewState: HumanReviewState;
  verification: VerificationObservationOutcome;
  // SAFETY — always false/true by construction; asserted in tests.
  isIllegalityDetermined: false;
  isAuthorityApplied: false;
  isEnforcementDispatched: false;
  isRealObservationSource: false;
  isExternalNetworkCall: false;
  note: string;
}
