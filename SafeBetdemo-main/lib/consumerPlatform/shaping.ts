// ─── Consumer Platform — response shaping (Phase 3.7) ────────────────────────
//
// Pure shapers: enterprise information (twin objects, intelligence,
// decisions, distributed event rows) → presentation contracts. Shaping
// selects, arranges and LABELS facts — it never recalculates them. Risk
// tier labels use the bands the Projection Platform published in
// projection_casino_state (80/60/40); feed statistics (events/min, average
// bet) describe the served feed window itself — presentation stats of
// presented data, exactly what the retired legacy KPI mirror displayed.

import type {
  CasinoDigitalTwin, InterventionTwin, MachineTwin, PlayerTwin,
} from '../digitalTwin/index.ts';
import { intelligenceOf } from '../domainIntelligence/index.ts';
import type { PolicyDecision } from '../policyPlatform/index.ts';
import type {
  DecisionView, FinancialPostureView, InterventionView, LiveEventView, LiveKpiView,
  MachineStatusView, PlayerView,
} from './contracts.ts';

/** projection_financial_posture row → FinancialPostureView (passthrough only). */
export function shapeFinancial(row: Record<string, unknown> | null | undefined): FinancialPostureView | null {
  if (!row) return null;
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  // Preserve null for UNSUPPORTED categories — never coerce to a false 0.
  const numOrNull = (v: unknown) => (v == null ? null : num(v));
  const bool = (v: unknown) => v === true || v === 'true';
  const status = String(row.financial_data_status ?? 'unavailable') as FinancialPostureView['status'];
  // No certified financial evidence → null so the UI shows "—", not a zero.
  if (status === 'unavailable') return null;
  return {
    currency: String(row.financial_currency ?? 'ZAR'),
    timezone: String(row.financial_timezone ?? 'Africa/Johannesburg'),
    status,
    snapshotAt: String(row.financial_snapshot_at ?? new Date().toISOString()),
    projectionLagSeconds: num(row.financial_projection_lag_seconds),
    ggrCurrentShift: num(row.ggr_current_shift),
    ggrToday: num(row.ggr_today),
    ggrLast24Hours: num(row.ggr_last_24_hours),
    ggrMonthToDate: num(row.ggr_month_to_date),
    stakesCurrentShift: num(row.stakes_current_shift),
    stakesToday: num(row.stakes_today),
    stakesLast24Hours: num(row.stakes_last_24_hours),
    stakesMonthToDate: num(row.stakes_month_to_date),
    playerWinningsCurrentShift: num(row.player_winnings_current_shift),
    playerWinningsToday: num(row.player_winnings_today),
    playerWinningsLast24Hours: num(row.player_winnings_last_24_hours),
    playerWinningsMonthToDate: num(row.player_winnings_month_to_date),
    settledBetsToday: num(row.settled_bets_today),
    voidedBetsToday: numOrNull(row.voided_bets_today),
    reversedTransactionsToday: numOrNull(row.reversed_transactions_today),
    bonusWagersToday: numOrNull(row.bonus_wagers_today),
    voidsSupported: bool(row.voids_supported),
    reversalsSupported: bool(row.reversals_supported),
    bonusSupported: bool(row.bonus_supported),
    combinedWagerSettlement: bool(row.combined_wager_settlement),
    separateSettlement: bool(row.separate_settlement),
    capabilityVersion: num(row.capability_version),
    containsSyntheticData: bool(row.contains_synthetic_data),
    syntheticEventCount: num(row.synthetic_event_count),
    nonSyntheticEventCount: num(row.non_synthetic_event_count),
    dataMode: (String(row.financial_data_mode ?? 'unavailable') as FinancialPostureView['dataMode']),
  };
}

// Bands as published by the Projection Platform's casino read model.
export function riskLevelFor(score: number): PlayerView['riskLevel'] {
  return score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
}

// Presentation constant: nominal game pace shown on machine tiles.
const SPINS_PER_MINUTE: Record<string, number> = {
  slots: 12, blackjack: 4, roulette: 3, poker: 2, baccarat: 6, live_dealer: 5,
};

/** casino_event_log row (the distributed envelope) → LiveEventView. */
export function shapeEventRow(row: Record<string, unknown>): LiveEventView {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  return {
    id: row.event_id as string,
    event_type: row.event_type as string,
    casino_id: row.casino_id as string,
    player_id: row.safebet_player_id as string,
    session_id: (row.session_id as string | null) ?? null,
    game_id: (p.game_id as string | null) ?? null,
    machine_id: (row.machine_id as string | null) ?? null,
    bet_amount: num(p.bet_amount),
    win_amount: num(p.win_amount),
    balance_after: p.balance_after != null ? num(p.balance_after) : null,
    duration_seconds: num(p.duration_seconds),
    risk_score: num(p.risk_score),
    risk_flags: Array.isArray(p.risk_flags) ? (p.risk_flags as string[]) : [],
    outcome: ((p.outcome as string) ?? 'active') as LiveEventView['outcome'],
    game_type: (p.game_type as string | null) ?? null,
    is_simulated: (p.is_simulated as boolean) ?? true,
    metadata: (p.metadata as Record<string, unknown>) ?? {},
    created_at: row.occurred_at as string,
  };
}

/**
 * projection_machine_state row (the distributed machine read model) →
 * MachineStatusView. Used by live consumers shaping Realtime distribution
 * client-side; the gateway's own floor view uses shapeMachine (twin-based).
 */
export function shapeMachineRow(row: Record<string, unknown>): MachineStatusView {
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
  const status = (row.status as string) === 'active' ? 'active' : 'idle';
  return {
    machine_id: row.machine_id as string,
    machine_type: (row.machine_type as string | null) ?? 'slot',
    status,
    current_player_id: (row.current_player_id as string | null) ?? null,
    session_id: (row.current_session_id as string | null) ?? null,
    current_game: null,
    spins_per_minute: status === 'active' ? 4 : 0,
    current_risk_score: num(row.current_risk_score),
    total_wagered_session: num(row.session_wagered),
    session_duration_seconds: 0,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** MachineTwin (with its session, when open) → MachineStatusView. */
export function shapeMachine(machine: MachineTwin, twin: CasinoDigitalTwin): MachineStatusView {
  const session = machine.currentSessionId
    ? twin.registry.sessions.get(machine.currentSessionId) ?? null : null;
  const intel = intelligenceOf(session ?? machine);
  const durationMinutes = session && intel?.session
    ? (intel.session as Record<string, unknown>).durationMinutes : null;
  return {
    machine_id: machine.machineId,
    machine_type: machine.machineType ?? 'slot',
    status: machine.status,
    current_player_id: machine.currentPlayerId,
    session_id: machine.currentSessionId,
    current_game: session?.gameType ?? null,
    spins_per_minute: machine.status === 'active'
      ? SPINS_PER_MINUTE[session?.gameType ?? 'slots'] ?? 4 : 0,
    current_risk_score: machine.currentRiskScore,
    total_wagered_session: machine.sessionWagered,
    session_duration_seconds: typeof durationMinutes === 'number' ? Math.round(durationMinutes * 60) : 0,
    updated_at: machine.lastEventAt ?? new Date().toISOString(),
  };
}

/**
 * The operator floor plan: the demo's 80-position grid with the twin's
 * machines overlaid — a presentation scaffold; idle placeholders carry no
 * runtime meaning.
 */
export function shapeFloorGrid(twin: CasinoDigitalTwin): MachineStatusView[] {
  const grid = new Map<string, MachineStatusView>();
  const types = ['slot', 'slot', 'slot', 'table', 'rng', 'live_dealer'];
  for (let i = 1; i <= 80; i++) {
    const id = `M-${String(i).padStart(3, '0')}`;
    grid.set(id, {
      machine_id: id, machine_type: types[(i - 1) % types.length], status: 'idle',
      current_player_id: null, session_id: null, current_game: null,
      spins_per_minute: 0, current_risk_score: 0, total_wagered_session: 0,
      session_duration_seconds: 0, updated_at: new Date().toISOString(),
    });
  }
  twin.registry.machines.forEach(m => grid.set(m.machineId, shapeMachine(m, twin)));
  return Array.from(grid.values());
}

export function shapePlayer(player: PlayerTwin, twin: CasinoDigitalTwin): PlayerView {
  const intel = intelligenceOf(player) ?? {};
  const behaviour = (intel.behaviour ?? {}) as Record<string, unknown>;
  const session = (intel.session ?? {}) as Record<string, unknown>;
  const sessionTwin = player.currentSessionId
    ? twin.registry.sessions.get(player.currentSessionId) ?? null : null;
  return {
    id: player.playerId,
    playerId: player.playerId,
    game: sessionTwin?.gameType ?? 'slots',
    betAmount: typeof behaviour.avgBetSize === 'number' ? behaviour.avgBetSize : 0,
    totalWagered: player.totalWagered,
    sessionDuration: typeof session.minutesSinceLastEvent === 'number'
      ? Math.round((session.minutesSinceLastEvent as number) * 60) : 0,
    riskScore: player.riskScore,
    riskLevel: riskLevelFor(player.riskScore),
    isActive: player.status === 'active',
    lastBetTime: player.lastEventAt ?? new Date().toISOString(),
  };
}

export function shapeIntervention(intervention: InterventionTwin, twin: CasinoDigitalTwin): InterventionView {
  const player = twin.registry.players.get(intervention.playerId);
  const patterns = player
    ? (((intelligenceOf(player)?.behaviour ?? {}) as Record<string, unknown>).patterns as string[] | undefined) ?? []
    : [];
  const triggerType: InterventionView['triggerType'] =
    patterns.indexOf('loss_chasing_flagged') !== -1 || patterns.indexOf('loss_chasing_inferred') !== -1
      ? 'loss_chasing'
      : patterns.indexOf('rapid_betting') !== -1 ? 'rapid_betting'
      : patterns.indexOf('extended_session') !== -1 ? 'session_duration'
      : 'high_risk';
  // Evidence integrity (Constitution §8): present ONLY recorded facts and
  // clearly-labelled derived intelligence. The platform records that an
  // intervention occurred (count + timestamp + risk) but NOT its delivery
  // channel or delivery status — so those are reported as 'unrecorded' /
  // 'recorded', never fabricated as a delivered WhatsApp message.
  return {
    id: `${intervention.playerId}-${intervention.lastInterventionAt ?? 'na'}`,
    playerId: intervention.playerId,
    evidenceClass: 'recorded-fact',
    channel: 'unrecorded',
    status: 'recorded',
    timestamp: intervention.lastInterventionAt ?? intervention.lastEventAt ?? new Date().toISOString(),
    interventionCount: intervention.interventionCount,
    reason: 'Intervention recorded on the player journey (delivery channel not captured by the platform)',
    riskScore: intervention.riskScore,
    triggerType,               // Derived Intelligence
    triggerSource: 'derived-intelligence',
  };
}

/** KPI view: projected aggregates + presentation stats of the served feed window. */
export function shapeKpi(twin: CasinoDigitalTwin, feedWindow: LiveEventView[]): LiveKpiView {
  const aggregates = twin.casinoAggregates();
  const bets = feedWindow.filter(e => e.event_type === 'BET_PLACED' || e.event_type === 'JACKPOT');
  const wagered = bets.reduce((s, e) => s + e.bet_amount, 0);
  return {
    active_players: aggregates.activePlayers,
    active_sessions: aggregates.activeSessions,
    idle_sessions: aggregates.idleSessions,
    stale_sessions: aggregates.staleSessions,
    open_sessions: aggregates.openSessions,
    players_active_now: aggregates.playersActiveNow,
    players_idle: aggregates.playersIdle,
    players_stale: aggregates.playersStale,
    machines_in_play: aggregates.machinesInPlay,
    machines_stale: aggregates.machinesStale,
    registered_machines: aggregates.registeredMachines,
    events_per_min: feedWindow.length,
    total_wagered: aggregates.totalWagered,
    total_won: aggregates.totalWon,
    ggr: aggregates.ggr,
    avg_bet_size: bets.length > 0 ? Math.round((wagered / bets.length) * 100) / 100 : 0,
    risk_critical: aggregates.riskCritical,
    risk_high: aggregates.riskHigh,
    risk_medium: aggregates.riskMedium,
    risk_low: aggregates.riskLow,
    risk_unclassified: aggregates.riskUnclassified,
    active_machines: aggregates.activeMachines,
    snapshot_at: new Date().toISOString(),
  };
}

export function shapeDecision(decision: PolicyDecision): DecisionView {
  return {
    decisionId: decision.decisionId,
    policyId: decision.policyId,
    action: decision.action,
    priority: decision.priority,
    subject: { kind: decision.subject.kind, id: decision.subject.id },
    reason: decision.reason,
    policyReference: decision.policyReference,
    confidence: decision.confidence,
    executionRequired: decision.executionRequired,
  };
}
