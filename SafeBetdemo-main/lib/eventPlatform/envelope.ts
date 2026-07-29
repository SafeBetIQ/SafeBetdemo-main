// ─── Enterprise Event Envelope (Phase 3.2) ───────────────────────────────────
//
// THE one immutable envelope every SafeBet IQ event travels in — through
// validation, enrichment, persistence, realtime distribution, and every
// future stage (projections, digital twin, engines, dashboards, regulator).
//
// Envelopes are append-only facts: never updated, never overwritten, never
// mutated. If something changes, another event is created. Instances are
// deep-frozen at creation.
//
// This module is pure type/constant/factory infrastructure — no I/O.

export const ENVELOPE_SCHEMA_VERSION = 1;

/** The complete event vocabulary of the enterprise platform. */
export const EVENT_TYPES = [
  // legacy
  'BET_PLACED', 'BET_RESULT', 'SESSION_START', 'SESSION_END', 'GAME_SPIN',
  'HAND_PLAYED', 'DEPOSIT', 'WITHDRAWAL', 'TIME_SPENT_UPDATE',
  'MACHINE_ACTIVITY', 'RISK_FLAG',
  // session lifecycle
  'CARD_INSERT', 'MACHINE_ALLOCATED', 'CASH_OUT', 'CARD_REMOVED', 'MACHINE_IDLE',
  // risk & intervention
  'RISK_ALERT', 'INTERVENTION_TRIGGERED',
  // specials
  'JACKPOT', 'MACHINE_FAULT', 'VIP_ACTIVITY', 'SELF_EXCLUSION', 'SECURITY_EVENT',
] as const;

export type CasinoEventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

/**
 * The immutable enterprise envelope. Every field is always present
 * (sessionId / machineId carry explicit null for non-session events).
 */
export interface CasinoEventEnvelope {
  readonly eventId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly tenantId: string;
  readonly casinoId: string;
  readonly jurisdiction: string;
  readonly safeBetPlayerId: string;
  readonly sessionId: string | null;
  readonly machineId: string | null;
  readonly producer: string;
  readonly schemaVersion: number;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly receivedAt: string;
  readonly processedAt: string;
  readonly replayNumber: number;
  /**
   * Producer-stable idempotency key (Phase 4.3, ADR-003). Retries that reuse
   * the key are de-duplicated at the store (at-least-once delivery →
   * exactly-once processing). Defaults to eventId when the producer supplies
   * none, preserving pre-4.3 behaviour (every event distinct).
   */
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * What a producer submits. Identity arrives EITHER as an already-resolved
 * SafeBet IQ Player ID (when Identity Resolution ran upstream, per the
 * lifecycle: Casino Event → Identity Resolution → Platform) OR as a raw
 * casino reference, which enrichment resolves through the Identity
 * Resolution Service exactly once.
 */
export interface CasinoEventDraft {
  eventType: string;
  occurredAt: string;
  safeBetPlayerId?: string;
  casinoPlayerRef?: string;
  sessionId?: string | null;
  machineId?: string | null;
  /** Correlates related events (a session journey). Defaults to sessionId. */
  correlationId?: string;
  /**
   * Optional producer idempotency key (Phase 4.3). Supply a stable value to
   * make retries safe: a re-ingest with the same key is de-duplicated and
   * never double-projected. Omit for one-shot events.
   */
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}

/** Freeze an envelope (and its payload) into an immutable fact. */
export function freezeEnvelope(envelope: CasinoEventEnvelope): CasinoEventEnvelope {
  Object.freeze(envelope.payload);
  return Object.freeze(envelope);
}
