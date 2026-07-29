// ─── Event Persistence (Phase 3.2) ───────────────────────────────────────────
//
// Appends immutable envelopes to casino_event_log — the authoritative event
// store. Column-for-field mapping is exact: what is persisted IS the
// envelope. Immutability is enforced in the database itself (trigger refuses
// UPDATE/DELETE), supporting audit, replay, recovery, analytics, and future
// event sourcing.
//
// Infrastructure only: no reads, no interpretation, no aggregation.

import type { CasinoEventEnvelope } from './envelope.ts';

/**
 * Structural store client (satisfied by @supabase/supabase-js). The insert
 * path uses upsert-ignore-duplicates so producer retries de-duplicate at the
 * store (Phase 4.3): `.upsert(rows, { onConflict, ignoreDuplicates })` then
 * `.select('event_id')` returns ONLY the rows actually inserted.
 */
export interface EventStoreClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

export const EVENT_LOG_TABLE = 'casino_event_log';

/** Exact envelope → column mapping (1:1, both directions). */
export function envelopeToRow(e: CasinoEventEnvelope): Record<string, unknown> {
  return {
    event_id: e.eventId,
    correlation_id: e.correlationId,
    trace_id: e.traceId,
    tenant_id: e.tenantId,
    casino_id: e.casinoId,
    jurisdiction: e.jurisdiction,
    safebet_player_id: e.safeBetPlayerId,
    session_id: e.sessionId,
    machine_id: e.machineId,
    producer: e.producer,
    schema_version: e.schemaVersion,
    event_type: e.eventType,
    occurred_at: e.occurredAt,
    received_at: e.receivedAt,
    processed_at: e.processedAt,
    replay_number: e.replayNumber,
    dedupe_key: e.idempotencyKey,
    payload: e.payload,
  };
}

/**
 * Append envelopes to the event store, idempotently (Phase 4.3).
 *
 * Duplicate keys (casino_id, dedupe_key) are ignored — a retried event is
 * NOT re-appended and NOT returned. Returns exactly the envelopes that were
 * newly persisted, so the caller projects each event at most once
 * (exactly-once processing over at-least-once delivery). Ordering within the
 * returned set is preserved by occurredAt at projection time.
 */
export async function persistEnvelopes(
  client: EventStoreClient,
  envelopes: CasinoEventEnvelope[],
): Promise<CasinoEventEnvelope[]> {
  if (envelopes.length === 0) return [];
  // Conflict target includes occurred_at: the event store is range-partitioned
  // by occurred_at (Phase 4.3), so its uniqueness constraint carries the
  // partition key. occurred_at is stable across a producer's retries, so
  // (casino_id, dedupe_key, occurred_at) de-duplicates retries exactly.
  const { data, error } = await client.from(EVENT_LOG_TABLE)
    .upsert(envelopes.map(envelopeToRow), { onConflict: 'casino_id,dedupe_key,occurred_at', ignoreDuplicates: true })
    .select('event_id');
  if (error) throw new Error(`event persistence failed: ${error.message}`);

  // supabase-js returns exactly the rows inserted; duplicates (retries) are
  // absent, so an empty result means every event was already stored.
  const insertedIds = new Set((data ?? []).map((r: { event_id: string }) => r.event_id));
  return envelopes.filter(e => insertedIds.has(e.eventId));
}
