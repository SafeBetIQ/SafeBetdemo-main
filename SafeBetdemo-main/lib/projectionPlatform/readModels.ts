// ─── Enterprise Projection Platform — read models (Phase 3.3) ────────────────
//
// Types for the maintained projection tables. The wider read-model catalogue
// (casino, risk, behaviour, intervention, compliance, executive, regulator)
// is defined as SQL views over these three — no duplicate state anywhere.
//
// Projections are disposable views of immutable events: they carry no
// information of their own and can always be rebuilt from casino_event_log.

export const PROJECTION_VERSION = 2; // v2: machine state materializes floor_location (event fact)

// Per-row optimistic-concurrency counter (Phase 4.3). Guards the read →
// reduce → write cycle against lost updates: a write commits only if the
// stored row_version still equals the version that was loaded. NOT a
// business field — projection bookkeeping only.
export const NEW_ROW_VERSION = 0;

export interface PlayerState {
  casino_id: string;
  safebet_player_id: string;
  status: 'active' | 'idle';
  current_session_id: string | null;
  current_machine_id: string | null;
  risk_score: number;
  risk_flags: string[];
  total_wagered: number;
  total_won: number;
  bet_count: number;
  session_count: number;
  intervention_count: number;
  last_intervention_at: string | null;
  last_event_id: string | null;
  last_event_at: string | null;
  projection_version: number;
  row_version: number;
  updated_at: string;
}

export interface SessionState {
  session_id: string;
  casino_id: string;
  safebet_player_id: string;
  machine_id: string | null;
  status: 'active' | 'ended';
  // Why the session closed (evidence-derived): 'session-end' | 'card-removed'
  // | 'superseded' (a newer session for the same player replaced it). Null
  // while open. Supersession is applied by the certified projection, not here.
  ended_reason: string | null;
  game_type: string | null;
  started_at: string | null;
  ended_at: string | null;
  total_wagered: number;
  total_won: number;
  bet_count: number;
  risk_score: number;
  last_event_id: string | null;
  last_event_at: string | null;
  projection_version: number;
  row_version: number;
  updated_at: string;
}

export interface MachineState {
  casino_id: string;
  machine_id: string;
  machine_type: string | null;
  floor_location: string | null;
  status: 'active' | 'idle';
  current_player_id: string | null;
  current_session_id: string | null;
  current_risk_score: number;
  session_wagered: number;
  last_event_id: string | null;
  last_event_at: string | null;
  projection_version: number;
  row_version: number;
  updated_at: string;
}

export const PLAYER_TABLE = 'projection_player_state';
export const SESSION_TABLE = 'projection_session_state';
export const MACHINE_TABLE = 'projection_machine_state';

/** The full read-model catalogue exposed to consumers (tables + views). */
export const READ_MODEL_CATALOGUE = [
  'projection_player_state',      // table
  'projection_session_state',     // table
  'projection_machine_state',     // table
  'projection_casino_state',      // view
  'projection_risk_state',        // view
  'projection_behaviour_state',   // view
  'projection_intervention_state',// view
  'projection_compliance_state',  // view
  'projection_executive_state',   // view
  'projection_regulator_state',   // view
] as const;

export function newPlayerState(casinoId: string, playerId: string): PlayerState {
  return {
    casino_id: casinoId, safebet_player_id: playerId,
    status: 'idle', current_session_id: null, current_machine_id: null,
    risk_score: 0, risk_flags: [], total_wagered: 0, total_won: 0,
    bet_count: 0, session_count: 0, intervention_count: 0,
    last_intervention_at: null, last_event_id: null, last_event_at: null,
    projection_version: PROJECTION_VERSION, row_version: NEW_ROW_VERSION,
    updated_at: new Date().toISOString(),
  };
}

export function newSessionState(sessionId: string, casinoId: string, playerId: string): SessionState {
  return {
    session_id: sessionId, casino_id: casinoId, safebet_player_id: playerId,
    machine_id: null, status: 'active', ended_reason: null, game_type: null,
    started_at: null, ended_at: null, total_wagered: 0, total_won: 0,
    bet_count: 0, risk_score: 0, last_event_id: null, last_event_at: null,
    projection_version: PROJECTION_VERSION, row_version: NEW_ROW_VERSION,
    updated_at: new Date().toISOString(),
  };
}

export function newMachineState(casinoId: string, machineId: string): MachineState {
  return {
    casino_id: casinoId, machine_id: machineId, machine_type: null,
    floor_location: null,
    status: 'idle', current_player_id: null, current_session_id: null,
    current_risk_score: 0, session_wagered: 0,
    last_event_id: null, last_event_at: null,
    projection_version: PROJECTION_VERSION, row_version: NEW_ROW_VERSION,
    updated_at: new Date().toISOString(),
  };
}
