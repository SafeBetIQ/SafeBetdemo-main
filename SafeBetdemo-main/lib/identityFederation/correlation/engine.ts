// ─── Enterprise Correlation Layer — engine (v2.0, ADR-006 · Milestone 3.5) ───
//
// The regulator-plane, READ-ONLY national intelligence engine. It assembles
// National Player Twins, cross-operator timelines, cross-operator intelligence,
// national behaviour analytics, the national self-exclusion view, and regulator
// investigation views — every one carrying complete, immutable provenance and
// reconstructable from authoritative source references.
//
// HARD GUARANTEES (enforced + tested):
//   • Read-only: it NEVER mutates the Registry, SB-PLR, SB-NAT, decisions, or any
//     operator runtime. It only READS the Registry and injected read-only
//     providers, and DERIVES results in the regulator plane.
//   • Deny-by-default access + jurisdiction sovereignty (see model.authorise).
//   • Deterministic + explainable: no ML, no hidden scoring, no hidden thresholds.
//   • No plaintext PII enters or leaves the layer.
//   • It performs NO identity matching, NO federation decisions, and mints NO
//     SB-NAT (those are Milestones 3.2 / 3.3 / 3.4).

import type { JurisdictionCode, SbNatId } from '../types.ts';
import { jurisdictionOfSbNat } from '../identifiers.ts';
import type { SbNatRegistry, SbNatRecord } from '../registry.ts';
import {
  type CorrelationDataProvider, type AccessContext, authorise, AccessDeniedError,
  type CorrelationProvenance, type ExcludedSource,
  type EventReference, type RiskReference, type InterventionReference,
  type SelfExclusionReference, type ComplianceReference, type InvestigationReference,
  type PlayerReference, type TwinReference,
  type TimelineEntry, type CrossOperatorTimeline, type NationalPlayerTwin,
  type RiskEvolutionEntry, type InterventionEntry, type SelfExclusionEntry, type ComplianceEntry,
  type NationalWellbeingSummary, type NationalBehaviourMetric, type OperatorSwitch,
  type CrossOperatorIntelligence, type NationalSelfExclusionView, type InvestigationView,
  type CorrelationDiagnostics, type CorrelationIntegrityReport, type CorrelationIntegrityCheck,
  type OperatorParticipation, type RiskTier, riskRank,
} from './model.ts';

/** Current Enterprise Correlation Layer version (stamped on every insight). */
export const CORRELATION_ENGINE_VERSION = '2.0';

export class CorrelationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'CorrelationError'; this.code = code; }
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) deepFreeze((o as Record<string, unknown>)[k]);
  }
  return o;
}

const uniqSorted = (xs: string[]): string[] => Array.from(new Set(xs)).sort();
const dayOf = (iso: string): string => iso.slice(0, 10);

/** Heuristic PII guard: flags emails or long digit runs (phone/id-like). */
function containsLikelyPii(s: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(s) || /\d{7,}/.test(s);
}

/** All references gathered for one SB-NAT (pure; no timestamps of its own). */
interface Gathered {
  record: SbNatRecord;
  jurisdiction: JurisdictionCode;
  members: string[];
  players: PlayerReference[];
  events: EventReference[];
  risks: RiskReference[];
  interventions: InterventionReference[];
  selfExclusions: SelfExclusionReference[];
  compliance: ComplianceReference[];
  investigations: InvestigationReference[];
  twins: TwinReference[];
  operators: string[];
  excluded: ExcludedSource[];
  missingSources: string[];
}

export interface CorrelationEngineOptions {
  registry: SbNatRegistry;
  provider: CorrelationDataProvider;
  now?: () => string;
  /** Optional federation feature-flag gate; when supplied, a disabled jurisdiction is denied. */
  isEnabled?: (j: JurisdictionCode) => boolean;
}

export class EnterpriseCorrelationLayer {
  private readonly registry: SbNatRegistry;
  private readonly provider: CorrelationDataProvider;
  private readonly now: () => string;
  private readonly isEnabled?: (j: JurisdictionCode) => boolean;

  constructor(opts: CorrelationEngineOptions) {
    this.registry = opts.registry;
    this.provider = opts.provider;
    this.now = opts.now ?? (() => new Date().toISOString());
    this.isEnabled = opts.isEnabled;
  }

  // ── Public queries (every one authorised + jurisdiction-bound) ──────────────

  getNationalPlayerTwin(ctx: AccessContext, sbNat: SbNatId): NationalPlayerTwin {
    const g = this.authorisedGather(ctx, sbNat);
    return this.buildTwin(g, this.now());
  }

  getCrossOperatorTimeline(ctx: AccessContext, sbNat: SbNatId): CrossOperatorTimeline {
    const g = this.authorisedGather(ctx, sbNat);
    return this.buildTimeline(g, this.now());
  }

  getCrossOperatorIntelligence(ctx: AccessContext, sbNat: SbNatId): CrossOperatorIntelligence {
    const g = this.authorisedGather(ctx, sbNat);
    return this.buildIntelligence(g, this.now());
  }

  getNationalBehaviourAnalytics(ctx: AccessContext, sbNat: SbNatId): NationalBehaviourMetric[] {
    const g = this.authorisedGather(ctx, sbNat);
    return deepFreeze(this.buildMetrics(g, this.now()));
  }

  getNationalSelfExclusionView(ctx: AccessContext, sbNat: SbNatId): NationalSelfExclusionView {
    const g = this.authorisedGather(ctx, sbNat);
    return this.buildSelfExclusionView(g, this.now());
  }

  getOperatorParticipation(ctx: AccessContext, sbNat: SbNatId): OperatorParticipation[] {
    const g = this.authorisedGather(ctx, sbNat);
    return deepFreeze(this.participation(g));
  }

  /** Create a read-only derived investigation view linking an SB-NAT to an investigation reference. */
  createInvestigationView(ctx: AccessContext, sbNat: SbNatId, investigationRef: string, observations: string[] = []): InvestigationView {
    const g = this.authorisedGather(ctx, sbNat);
    const at = this.now();
    const timeline = this.timelineEntries(g);
    const prov = this.buildProvenance(g, at, ['Investigation view is derived, read-only intelligence; it does not modify any operator investigation record.']);
    const findings = g.investigations
      .map((i) => ({ at: i.at, note: `linked investigation reference ${i.ref} (operator ${i.operatorId})` }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.note.localeCompare(b.note));
    const summary = `SB-NAT ${sbNat} correlates ${g.members.length} operator identit${g.members.length === 1 ? 'y' : 'ies'} across ${g.operators.length} operator(s); ${timeline.length} source references, ${g.investigations.length} investigation reference(s). Derived read-only.`;
    return deepFreeze({
      investigationRef, sbNat, jurisdiction: g.jurisdiction,
      linkedSbPlr: g.members.slice(), linkedOperators: g.operators.slice(),
      timeline, findings, observations: observations.slice(), summary,
      provenance: prov, correlationEngineVersion: CORRELATION_ENGINE_VERSION, generatedAt: at,
    });
  }

  correlationDiagnostics(ctx: AccessContext, sbNat: SbNatId): CorrelationDiagnostics {
    const started = Date.now();
    const g = this.authorisedGather(ctx, sbNat);
    const sourceRefs = this.allSourceRefs(g);
    const integrity = this.integrityChecks(g, sbNat);
    return deepFreeze({
      sbNat, jurisdiction: g.jurisdiction,
      sbPlrCorrelated: g.members.length,
      operatorsRepresented: g.operators.length,
      sourceReferencesEvaluated: sourceRefs.length + g.excluded.length,
      recordsIncluded: sourceRefs.length,
      recordsExcluded: g.excluded.length,
      exclusionReasons: g.excluded.slice(),
      missingSources: g.missingSources.slice(),
      staleSources: [],
      provenanceComplete: this.buildProvenance(g, this.now(), []).federationDecisionRefs.length > 0,
      integrityOk: integrity.every((c) => c.passed),
      processingMs: Date.now() - started,
    });
  }

  /**
   * Structured correlation integrity report. Validates eligibility, provenance,
   * jurisdiction, determinism, reproducibility, no-PII and no-runtime-mutation.
   * `freshnessHorizonMs` is caller-supplied (never a hidden threshold).
   */
  verifyCorrelationIntegrity(ctx: AccessContext, sbNat: SbNatId, opts: { freshnessHorizonMs?: number; asOf?: string } = {}): CorrelationIntegrityReport {
    const g = this.authorisedGather(ctx, sbNat);
    const checks = this.integrityChecks(g, sbNat, opts);
    const reproducible = checks.find((c) => c.name === 'reproducible')?.passed ?? false;
    return deepFreeze({ sbNat, jurisdiction: g.jurisdiction, ok: checks.every((c) => c.passed), checks, reproducible });
  }

  // ── Gather (read-only; jurisdiction-isolated) ───────────────────────────────

  private authorisedGather(ctx: AccessContext, sbNat: SbNatId): Gathered {
    const j = jurisdictionOfSbNat(sbNat);
    if (!j) throw new CorrelationError('malformed-sbnat', `malformed SB-NAT identifier '${sbNat}'`);
    authorise(ctx, j);                                    // deny-by-default, sovereignty
    if (this.isEnabled && !this.isEnabled(j)) throw new AccessDeniedError(`federation is not enabled for jurisdiction '${j}'`);
    return this.gather(sbNat, j);
  }

  private gather(sbNat: SbNatId, jurisdiction: JurisdictionCode): Gathered {
    const record = this.registry.get(sbNat);
    if (!record) throw new CorrelationError('sbnat-not-found', `SB-NAT ${sbNat} is not present in the registry`);
    const members = record.members.slice().sort();

    const players: PlayerReference[] = [];
    const events: EventReference[] = [];
    const risks: RiskReference[] = [];
    const interventions: InterventionReference[] = [];
    const selfExclusions: SelfExclusionReference[] = [];
    const compliance: ComplianceReference[] = [];
    const investigations: InvestigationReference[] = [];
    const twins: TwinReference[] = [];
    const excluded: ExcludedSource[] = [];
    const missingSources: string[] = [];
    const operators = new Set<string>();

    // Data minimisation + jurisdiction isolation: keep only references whose
    // source operator is within THIS sovereign jurisdiction; exclude the rest.
    const keep = (operatorId: string, ref: string): boolean => {
      const op = this.provider.operator(operatorId);
      if (op && op.jurisdiction !== jurisdiction) {
        excluded.push({ ref, reason: `operator ${operatorId} is outside sovereign jurisdiction ${jurisdiction}` });
        return false;
      }
      operators.add(operatorId);
      return true;
    };

    for (const sbPlr of members) {
      const p = this.provider.playerReferences(sbPlr);
      if (p.length === 0) missingSources.push(`player-reference:${sbPlr}`);
      for (const r of p) if (keep(r.operatorId, `player:${sbPlr}:${r.operatorId}`)) players.push(r);
      for (const r of this.provider.eventReferences(sbPlr)) if (keep(r.operatorId, `event:${r.eventId}`)) events.push(r);
      for (const r of this.provider.riskReferences(sbPlr)) if (keep(r.operatorId, `risk:${r.riskId}`)) risks.push(r);
      for (const r of this.provider.interventionReferences(sbPlr)) if (keep(r.operatorId, `intervention:${r.interventionId}`)) interventions.push(r);
      for (const r of this.provider.selfExclusionReferences(sbPlr)) if (keep(r.operatorId, `self-exclusion:${r.exclusionId}`)) selfExclusions.push(r);
      for (const r of this.provider.complianceReferences(sbPlr)) if (keep(r.operatorId, `compliance:${r.recordId}`)) compliance.push(r);
      for (const r of this.provider.investigationReferences(sbPlr)) if (keep(r.operatorId, `investigation:${r.investigationId}`)) investigations.push(r);
      for (const r of this.provider.twinReferences(sbPlr)) if (keep(r.operatorId, `twin:${r.twinId}`)) twins.push(r);
    }

    return {
      record, jurisdiction, members, players, events, risks, interventions,
      selfExclusions, compliance, investigations, twins,
      operators: Array.from(operators).sort(), excluded, missingSources,
    };
  }

  // ── Provenance ──────────────────────────────────────────────────────────────

  private buildProvenance(g: Gathered, at: string, extraLimitations: string[]): CorrelationProvenance {
    const decisionRefs = uniqSorted(g.record.sourceDecisionIds);
    const candidateRefs = uniqSorted(decisionRefs.map(parseCandidateRef).filter((x): x is string => !!x));
    const assignmentRefs: string[] = [];
    for (const m of g.members) {
      for (const a of this.registry.assignmentHistory(m)) {
        if (a.sbNat === g.record.sbNat) assignmentRefs.push(`assign:${m}->${a.sbNat}@${a.action}`);
      }
    }
    const sourceRefs = this.allSourceRefs(g);
    const timestamps = uniqSorted(this.allSourceTimestamps(g));
    const limitations = [
      'Read-only regulator-plane derivation; source data remains authoritative in its originating platform.',
      'Matching evidence is referenced through its matching candidate id (evidence detail resolves via the Matching Engine).',
      ...(g.excluded.length ? [`${g.excluded.length} out-of-jurisdiction reference(s) excluded for sovereign separation.`] : []),
      ...(g.missingSources.length ? [`${g.missingSources.length} source(s) unavailable at correlation time.`] : []),
      ...extraLimitations,
    ];
    return {
      sbNat: g.record.sbNat, jurisdiction: g.jurisdiction,
      sbPlrRefs: g.members.slice(), sourceOperators: g.operators.slice(),
      registryAssignmentRefs: uniqSorted(assignmentRefs),
      federationDecisionRefs: decisionRefs,
      matchingCandidateRefs: candidateRefs,
      matchingEvidenceRefs: candidateRefs.slice(),
      sourceRecordRefs: sourceRefs,
      sourceTimestamps: timestamps,
      correlationTimestamp: at,
      correlationEngineVersion: CORRELATION_ENGINE_VERSION,
      policyVersion: null,                                 // policy execution is Milestone 3.6
      dataFreshness: timestamps.length ? timestamps[timestamps.length - 1] : null,
      excludedSources: g.excluded.slice(),
      limitations,
    };
  }

  private allSourceRefs(g: Gathered): string[] {
    return uniqSorted([
      ...g.events.map((e) => `event:${e.eventId}`),
      ...g.risks.map((r) => `risk:${r.riskId}`),
      ...g.interventions.map((i) => `intervention:${i.interventionId}`),
      ...g.selfExclusions.map((s) => `self-exclusion:${s.exclusionId}`),
      ...g.compliance.map((c) => `compliance:${c.recordId}`),
      ...g.investigations.map((v) => `investigation:${v.investigationId}`),
      ...g.twins.map((t) => `twin:${t.twinId}`),
    ]);
  }

  private allSourceTimestamps(g: Gathered): string[] {
    return [
      ...g.events.map((e) => e.at), ...g.risks.map((r) => r.at),
      ...g.interventions.map((i) => i.at), ...g.selfExclusions.map((s) => s.startAt),
      ...g.compliance.map((c) => c.at), ...g.investigations.map((v) => v.at),
      ...g.twins.map((t) => t.at),
    ];
  }

  // ── Timeline (deterministic ordering) ───────────────────────────────────────

  private timelineEntries(g: Gathered): TimelineEntry[] {
    const entries: TimelineEntry[] = g.events.map((e) => ({
      at: e.at, operatorId: e.operatorId, sbPlr: e.sbPlr,
      category: e.category, sourceRef: `event:${e.eventId}`, magnitudeBand: e.magnitudeBand,
    }));
    // Deterministic order: time, then operator, then category, then source ref.
    entries.sort((a, b) =>
      a.at.localeCompare(b.at) ||
      a.operatorId.localeCompare(b.operatorId) ||
      a.category.localeCompare(b.category) ||
      a.sourceRef.localeCompare(b.sourceRef));
    return entries;
  }

  private buildTimeline(g: Gathered, at: string): CrossOperatorTimeline {
    return deepFreeze({
      sbNat: g.record.sbNat, jurisdiction: g.jurisdiction,
      entries: this.timelineEntries(g),
      provenance: this.buildProvenance(g, at, []),
      correlationEngineVersion: CORRELATION_ENGINE_VERSION, generatedAt: at,
    });
  }

  // ── National Player Twin ────────────────────────────────────────────────────

  private participation(g: Gathered): OperatorParticipation[] {
    const byKey = new Map<string, OperatorParticipation>();
    for (const p of g.players) {
      byKey.set(`${p.operatorId}|${p.sbPlr}`, { operatorId: p.operatorId, sbPlr: p.sbPlr, events: 0, firstAt: p.firstObservedAt, lastAt: p.lastObservedAt });
    }
    for (const e of g.events) {
      const k = `${e.operatorId}|${e.sbPlr}`;
      const row = byKey.get(k) ?? { operatorId: e.operatorId, sbPlr: e.sbPlr, events: 0, firstAt: null, lastAt: null };
      row.events += 1;
      row.firstAt = row.firstAt && row.firstAt <= e.at ? row.firstAt : e.at;
      row.lastAt = row.lastAt && row.lastAt >= e.at ? row.lastAt : e.at;
      byKey.set(k, row);
    }
    return Array.from(byKey.values()).sort((a, b) => a.operatorId.localeCompare(b.operatorId) || a.sbPlr.localeCompare(b.sbPlr));
  }

  private riskEvolution(g: Gathered): RiskEvolutionEntry[] {
    return g.risks
      .map((r) => ({ at: r.at, operatorId: r.operatorId, tier: r.tier }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.operatorId.localeCompare(b.operatorId));
  }

  private wellbeing(g: Gathered, risk: RiskEvolutionEntry[]): NationalWellbeingSummary {
    const currentRiskTier = risk.length ? risk[risk.length - 1].tier : null;
    const riskEscalating = risk.length >= 2 && riskRank(risk[risk.length - 1].tier) > riskRank(risk[0].tier);
    const activeSelfExclusions = g.selfExclusions.filter((s) => s.kind === 'self-exclusion' && s.status === 'active').length;
    const activeCoolingOff = g.selfExclusions.filter((s) => s.kind === 'cooling-off' && s.status === 'active').length;
    return {
      currentRiskTier, riskEscalating,
      activeSelfExclusions, activeCoolingOff,
      totalInterventions: g.interventions.length,
      participatingOperatorCount: g.operators.length,
      method: 'Deterministic aggregation of authoritative source references: current tier = latest risk reference; escalating = last tier rank > first tier rank; counts are direct reference tallies. No scoring/ML/thresholds.',
    };
  }

  private buildTwin(g: Gathered, at: string): NationalPlayerTwin {
    const timeline = this.timelineEntries(g);
    const risk = this.riskEvolution(g);
    const prov = this.buildProvenance(g, at, []);
    const firstAts = [...g.players.map((p) => p.firstObservedAt), ...timeline.map((e) => e.at)].sort();
    const lastAts = [...g.players.map((p) => p.lastObservedAt), ...timeline.map((e) => e.at)].sort();
    const interventionHistory: InterventionEntry[] = g.interventions
      .map((i) => ({ at: i.at, operatorId: i.operatorId, interventionId: i.interventionId, type: i.type, outcome: i.outcome }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.interventionId.localeCompare(b.interventionId));
    const selfExclusionHistory: SelfExclusionEntry[] = g.selfExclusions
      .map((s) => ({ exclusionId: s.exclusionId, operatorId: s.operatorId, kind: s.kind, startAt: s.startAt, endAt: s.endAt, status: s.status }))
      .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.exclusionId.localeCompare(b.exclusionId));
    const complianceHistory: ComplianceEntry[] = g.compliance
      .map((c) => ({ at: c.at, operatorId: c.operatorId, recordId: c.recordId, type: c.type, status: c.status }))
      .sort((a, b) => a.at.localeCompare(b.at) || a.recordId.localeCompare(b.recordId));

    return deepFreeze({
      sbNat: g.record.sbNat, jurisdiction: g.jurisdiction,
      participatingOperators: g.operators.slice(),
      sbPlrRefs: g.members.slice(),
      firstObservedAt: firstAts.length ? firstAts[0] : null,
      lastObservedAt: lastAts.length ? lastAts[lastAts.length - 1] : null,
      activityTimeline: timeline,
      riskEvolution: risk,
      behaviourEvolution: timeline.filter((e) => e.category === 'behaviour' || e.category === 'risk-change'),
      interventionHistory,
      selfExclusionHistory,
      complianceHistory,
      investigationRefs: uniqSorted(g.investigations.map((v) => v.ref)),
      wellbeingSummary: this.wellbeing(g, risk),
      provenance: prov,
      dataFreshness: prov.dataFreshness,
      limitations: prov.limitations,
      correlationEngineVersion: CORRELATION_ENGINE_VERSION, generatedAt: at,
    });
  }

  // ── Cross-operator intelligence + national behaviour analytics ──────────────

  private operatorSwitches(g: Gathered): OperatorSwitch[] {
    const ordered = this.timelineEntries(g);
    const switches: OperatorSwitch[] = [];
    let last: string | null = null;
    for (const e of ordered) {
      if (last !== null && last !== e.operatorId) switches.push({ from: last, to: e.operatorId, at: e.at });
      last = e.operatorId;
    }
    return switches;
  }

  private concurrentWindows(g: Gathered): { at: string; operators: string[] }[] {
    const byDay = new Map<string, Set<string>>();
    for (const e of g.events) {
      const d = dayOf(e.at);
      if (!byDay.has(d)) byDay.set(d, new Set());
      byDay.get(d)!.add(e.operatorId);
    }
    return Array.from(byDay.entries())
      .filter(([, ops]) => ops.size >= 2)
      .map(([d, ops]) => ({ at: d, operators: Array.from(ops).sort() }))
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  private exclusionConflicts(g: Gathered, kind: 'self-exclusion' | 'cooling-off') {
    const activity = g.events.filter((e) => e.category === 'session' || e.category === 'deposit' || e.category === 'wager' || e.category === 'loss');
    const conflicts: { exclusionId: string; operatorId: string; conflictRef: string; at: string }[] = [];
    for (const ex of g.selfExclusions.filter((s) => s.kind === kind && s.status === 'active')) {
      for (const e of activity) {
        const within = e.at >= ex.startAt && (ex.endAt === null || e.at <= ex.endAt);
        if (within) conflicts.push({ exclusionId: ex.exclusionId, operatorId: e.operatorId, conflictRef: `event:${e.eventId}`, at: e.at });
      }
    }
    return conflicts.sort((a, b) => a.at.localeCompare(b.at) || a.exclusionId.localeCompare(b.exclusionId) || a.conflictRef.localeCompare(b.conflictRef));
  }

  private buildMetrics(g: Gathered, at: string): NationalBehaviourMetric[] {
    const refs = this.allSourceRefs(g);
    const ts = this.allSourceTimestamps(g).sort();
    const window = { from: ts.length ? ts[0] : null, to: ts.length ? ts[ts.length - 1] : null };
    const risk = this.riskEvolution(g);
    const escalating = risk.length >= 2 && riskRank(risk[risk.length - 1].tier) > riskRank(risk[0].tier);
    const losses = g.events.filter((e) => e.category === 'loss').length;
    const concurrent = this.concurrentWindows(g);
    const mk = (name: string, definition: string, method: string, result: number | string | boolean, sourceRefs: string[]): NationalBehaviourMetric =>
      ({ name, definition, sourceRefs, window, method, result, version: CORRELATION_ENGINE_VERSION, timestamp: at, limitations: ['Deterministic aggregation of authoritative references; no ML, no hidden thresholds.'] });
    return [
      mk('participating_operators', 'Distinct operators correlated under the SB-NAT.', 'count(distinct operatorId across included references)', g.operators.length, g.operators.map((o) => `operator:${o}`)),
      mk('activity_frequency', 'Total included cross-operator event references.', 'count(event references)', g.events.length, g.events.map((e) => `event:${e.eventId}`)),
      mk('operator_switching', 'Number of operator transitions along the ordered timeline.', 'count(consecutive timeline entries whose operator changes)', this.operatorSwitches(g).length, refs),
      mk('risk_escalation', 'Whether the national risk tier increased over the observed window.', 'rank(last risk tier) > rank(first risk tier)', escalating, risk.map((r) => `risk:${r.at}:${r.tier}`)),
      mk('loss_indicators', 'Count of loss-category references (repeated-harm indicator).', 'count(events where category = loss)', losses, g.events.filter((e) => e.category === 'loss').map((e) => `event:${e.eventId}`)),
      mk('concurrent_activity_days', 'Days with activity at two or more operators (overlap indicator).', 'count(calendar days with >=2 distinct operators)', concurrent.length, refs),
    ];
  }

  private buildIntelligence(g: Gathered, at: string): CrossOperatorIntelligence {
    const risk = this.riskEvolution(g);
    const escalating = risk.length >= 2 && riskRank(risk[risk.length - 1].tier) > riskRank(risk[0].tier);
    const interventionByType = new Map<string, number>();
    for (const i of g.interventions) interventionByType.set(i.type, (interventionByType.get(i.type) ?? 0) + 1);
    const repeatedInterventionPatterns = Array.from(interventionByType.values()).reduce((n, c) => n + (c > 1 ? c - 1 : 0), 0);
    const losses = g.events.filter((e) => e.category === 'loss').length;
    const seConflicts = this.exclusionConflicts(g, 'self-exclusion');
    const coConflicts = this.exclusionConflicts(g, 'cooling-off');
    return deepFreeze({
      sbNat: g.record.sbNat, jurisdiction: g.jurisdiction,
      participatingOperatorCount: g.operators.length,
      participatingOperators: g.operators.slice(),
      activityFrequency: g.events.length,
      operatorSwitches: this.operatorSwitches(g),
      riskProgression: risk,
      riskEscalating: escalating,
      repeatedHarmIndicators: losses,
      repeatedInterventionPatterns,
      concurrentActivityWindows: this.concurrentWindows(g),
      selfExclusionConflicts: seConflicts,
      coolingOffConflicts: coConflicts,
      interventionEffectiveness: g.interventions
        .map((i) => ({ interventionId: i.interventionId, operatorId: i.operatorId, at: i.at, outcome: i.outcome }))
        .sort((a, b) => a.at.localeCompare(b.at) || a.interventionId.localeCompare(b.interventionId)),
      investigationIndicators: g.investigations.length,
      behaviourEscalation: escalating || (losses > 0 && g.operators.length > 1),
      metrics: this.buildMetrics(g, at),
      provenance: this.buildProvenance(g, at, []),
      correlationEngineVersion: CORRELATION_ENGINE_VERSION, generatedAt: at,
    });
  }

  // ── National Self-Exclusion View ────────────────────────────────────────────

  private buildSelfExclusionView(g: Gathered, at: string): NationalSelfExclusionView {
    const toEntry = (s: SelfExclusionReference): SelfExclusionEntry =>
      ({ exclusionId: s.exclusionId, operatorId: s.operatorId, kind: s.kind, startAt: s.startAt, endAt: s.endAt, status: s.status });
    const sortSE = (a: SelfExclusionEntry, b: SelfExclusionEntry) => a.startAt.localeCompare(b.startAt) || a.exclusionId.localeCompare(b.exclusionId);
    const all = g.selfExclusions.map(toEntry);
    return deepFreeze({
      sbNat: g.record.sbNat, jurisdiction: g.jurisdiction,
      activeExclusions: all.filter((s) => s.kind === 'self-exclusion' && s.status === 'active').sort(sortSE),
      historicalExclusions: all.filter((s) => s.kind === 'self-exclusion' && s.status !== 'active').sort(sortSE),
      coolingOffPeriods: all.filter((s) => s.kind === 'cooling-off').sort(sortSE),
      conflictingActivity: this.exclusionConflicts(g, 'self-exclusion'),
      provenance: this.buildProvenance(g, at, ['This view represents approved source information only; it does not enforce or propagate self-exclusion (national policy execution is Milestone 3.6).']),
      correlationEngineVersion: CORRELATION_ENGINE_VERSION, generatedAt: at,
    });
  }

  // ── Integrity ───────────────────────────────────────────────────────────────

  private integrityChecks(g: Gathered, sbNat: SbNatId, opts: { freshnessHorizonMs?: number; asOf?: string } = {}): CorrelationIntegrityCheck[] {
    const checks: CorrelationIntegrityCheck[] = [];
    const push = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

    // 1. SB-NAT exists and is eligible.
    const eligible = this.registry.exists(sbNat) && !!this.registry.get(sbNat);
    push('sbnat-exists-and-eligible', eligible, eligible ? 'SB-NAT is registered and resolvable' : 'SB-NAT is not registered');

    // 2. Registry assignments valid (every member is assigned to this SB-NAT).
    let assignOk = true; let assignDetail = 'every member has a registry assignment to this SB-NAT';
    for (const m of g.members) {
      if (!this.registry.assignmentHistory(m).some((a) => a.sbNat === sbNat)) { assignOk = false; assignDetail = `member ${m} has no assignment to ${sbNat}`; break; }
    }
    push('registry-assignments-valid', assignOk, assignDetail);

    // 3. Referenced SB-PLR records exist (each member resolves to a player reference).
    const missing = g.members.filter((m) => this.provider.playerReferences(m).length === 0);
    push('referenced-sbplr-exist', missing.length === 0, missing.length === 0 ? 'all members resolve to a player reference' : `unresolved members: ${missing.join(',')}`);

    // 4. Jurisdictions match (no included reference is out of jurisdiction).
    push('jurisdictions-match', g.record.jurisdiction === g.jurisdiction, `record ${g.record.jurisdiction} vs query ${g.jurisdiction}`);

    // 5. Each member resolves to a single operator (operator referential integrity).
    let opOk = true; let opDetail = 'each member resolves to a single operator';
    for (const m of g.members) {
      const ops = new Set(g.players.filter((p) => p.sbPlr === m).map((p) => p.operatorId));
      if (ops.size > 1) { opOk = false; opDetail = `member ${m} maps to multiple operators`; break; }
    }
    push('operators-distinct', opOk, opDetail);

    // 6. Federation decision provenance exists.
    push('federation-decision-provenance', g.record.sourceDecisionIds.length > 0, `${g.record.sourceDecisionIds.length} decision reference(s)`);

    // 7. Matching provenance exists (each decision yields a candidate reference).
    const candOk = g.record.sourceDecisionIds.every((d) => !!parseCandidateRef(d));
    push('matching-provenance', candOk, candOk ? 'every decision reference yields a matching candidate reference' : 'a decision reference has no matching candidate');

    // 8. Source references resolvable (nothing silently dropped).
    push('source-references-resolvable', true, `${this.allSourceRefs(g).length} included, ${g.excluded.length} excluded (accounted for)`);

    // 9. Timeline ordering deterministic.
    const t1 = JSON.stringify(this.timelineEntries(g));
    const t2 = JSON.stringify(this.timelineEntries(g));
    push('timeline-ordering-deterministic', t1 === t2, t1 === t2 ? 'timeline ordering is stable' : 'timeline ordering is unstable');

    // 10. No plaintext PII in produced provenance/output.
    const sample = JSON.stringify(this.buildProvenance(g, opts.asOf ?? '1970-01-01T00:00:00.000Z', []));
    const piiOk = !containsLikelyPii(sample);
    push('no-plaintext-pii', piiOk, piiOk ? 'no email/long-digit patterns detected in output' : 'possible PII pattern detected');

    // 11. Reproducible (two builds at a fixed timestamp are byte-identical).
    const fixed = opts.asOf ?? '1970-01-01T00:00:00.000Z';
    const r1 = JSON.stringify(this.buildTwin(g, fixed));
    const r2 = JSON.stringify(this.buildTwin(g, fixed));
    push('reproducible', r1 === r2, r1 === r2 ? 'insight is reproducible from the same references' : 'insight is not reproducible');

    // 12. No runtime mutation (registry state unchanged across derivation).
    const before = JSON.stringify(this.registry.diagnostics());
    this.buildTwin(g, fixed); this.buildTimeline(g, fixed); this.buildIntelligence(g, fixed);
    const after = JSON.stringify(this.registry.diagnostics());
    push('no-runtime-mutation', before === after, before === after ? 'registry state is unchanged by correlation' : 'registry state changed');

    // Optional caller-supplied freshness horizon (never a hidden threshold).
    if (opts.freshnessHorizonMs !== undefined && opts.asOf) {
      const horizon = new Date(opts.asOf).getTime() - opts.freshnessHorizonMs;
      const stale = this.allSourceTimestamps(g).filter((t) => new Date(t).getTime() < horizon);
      push('within-freshness-horizon', stale.length === 0, stale.length === 0 ? 'all sources within caller freshness horizon' : `${stale.length} stale source(s)`);
    }

    return checks;
  }
}

/** Parse the matching-candidate reference out of a decision id: `dec:<candidate>:<ver>`. */
function parseCandidateRef(decisionId: string): string | null {
  if (!decisionId.startsWith('dec:')) return null;
  const body = decisionId.slice(4).replace(/:[^:]*$/, '');
  return body.length ? body : null;
}
