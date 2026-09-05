// ─── SafeBet Guardian — foundation worker (ARCH-V4-C0) ───────────────────────
//
// A SYNTHETIC foundation worker proving the Guardian message path only:
//   Guardian message → Guardian queue → Guardian worker → Guardian result → Guardian audit.
// It performs NO crawling, NO detection, and NO enforcement. Idempotent by
// idempotency_key. Pure/in-memory at C0 (the queue namespace is `guardian-*`, kept
// separate from `safebet-iq-*`; a real SQS+DLQ path is a later milestone).

import { validateEnvelope, type GuardianEnvelope } from './envelope.ts';
import { GUARDIAN_PRODUCT } from './product.ts';

export interface GuardianWorkerResult {
  ok: boolean;
  product: typeof GUARDIAN_PRODUCT;
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  duplicate: boolean;
  auditContextRef: string;
}

/** In-memory idempotent processor. Re-processing the same idempotency_key returns
 *  the prior result marked duplicate (no double effect) — the core queue-worker
 *  idempotency guarantee, provable without external infrastructure at C0. */
export class GuardianFoundationWorker {
  private readonly seen = new Map<string, GuardianWorkerResult>();

  process(env: GuardianEnvelope): GuardianWorkerResult {
    validateEnvelope(env);
    if (env.product !== GUARDIAN_PRODUCT) {
      throw new Error('worker refuses non-Guardian message');
    }
    const prior = this.seen.get(env.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };

    const result: GuardianWorkerResult = {
      ok: true,
      product: GUARDIAN_PRODUCT,
      jurisdiction: env.jurisdiction,
      correlationId: env.correlationId,
      idempotencyKey: env.idempotencyKey,
      duplicate: false,
      auditContextRef: `guardian-audit:${env.jurisdiction}:${env.correlationId}`,
    };
    this.seen.set(env.idempotencyKey, result);
    return result;
  }

  processedCount(): number { return this.seen.size; }
}

/** The independent Guardian queue namespace prefix (never safebet-iq-*). */
export const GUARDIAN_QUEUE_PREFIX = 'guardian-' as const;
export const GUARDIAN_FOUNDATION_QUEUE = 'guardian-foundation-events' as const;
export const GUARDIAN_FOUNDATION_DLQ = 'guardian-foundation-events-dlq' as const;
