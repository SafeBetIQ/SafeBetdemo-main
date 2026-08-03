// ─── Consumer Platform — Regulator Intelligence views (v1.2) ─────────────────
//
// The Regulator Portal is a CONSUMER. These shapers COMPOSE already-produced,
// anonymous facts from the certified platform — the Projection Platform's
// read-model rollups, the Domain Intelligence enrichment, and the Policy
// Platform's decisions — into regulator views. They recalculate nothing, own
// no runtime state, and expose no PII (anonymous SB-PLR ids only). Every
// section carries an evidence classification (Constitution §8).
//
// Cross-operator note: SafeBet identity is per-casino by design (federation
// denied by default, ADR-001), so per-INDIVIDUAL linkage across operators is
// intentionally impossible. Cross-operator intelligence here is therefore
// AGGREGATE/cohort-level only — never per-player linkage.

import type { PolicyDecision } from '../policyPlatform/index.ts';
import { shapeDecision } from './shaping.ts';
import type { DecisionView } from './contracts.ts';

export const REGULATOR_VIEWS = [
  'national-overview', 'cross-operator', 'operator-compliance',
  'investigation', 'evidence-package', 'regulatory-report',
] as const;
export type RegulatorView = (typeof REGULATOR_VIEWS)[number];

/** Which regulator views are national (no single casino / twin needed). */
export const REGULATOR_NATIONAL_VIEWS = new Set<string>([
  'national-overview', 'cross-operator', 'operator-compliance', 'regulatory-report',
]);

export type EvidenceClass = 'recorded-fact' | 'derived-intelligence' | 'policy-decision' | 'demonstration-data';

type Num = number;
const n = (v: unknown): Num => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;

interface OperatorRollup {
  casino_id: string; casino_name: string; province: string | null;
  active_players: Num;                 // observed
  players_active_now?: Num;            // certified freshness-based active-now
  players_idle?: Num; players_stale?: Num;
  active_sessions: Num; active_machines: Num;
  risk_critical: Num; risk_high: Num; risk_medium: Num; risk_low: Num;
  total_wagered: Num; ggr: Num; players_monitored: Num; interventions: Num;
  last_event_at: string | null;
}

// ─── WS1 National Regulator Dashboard ─────────────────────────────────────────

export interface NationalOverviewView {
  jurisdiction: string;
  operators: Num;
  activePlayers: Num;                 // ACTIVE NOW — certified freshness-based (sum of casino active_now)
  observedPlayers: Num;              // OBSERVED — sum of each casino's observed players
  riskTiers: { critical: Num; high: Num; medium: Num; low: Num };
  playersMonitored: Num;              // compliance-view membership (projected)
  interventions: Num;                 // recorded interventions
  ggr: Num;
  operatorHealth: { casinoId: string; name: string; activeNow: Num; observed: Num; activePlayers: Num; riskCritical: Num; monitored: Num; lastEventAt: string | null }[];
  emergingRisks: { code: string; detail: string }[];   // derived from projected tiers
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export function shapeNationalOverview(national: Record<string, unknown>): NationalOverviewView {
  const ops = (Array.isArray(national.operators_detail) ? national.operators_detail : []) as OperatorRollup[];
  const critical = n(national.risk_critical);
  const monitored = n(national.players_monitored);
  const emergingRisks: NationalOverviewView['emergingRisks'] = [];
  if (critical > 0) emergingRisks.push({ code: 'CRITICAL_RISK_PRESENT', detail: `${critical} players at critical risk across the jurisdiction` });
  ops.filter(o => n(o.risk_critical) > 0).forEach(o =>
    emergingRisks.push({ code: 'OPERATOR_CRITICAL_RISK', detail: `${o.casino_name}: ${n(o.risk_critical)} critical` }));
  return {
    jurisdiction: String(national.jurisdiction ?? ''),
    operators: n(national.operators),
    // ACTIVE NOW is the certified freshness-based sum; OBSERVED is shown separately.
    activePlayers: n(national.players_active_now),
    observedPlayers: n(national.observed_players ?? national.active_players),
    riskTiers: { critical, high: n(national.risk_high), medium: n(national.risk_medium), low: n(national.risk_low) },
    playersMonitored: monitored,
    interventions: n(national.interventions),
    ggr: n(national.ggr),
    operatorHealth: ops.map(o => ({
      casinoId: o.casino_id, name: o.casino_name,
      activeNow: n(o.players_active_now),
      observed: n(o.active_players),
      activePlayers: n(o.active_players),   // back-compat alias (= observed) for other regulator/admin views
      riskCritical: n(o.risk_critical), monitored: n(o.players_monitored), lastEventAt: o.last_event_at,
    })),
    emergingRisks,
    evidence: {
      activePlayers: 'recorded-fact', observedPlayers: 'recorded-fact', riskTiers: 'recorded-fact', playersMonitored: 'recorded-fact',
      interventions: 'recorded-fact', ggr: 'recorded-fact', emergingRisks: 'derived-intelligence',
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── WS2 Cross-Operator Intelligence (AGGREGATE only — no per-player linkage) ─

export interface CrossOperatorView {
  jurisdiction: string;
  identityModel: 'per-operator-anonymous';   // documents the privacy boundary
  perPlayerLinkage: 'not-available-by-design';
  operators: {
    casinoId: string; name: string;
    riskDistribution: { critical: Num; high: Num; medium: Num; low: Num };
    monitored: Num; interventions: Num; interventionRate: Num;   // per active player
  }[];
  nationalRiskDistribution: { critical: Num; high: Num; medium: Num; low: Num };
  evidence: Record<string, EvidenceClass>;
  note: string;
  generatedAt: string;
}

export function shapeCrossOperator(national: Record<string, unknown>): CrossOperatorView {
  const ops = (Array.isArray(national.operators_detail) ? national.operators_detail : []) as OperatorRollup[];
  return {
    jurisdiction: String(national.jurisdiction ?? ''),
    identityModel: 'per-operator-anonymous',
    perPlayerLinkage: 'not-available-by-design',
    operators: ops.map(o => {
      const active = n(o.active_players);
      return {
        casinoId: o.casino_id, name: o.casino_name,
        riskDistribution: { critical: n(o.risk_critical), high: n(o.risk_high), medium: n(o.risk_medium), low: n(o.risk_low) },
        monitored: n(o.players_monitored), interventions: n(o.interventions),
        interventionRate: active > 0 ? Math.round((n(o.interventions) / active) * 1000) / 1000 : 0,
      };
    }),
    nationalRiskDistribution: {
      critical: n(national.risk_critical), high: n(national.risk_high),
      medium: n(national.risk_medium), low: n(national.risk_low),
    },
    evidence: { riskDistribution: 'recorded-fact', interventionRate: 'derived-intelligence' },
    note: 'Anonymous per-operator identity: individual cross-operator linkage is denied by the Identity Policy (privacy by design). Intelligence is aggregate/cohort-level.',
    generatedAt: new Date().toISOString(),
  };
}

// ─── WS5 Operator Compliance ──────────────────────────────────────────────────

export interface OperatorComplianceView {
  jurisdiction: string;
  operators: {
    casinoId: string; name: string; province: string | null;
    activePlayers: Num; monitored: Num; interventions: Num;
    riskCritical: Num; riskHigh: Num;
    complianceStatus: 'attention' | 'monitor' | 'clear';
    lastEventAt: string | null;
  }[];
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export function shapeOperatorCompliance(national: Record<string, unknown>): OperatorComplianceView {
  const ops = (Array.isArray(national.operators_detail) ? national.operators_detail : []) as OperatorRollup[];
  return {
    jurisdiction: String(national.jurisdiction ?? ''),
    operators: ops.map(o => ({
      casinoId: o.casino_id, name: o.casino_name, province: o.province,
      activePlayers: n(o.active_players), monitored: n(o.players_monitored), interventions: n(o.interventions),
      riskCritical: n(o.risk_critical), riskHigh: n(o.risk_high),
      // Status is read from projected facts (tiers/monitoring) — not recomputed risk.
      complianceStatus: n(o.risk_critical) > 0 ? 'attention' : n(o.players_monitored) > 0 ? 'monitor' : 'clear',
      lastEventAt: o.last_event_at,
    })),
    evidence: { activePlayers: 'recorded-fact', monitored: 'recorded-fact', complianceStatus: 'derived-intelligence' },
    generatedAt: new Date().toISOString(),
  };
}

// ─── WS3 Investigation Workspace (per anonymous player) ───────────────────────

export interface InvestigationEvent {
  eventId: string; eventType: string; occurredAt: string;
  machineId: string | null; sessionId: string | null;
  amounts: { bet: number; win: number };
  evidenceClass: 'recorded-fact';
}

export interface InvestigationView {
  playerId: string;                    // anonymous SB-PLR
  casinoId: string;
  timeline: InvestigationEvent[];      // recorded facts
  intelligence: Record<string, unknown> | null;   // derived (from the twin enrichment)
  decisions: DecisionView[];           // policy decisions for this subject
  interventions: { count: number; lastAt: string | null };
  replayReference: { source: 'casino_event_log'; casinoId: string; playerId: string; deterministic: true };
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export interface InvestigationInput {
  playerId: string;
  casinoId: string;
  events: Record<string, unknown>[];   // casino_event_log rows for this player (scoped)
  intelligence: Record<string, unknown> | null;
  interventionCount: number;
  lastInterventionAt: string | null;
  decisions: PolicyDecision[];
}

export function shapeInvestigation(input: InvestigationInput): InvestigationView {
  const timeline: InvestigationEvent[] = input.events.map(r => {
    const p = (r.payload ?? {}) as Record<string, unknown>;
    return {
      eventId: String(r.event_id ?? ''), eventType: String(r.event_type ?? ''),
      occurredAt: String(r.occurred_at ?? ''),
      machineId: (r.machine_id as string | null) ?? null, sessionId: (r.session_id as string | null) ?? null,
      amounts: { bet: n(p.bet_amount), win: n(p.win_amount) },
      evidenceClass: 'recorded-fact',
    };
  });
  return {
    playerId: input.playerId, casinoId: input.casinoId,
    timeline,
    intelligence: input.intelligence,
    decisions: input.decisions.filter(d => d.subject.kind === 'player' && d.subject.id === input.playerId).map(shapeDecision),
    interventions: { count: input.interventionCount, lastAt: input.lastInterventionAt },
    replayReference: { source: 'casino_event_log', casinoId: input.casinoId, playerId: input.playerId, deterministic: true },
    evidence: {
      timeline: 'recorded-fact', intelligence: 'derived-intelligence',
      decisions: 'policy-decision', interventions: 'recorded-fact',
    },
    generatedAt: new Date().toISOString(),
  };
}

// ─── WS4 Evidence Package Builder ─────────────────────────────────────────────

export interface EvidencePackageView {
  packageId: string;
  subject: { playerId: string; casinoId: string; jurisdiction: string };
  sections: {
    title: string; evidenceClass: EvidenceClass; content: unknown;
  }[];
  replayReference: InvestigationView['replayReference'];
  attestation: string;
  generatedAt: string;
}

export function buildEvidencePackage(investigation: InvestigationView, jurisdiction: string): EvidencePackageView {
  return {
    packageId: `EVP-${investigation.casinoId.slice(0, 8)}-${investigation.playerId.slice(-8)}-${Date.now()}`,
    subject: { playerId: investigation.playerId, casinoId: investigation.casinoId, jurisdiction },
    sections: [
      { title: 'Event Timeline', evidenceClass: 'recorded-fact', content: investigation.timeline },
      { title: 'Intelligence Summary', evidenceClass: 'derived-intelligence', content: investigation.intelligence },
      { title: 'Policy Decisions', evidenceClass: 'policy-decision', content: investigation.decisions },
      { title: 'Intervention Record', evidenceClass: 'recorded-fact', content: investigation.interventions },
    ],
    replayReference: investigation.replayReference,
    attestation: 'Every value is classified (Recorded Fact / Derived Intelligence / Policy Decision). Anonymous SB-PLR identity; no PII. Reconstructable deterministically from the immutable event log.',
    generatedAt: new Date().toISOString(),
  };
}

// ─── WS6 Regulatory Reporting ─────────────────────────────────────────────────

export const REPORT_KINDS = [
  'responsible-gambling', 'operator-compliance', 'intervention-statistics',
  'cross-operator', 'national-trend', 'policy-effectiveness', 'regulatory-risk',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export interface RegulatoryReportView {
  kind: ReportKind;
  jurisdiction: string;
  title: string;
  sections: { heading: string; evidenceClass: EvidenceClass; rows: Record<string, unknown>[] }[];
  generatedAt: string;
}

export function shapeRegulatoryReport(kind: ReportKind, national: Record<string, unknown>): RegulatoryReportView {
  const ops = (Array.isArray(national.operators_detail) ? national.operators_detail : []) as OperatorRollup[];
  const titles: Record<ReportKind, string> = {
    'responsible-gambling': 'Responsible Gambling Overview',
    'operator-compliance': 'Operator Compliance',
    'intervention-statistics': 'Intervention Statistics',
    'cross-operator': 'Cross-Operator Intelligence',
    'national-trend': 'National Trend Analysis',
    'policy-effectiveness': 'Policy Effectiveness',
    'regulatory-risk': 'Regulatory Risk Summary',
  };
  const opRows = ops.map(o => ({
    operator: o.casino_name, active_players: n(o.active_players),
    risk_critical: n(o.risk_critical), risk_high: n(o.risk_high),
    monitored: n(o.players_monitored), interventions: n(o.interventions),
  }));
  return {
    kind, jurisdiction: String(national.jurisdiction ?? ''), title: titles[kind],
    sections: [
      { heading: 'Jurisdiction Summary', evidenceClass: 'recorded-fact', rows: [{
        operators: n(national.operators), active_players: n(national.active_players),
        critical: n(national.risk_critical), high: n(national.risk_high),
        monitored: n(national.players_monitored), interventions: n(national.interventions), ggr: n(national.ggr),
      }] },
      { heading: 'By Operator', evidenceClass: 'recorded-fact', rows: opRows },
    ],
    generatedAt: new Date().toISOString(),
  };
}
