// ─── Projection reducers (Phase 3.3) ─────────────────────────────────────────
//
// Pure functions: (previous state, immutable envelope) → next state.
//
// Reducers MATERIALIZE event facts — they never compute business outcomes.
// Risk scores, flags, and amounts are copied from the event exactly as the
// producer (and, from Phase 3.6, the Shared Domain Engines) recorded them.
// Sums and counters are projection arithmetic, not business logic.

import type { CasinoEventEnvelope } from '../eventPlatform/index.ts';
import type { MachineState, PlayerState, SessionState } from './readModels.ts';

const SESSION_OPENERS = new Set(['CARD_INSERT', 'MACHINE_ALLOCATED', 'SESSION_START']);
const SESSION_CLOSERS = new Set(['SESSION_END', 'CARD_REMOVED']);
const WAGER_EVENTS = new Set(['BET_PLACED', 'JACKPOT']);
const MACHINE_RELEASERS = new Set(['MACHINE_IDLE', 'CARD_REMOVED']);

function num(v: unknown): number { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function str(v: unknown): string | null { return typeof v === 'string' && v.length > 0 ? v : null; }

function stamp<T extends { last_event_id: string | null; last_event_at: string | null; updated_at: string }>(
  s: T, e: CasinoEventEnvelope,
): T {
  s.last_event_id = e.eventId;
  s.last_event_at = e.occurredAt;
  s.updated_at = new Date().toISOString();
  return s;
}

export function reducePlayer(prev: PlayerState, e: CasinoEventEnvelope): PlayerState {
  const s = { ...prev, risk_flags: [...prev.risk_flags] };
  const p = e.payload as Record<string, unknown>;

  if (e.eventType === 'SESSION_START') {
    s.status = 'active';
    s.session_count += 1;
    s.current_session_id = e.sessionId;
    s.current_machine_id = e.machineId;
  } else if (SESSION_OPENERS.has(e.eventType)) {
    s.status = 'active';
    s.current_session_id = e.sessionId;
    s.current_machine_id = e.machineId;
  } else if (SESSION_CLOSERS.has(e.eventType)) {
    s.status = 'idle';
    s.current_session_id = null;
    s.current_machine_id = null;
  }

  if (WAGER_EVENTS.has(e.eventType)) {
    s.total_wagered += num(p.bet_amount);
    s.total_won += num(p.win_amount);
    s.bet_count += 1;
  }

  if (e.eventType === 'INTERVENTION_TRIGGERED') {
    s.intervention_count += 1;
    s.last_intervention_at = e.occurredAt;
  }

  const risk = num(p.risk_score);
  if (risk > 0 || WAGER_EVENTS.has(e.eventType)) s.risk_score = risk;
  const flags = p.risk_flags;
  if (Array.isArray(flags) && flags.length > 0) {
    s.risk_flags = Array.from(new Set([...s.risk_flags, ...flags.filter(f => typeof f === 'string')]));
  }

  return stamp(s, e);
}

export function reduceSession(prev: SessionState, e: CasinoEventEnvelope): SessionState {
  const s = { ...prev };
  const p = e.payload as Record<string, unknown>;

  if (SESSION_OPENERS.has(e.eventType)) {
    s.status = 'active';
    s.machine_id = e.machineId ?? s.machine_id;
    s.game_type = str(p.game_type) ?? s.game_type;
    if (e.eventType === 'CARD_INSERT' || s.started_at === null) s.started_at = e.occurredAt;
  }
  if (WAGER_EVENTS.has(e.eventType)) {
    s.total_wagered += num(p.bet_amount);
    s.total_won += num(p.win_amount);
    s.bet_count += 1;
  }
  // Close only an open session — a duplicate close is idempotent (the first
  // close time stands) and a completed session is not "re-closed".
  if (SESSION_CLOSERS.has(e.eventType) && s.status === 'active') {
    s.status = 'ended';
    s.ended_at = e.occurredAt;
    s.ended_reason = e.eventType === 'SESSION_END' ? 'session-end' : 'card-removed';
  }

  const risk = num(p.risk_score);
  if (risk > s.risk_score || WAGER_EVENTS.has(e.eventType)) s.risk_score = risk;

  return stamp(s, e);
}

export function reduceMachine(prev: MachineState, e: CasinoEventEnvelope): MachineState {
  const s = { ...prev };
  const p = e.payload as Record<string, unknown>;
  const meta = (p.metadata ?? {}) as Record<string, unknown>;

  const machineType = str(meta.machine_type) ?? str(p.machine_type);
  if (machineType) s.machine_type = machineType;

  // Floor location is an event fact recorded by the producer — materialized,
  // never derived, so the Digital Twin can model gaming floors without logic.
  const floorLocation = str(meta.casino_floor_location) ?? str(p.casino_floor_location);
  if (floorLocation) s.floor_location = floorLocation;

  if (e.eventType === 'MACHINE_ALLOCATED' || e.eventType === 'SESSION_START') {
    s.status = 'active';
    s.current_player_id = e.safeBetPlayerId;
    s.current_session_id = e.sessionId;
    s.current_risk_score = num(p.risk_score);
    s.session_wagered = 0;
  } else if (MACHINE_RELEASERS.has(e.eventType)) {
    s.status = 'idle';
    s.current_player_id = null;
    s.current_session_id = null;
    s.current_risk_score = 0;
    s.session_wagered = 0;
  } else if (WAGER_EVENTS.has(e.eventType)) {
    s.session_wagered += num(p.bet_amount);
    const risk = num(p.risk_score);
    if (risk > s.current_risk_score) s.current_risk_score = risk;
  }

  return stamp(s, e);
}
