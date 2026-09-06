// ─── SafeBet Guardian — Payment observation worker logic (ARCH-V4-C4) ─────────
// Pure, idempotent. Synthetic fixtures only; NO bank/PSP connection, NO payment
// instruction, NO enforcement.

import type { RegistrySnapshot } from '../registry/types.ts';
import { SYNTHETIC_REGISTRY } from '../registry/snapshot.ts';
import { SYNTHETIC_PAYMENT_FIXTURES } from './fixtures.ts';
import { analysePayment } from './intelligence.ts';
import type { PaymentIntelligenceResult } from './types.ts';

export interface PaymentObservationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.payment.observe';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureMerchantReference: string;   // reference to a SYNTHETIC fixture — never real payment data
}

export class PaymentPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'PaymentPoisonMessageError'; }
}

export interface PaymentWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: PaymentIntelligenceResult | null }

export class GuardianPaymentWorker {
  private readonly seen = new Map<string, PaymentWorkerOutput>();
  private readonly registry: RegistrySnapshot;
  constructor(registry: RegistrySnapshot = SYNTHETIC_REGISTRY) { this.registry = registry; }

  process(msg: PaymentObservationMessage): PaymentWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.payment.observe') throw new PaymentPoisonMessageError('not a Guardian payment-observation message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new PaymentPoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_PAYMENT_FIXTURES[msg.fixtureMerchantReference];
    if (!fx) throw new PaymentPoisonMessageError(`unknown synthetic payment fixture: ${msg.fixtureMerchantReference}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new PaymentPoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };
    const result = analysePayment(this.registry, fx, { observationId: `POBS-${msg.idempotencyKey}` });
    const out: PaymentWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_PAYMENT_QUEUE = 'guardian-payment-observation' as const;
export const GUARDIAN_PAYMENT_DLQ = 'guardian-payment-observation-dlq' as const;
