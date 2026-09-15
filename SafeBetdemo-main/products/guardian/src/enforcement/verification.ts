// ─── SafeBet Guardian — independent enforcement verification (ARCH-V4-C9 §15/§40) ─
// Verification is SEPARATE from dispatch (distinct function/component). ACTIONED != VERIFIED:
// only this verification process may set VERIFIED, using synthetic verification evidence — it
// never contacts real public infrastructure.

import type { VerificationType, VerificationResult } from './types.ts';
import type { ActionType } from '../authorisation/types.ts';

const ACTION_VERIFICATION: Record<ActionType, VerificationType> = {
  DOMAIN_BLOCK: 'DOMAIN_UNAVAILABLE', DNS_POLICY: 'DNS_POLICY_OBSERVED', HOSTING_REFERRAL: 'HOSTING_STATUS_CHANGED',
  REGISTRAR_REFERRAL: 'REGISTRAR_STATUS_CHANGED', APP_PLATFORM_REFERRAL: 'APP_LISTING_CHANGED',
  PAYMENT_REFERRAL: 'PAYMENT_CHANNEL_STATUS_CHANGED', GEO_RESTRICTION: 'GEO_RESTRICTION_OBSERVED', MONITOR_ONLY: 'OTHER',
};

export interface VerificationOutcome { verificationType: VerificationType; observedState: string; result: VerificationResult }

/** Independently verify a provider-claimed ACTIONED outcome against synthetic observation.
 *  Only a matching synthetic observation yields VERIFIED; a mismatch → NOT_VERIFIED (follow-up). */
export function verifyProviderOutcome(actionType: ActionType, providerActioned: boolean, syntheticObservation: { observedState: string; expectedState: string }): VerificationOutcome {
  const verificationType = ACTION_VERIFICATION[actionType];
  if (!providerActioned) return { verificationType, observedState: syntheticObservation.observedState, result: 'NOT_VERIFIED' };
  const result: VerificationResult = syntheticObservation.observedState === syntheticObservation.expectedState ? 'VERIFIED' : (syntheticObservation.observedState ? 'NOT_VERIFIED' : 'INCONCLUSIVE');
  return { verificationType, observedState: syntheticObservation.observedState, result };
}
