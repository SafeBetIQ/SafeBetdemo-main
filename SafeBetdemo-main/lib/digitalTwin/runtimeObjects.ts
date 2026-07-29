// ─── Enterprise Casino Digital Twin — runtime object model (Phase 3.4) ───────
//
// THE shared object model. There is exactly ONE runtime instance of each
// Player, Session, Machine, Gaming Floor, Intervention and Casino per twin;
// the registry guarantees it. Every future Shared Domain Engine (Phase 3.5)
// enriches these SAME instances through their `enrichments` slot — no engine
// may create replacement objects.
//
// Twin objects are ASSEMBLED views of the Enterprise Projection Platform's
// read models. They carry no information of their own: every field below is
// a projection field mapped 1:1 (mapPlayer/mapSession/mapMachine). No field
// is ever calculated here — risk scores, flags, totals and floor locations
// arrive exactly as the Projection Platform materialized them from events.

import type { MachineState, PlayerState, SessionState } from '../projectionPlatform/index.ts';

/** Per-engine enrichment slot. Engines write under their own engineId key. */
export type TwinEnrichments = Record<string, Readonly<Record<string, unknown>>>;

export interface PlayerTwin {
  readonly kind: 'player';
  readonly casinoId: string;
  readonly playerId: string;               // SB-PLR anonymous id — no PII
  status: 'active' | 'idle';
  currentSessionId: string | null;
  currentMachineId: string | null;
  riskScore: number;
  riskFlags: string[];
  totalWagered: number;
  totalWon: number;
  betCount: number;
  sessionCount: number;
  interventionCount: number;
  lastInterventionAt: string | null;
  /** Membership of projection_compliance_state (projected fact, not computed here). */
  requiresMonitoring: boolean;
  lastEventAt: string | null;
  readonly enrichments: TwinEnrichments;
}

export interface SessionTwin {
  readonly kind: 'session';
  readonly sessionId: string;
  readonly casinoId: string;
  readonly playerId: string;
  machineId: string | null;
  status: 'active' | 'ended';
  gameType: string | null;
  startedAt: string | null;
  totalWagered: number;
  totalWon: number;
  betCount: number;
  riskScore: number;
  lastEventAt: string | null;
  readonly enrichments: TwinEnrichments;
}

export interface MachineTwin {
  readonly kind: 'machine';
  readonly casinoId: string;
  readonly machineId: string;
  machineType: string | null;
  floorLocation: string | null;            // materialized event fact (projection v2)
  status: 'active' | 'idle';
  currentPlayerId: string | null;
  currentSessionId: string | null;
  currentRiskScore: number;
  sessionWagered: number;
  lastEventAt: string | null;
  readonly enrichments: TwinEnrichments;
}

/** A gaming floor is a grouping of the SAME machine instances — never copies. */
export interface GamingFloorTwin {
  readonly kind: 'floor';
  readonly casinoId: string;
  readonly floorLocation: string;
  readonly machines: Map<string, MachineTwin>;
  readonly enrichments: TwinEnrichments;
}

/** An active intervention observation (projection_intervention_state row). */
export interface InterventionTwin {
  readonly kind: 'intervention';
  readonly casinoId: string;
  readonly playerId: string;
  interventionCount: number;
  lastInterventionAt: string | null;
  riskScore: number;
  lastEventAt: string | null;
  readonly enrichments: TwinEnrichments;
}

/** Casino-level aggregates read from the projection_casino_state VIEW. */
export interface CasinoAggregates {
  activePlayers: number;
  // Session posture (certified). activeSessions = FRESH open sessions; the
  // three postures partition openSessions: active + idle + stale = open.
  activeSessions: number;
  idleSessions: number;
  staleSessions: number;
  openSessions: number;
  // Player activity posture (partitions activePlayers by freshness).
  playersActiveNow: number;
  playersIdle: number;
  playersStale: number;
  activeMachines: number;
  // Machine activity posture (machinesInPlay + machinesStale = activeMachines).
  machinesInPlay: number;
  machinesStale: number;
  registeredMachines: number;
  totalWagered: number;
  totalWon: number;
  ggr: number;
  riskCritical: number;
  riskHigh: number;
  riskMedium: number;
  riskLow: number;
  // Active players without an established risk classification (see the
  // projection_casino_state view). Never merged into riskLow.
  riskUnclassified: number;
  lastEventAt: string | null;
}

export function emptyAggregates(): CasinoAggregates {
  return {
    activePlayers: 0, activeSessions: 0, idleSessions: 0, staleSessions: 0, openSessions: 0,
    playersActiveNow: 0, playersIdle: 0, playersStale: 0,
    activeMachines: 0, machinesInPlay: 0, machinesStale: 0, registeredMachines: 0,
    totalWagered: 0, totalWon: 0, ggr: 0,
    riskCritical: 0, riskHigh: 0, riskMedium: 0, riskLow: 0, riskUnclassified: 0,
    lastEventAt: null,
  };
}

// ─── Projection row → twin field mapping (1:1, no computation) ───────────────

export function newPlayerTwin(casinoId: string, playerId: string): PlayerTwin {
  return {
    kind: 'player', casinoId, playerId,
    status: 'idle', currentSessionId: null, currentMachineId: null,
    riskScore: 0, riskFlags: [], totalWagered: 0, totalWon: 0,
    betCount: 0, sessionCount: 0, interventionCount: 0,
    lastInterventionAt: null, requiresMonitoring: false, lastEventAt: null,
    enrichments: {},
  };
}

export function mapPlayer(twin: PlayerTwin, row: PlayerState): PlayerTwin {
  twin.status = row.status;
  twin.currentSessionId = row.current_session_id;
  twin.currentMachineId = row.current_machine_id;
  twin.riskScore = Number(row.risk_score);
  twin.riskFlags = Array.isArray(row.risk_flags) ? [...row.risk_flags] : [];
  twin.totalWagered = Number(row.total_wagered);
  twin.totalWon = Number(row.total_won);
  twin.betCount = row.bet_count;
  twin.sessionCount = row.session_count;
  twin.interventionCount = row.intervention_count;
  twin.lastInterventionAt = row.last_intervention_at;
  twin.lastEventAt = row.last_event_at;
  return twin;
}

export function newSessionTwin(sessionId: string, casinoId: string, playerId: string): SessionTwin {
  return {
    kind: 'session', sessionId, casinoId, playerId,
    machineId: null, status: 'active', gameType: null, startedAt: null,
    totalWagered: 0, totalWon: 0, betCount: 0, riskScore: 0,
    lastEventAt: null, enrichments: {},
  };
}

export function mapSession(twin: SessionTwin, row: SessionState): SessionTwin {
  twin.machineId = row.machine_id;
  twin.status = row.status;
  twin.gameType = row.game_type;
  twin.startedAt = row.started_at;
  twin.totalWagered = Number(row.total_wagered);
  twin.totalWon = Number(row.total_won);
  twin.betCount = row.bet_count;
  twin.riskScore = Number(row.risk_score);
  twin.lastEventAt = row.last_event_at;
  return twin;
}

export function newMachineTwin(casinoId: string, machineId: string): MachineTwin {
  return {
    kind: 'machine', casinoId, machineId,
    machineType: null, floorLocation: null, status: 'idle',
    currentPlayerId: null, currentSessionId: null,
    currentRiskScore: 0, sessionWagered: 0, lastEventAt: null,
    enrichments: {},
  };
}

export function mapMachine(twin: MachineTwin, row: MachineState): MachineTwin {
  twin.machineType = row.machine_type;
  twin.floorLocation = row.floor_location ?? null;
  twin.status = row.status;
  twin.currentPlayerId = row.current_player_id;
  twin.currentSessionId = row.current_session_id;
  twin.currentRiskScore = Number(row.current_risk_score);
  twin.sessionWagered = Number(row.session_wagered);
  twin.lastEventAt = row.last_event_at;
  return twin;
}
