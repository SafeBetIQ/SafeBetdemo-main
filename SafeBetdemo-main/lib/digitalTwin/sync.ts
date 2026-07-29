// ─── Digital Twin live sync — projection observation (Phase 3.4) ─────────────
//
// Keeps the twin current by OBSERVING the Enterprise Projection Platform:
// Supabase Realtime `postgres_changes` on the three maintained projection
// tables. Distribution only — a changed projection row is routed onto the
// SAME runtime instance in the registry. The twin never subscribes to
// casino_event_log (that would bypass the Projection Platform), never
// re-derives state, never writes anything back.

import {
  MACHINE_TABLE, PLAYER_TABLE, SESSION_TABLE,
  type MachineState, type PlayerState, type SessionState,
} from '../projectionPlatform/index.ts';
import type { TwinRegistry } from './registry.ts';

export const OBSERVED_TABLES = [PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE] as const;
export type ObservedTable = (typeof OBSERVED_TABLES)[number];

/**
 * Route one changed projection row onto the single runtime instance.
 * Returns true when the row belonged to this twin's casino.
 */
export function applyProjectionChange(
  registry: TwinRegistry,
  table: string,
  row: Record<string, unknown>,
): boolean {
  if (row.casino_id !== registry.casinoId) return false;
  switch (table) {
    case PLAYER_TABLE:
      registry.upsertPlayer(row as unknown as PlayerState);
      return true;
    case SESSION_TABLE:
      registry.upsertSession(row as unknown as SessionState);
      return true;
    case MACHINE_TABLE:
      registry.upsertMachine(row as unknown as MachineState);
      return true;
    default:
      return false;
  }
}

/**
 * Minimal structural surface of a Realtime-capable supabase-js client.
 * Injected so the twin works identically in browser, Node and edge hosts
 * (and is fully testable without a network).
 */
export interface RealtimeCapableClient {
  // deno-lint-ignore no-explicit-any
  channel(name: string): any;
  // deno-lint-ignore no-explicit-any
  removeChannel(channel: any): unknown;
}

/**
 * Subscribe to projection-table changes for one casino.
 * Returns an unsubscribe function (used by the twin's dispose()).
 */
export function subscribeToProjections(
  client: RealtimeCapableClient,
  registry: TwinRegistry,
  onChange?: (table: ObservedTable) => void,
): () => void {
  let channel = client.channel(`digital-twin:${registry.casinoId}`);
  OBSERVED_TABLES.forEach(table => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `casino_id=eq.${registry.casinoId}` },
      (payload: { new?: Record<string, unknown> }) => {
        if (payload.new && applyProjectionChange(registry, table, payload.new)) {
          onChange?.(table);
        }
      },
    );
  });
  channel.subscribe();
  return () => { client.removeChannel(channel); };
}
