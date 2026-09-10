// ─── SafeBet Guardian — evidence hashing + custody hash chain (ARCH-V4-C7) ────
// LAYERED integrity (ADR-0017): an independent per-evidence tamper-evident hash chain
// (sequence_number + previous_event_hash → event_hash), anchored to Shared Audit.
// SHA-256. Deterministic — the same custody sequence recomputes the same hashes.

import { createHash } from 'node:crypto';
import type { CustodyEvent, CustodyEventType, EvidenceRole } from './types.ts';

export const CUSTODY_GENESIS = '0'.repeat(64);

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Deterministic content hash of a synthetic evidence body. */
export function hashEvidenceContent(syntheticBody: string): string {
  return sha256Hex(syntheticBody);
}

/** Event hash binds the event to its predecessor (previous_event_hash) → tamper-evident. */
export function computeCustodyEventHash(fields: {
  evidenceId: string; sequenceNumber: number; eventType: CustodyEventType; actor: string;
  actorRole: EvidenceRole; jurisdiction: string; occurredAt: string; previousEventHash: string;
}): string {
  const canonical = [
    fields.evidenceId, String(fields.sequenceNumber), fields.eventType, fields.actor,
    fields.actorRole, fields.jurisdiction, fields.occurredAt, fields.previousEventHash,
  ].join('|');
  return sha256Hex(canonical);
}

export interface AppendCustodyInput {
  evidenceId: string; eventType: CustodyEventType; actor: string; actorRole: EvidenceRole;
  jurisdiction: string; occurredAt: string; reason?: string | null; correlationId?: string | null;
}

/** Append one custody event to an existing (verified-order) chain, extending the hash chain. */
export function appendCustodyEvent(chain: CustodyEvent[], inp: AppendCustodyInput): CustodyEvent {
  const sequenceNumber = chain.length + 1;
  const previousEventHash = chain.length ? chain[chain.length - 1].eventHash : CUSTODY_GENESIS;
  const eventHash = computeCustodyEventHash({ ...inp, sequenceNumber, previousEventHash });
  return {
    custodyEventId: `GECE-${inp.evidenceId}-${sequenceNumber}`,
    evidenceId: inp.evidenceId, sequenceNumber, eventType: inp.eventType, actor: inp.actor,
    actorRole: inp.actorRole, jurisdiction: inp.jurisdiction, occurredAt: inp.occurredAt,
    reason: inp.reason ?? null, previousEventHash, eventHash, correlationId: inp.correlationId ?? null,
  };
}

export interface CustodyChainVerdict { ok: boolean; brokenAtSequence: number | null; reason?: string }

/** Verify a custody chain: sequence contiguity + each event_hash recomputes + links. */
export function verifyCustodyChain(chain: CustodyEvent[]): CustodyChainVerdict {
  let prev = CUSTODY_GENESIS;
  for (let i = 0; i < chain.length; i += 1) {
    const e = chain[i];
    if (e.sequenceNumber !== i + 1) return { ok: false, brokenAtSequence: e.sequenceNumber, reason: 'non-contiguous sequence' };
    if (e.previousEventHash !== prev) return { ok: false, brokenAtSequence: e.sequenceNumber, reason: 'previous-hash link mismatch' };
    const recomputed = computeCustodyEventHash({ evidenceId: e.evidenceId, sequenceNumber: e.sequenceNumber, eventType: e.eventType, actor: e.actor, actorRole: e.actorRole, jurisdiction: e.jurisdiction, occurredAt: e.occurredAt, previousEventHash: e.previousEventHash });
    if (recomputed !== e.eventHash) return { ok: false, brokenAtSequence: e.sequenceNumber, reason: 'event-hash mismatch (tamper)' };
    prev = e.eventHash;
  }
  return { ok: true, brokenAtSequence: null };
}

export type EvidenceIntegrityVerdict = 'VERIFIED' | 'INTEGRITY_FAILED' | 'UNVERIFIED';
/** Content integrity: recompute the body hash and compare to the recorded content hash. */
export function verifyEvidenceContent(recordedHash: string | null | undefined, syntheticBody: string | null | undefined): EvidenceIntegrityVerdict {
  if (!recordedHash) return 'UNVERIFIED';
  if (syntheticBody == null) return 'UNVERIFIED';
  return hashEvidenceContent(syntheticBody) === recordedHash ? 'VERIFIED' : 'INTEGRITY_FAILED';
}
