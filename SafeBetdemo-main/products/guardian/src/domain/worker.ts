// ─── SafeBet Guardian — Domain observation worker logic (ARCH-V4-C2) ──────────
//
// Pure, idempotent processing for the durable Guardian domain-observation path
// (SQS → worker → DLQ). It performs ONLY synthetic C2 processing: normalise a
// domain, compute deterministic signals, compare against the registry (C1 contract),
// and produce a NON-LEGAL intelligence result. It does NO web crawling and NO DNS
// resolution — it operates on synthetic fixtures/payload references only.

import type { RegistrySnapshot } from '../registry/types.ts';
import { SYNTHETIC_REGISTRY } from '../registry/snapshot.ts';
import { SYNTHETIC_DOMAIN_FIXTURES } from './fixtures.ts';
import { analyseDomain } from './intelligence.ts';
import type { DomainIntelligenceResult } from './types.ts';

export interface DomainObservationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.domain.observe';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  /** Reference to a SYNTHETIC fixture — never an inline body, never a real URL to fetch. */
  fixtureHostname: string;
}

export class PoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'PoisonMessageError'; }
}

export interface DomainWorkerOutput {
  ok: boolean;
  duplicate: boolean;
  idempotencyKey: string;
  result: DomainIntelligenceResult | null;
}

/** Idempotent domain worker. Re-processing the same idempotency key returns the prior
 *  result marked duplicate (no duplicate authoritative observation). A malformed /
 *  unknown-fixture message throws PoisonMessageError so the caller can route it to the DLQ. */
export class GuardianDomainWorker {
  private readonly seen = new Map<string, DomainWorkerOutput>();
  private readonly registry: RegistrySnapshot;
  constructor(registry: RegistrySnapshot = SYNTHETIC_REGISTRY) { this.registry = registry; }

  process(msg: DomainObservationMessage): DomainWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.domain.observe') {
      throw new PoisonMessageError('not a Guardian domain-observation message');
    }
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new PoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_DOMAIN_FIXTURES[msg.fixtureHostname];
    if (!fx) throw new PoisonMessageError(`unknown synthetic fixture: ${msg.fixtureHostname}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new PoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };

    const result = analyseDomain(this.registry, fx, { observationId: `OBS-${msg.idempotencyKey}` });
    const out: DomainWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_DOMAIN_QUEUE = 'guardian-domain-observation' as const;
export const GUARDIAN_DOMAIN_DLQ = 'guardian-domain-observation-dlq' as const;
