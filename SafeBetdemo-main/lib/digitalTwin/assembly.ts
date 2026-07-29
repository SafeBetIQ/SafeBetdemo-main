// ─── Digital Twin assembly — projection consumption (Phase 3.4) ──────────────
//
// The ONLY data source of the Digital Twin is the Enterprise Projection
// Platform's read-model catalogue. Assembly reads the three maintained
// projection tables plus the casino / intervention / compliance VIEWS and
// populates the registry. It NEVER reads casino_event_log, NEVER reads
// legacy tables, NEVER computes business outcomes — thresholds live in the
// catalogue views, aggregates in projection_casino_state.
//
// Because assembly consumes projections only, rebuilding projections from
// the immutable event log automatically reconstructs the Digital Twin: the
// next assemble() (or live sync) reflects the rebuilt state. Replay-safety
// is inherited, not reimplemented.

import {
  MACHINE_TABLE, PLAYER_TABLE, SESSION_TABLE,
  type MachineState, type PlayerState, type ProjectionStoreClient, type SessionState,
} from '../projectionPlatform/index.ts';
import type { InterventionStateRow, TwinRegistry } from './registry.ts';
import { emptyAggregates, type CasinoAggregates } from './runtimeObjects.ts';

const CASINO_VIEW = 'projection_casino_state';
const INTERVENTION_VIEW = 'projection_intervention_state';
const COMPLIANCE_VIEW = 'projection_compliance_state';

export interface AssemblyResult {
  aggregates: CasinoAggregates;
  assembledAt: string;
  playersAssembled: number;
  sessionsAssembled: number;
  machinesAssembled: number;
  floorsAssembled: number;
  interventionsAssembled: number;
}

async function rows<T>(query: Promise<{ data: unknown; error: { message: string } | null }>, model: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`digital twin assembly failed (${model}): ${error.message}`);
  return (data ?? []) as T[];
}

/** Assemble (or re-assemble) one casino's twin from the read-model catalogue. */
export async function assembleCasinoTwin(
  client: ProjectionStoreClient,
  registry: TwinRegistry,
): Promise<AssemblyResult> {
  const casinoId = registry.casinoId;

  const [players, sessions, machines, casinoRows, interventionRows, complianceRows] = await Promise.all([
    rows<PlayerState>(client.from(PLAYER_TABLE).select('*').eq('casino_id', casinoId), PLAYER_TABLE),
    rows<SessionState>(client.from(SESSION_TABLE).select('*').eq('casino_id', casinoId).eq('status', 'active'), SESSION_TABLE),
    rows<MachineState>(client.from(MACHINE_TABLE).select('*').eq('casino_id', casinoId), MACHINE_TABLE),
    rows<Record<string, unknown>>(client.from(CASINO_VIEW).select('*').eq('casino_id', casinoId), CASINO_VIEW),
    rows<InterventionStateRow>(client.from(INTERVENTION_VIEW).select('*').eq('casino_id', casinoId), INTERVENTION_VIEW),
    rows<{ safebet_player_id: string }>(client.from(COMPLIANCE_VIEW).select('safebet_player_id').eq('casino_id', casinoId), COMPLIANCE_VIEW),
  ]);

  // Upserts refresh existing instances IN PLACE (references and engine
  // enrichments survive); reconcile() then drops only the entities the
  // projections no longer contain.
  players.forEach(row => registry.upsertPlayer(row));
  sessions.forEach(row => registry.upsertSession(row));
  machines.forEach(row => registry.upsertMachine(row));
  interventionRows.forEach(row => registry.upsertIntervention(row));
  registry.reconcile({
    players: new Set(players.map(r => r.safebet_player_id)),
    sessions: new Set(sessions.map(r => r.session_id)),
    machines: new Set(machines.map(r => r.machine_id)),
    interventions: new Set(interventionRows.map(r => r.safebet_player_id)),
  });

  // Monitoring membership is decided by the compliance VIEW (projection
  // side) — the twin only marks the flag on the same player instances.
  const monitored = new Set(complianceRows.map(r => r.safebet_player_id));
  registry.players.forEach(player => {
    player.requiresMonitoring = monitored.has(player.playerId);
  });

  const aggregates = mapAggregates(casinoRows[0]);

  return {
    aggregates,
    assembledAt: new Date().toISOString(),
    playersAssembled: registry.players.size,
    sessionsAssembled: registry.sessions.size,
    machinesAssembled: registry.machines.size,
    floorsAssembled: registry.floors.size,
    interventionsAssembled: registry.interventions.size,
  };
}

/** Map a projection_casino_state view row 1:1 — aggregates are projected, not computed. */
export function mapAggregates(row: Record<string, unknown> | undefined): CasinoAggregates {
  if (!row) return emptyAggregates();
  const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  return {
    activePlayers: n(row.active_players),
    activeSessions: n(row.active_sessions),
    idleSessions: n(row.idle_sessions),
    staleSessions: n(row.stale_sessions),
    openSessions: n(row.open_sessions),
    playersActiveNow: n(row.players_active_now),
    playersIdle: n(row.players_idle),
    playersStale: n(row.players_stale),
    activeMachines: n(row.active_machines),
    machinesInPlay: n(row.machines_in_play),
    machinesStale: n(row.machines_stale),
    registeredMachines: n(row.registered_machines),
    totalWagered: n(row.total_wagered),
    totalWon: n(row.total_won),
    ggr: n(row.ggr),
    riskCritical: n(row.risk_critical),
    riskHigh: n(row.risk_high),
    riskMedium: n(row.risk_medium),
    riskLow: n(row.risk_low),
    riskUnclassified: n(row.risk_unclassified),
    lastEventAt: (row.last_event_at as string | null) ?? null,
  };
}
