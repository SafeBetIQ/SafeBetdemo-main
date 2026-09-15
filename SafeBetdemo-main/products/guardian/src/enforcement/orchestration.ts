// ─── SafeBet Guardian — enforcement orchestration engine (ARCH-V4-C9) ─────────
//
// Deterministic. Strict path: only a REVALIDATED C8 AuthorisedActionContract can enter
// orchestration (no detection->enforcement, no scope widening). Guardian sets internal states
// (READY/PUBLISHED/REFERRED); provider states come ONLY from the synthetic adapter result.
// ACKNOWLEDGED != ACTIONED; ACTIONED != VERIFIED. No real provider / external network call.

import { revalidateAuthorisation, type RequestedScope } from './revalidation.ts';
import { buildProviderPayload, hashProviderPayload } from './payload.ts';
import type { AuthorisedActionSnapshot, ProviderChannel, OrchestrationDecision, SyntheticProviderResult, OrchestrationStatus, OrchestrationReasonCode } from './types.ts';

const REFERRAL_ACTIONS = new Set(['HOSTING_REFERRAL', 'REGISTRAR_REFERRAL', 'APP_PLATFORM_REFERRAL', 'PAYMENT_REFERRAL']);

/** Select + validate a provider channel for the authorised action (jurisdiction + supported). */
export function selectChannel(a: AuthorisedActionSnapshot, channels: ProviderChannel[]): { channel: ProviderChannel | null; reason: OrchestrationReasonCode | null } {
  const inJur = channels.filter((c) => c.jurisdiction === a.jurisdiction);
  if (inJur.length === 0) return { channel: null, reason: 'NO_PROVIDER_CHANNEL' };
  const supporting = inJur.find((c) => c.supportedActionTypes.includes(a.actionType));
  if (!supporting) return { channel: null, reason: 'ACTION_NOT_SUPPORTED_BY_CHANNEL' };
  return { channel: supporting, reason: null };
}

export interface OrchestrateInput {
  orchestrationId: string;
  authorised: AuthorisedActionSnapshot | null;
  requested: RequestedScope;
  channels: ProviderChannel[];
  requestVersion?: number;
  attemptNo: number;
  dispatch: (payloadHash: string, attemptNo: number) => SyntheticProviderResult;   // synthetic adapter closure
  principalAuthenticated: boolean;                                                  // §2/§49 edge binding
  now?: Date;
}

export function orchestrate(inp: OrchestrateInput): OrchestrationDecision {
  const now = inp.now ?? new Date();
  const base = (status: OrchestrationStatus, reasonCodes: OrchestrationReasonCode[], channel: string | null, hash: string | null): OrchestrationDecision => ({
    product: 'GUARDIAN', jurisdiction: inp.requested.jurisdiction, orchestrationId: inp.orchestrationId,
    authorisationReference: inp.authorised?.authorisationReference ?? 'unknown', actionType: inp.requested.actionType,
    targetReference: inp.requested.targetReference, providerChannel: channel, status, reasonCodes,
    requestPayloadHash: hash, requestVersion: inp.requestVersion ?? 1, isRealProvider: false, isExternalNetworkCall: false,
    note: 'Synthetic enforcement orchestration — Guardian orchestrates/refers an authorised request; the external synthetic provider performs the provider-side action. No real provider, no external network call, no automatic enforcement.',
  });

  // §2/§49: caller cannot self-assert authority — the principal must be authenticated upstream.
  if (!inp.principalAuthenticated) return base('ORCHESTRATION_BLOCKED', ['PRINCIPAL_NOT_AUTHENTICATED'], null, null);

  // §4/§5: revalidate the authorisation immediately (no stale snapshot).
  const reval = revalidateAuthorisation(inp.authorised, inp.requested, now);
  if (!reval.ok || !inp.authorised) return base('ORCHESTRATION_BLOCKED', reval.reasonCodes, null, null);

  // Channel selection.
  const { channel, reason } = selectChannel(inp.authorised, inp.channels);
  if (!channel) return base('ORCHESTRATION_BLOCKED', [reason!], null, null);

  // Immutable authorised payload + hash (retries reuse the same hash).
  const payload = buildProviderPayload(inp.authorised, inp.requestVersion ?? 1);
  const hash = hashProviderPayload(payload);

  // Synthetic dispatch.
  const result = inp.dispatch(hash, inp.attemptNo);
  if (!result.delivered) {
    // Technical delivery failure — retryable; NOT a provider decline. Stays READY.
    return base('READY', [], channel.providerChannelId, hash);
  }
  // Guardian-set published/referred state, then map the PROVIDER-originated state.
  const providerStatus: OrchestrationStatus = (result.providerState as OrchestrationStatus) ?? 'ACKNOWLEDGED';
  // ACTIONED is provider-claimed only — it is NOT VERIFIED here (verification is a separate step).
  return base(providerStatus, [], channel.providerChannelId, hash);
}

/** Guardian's own dispatch state before mapping the provider response (PUBLISHED vs REFERRED). */
export function guardianDispatchState(actionType: string): OrchestrationStatus {
  return REFERRAL_ACTIONS.has(actionType) ? 'REFERRED' : 'PUBLISHED';
}
