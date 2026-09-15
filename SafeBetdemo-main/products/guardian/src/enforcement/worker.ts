// ─── SafeBet Guardian — enforcement orchestration worker logic (ARCH-V4-C9) ───
// Pure, idempotent. DISPATCH path (separate from verification). Revalidates the C8 authorised
// action, selects a synthetic channel, builds+hashes the payload, dispatches via the SYNTHETIC
// adapter, maps the provider-originated state. NO real provider, NO external network call.

import { SyntheticProviderAdapter } from './adapter.ts';
import { orchestrate, guardianDispatchState } from './orchestration.ts';
import { SYNTHETIC_PROVIDER_CHANNELS, syntheticAuthorisedAction } from './fixtures.ts';
import type { OrchestrationDecision, AuthorisedActionSnapshot } from './types.ts';

export interface OrchestrationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.enforcement.orchestrate';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  authorisationReference: string;   // resolved to a bounded AuthorisedActionContract snapshot
  providerScenario: string;         // synthetic adapter scenario (fixtures only)
  attemptNo?: number;
}

export class OrchestrationPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'OrchestrationPoisonMessageError'; }
}

// Synthetic authorised-action snapshots keyed by reference (a real deployment reads the
// guardian.authorised_action contract view; the pure worker uses fixtures for determinism).
const AUTHORISED: Record<string, () => AuthorisedActionSnapshot | null> = {
  'AUTH-SYNTH-0001': () => syntheticAuthorisedAction(),
  'AUTH-EXPIRED': () => syntheticAuthorisedAction({ authorisationReference: 'AUTH-EXPIRED', expiresAt: '2020-01-01T00:00:00Z' }),
  'AUTH-WITHDRAWN': () => syntheticAuthorisedAction({ authorisationReference: 'AUTH-WITHDRAWN', status: 'WITHDRAWN' }),
  'AUTH-WC': () => syntheticAuthorisedAction({ authorisationReference: 'AUTH-WC', jurisdiction: 'ZA-WC' }),
  'AUTH-PAYMENT': () => syntheticAuthorisedAction({ authorisationReference: 'AUTH-PAYMENT', actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-REF-0001' }),
  'AUTH-APP': () => syntheticAuthorisedAction({ authorisationReference: 'AUTH-APP', actionType: 'APP_PLATFORM_REFERRAL', targetType: 'MOBILE_APP', targetReference: 'com.safebet.synthetic.bet003' }),
  'AUTH-NONE': () => null,
};

export interface OrchestrationWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; decision: OrchestrationDecision | null; guardianDispatchState: string }

export class GuardianEnforcementWorker {
  private readonly seen = new Map<string, OrchestrationWorkerOutput>();
  private readonly adapter = new SyntheticProviderAdapter();

  process(msg: OrchestrationMessage): OrchestrationWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.enforcement.orchestrate') throw new OrchestrationPoisonMessageError('not a Guardian enforcement-orchestration message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new OrchestrationPoisonMessageError('missing idempotencyKey/jurisdiction');
    const make = AUTHORISED[msg.authorisationReference];
    if (!make) throw new OrchestrationPoisonMessageError(`unknown synthetic authorisation reference: ${msg.authorisationReference}`);

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };

    const authorised = make();
    const requested = authorised
      ? { actionType: authorised.actionType, targetType: authorised.targetType, targetReference: authorised.targetReference, jurisdiction: msg.jurisdiction }
      : { actionType: 'DOMAIN_BLOCK' as const, targetType: 'DOMAIN' as const, targetReference: 'unknown', jurisdiction: msg.jurisdiction };
    const decision = orchestrate({
      orchestrationId: `ORCH-${msg.idempotencyKey}`, authorised, requested, channels: SYNTHETIC_PROVIDER_CHANNELS,
      attemptNo: msg.attemptNo ?? 1, dispatch: (h, n) => this.adapter.publishAuthorisedRequest({ requestPayloadHash: h, scenario: msg.providerScenario, attemptNo: n }),
      principalAuthenticated: true,   // the durable path is triggered only by an authenticated C8 handoff
    });
    const out: OrchestrationWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, decision, guardianDispatchState: guardianDispatchState(requested.actionType) };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_ENFORCEMENT_QUEUE = 'guardian-enforcement-orchestration' as const;
export const GUARDIAN_ENFORCEMENT_DLQ = 'guardian-enforcement-orchestration-dlq' as const;
