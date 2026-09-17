// ─── SafeBet Guardian — re-entry human review + routing (ARCH-V4-C10 §19–§22/§40/§43/§44) ─
//
// Human review is REQUIRED before any routing. Review outcomes never include AUTO_BLOCK_APPROVED.
// Routing RECORDS an outcome only — C10 cannot create C8 authorisation (AUTHORISATION_GRANTED),
// cannot set C9 provider states, and cannot enqueue C9 enforcement. The covered fast path still
// routes to a C8 authority review that must produce/confirm a valid AuthorisedActionContract
// before C9 may orchestrate — C10 itself never dispatches.

import type {
  ReentryReviewOutcome, ReentryCandidateState, CoverageState, ReentryRoutingOutcome,
  RoutingTargetModule, ReentryReasonCode,
} from './types.ts';

export type GuardianReentryReviewerRole = 'INVESTIGATOR' | 'LEGAL_REVIEWER';

/** Deterministic candidate-state transition for a human review outcome. */
export function applyReview(outcome: ReentryReviewOutcome): { nextState: ReentryCandidateState; humanReviewState: 'REVIEW_COMPLETE' } {
  const MAP: Record<ReentryReviewOutcome, ReentryCandidateState> = {
    SAME_TARGET_CONFIRMED: 'RELATIONSHIP_CONFIRMED',
    RELATED_TARGET_CONFIRMED: 'RELATIONSHIP_CONFIRMED',
    RELATIONSHIP_UNRESOLVED: 'REQUIRES_REVIEW',
    FALSE_POSITIVE: 'FALSE_POSITIVE',
    EXISTING_AUTHORITY_REVIEW_REQUIRED: 'COVERAGE_REVIEW_REQUIRED',
    NEW_INVESTIGATION_REQUIRED: 'NEW_INVESTIGATION_REQUIRED',
    INSUFFICIENT_EVIDENCE: 'REQUIRES_REVIEW',
  };
  return { nextState: MAP[outcome], humanReviewState: 'REVIEW_COMPLETE' };
}

export interface RoutingDecision {
  routingOutcome: ReentryRoutingOutcome;
  targetModule: RoutingTargetModule;
  nextCandidateState: ReentryCandidateState;
  reasonCodes: ReentryReasonCode[];
  // Always false — routing records an outcome; it never authorises or dispatches.
  isAuthorisationGranted: false;
  isEnforcementDispatched: false;
}

/** Route a reviewed candidate. The covered fast path (§19) requires BOTH an explicit
 *  EXPLICITLY_COVERED coverage assessment AND a human confirmation — and still only routes to a
 *  C8 authority review (never C9). Any expired/withdrawn/superseded/unclear/out-of-scope
 *  authority routes to a NEW C8 authorisation review (§16/§17/§18/§20). */
export function routeCandidate(inp: { reviewOutcome: ReentryReviewOutcome; coverageState: CoverageState }): RoutingDecision {
  const done = (routingOutcome: ReentryRoutingOutcome, targetModule: RoutingTargetModule, nextCandidateState: ReentryCandidateState, reasonCodes: ReentryReasonCode[]): RoutingDecision =>
    ({ routingOutcome, targetModule, nextCandidateState, reasonCodes, isAuthorisationGranted: false, isEnforcementDispatched: false });

  // Human said false positive → close, no action.
  if (inp.reviewOutcome === 'FALSE_POSITIVE') return done('CLOSED_FALSE_POSITIVE', 'NONE', 'CLOSED', []);

  // Human said new investigation → C6 intake.
  if (inp.reviewOutcome === 'NEW_INVESTIGATION_REQUIRED') return done('NEW_INVESTIGATION', 'C6_INVESTIGATION', 'NEW_INVESTIGATION_REQUIRED', []);

  // Unresolved / insufficient evidence → back to review (never routed onward).
  if (inp.reviewOutcome === 'RELATIONSHIP_UNRESOLVED' || inp.reviewOutcome === 'INSUFFICIENT_EVIDENCE') {
    return done('COVERAGE_REVIEW', 'NONE', 'REQUIRES_REVIEW', ['INSUFFICIENT_EVIDENCE']);
  }

  // Relationship confirmed OR existing-authority-review requested → coverage decides the C8 path.
  switch (inp.coverageState) {
    case 'EXPLICITLY_COVERED':
      // Fast path: to a C8 authority review that must confirm/produce a valid contract (no C9 here).
      return done('EXISTING_AUTHORITY_REVIEW', 'C8_AUTHORISATION', 'EXISTING_AUTHORITY_PATH', ['PRIOR_VERIFIED_ACTION_EXISTS']);
    case 'AUTHORITY_EXPIRED':
      return done('NEW_C8_AUTHORISATION_REQUIRED', 'C8_AUTHORISATION', 'ROUTED_TO_C8', ['EXISTING_AUTHORITY_EXPIRED']);
    case 'AUTHORITY_WITHDRAWN':
    case 'AUTHORITY_SUPERSEDED':
      return done('NEW_C8_AUTHORISATION_REQUIRED', 'C8_AUTHORISATION', 'ROUTED_TO_C8', ['EXISTING_AUTHORITY_WITHDRAWN']);
    case 'NOT_COVERED':
      return done('NEW_C8_AUTHORISATION_REQUIRED', 'C8_AUTHORISATION', 'ROUTED_TO_C8', ['NEW_TARGET_OUTSIDE_SCOPE']);
    case 'REQUIRES_C8_REVIEW':
      return done('NEW_C8_AUTHORISATION_REQUIRED', 'C8_AUTHORISATION', 'ROUTED_TO_C8', ['NEW_TARGET_OUTSIDE_SCOPE']);
    case 'COVERAGE_UNCLEAR':
    default:
      return done('COVERAGE_REVIEW', 'C8_AUTHORISATION', 'COVERAGE_REVIEW_REQUIRED', ['AUTHORITY_COVERAGE_UNKNOWN']);
  }
}
