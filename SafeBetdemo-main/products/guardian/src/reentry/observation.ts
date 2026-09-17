// ─── SafeBet Guardian — continuous / follow-up verification observation (ARCH-V4-C10 §5/§6/§7/§8/§25) ─
//
// Formalises repeated verification observations AFTER a C9 ACTIONED/VERIFIED outcome. Append-only,
// synthetic, bounded scheduling only (no high-frequency uncontrolled scanning; no real crawl/DNS/
// provider query). Observations are FACTUAL states — never an "illegal-again" or "auto re-enforce" conclusion.
// A historic VERIFIED record is NEVER rewritten; a later contrary observation is appended.

import type {
  OrchestrationReferenceSnapshot, ReentrySignal, VerificationObservationOutcome,
  VerificationObservationResult, VerificationType, ObservationKind,
} from './types.ts';

const ACTION_VERIFICATION: Record<string, VerificationType> = {
  DOMAIN_BLOCK: 'DOMAIN_UNAVAILABLE', DNS_POLICY: 'DNS_POLICY_OBSERVED', HOSTING_REFERRAL: 'HOSTING_STATUS_CHANGED',
  REGISTRAR_REFERRAL: 'REGISTRAR_STATUS_CHANGED', APP_PLATFORM_REFERRAL: 'APP_LISTING_CHANGED',
  PAYMENT_REFERRAL: 'PAYMENT_CHANNEL_STATUS_CHANGED', GEO_RESTRICTION: 'GEO_RESTRICTION_OBSERVED', MONITOR_ONLY: 'OTHER',
};

// The synthetic "expected" post-enforcement state per action (e.g. a blocked domain is unavailable).
const EXPECTED_STATE: Record<VerificationType, string> = {
  DOMAIN_UNAVAILABLE: 'TARGET_UNAVAILABLE', DNS_POLICY_OBSERVED: 'DNS_POLICY_ACTIVE',
  HOSTING_STATUS_CHANGED: 'HOSTING_SUSPENDED', REGISTRAR_STATUS_CHANGED: 'REGISTRAR_HOLD',
  APP_LISTING_CHANGED: 'LISTING_REMOVED', PAYMENT_CHANNEL_STATUS_CHANGED: 'PAYMENT_CHANNEL_BLOCKED',
  GEO_RESTRICTION_OBSERVED: 'GEO_RESTRICTED', OTHER: 'MONITORED',
};

/** Build a bounded follow-up verification observation from a synthetic signal. The result is a
 *  factual observational state; it never asserts illegality and never mutates prior verification. */
export function buildVerificationObservation(
  orchestration: OrchestrationReferenceSnapshot,
  signal: ReentrySignal,
  observationKind: ObservationKind = 'FOLLOWUP',
): VerificationObservationOutcome {
  const verificationType = ACTION_VERIFICATION[orchestration.actionType] ?? 'OTHER';
  const expected = EXPECTED_STATE[verificationType];
  const observedState = signal.observedState;

  let result: VerificationObservationResult;
  if (!observedState) result = 'INCONCLUSIVE';
  else if (observedState === expected) result = 'EXPECTED_STATE_OBSERVED';
  else if (observedState === 'TARGET_AVAILABLE') result = 'TARGET_AVAILABLE';
  else if (observedState === 'TARGET_UNAVAILABLE') result = 'TARGET_UNAVAILABLE';
  else if (observedState === 'TARGET_CHANGED') result = 'TARGET_CHANGED';
  else if (observedState === 'REFERENCE_NOT_FOUND') result = 'REFERENCE_NOT_FOUND';
  else result = 'EXPECTED_STATE_NOT_OBSERVED';

  return { verificationType, observationKind, observedState: observedState || '', result };
}

/** A follow-up observation indicates a possible re-entry when the enforced/expected state no
 *  longer holds (target available / changed / expected-state-not-observed). Expected-state-still-
 *  observed and target-unavailable are NOT re-entry. */
export function indicatesReentry(outcome: VerificationObservationOutcome): boolean {
  return outcome.result === 'TARGET_AVAILABLE'
    || outcome.result === 'TARGET_CHANGED'
    || outcome.result === 'EXPECTED_STATE_NOT_OBSERVED';
}

/** True when a provider claimed ACTIONED but independent verification did NOT confirm it (§25):
 *  record the discrepancy → FOLLOW_UP_REQUIRED; never silently convert to VERIFIED. */
export function actionedButNotVerified(orchestration: OrchestrationReferenceSnapshot): boolean {
  return orchestration.latestProviderState === 'ACTIONED' && orchestration.latestVerificationState === 'NOT_VERIFIED';
}
