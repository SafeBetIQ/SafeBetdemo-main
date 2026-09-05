// ─── SafeBet Guardian — message envelope (ARCH-V4-C0) ────────────────────────
//
// Guardian uses the Shared message-envelope convention with product=GUARDIAN.
// Sensitive raw regulatory evidence is NEVER placed inline — the envelope carries
// only a payload_reference (a pointer to Shared Evidence), never the evidence body.

import { GUARDIAN_PRODUCT, GUARDIAN_SCHEMA_VERSION, type ProductTag } from './product.ts';

export interface GuardianEnvelope {
  product: ProductTag;         // GUARDIAN
  schemaVersion: string;       // GUARDIAN_SCHEMA_VERSION
  eventType: string;
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;          // ISO 8601
  payloadReference: string;    // pointer only — NEVER inline sensitive evidence
}

export class GuardianEnvelopeError extends Error {
  constructor(message: string) { super(message); this.name = 'GuardianEnvelopeError'; }
}

// Keys that must never appear inline in a queue envelope (defence in depth).
const FORBIDDEN_INLINE_KEYS = ['payload', 'evidence', 'evidenceBody', 'raw', 'rawEvidence', 'pii', 'bankData'];

export function makeEnvelope(input: Omit<GuardianEnvelope, 'product' | 'schemaVersion'> & Record<string, unknown>): GuardianEnvelope {
  for (const k of FORBIDDEN_INLINE_KEYS) {
    if (k in input) throw new GuardianEnvelopeError(`inline '${k}' is forbidden in a Guardian envelope — use payloadReference`);
  }
  const env: GuardianEnvelope = {
    product: GUARDIAN_PRODUCT,
    schemaVersion: GUARDIAN_SCHEMA_VERSION,
    eventType: input.eventType,
    jurisdiction: input.jurisdiction,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    payloadReference: input.payloadReference,
  };
  validateEnvelope(env);
  return env;
}

export function validateEnvelope(env: GuardianEnvelope): void {
  if (env.product !== GUARDIAN_PRODUCT) throw new GuardianEnvelopeError('envelope product must be GUARDIAN');
  for (const f of ['eventType', 'jurisdiction', 'correlationId', 'idempotencyKey', 'occurredAt', 'payloadReference'] as const) {
    if (!env[f] || typeof env[f] !== 'string') throw new GuardianEnvelopeError(`envelope.${f} required`);
  }
  if (Number.isNaN(Date.parse(env.occurredAt))) throw new GuardianEnvelopeError('envelope.occurredAt must be ISO 8601');
}
