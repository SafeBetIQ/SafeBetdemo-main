// ─── Enterprise Consumer Platform — THE presentation gateway (Phase 3.7) ─────
//
// ONE gateway serving EVERY consumer: casino dashboards, regulator views,
// executive summaries, compliance workspaces, mobile apps, REST clients and
// future GraphQL resolvers all call serve(). There are no per-consumer
// APIs and no feature endpoints — one router, one authorization model,
// one contract catalogue.
//
//   request {consumer, view, version, casinoId}
//     → negotiate version → authorize → read the enterprise platforms
//     → shape → ConsumerResponse envelope
//
// The gateway reads the Digital Twin (already enriched by the Domain
// Intelligence Platform), the Policy Platform's decisions, and the
// distributed event feed. It SHAPES information — it never recalculates
// intelligence, never evaluates policy logic itself, never mutates
// anything, and never exposes platform internals.

import type { CasinoDigitalTwin } from '../digitalTwin/index.ts';
import { intelligenceOf } from '../domainIntelligence/index.ts';
import type { DecisionSet } from '../policyPlatform/index.ts';
import { authorizeView } from './authorization.ts';
import {
  CONTRACT_VERSIONS, CURRENT_VERSION,
  CONSUMER_PROFILES, CONSUMER_VIEWS,
  type ActivityFeedView, type ComplianceActionsView, type ConsumerProfile,
  type ConsumerResponse, type ConsumerView, type ContractVersion,
  type ExecutiveSummaryView, type LiveEventView, type OperatorLiveFloorView,
  type RegulatorComplianceView, type IntegrationHealthView,
} from './contracts.ts';
import {
  shapeDecision, shapeEventRow, shapeFinancial, shapeFloorGrid, shapeIntervention,
  shapeKpi, shapePlayer,
} from './shaping.ts';
import {
  REGULATOR_VIEWS, type RegulatorView,
  type InvestigationInput, type ReportKind,
  shapeNationalOverview, shapeCrossOperator, shapeOperatorCompliance,
  shapeInvestigation, buildEvidencePackage, shapeRegulatoryReport,
} from './regulator.ts';
import {
  explainPlayer, shapeAiPerformance, shapeExecutiveIntelligence,
  type ExplanationView, type AiPerformanceView, type ExecutiveIntelligenceView,
} from './explain.ts';

export interface ConsumerRequest {
  consumer: ConsumerProfile;
  view: ConsumerView;
  casinoId: string;
  version?: string;
  jurisdiction?: string;
}

/**
 * The enterprise sources the gateway presents. The host wires these from
 * the platforms (twin already enriched; decisions from the Policy
 * Platform; recent rows from the distributed event store). The gateway
 * itself holds no state and no clients.
 */
export interface ConsumerSources {
  twin: CasinoDigitalTwin;
  /** Recent distributed events (casino_event_log rows, newest first). */
  recentEvents(): Promise<Record<string, unknown>[]>;
  /** The Policy Platform's decision set for this casino + jurisdiction. */
  decisions(): DecisionSet;
  /** Connector integration health (v1.1). Optional; empty when unavailable. */
  connectorHealth?(): Promise<Record<string, unknown>>;
  /** A player's immutable event timeline (recorded facts) for explanation (v1.4). */
  playerEvents?(playerId: string): Promise<Record<string, unknown>[]>;
  /** The player id to explain (v1.4 explanation view). */
  explainPlayerId?: string;
  /** Certified period-scoped financial posture row (projection_financial_posture). */
  financialPosture?(): Promise<Record<string, unknown> | null>;
}

/**
 * Regulator Intelligence sources (v1.2). Composition of certified read-model
 * rollups + per-player timelines — the host supplies these scoped to the
 * VERIFIED regulator's jurisdiction. No recalculation; anonymous; no PII.
 */
export interface RegulatorSources {
  jurisdiction: string;
  /** sbiq_regulator_national(jurisdiction) rollup. */
  national(): Promise<Record<string, unknown>>;
  /** For investigation/evidence of one anonymous player. */
  investigation?(): Promise<InvestigationInput>;
  /** Report kind for regulatory-report. */
  reportKind?: ReportKind;
}

export class ConsumerRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ConsumerRequestError';
    this.status = status;
  }
}

function negotiateVersion(requested: string | undefined): ContractVersion {
  const version = requested ?? CURRENT_VERSION;
  if ((CONTRACT_VERSIONS as readonly string[]).indexOf(version) === -1) {
    throw new ConsumerRequestError(
      `unsupported contract version '${version}' — supported: ${CONTRACT_VERSIONS.join(', ')}`, 400);
  }
  return version as ContractVersion;
}

export function validateRequest(req: ConsumerRequest): void {
  if ((CONSUMER_PROFILES as readonly string[]).indexOf(req.consumer) === -1) {
    throw new ConsumerRequestError(`unknown consumer profile '${req.consumer}'`, 400);
  }
  if ((CONSUMER_VIEWS as readonly string[]).indexOf(req.view) === -1) {
    throw new ConsumerRequestError(`unknown view '${req.view}'`, 400);
  }
}

export class ConsumerGateway {
  /** Serve one consumer request. The ONLY consumer entry point. */
  async serve(req: ConsumerRequest, sources: ConsumerSources): Promise<ConsumerResponse<unknown>> {
    const version = negotiateVersion(req.version);
    validateRequest(req);
    authorizeView(req.consumer, req.view);

    let data: unknown;
    switch (req.view) {
      case 'live-floor': data = await this.liveFloor(sources); break;
      case 'activity-feed': data = await this.activityFeed(sources); break;
      case 'compliance': data = await this.compliance(sources); break;
      case 'summary': data = await this.summary(sources); break;
      case 'actions': data = await this.actions(sources); break;
      case 'integration': data = await this.integration(sources); break;
      case 'explanation': data = await this.explanation(sources); break;
      case 'ai-performance': data = this.aiPerformance(sources); break;
      case 'executive-intelligence': data = this.executiveIntelligence(sources); break;
      default: throw new ConsumerRequestError(`unknown view '${req.view}'`, 400);
    }

    return {
      contractVersion: version,
      consumer: req.consumer,
      view: req.view,
      casinoId: sources.twin.casinoId,
      generatedAt: new Date().toISOString(),
      data,
    };
  }

  /**
   * Serve a regulator view (v1.2). Composition of certified read-model
   * rollups + decisions, scoped to the VERIFIED regulator's jurisdiction.
   * No twin required for national views; anonymous; no recalculation.
   */
  async serveRegulator(
    req: { consumer: ConsumerProfile; view: string; version?: string },
    regulator: RegulatorSources,
  ): Promise<ConsumerResponse<unknown>> {
    const version = negotiateVersion(req.version);
    if ((CONSUMER_PROFILES as readonly string[]).indexOf(req.consumer) === -1) {
      throw new ConsumerRequestError(`unknown consumer profile '${req.consumer}'`, 400);
    }
    if ((REGULATOR_VIEWS as readonly string[]).indexOf(req.view) === -1) {
      throw new ConsumerRequestError(`'${req.view}' is not a regulator view`, 400);
    }
    authorizeView(req.consumer, req.view as ConsumerView);
    const data = await this.regulatorView(req.view as RegulatorView, regulator);
    return {
      contractVersion: version, consumer: req.consumer, view: req.view as ConsumerView,
      casinoId: regulator.jurisdiction, generatedAt: new Date().toISOString(), data,
    };
  }

  private async regulatorView(view: RegulatorView, r: RegulatorSources): Promise<unknown> {
    if (view === 'national-overview') return shapeNationalOverview(await r.national());
    if (view === 'cross-operator') return shapeCrossOperator(await r.national());
    if (view === 'operator-compliance') return shapeOperatorCompliance(await r.national());
    if (view === 'regulatory-report') return shapeRegulatoryReport(r.reportKind ?? 'responsible-gambling', await r.national());
    if (view === 'investigation') {
      if (!r.investigation) throw new ConsumerRequestError('player_id required for investigation', 400);
      return shapeInvestigation(await r.investigation());
    }
    if (view === 'evidence-package') {
      if (!r.investigation) throw new ConsumerRequestError('player_id required for evidence package', 400);
      return buildEvidencePackage(shapeInvestigation(await r.investigation()), r.jurisdiction);
    }
    throw new ConsumerRequestError(`unknown regulator view '${view}'`, 400);
  }

  private async feed(sources: ConsumerSources): Promise<LiveEventView[]> {
    const rows = await sources.recentEvents();
    return rows.map(shapeEventRow);
  }

  private async liveFloor(sources: ConsumerSources): Promise<OperatorLiveFloorView> {
    const twin = sources.twin;
    const events = await this.feed(sources);
    const financial = shapeFinancial(sources.financialPosture ? await sources.financialPosture() : null);
    return {
      financial,
      kpi: shapeKpi(twin, events.slice(0, 60)),
      machines: shapeFloorGrid(twin),
      players: Array.from(twin.registry.players.values()).map(p => shapePlayer(p, twin)),
      interventions: twin.activeInterventions().map(i => shapeIntervention(i, twin)),
      floors: twin.floorOccupancy(),
    };
  }

  private async activityFeed(sources: ConsumerSources): Promise<ActivityFeedView> {
    return { events: await this.feed(sources) };
  }

  private async compliance(sources: ConsumerSources): Promise<RegulatorComplianceView> {
    const twin = sources.twin;
    const aggregates = twin.casinoAggregates();
    const health = twin.health();
    const decisions = sources.decisions();
    return {
      riskTiers: {
        critical: aggregates.riskCritical, high: aggregates.riskHigh,
        medium: aggregates.riskMedium, low: aggregates.riskLow,
      },
      activePlayers: aggregates.activePlayers,
      playersRequiringMonitoring: twin.playersRequiringMonitoring().map(p => ({
        playerId: p.playerId, riskScore: p.riskScore, riskFlags: p.riskFlags,
        interventionCount: p.interventionCount, lastInterventionAt: p.lastInterventionAt,
      })),
      regulatoryDecisions: decisions.decisions
        .filter(d => d.action === 'REGULATOR_NOTIFICATION_REQUIRED' || d.action === 'COMPLIANCE_REVIEW_REQUIRED')
        .map(shapeDecision),
      auditEvidence: {
        eventsObserved: aggregates.lastEventAt,
        projectionLagMs: health.projectionLagMs,
      },
    };
  }

  private async summary(sources: ConsumerSources): Promise<ExecutiveSummaryView> {
    const twin = sources.twin;
    const events = await this.feed(sources);
    const health = twin.health();
    const decisions = sources.decisions();
    return {
      kpi: shapeKpi(twin, events.slice(0, 60)),
      floors: twin.floorOccupancy().map(f => ({
        floorLocation: f.floorLocation, occupancyRate: f.occupancyRate,
      })),
      headlineDecisions: decisions.decisions
        .filter(d => d.priority === 'critical' || d.priority === 'high')
        .slice(0, 10).map(shapeDecision),
      operationalHealth: { state: health.state, projectionLagMs: health.projectionLagMs },
    };
  }

  private async actions(sources: ConsumerSources): Promise<ComplianceActionsView> {
    const twin = sources.twin;
    const decisions = sources.decisions();
    const outstanding: ComplianceActionsView['outstanding'] = [];
    twin.registry.players.forEach(player => {
      const compliance = (intelligenceOf(player)?.compliance ?? {}) as Record<string, unknown>;
      const actions = Array.isArray(compliance.outstandingActions)
        ? compliance.outstandingActions as string[] : [];
      if (actions.length > 0) {
        outstanding.push({
          playerId: player.playerId, actions,
          readiness: String(compliance.complianceReadiness ?? 'unknown'),
        });
      }
    });
    return {
      outstanding,
      alerts: twin.operationalAlerts(),
      executionRequired: decisions.decisions.filter(d => d.executionRequired).map(shapeDecision),
    };
  }

  // ── Explainable Intelligence (v1.4) — explains the EXISTING intelligence ──
  private async explanation(sources: ConsumerSources): Promise<ExplanationView> {
    const twin = sources.twin;
    const playerId = sources.explainPlayerId;
    if (!playerId) throw new ConsumerRequestError('player_id required for explanation', 400);
    const player = twin.registry.players.get(playerId) ?? null;
    const events = sources.playerEvents ? await sources.playerEvents(playerId) : [];
    return explainPlayer({
      playerId, casinoId: twin.casinoId,
      player: player ? {
        riskScore: player.riskScore, riskFlags: player.riskFlags, totalWagered: player.totalWagered,
        totalWon: player.totalWon, betCount: player.betCount, interventionCount: player.interventionCount,
        lastInterventionAt: player.lastInterventionAt, requiresMonitoring: player.requiresMonitoring,
      } : null,
      intelligence: player ? (intelligenceOf(player) ?? null) : null,
      decisions: sources.decisions().decisions,
      events,
    });
  }

  private aiPerformance(sources: ConsumerSources): AiPerformanceView {
    const twin = sources.twin;
    const agg = twin.casinoAggregates();
    const players = Array.from(twin.registry.players.values()).map(p => ({
      intelligence: intelligenceOf(p) ?? null,
      interventionCount: p.interventionCount, requiresMonitoring: p.requiresMonitoring,
    }));
    return shapeAiPerformance({
      casinoId: twin.casinoId,
      aggregates: { riskCritical: agg.riskCritical, riskHigh: agg.riskHigh, riskMedium: agg.riskMedium, riskLow: agg.riskLow },
      players,
    });
  }

  private executiveIntelligence(sources: ConsumerSources): ExecutiveIntelligenceView {
    const twin = sources.twin;
    const agg = twin.casinoAggregates();
    const busiest = twin.busiestFloor();
    const emerging = new Set<string>();
    twin.registry.players.forEach(p => {
      const ai = (intelligenceOf(p)?.ai ?? {}) as Record<string, unknown>;
      if (Array.isArray(ai.emergingBehaviour)) (ai.emergingBehaviour as string[]).forEach(e => emerging.add(e.replace(/_/g, ' ')));
    });
    return shapeExecutiveIntelligence({
      casinoId: twin.casinoId,
      aggregates: { activePlayers: agg.activePlayers, ggr: agg.ggr, riskCritical: agg.riskCritical, riskHigh: agg.riskHigh },
      playersMonitored: twin.playersRequiringMonitoring().length,
      interventions: twin.activeInterventions().length,
      busiestOccupancy: busiest ? busiest.occupancyRate : null,
      emerging: Array.from(emerging),
    });
  }

  private async integration(sources: ConsumerSources): Promise<IntegrationHealthView> {
    const h = (sources.connectorHealth ? await sources.connectorHealth() : {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
    const connectors = Array.isArray(h.connectors) ? h.connectors as Record<string, unknown>[] : [];
    const diags = Array.isArray(h.recent_diagnostics) ? h.recent_diagnostics as Record<string, unknown>[] : [];
    return {
      casinoId: sources.twin.casinoId,
      runs: n(h.runs), received: n(h.received), submitted: n(h.submitted),
      rejected: n(h.rejected), failed: n(h.failed),
      lastRunAt: (h.last_run_at as string | null) ?? null,
      connectors: connectors.map(c => ({
        connectorType: String(c.connector_type ?? ''), connectorName: String(c.connector_name ?? ''),
        received: n(c.received), submitted: n(c.submitted), rejected: n(c.rejected), failed: n(c.failed),
        lastRunAt: (c.last_run_at as string | null) ?? null,
      })),
      recentDiagnostics: diags.map(d => ({
        connectorName: String(d.connector_name ?? ''), finishedAt: String(d.finished_at ?? ''),
        diagnostics: Array.isArray(d.diagnostics) ? d.diagnostics : [],
      })),
    };
  }
}

let defaultGateway: ConsumerGateway | undefined;

/** THE application-wide Enterprise Consumer Platform gateway. */
export function getConsumerGateway(): ConsumerGateway {
  if (!defaultGateway) defaultGateway = new ConsumerGateway();
  return defaultGateway;
}
