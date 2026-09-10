// ─── SafeBet Guardian — Case intake worker logic (ARCH-V4-C6) ─────────────────
// Pure, idempotent. Synthetic fixtures only. Creates a synthetic investigation-case
// recommendation/record; NO enforcement, NO provider action, NO legal determination.

import { SYNTHETIC_CASE_FIXTURES } from './fixtures.ts';
import { analyseCaseIntake } from './correlation.ts';
import type { CaseRecommendationResult } from './types.ts';

export interface CaseIntakeMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.case.intake';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureIntakeReference: string;    // reference to a SYNTHETIC fixture — never a real case
}

export class CasePoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'CasePoisonMessageError'; }
}

export interface CaseWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: CaseRecommendationResult | null }

export class GuardianCaseWorker {
  private readonly seen = new Map<string, CaseWorkerOutput>();

  process(msg: CaseIntakeMessage): CaseWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.case.intake') throw new CasePoisonMessageError('not a Guardian case-intake message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new CasePoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_CASE_FIXTURES[msg.fixtureIntakeReference];
    if (!fx) throw new CasePoisonMessageError(`unknown synthetic case fixture: ${msg.fixtureIntakeReference}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new CasePoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };
    const result = analyseCaseIntake(fx);
    const out: CaseWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_CASE_QUEUE = 'guardian-case-intake' as const;
export const GUARDIAN_CASE_DLQ = 'guardian-case-intake-dlq' as const;
