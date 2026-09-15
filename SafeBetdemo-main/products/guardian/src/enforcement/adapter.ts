// ─── SafeBet Guardian — SYNTHETIC provider adapter (ARCH-V4-C9 §36/§37/§38) ───
//
// Provider-neutral adapter CONTRACT with a SYNTHETIC-ONLY implementation. There is NO real
// HTTP/provider endpoint, NO real IP/DNS name, NO provider credential, NO arbitrary URL input
// (no SSRF surface). Provider-originated states come ONLY from this adapter's deterministic
// synthetic result — Guardian never fabricates a provider acknowledgement elsewhere.

import type { ProviderState, ProviderReasonCode, SyntheticProviderResult } from './types.ts';

export interface ProviderAdapter {
  publishAuthorisedRequest(input: { requestPayloadHash: string; scenario: string; attemptNo: number }): SyntheticProviderResult;
}

/** Deterministic synthetic behaviours keyed by a scenario token (fixtures only). */
const SCENARIOS: Record<string, { deliverFromAttempt: number; state: ProviderState | null; reason: ProviderReasonCode | null }> = {
  ACK_ACTIONED: { deliverFromAttempt: 1, state: 'ACTIONED', reason: null },
  ACKNOWLEDGED: { deliverFromAttempt: 1, state: 'ACKNOWLEDGED', reason: null },
  UNDER_REVIEW: { deliverFromAttempt: 1, state: 'UNDER_REVIEW', reason: null },
  MORE_INFO: { deliverFromAttempt: 1, state: 'MORE_INFO_REQUIRED', reason: 'INSUFFICIENT_INFORMATION' },
  DECLINED: { deliverFromAttempt: 1, state: 'DECLINED', reason: 'OUTSIDE_PROVIDER_SCOPE' },
  TECH_FAIL_THEN_OK: { deliverFromAttempt: 2, state: 'ACTIONED', reason: null }, // attempt 1 = technical failure
};

export class SyntheticProviderAdapter implements ProviderAdapter {
  publishAuthorisedRequest(input: { requestPayloadHash: string; scenario: string; attemptNo: number }): SyntheticProviderResult {
    const s = SCENARIOS[input.scenario] ?? SCENARIOS.ACK_ACTIONED;
    if (input.attemptNo < s.deliverFromAttempt) {
      // Technical delivery failure — NOT a provider decline. Retryable.
      return { delivered: false, providerState: null, providerReference: null, reasonCode: 'TECHNICAL_LIMITATION', requestPayloadHash: input.requestPayloadHash };
    }
    return {
      delivered: true, providerState: s.state, reasonCode: s.reason,
      providerReference: `SYN-PRV-${input.requestPayloadHash.slice(0, 12)}`, requestPayloadHash: input.requestPayloadHash,
    };
  }
}
