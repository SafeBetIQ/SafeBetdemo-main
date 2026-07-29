// ─── Projection application (Phase 3.3) ──────────────────────────────────────
//
// Applies a batch of immutable envelopes to the read models:
// load current rows → run pure reducers in occurred_at order → upsert.
//
// At-least-once semantics with an immediate-duplicate guard
// (last_event_id); the rebuild path (rebuild.ts) is the authoritative
// corrector for any drift. Exactly-once ledgering arrives with the
// Digital Twin phase.

import type { CasinoEventEnvelope } from '../eventPlatform/index.ts';
import {
  MACHINE_TABLE, PLAYER_TABLE, SESSION_TABLE,
  newMachineState, newPlayerState, newSessionState,
  type MachineState, type PlayerState, type SessionState,
} from './readModels.ts';
import { reduceMachine, reducePlayer, reduceSession } from './reducers.ts';

// Session openers (mirrors reducers.ts). A newly-active session supersedes the
// same player's older open sessions — parity with the SQL trigger
// trg_supersede_prior_sessions so a full TS replay matches the SQL end-state.
const SESSION_OPENERS = new Set(['CARD_INSERT', 'MACHINE_ALLOCATED', 'SESSION_START']);

/**
 * Minimal structural store client (satisfied by @supabase/supabase-js).
 * The query-builder surface is too fluent to type structurally in full;
 * access is confined to this module and rebuild.ts.
 */
export interface ProjectionStoreClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
  // deno-lint-ignore no-explicit-any
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { message: string } | null }>;
}

export interface ProjectionStates {
  players: Map<string, PlayerState>;
  sessions: Map<string, SessionState>;
  machines: Map<string, MachineState>;
}

export function emptyStates(): ProjectionStates {
  return { players: new Map(), sessions: new Map(), machines: new Map() };
}

/** Pure in-memory reduction of envelopes into projection states. */
export function reduceEnvelopes(states: ProjectionStates, envelopes: CasinoEventEnvelope[]): ProjectionStates {
  const ordered = [...envelopes].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  for (const e of ordered) {
    const playerKey = `${e.casinoId}:${e.safeBetPlayerId}`;
    const prevPlayer = states.players.get(playerKey) ?? newPlayerState(e.casinoId, e.safeBetPlayerId);
    if (prevPlayer.last_event_id !== e.eventId) {
      states.players.set(playerKey, reducePlayer(prevPlayer, e));
    }

    if (e.sessionId) {
      const prevSession = states.sessions.get(e.sessionId)
        ?? newSessionState(e.sessionId, e.casinoId, e.safeBetPlayerId);
      if (prevSession.last_event_id !== e.eventId) {
        const next = reduceSession(prevSession, e);
        states.sessions.set(e.sessionId, next);
        // Supersession (SQL-trigger parity): a newly-active session ends the
        // same player's older open sessions. Idempotent — the duplicate guard
        // above means a replayed opener does not re-supersede.
        if (next.status === 'active' && SESSION_OPENERS.has(e.eventType)) {
          const cutoff = next.started_at ?? e.occurredAt;
          for (const [sid, s] of Array.from(states.sessions)) {
            if (sid !== e.sessionId
              && s.casino_id === e.casinoId && s.safebet_player_id === e.safeBetPlayerId
              && s.status === 'active' && (s.started_at ?? '') <= cutoff) {
              states.sessions.set(sid, { ...s, status: 'ended', ended_at: cutoff, ended_reason: 'superseded' });
            }
          }
        }
      }
    }

    if (e.machineId) {
      const machineKey = `${e.casinoId}:${e.machineId}`;
      const prevMachine = states.machines.get(machineKey) ?? newMachineState(e.casinoId, e.machineId);
      if (prevMachine.last_event_id !== e.eventId) {
        states.machines.set(machineKey, reduceMachine(prevMachine, e));
      }
    }
  }
  return states;
}

/** Load current projection rows for the keys touched by a batch. */
export async function loadStates(
  client: ProjectionStoreClient,
  casinoId: string,
  envelopes: CasinoEventEnvelope[],
): Promise<ProjectionStates> {
  const states = emptyStates();
  const playerIds = Array.from(new Set(envelopes.map(e => e.safeBetPlayerId)));
  const sessionIds = Array.from(new Set(envelopes.map(e => e.sessionId).filter((v): v is string => !!v)));
  const machineIds = Array.from(new Set(envelopes.map(e => e.machineId).filter((v): v is string => !!v)));

  if (playerIds.length > 0) {
    const { data, error } = await client.from(PLAYER_TABLE)
      .select('*').eq('casino_id', casinoId).in('safebet_player_id', playerIds);
    if (error) throw new Error(`projection load failed (${PLAYER_TABLE}): ${error.message}`);
    for (const row of (data ?? []) as PlayerState[]) {
      states.players.set(`${row.casino_id}:${row.safebet_player_id}`, { ...row, risk_flags: (row.risk_flags as unknown as string[]) ?? [] });
    }
  }
  if (sessionIds.length > 0) {
    const { data, error } = await client.from(SESSION_TABLE)
      .select('*').in('session_id', sessionIds);
    if (error) throw new Error(`projection load failed (${SESSION_TABLE}): ${error.message}`);
    for (const row of (data ?? []) as SessionState[]) states.sessions.set(row.session_id, row);
  }
  if (machineIds.length > 0) {
    const { data, error } = await client.from(MACHINE_TABLE)
      .select('*').eq('casino_id', casinoId).in('machine_id', machineIds);
    if (error) throw new Error(`projection load failed (${MACHINE_TABLE}): ${error.message}`);
    for (const row of (data ?? []) as MachineState[]) {
      states.machines.set(`${row.casino_id}:${row.machine_id}`, row);
    }
  }
  return states;
}

/**
 * Bulk upsert reduced states into the projection tables (Phase 3.3 path).
 * Used by REBUILD only, which disposes the casino's projections first and so
 * has no concurrent writer — a plain upsert is correct and fastest there.
 * The live path uses writeStatesVersioned (optimistic concurrency).
 */
export async function writeStates(client: ProjectionStoreClient, states: ProjectionStates): Promise<void> {
  if (states.players.size > 0) {
    const { error } = await client.from(PLAYER_TABLE)
      .upsert(Array.from(states.players.values()), { onConflict: 'casino_id,safebet_player_id' });
    if (error) throw new Error(`projection write failed (${PLAYER_TABLE}): ${error.message}`);
  }
  if (states.sessions.size > 0) {
    const { error } = await client.from(SESSION_TABLE)
      .upsert(Array.from(states.sessions.values()), { onConflict: 'session_id' });
    if (error) throw new Error(`projection write failed (${SESSION_TABLE}): ${error.message}`);
  }
  if (states.machines.size > 0) {
    const { error } = await client.from(MACHINE_TABLE)
      .upsert(Array.from(states.machines.values()), { onConflict: 'casino_id,machine_id' });
    if (error) throw new Error(`projection write failed (${MACHINE_TABLE}): ${error.message}`);
  }
}

/**
 * Optimistic-concurrency write (Phase 4.3 live path). Delegates to the
 * sbiq_write_projection_states RPC, which — inside one transaction, under a
 * per-casino advisory lock — commits every row ONLY if its stored row_version
 * still equals the version that was loaded, incrementing it on success. If any
 * row's version has moved (a concurrent writer committed first) the whole
 * batch rolls back and `ok:false` is returned, so the caller reloads, re-reduces
 * and retries. This eliminates lost updates without moving reduction out of TS.
 */
export async function writeStatesVersioned(
  client: ProjectionStoreClient,
  casinoId: string,
  states: ProjectionStates,
): Promise<boolean> {
  if (states.players.size + states.sessions.size + states.machines.size === 0) return true;
  const { data, error } = await client.rpc('sbiq_write_projection_states', {
    p_casino: casinoId,
    p_players: Array.from(states.players.values()),
    p_sessions: Array.from(states.sessions.values()),
    p_machines: Array.from(states.machines.values()),
  });
  if (error) throw new Error(`projection versioned write failed: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { ok?: boolean } | null;
  return row?.ok === true;
}
