// ─── Projection rebuild — replay from the immutable log (Phase 3.3) ─────────
//
// Projections are DISPOSABLE. This module deletes a casino's read models and
// reconstructs them completely by replaying casino_event_log in occurred_at
// order through the SAME pure reducers used on the live path. One code path,
// two entry points — live apply and rebuild can never diverge in logic.

import type { CasinoEventEnvelope } from '../eventPlatform/index.ts';
import { EVENT_LOG_TABLE } from '../eventPlatform/persistence.ts';
import { MACHINE_TABLE, PLAYER_TABLE, SESSION_TABLE } from './readModels.ts';
import { emptyStates, reduceEnvelopes, writeStates, type ProjectionStoreClient } from './apply.ts';

const PAGE_SIZE = 1000;

/** Inverse of persistence.envelopeToRow — exact 1:1, both directions. */
export function rowToEnvelope(row: Record<string, unknown>): CasinoEventEnvelope {
  return {
    eventId: row.event_id as string,
    correlationId: row.correlation_id as string,
    traceId: row.trace_id as string,
    tenantId: row.tenant_id as string,
    casinoId: row.casino_id as string,
    jurisdiction: row.jurisdiction as string,
    safeBetPlayerId: row.safebet_player_id as string,
    sessionId: (row.session_id as string | null) ?? null,
    machineId: (row.machine_id as string | null) ?? null,
    producer: row.producer as string,
    schemaVersion: row.schema_version as number,
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
    receivedAt: row.received_at as string,
    processedAt: row.processed_at as string,
    replayNumber: row.replay_number as number,
    idempotencyKey: (row.dedupe_key as string | undefined) ?? (row.event_id as string),
    payload: (row.payload as Record<string, unknown>) ?? {},
  };
}

export interface RebuildResult {
  casino_id: string;
  events_replayed: number;
  players_projected: number;
  sessions_projected: number;
  machines_projected: number;
}

/** Delete and completely rebuild one casino's projections from the log. */
export async function rebuildCasinoProjections(
  client: ProjectionStoreClient,
  casinoId: string,
): Promise<RebuildResult> {
  // 1. Dispose current read models — no information is lost; events are truth.
  for (const table of [PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE]) {
    const { error } = await client.from(table).delete().eq('casino_id', casinoId);
    if (error) throw new Error(`projection dispose failed (${table}): ${error.message}`);
  }

  // 2. Replay the immutable log in order through the same reducers.
  const states = emptyStates();
  let replayed = 0;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.from(EVENT_LOG_TABLE)
      .select('*')
      .eq('casino_id', casinoId)
      .order('occurred_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`event replay read failed: ${error.message}`);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;
    reduceEnvelopes(states, rows.map(rowToEnvelope));
    replayed += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  // 3. Materialize the reconstructed state.
  await writeStates(client, states);

  return {
    casino_id: casinoId,
    events_replayed: replayed,
    players_projected: states.players.size,
    sessions_projected: states.sessions.size,
    machines_projected: states.machines.size,
  };
}
