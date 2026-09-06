// ─── SafeBet Guardian — Mobile App observation worker logic (ARCH-V4-C3) ──────
// Pure, idempotent processing for the durable App Intelligence path (SQS → worker →
// DLQ). Synthetic fixtures only; NO real platform/network access; NO enforcement.

import type { RegistrySnapshot } from '../registry/types.ts';
import { SYNTHETIC_REGISTRY } from '../registry/snapshot.ts';
import { SYNTHETIC_APP_FIXTURES } from './fixtures.ts';
import { analyseApp } from './intelligence.ts';
import type { AppIntelligenceResult } from './types.ts';

export interface AppObservationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.app.observe';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureAppIdentifier: string;   // reference to a SYNTHETIC fixture — never a real app
}

export class AppPoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'AppPoisonMessageError'; }
}

export interface AppWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: AppIntelligenceResult | null }

export class GuardianAppWorker {
  private readonly seen = new Map<string, AppWorkerOutput>();
  private readonly registry: RegistrySnapshot;
  constructor(registry: RegistrySnapshot = SYNTHETIC_REGISTRY) { this.registry = registry; }

  process(msg: AppObservationMessage): AppWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.app.observe') throw new AppPoisonMessageError('not a Guardian app-observation message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new AppPoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_APP_FIXTURES[msg.fixtureAppIdentifier];
    if (!fx) throw new AppPoisonMessageError(`unknown synthetic app fixture: ${msg.fixtureAppIdentifier}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new AppPoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };
    const result = analyseApp(this.registry, fx, { observationId: `AOBS-${msg.idempotencyKey}` });
    const out: AppWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_APP_QUEUE = 'guardian-app-observation' as const;
export const GUARDIAN_APP_DLQ = 'guardian-app-observation-dlq' as const;
