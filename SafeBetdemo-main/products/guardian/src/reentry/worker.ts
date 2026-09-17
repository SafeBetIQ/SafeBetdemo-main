// ─── SafeBet Guardian — re-entry intelligence worker logic (ARCH-V4-C10 §30/§37/§40/§45) ─
// Pure, idempotent. DETECTION path only. Reads the bounded C9 Orchestration Reference Contract
// (fixtures here for determinism; the durable worker reads guardian.orchestration_reference),
// builds a follow-up verification observation + a re-entry candidate for HUMAN REVIEW. It NEVER
// dispatches C9 enforcement, sets provider states, creates C8 authority, or determines illegality.

import { detectReentry } from './reentry.ts';
import {
  syntheticVerifiedOrchestration, SIGNAL_STILL_UNAVAILABLE, SIGNAL_SAME_TARGET_AVAILABLE,
  SIGNAL_KNOWN_ALIAS, SIGNAL_MIRROR, SIGNAL_APP_RELISTING, SIGNAL_PAYMENT_REUSE, SIGNAL_GEO_CHANGE,
  SIGNAL_OPERATOR_STRONG, SIGNAL_OPERATOR_WEAK, coverageExplicit, COVERAGE_EXPIRED, COVERAGE_WITHDRAWN,
} from './fixtures.ts';
import type { OrchestrationReferenceSnapshot, ReentrySignal, AuthorityCoverageMetadata, ReentryDecision } from './types.ts';

export interface ReentryMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.reentry.detect';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  orchestrationReference: string;   // synthetic orchestration reference fixture key
  signalFixture: string;            // synthetic re-entry signal fixture key
  coverageFixture?: string;         // optional explicit authority-coverage fixture key
}

export class ReentryPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'ReentryPoisonMessageError'; }
}

// Synthetic bounded C9 Orchestration Reference snapshots keyed by reference (fixtures).
const ORCHESTRATIONS: Record<string, () => OrchestrationReferenceSnapshot> = {
  'ORCH-SYNTH-0001': () => syntheticVerifiedOrchestration(),
  'ORCH-SYNTH-APP': () => syntheticVerifiedOrchestration({ orchestrationReference: 'ORCH-SYNTH-APP', actionType: 'APP_PLATFORM_REFERRAL', targetType: 'MOBILE_APP', targetReference: 'com.synthetic.reentry.app01' }),
  'ORCH-SYNTH-PAY': () => syntheticVerifiedOrchestration({ orchestrationReference: 'ORCH-SYNTH-PAY', actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-SYNTH-REUSE-01' }),
  'ORCH-SYNTH-NOTVERIFIED': () => syntheticVerifiedOrchestration({ orchestrationReference: 'ORCH-SYNTH-NOTVERIFIED', latestProviderState: 'ACTIONED', latestVerificationState: 'NOT_VERIFIED' }),
  'ORCH-SYNTH-WC': () => syntheticVerifiedOrchestration({ orchestrationReference: 'ORCH-SYNTH-WC', jurisdiction: 'ZA-WC' }),
};

const SIGNALS: Record<string, ReentrySignal> = {
  STILL_UNAVAILABLE: SIGNAL_STILL_UNAVAILABLE, SAME_TARGET: SIGNAL_SAME_TARGET_AVAILABLE, ALIAS: SIGNAL_KNOWN_ALIAS,
  MIRROR: SIGNAL_MIRROR, APP_RELISTING: SIGNAL_APP_RELISTING, PAYMENT_REUSE: SIGNAL_PAYMENT_REUSE,
  GEO_CHANGE: SIGNAL_GEO_CHANGE, OPERATOR_STRONG: SIGNAL_OPERATOR_STRONG, OPERATOR_WEAK: SIGNAL_OPERATOR_WEAK,
};

const COVERAGES: Record<string, AuthorityCoverageMetadata> = {
  EXPLICIT: coverageExplicit(), EXPIRED: COVERAGE_EXPIRED, WITHDRAWN: COVERAGE_WITHDRAWN,
};

export interface ReentryWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; decision: ReentryDecision | null }

export class GuardianReentryWorker {
  private readonly seen = new Map<string, ReentryWorkerOutput>();

  process(msg: ReentryMessage): ReentryWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.reentry.detect') throw new ReentryPoisonMessageError('not a Guardian re-entry-detection message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new ReentryPoisonMessageError('missing idempotencyKey/jurisdiction');
    const makeOrch = ORCHESTRATIONS[msg.orchestrationReference];
    if (!makeOrch) throw new ReentryPoisonMessageError(`unknown synthetic orchestration reference: ${msg.orchestrationReference}`);
    const signal = SIGNALS[msg.signalFixture];
    if (!signal) throw new ReentryPoisonMessageError(`unknown synthetic signal fixture: ${msg.signalFixture}`);
    const coverage = msg.coverageFixture ? (COVERAGES[msg.coverageFixture] ?? null) : null;
    if (msg.coverageFixture && !coverage) throw new ReentryPoisonMessageError(`unknown coverage fixture: ${msg.coverageFixture}`);

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };

    const decision = detectReentry({ jurisdiction: msg.jurisdiction, orchestration: makeOrch(), signal, coverage });
    const out: ReentryWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, decision };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_REENTRY_QUEUE = 'guardian-reentry-intelligence' as const;
export const GUARDIAN_REENTRY_DLQ = 'guardian-reentry-intelligence-dlq' as const;
