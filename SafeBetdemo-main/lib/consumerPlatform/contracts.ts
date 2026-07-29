// ─── Enterprise Consumer Platform — presentation contracts (Phase 3.7) ───────
//
// STABLE, versioned view models — the ONLY shapes consumers ever see.
// Contracts are frozen per version: UI changes ride on these shapes without
// touching the core platform; breaking changes mint a new version ('v2')
// while 'v1' keeps serving existing consumers (REST versioning strategy;
// the same contracts are the future GraphQL type source).
//
// Contracts present information — they never carry behaviour.

export const CONTRACT_VERSIONS = ['v1'] as const;
export type ContractVersion = (typeof CONTRACT_VERSIONS)[number];
export const CURRENT_VERSION: ContractVersion = 'v1';

export const CONSUMER_PROFILES = [
  'casino-operator',
  'regulator',
  'executive',
  'compliance-officer',
  'administrator',
  'api-client',
] as const;
export type ConsumerProfile = (typeof CONSUMER_PROFILES)[number];

export const CONSUMER_VIEWS = [
  'live-floor',       // operator: machines, KPIs, players, interventions
  'activity-feed',    // operator/api: recent event stream
  'compliance',       // regulator: RG posture, obligations, notifications
  'summary',          // executive: KPIs, floors, headline decisions
  'actions',          // compliance officer: outstanding actions, alerts, evidence
  'integration',      // operator/admin: connector health & throughput (v1.1)
  // Regulator Intelligence Portal (v1.2) — national/cross-operator/investigation
  'national-overview', 'cross-operator', 'operator-compliance',
  'investigation', 'evidence-package', 'regulatory-report',
  // Explainable Intelligence (v1.4) — explains existing Domain Intelligence
  'explanation', 'ai-performance', 'executive-intelligence',
] as const;
export type ConsumerView = (typeof CONSUMER_VIEWS)[number];

// ─── v1 view models (mirror the shapes today's dashboards already render) ────

export interface LiveEventView {
  id: string;
  event_type: string;
  casino_id: string;
  player_id: string;
  session_id: string | null;
  game_id: string | null;
  machine_id: string | null;
  bet_amount: number;
  win_amount: number;
  balance_after: number | null;
  duration_seconds: number;
  risk_score: number;
  risk_flags: string[];
  outcome: 'win' | 'loss' | 'push' | 'active' | null;
  game_type: string | null;
  is_simulated: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LiveKpiView {
  active_players: number;
  // Session posture: active_sessions = FRESH open sessions; the three postures
  // partition open_sessions (active + idle + stale = open).
  active_sessions: number;
  idle_sessions: number;
  stale_sessions: number;
  open_sessions: number;
  // Player activity posture (active_now + idle + stale = active_players).
  players_active_now: number;
  players_idle: number;
  players_stale: number;
  // Machine activity posture (machines_in_play + machines_stale = active_machines).
  machines_in_play: number;
  machines_stale: number;
  registered_machines: number;
  events_per_min: number;
  total_wagered: number;
  total_won: number;
  ggr: number;
  avg_bet_size: number;
  risk_critical: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  // Active players with no established risk classification (never scored,
  // never wagered, no flags). Never folded into risk_low.
  risk_unclassified: number;
  active_machines: number;
  snapshot_at: string;
}

export interface MachineStatusView {
  machine_id: string;
  machine_type: string;
  status: 'active' | 'idle' | 'offline' | 'maintenance';
  current_player_id: string | null;
  session_id: string | null;
  current_game: string | null;
  spins_per_minute: number;
  current_risk_score: number;
  total_wagered_session: number;
  session_duration_seconds: number;
  updated_at: string;
}

export interface PlayerView {
  id: string;
  playerId: string;
  game: string;
  betAmount: number;
  totalWagered: number;
  sessionDuration: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  lastBetTime: string;
}

export interface InterventionView {
  id: string;
  playerId: string;
  /**
   * Evidence classification (Constitution §8). The intervention count and
   * timestamp are Recorded Facts; the trigger type is Derived Intelligence.
   * Delivery channel/status are NOT recorded by the platform and are reported
   * as such — never fabricated as 'delivered'.
   */
  evidenceClass: 'recorded-fact';
  /** Delivery channel is not recorded by the platform. */
  channel: 'unrecorded';
  /** The recorded fact: an intervention was recorded on the player journey. */
  status: 'recorded';
  timestamp: string;
  /** Recorded number of interventions on this player. */
  interventionCount: number;
  reason: string;
  riskScore: number;
  /** Trigger classification — Derived Intelligence (from Behaviour Intelligence). */
  triggerType: 'high_risk' | 'rapid_betting' | 'session_duration' | 'loss_chasing' | 'bet_escalation';
  triggerSource: 'derived-intelligence';
}

// Certified period-scoped financial posture (passthrough of the
// projection_financial_posture view). GGR = settled stakes − player winnings,
// computed over the immutable certified financial event log per period.
export interface FinancialPostureView {
  currency: string;
  timezone: string;
  status: 'healthy' | 'delayed' | 'partial' | 'degraded' | 'unavailable';
  snapshotAt: string;
  projectionLagSeconds: number;
  ggrCurrentShift: number;
  ggrToday: number;
  ggrLast24Hours: number;
  ggrMonthToDate: number;
  stakesCurrentShift: number;
  stakesToday: number;
  stakesLast24Hours: number;
  stakesMonthToDate: number;
  playerWinningsCurrentShift: number;
  playerWinningsToday: number;
  playerWinningsLast24Hours: number;
  playerWinningsMonthToDate: number;
  settledBetsToday: number;
  // Unsupported categories are null (never a false 0). Support flags say whether
  // the certified source can observe the category at all.
  voidedBetsToday: number | null;
  reversedTransactionsToday: number | null;
  bonusWagersToday: number | null;
  voidsSupported: boolean;
  reversalsSupported: boolean;
  bonusSupported: boolean;
  combinedWagerSettlement: boolean;
  separateSettlement: boolean;
  capabilityVersion: number;
  // Synthetic-data disclosure (demo honesty).
  containsSyntheticData: boolean;
  syntheticEventCount: number;
  nonSyntheticEventCount: number;
  dataMode: 'live' | 'synthetic' | 'mixed' | 'unavailable';
}

export interface OperatorLiveFloorView {
  kpi: LiveKpiView;
  machines: MachineStatusView[];
  players: PlayerView[];
  interventions: InterventionView[];
  floors: { floorLocation: string; machineCount: number; occupiedCount: number; occupancyRate: number }[];
  // Certified period-scoped financial posture (null when no certified financial
  // data supports the scope — rendered as "—", never a false zero).
  financial: FinancialPostureView | null;
}

export interface ActivityFeedView {
  events: LiveEventView[];
}

export interface RegulatorComplianceView {
  riskTiers: { critical: number; high: number; medium: number; low: number };
  activePlayers: number;
  playersRequiringMonitoring: {
    playerId: string; riskScore: number; riskFlags: string[];
    interventionCount: number; lastInterventionAt: string | null;
  }[];
  regulatoryDecisions: DecisionView[];
  auditEvidence: { eventsObserved: string | null; projectionLagMs: number | null };
}

export interface ExecutiveSummaryView {
  kpi: LiveKpiView;
  floors: { floorLocation: string; occupancyRate: number }[];
  headlineDecisions: DecisionView[];
  operationalHealth: { state: string; projectionLagMs: number | null };
}

export interface ComplianceActionsView {
  outstanding: { playerId: string; actions: string[]; readiness: string }[];
  alerts: { type: string; playerId: string; detail: Record<string, unknown> }[];
  executionRequired: DecisionView[];
}

/** Integration health (v1.1): connector throughput + diagnostics. */
export interface IntegrationHealthView {
  casinoId: string;
  runs: number;
  received: number;
  submitted: number;
  rejected: number;
  failed: number;
  lastRunAt: string | null;
  connectors: {
    connectorType: string; connectorName: string;
    received: number; submitted: number; rejected: number; failed: number;
    lastRunAt: string | null;
  }[];
  recentDiagnostics: { connectorName: string; finishedAt: string; diagnostics: unknown[] }[];
}

/** Policy decision as presented — verbatim from the Policy Platform. */
export interface DecisionView {
  decisionId: string;
  policyId: string;
  action: string;
  priority: string;
  subject: { kind: string; id: string };
  reason: string;
  policyReference: string;
  confidence: number;
  executionRequired: boolean;
}

/** Every gateway response travels in this envelope. */
export interface ConsumerResponse<T> {
  contractVersion: ContractVersion;
  consumer: ConsumerProfile;
  view: ConsumerView;
  casinoId: string;
  generatedAt: string;
  data: T;
}
