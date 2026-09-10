// ─── SafeBet Guardian — evidence registration worker logic (ARCH-V4-C7) ───────
// Pure, idempotent. Synthetic fixtures only. Registers evidence (hash + custody chain);
// NO enforcement, NO provider action, NO legal determination.

import { SYNTHETIC_EVIDENCE_FIXTURES } from './fixtures.ts';
import { registerEvidence } from './registration.ts';
import type { EvidenceRegistrationResult } from './types.ts';

export interface EvidenceRegistrationMessage {
  product: 'GUARDIAN';
  schemaVersion: string;
  eventType: 'guardian.evidence.register';
  jurisdiction: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  fixtureEvidenceReference: string;   // reference to a SYNTHETIC fixture — never real evidence
}

export class EvidencePoisonMessageError extends Error {
  constructor(message: string) { super(message); this.name = 'EvidencePoisonMessageError'; }
}

export interface EvidenceWorkerOutput { ok: boolean; duplicate: boolean; idempotencyKey: string; result: EvidenceRegistrationResult | null }

export class GuardianEvidenceWorker {
  private readonly seen = new Map<string, EvidenceWorkerOutput>();

  process(msg: EvidenceRegistrationMessage): EvidenceWorkerOutput {
    if (msg?.product !== 'GUARDIAN' || msg?.eventType !== 'guardian.evidence.register') throw new EvidencePoisonMessageError('not a Guardian evidence-registration message');
    if (!msg.idempotencyKey || !msg.jurisdiction) throw new EvidencePoisonMessageError('missing idempotencyKey/jurisdiction');
    const fx = SYNTHETIC_EVIDENCE_FIXTURES[msg.fixtureEvidenceReference];
    if (!fx) throw new EvidencePoisonMessageError(`unknown synthetic evidence fixture: ${msg.fixtureEvidenceReference}`);
    if (fx.jurisdiction !== msg.jurisdiction) throw new EvidencePoisonMessageError('fixture jurisdiction mismatch');

    const prior = this.seen.get(msg.idempotencyKey);
    if (prior) return { ...prior, duplicate: true };
    const result = registerEvidence(fx, { evidenceId: `GEV-${msg.idempotencyKey}` });
    const out: EvidenceWorkerOutput = { ok: true, duplicate: false, idempotencyKey: msg.idempotencyKey, result };
    this.seen.set(msg.idempotencyKey, out);
    return out;
  }

  processedCount(): number { return this.seen.size; }
}

export const GUARDIAN_EVIDENCE_QUEUE = 'guardian-evidence-processing' as const;
export const GUARDIAN_EVIDENCE_DLQ = 'guardian-evidence-processing-dlq' as const;
