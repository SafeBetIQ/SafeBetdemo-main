// ─── Consumer Platform — Explainable Intelligence (v1.4) ─────────────────────
//
// EXPLANATION, not intelligence. Every explanation here is COMPOSED from the
// output the certified Domain Intelligence Platform already produced (the
// seven-stage enrichment on the SAME twin objects) plus recorded facts and
// Policy Platform decisions. It recalculates NOTHING — it reads intelligence
// fields and phrases them in operational language, classifying every value
// as Recorded Fact, Derived Intelligence, or Policy Decision (Constitution
// §8). The Domain Intelligence Platform remains the ONLY intelligence engine;
// the Consumer Platform remains the ONLY presentation layer.

import type { PolicyDecision } from '../policyPlatform/index.ts';

export type EvidenceClass = 'recorded-fact' | 'derived-intelligence' | 'policy-decision';

export interface Indicator {
  indicator: string;
  value: unknown;
  plainLanguage: string;
  evidenceClass: EvidenceClass;
}

export interface TimelineStep {
  stage: 'recorded-fact' | 'derived-intelligence' | 'policy-decision' | 'recommended-intervention' | 'recorded-outcome';
  label: string;
  detail: string;
  at?: string;
}

export interface RecommendationExplanation {
  action: string | null;
  reason: string;
  confidence: number;
  expectedBenefit: string;
  historicalEffectiveness: string;
  supportingEvidence: string[];
  note: string;                       // "the platform recommends; the operator decides"
  evidenceClass: 'policy-decision';
}

export interface ExplanationView {
  playerId: string;
  casinoId: string;
  summary: { headline: string; riskLevel: string; dynamicRiskScore: number; confidence: number; trend: string };
  contributingIndicators: { behavioural: Indicator[]; session: Indicator[]; machine: Indicator[] };
  triggerSequence: string[];
  supportingEvidence: Indicator[];
  decisionTimeline: TimelineStep[];
  recommendation: RecommendationExplanation | null;
  // UAT-OP-1 (P0-2): honest evidence availability. When the certified intelligence
  // carries no risk drivers or recorded facts for THIS player, the explanation says
  // so explicitly instead of emitting generic phrasing that reads identically across
  // players. 'present' means the explanation is derived from this player's own signals.
  driverAvailability: 'present' | 'insufficient';
  driverNote: string | null;
  source: 'domain-intelligence';      // provenance: the ONE intelligence engine
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export interface ExplanationInput {
  playerId: string;
  casinoId: string;
  /** The player's projected facts (recorded). */
  player: {
    riskScore: number; riskFlags: string[]; totalWagered: number; totalWon: number;
    betCount: number; interventionCount: number; lastInterventionAt: string | null; requiresMonitoring: boolean;
  } | null;
  /** The Domain Intelligence enrichment already produced (read, never recomputed). */
  intelligence: Record<string, unknown> | null;
  /** Policy Platform decisions for this subject. */
  decisions: PolicyDecision[];
  /** The player's immutable event timeline (recorded facts, oldest first). */
  events: Record<string, unknown>[];
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0)) || 0;
const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {});

const RISK_PLAIN: Record<string, string> = {
  critical: 'requires immediate attention',
  elevated: 'warrants proactive contact',
  watch: 'should be observed',
  none: 'shows no elevated risk',
};

/** Compose a plain-language, evidence-classified explanation of existing intelligence. */
export function explainPlayer(input: ExplanationInput): ExplanationView {
  const intel = obj(input.intelligence);
  const behaviour = obj(intel.behaviour);
  const session = obj(intel.session);
  const risk = obj(intel.risk);
  const ai = obj(intel.ai);
  const intervention = obj(intel.intervention);

  const escalation = String(risk.escalationLevel ?? 'none');
  const dynamicRiskScore = num(risk.dynamicRiskScore);
  const confidence = num(risk.riskConfidence);
  const trend = String(risk.riskTrend ?? 'stable');

  // ── Summary (Derived Intelligence, phrased) ───────────────────────────────
  const summary = {
    headline: `This player ${RISK_PLAIN[escalation] ?? 'has been assessed'} (risk ${escalation}).`,
    riskLevel: escalation,
    dynamicRiskScore,
    confidence,
    trend,
  };

  // ── Contributing indicators (read from each intelligence stage) ────────────
  const behavioural: Indicator[] = [];
  if (behaviour.chasingLossIndicator === true) behavioural.push({ indicator: 'loss-chasing', value: true, plainLanguage: 'Loss-chasing behaviour is present.', evidenceClass: 'derived-intelligence' });
  if (Array.isArray(behaviour.patterns)) for (const p of behaviour.patterns as string[]) behavioural.push({ indicator: p, value: true, plainLanguage: patternPlain(p), evidenceClass: 'derived-intelligence' });
  if (behaviour.playStyle) behavioural.push({ indicator: 'play-style', value: behaviour.playStyle, plainLanguage: `Play style is "${behaviour.playStyle}".`, evidenceClass: 'derived-intelligence' });
  if (behaviour.betFrequency != null) behavioural.push({ indicator: 'bet-frequency', value: behaviour.betFrequency, plainLanguage: `Betting ${num(behaviour.betFrequency)} times per minute.`, evidenceClass: 'derived-intelligence' });

  const sessionInd: Indicator[] = [];
  if (session.durationMinutes != null) sessionInd.push({ indicator: 'session-duration', value: session.durationMinutes, plainLanguage: `Current session has run ${num(session.durationMinutes)} minutes.`, evidenceClass: 'derived-intelligence' });
  if (session.hasActiveSession != null) sessionInd.push({ indicator: 'active-session', value: session.hasActiveSession, plainLanguage: session.hasActiveSession ? 'Player is in an active session.' : 'Player is not currently in a session.', evidenceClass: 'derived-intelligence' });

  const machineInd: Indicator[] = [];
  if (session.currentLocation) machineInd.push({ indicator: 'location', value: session.currentLocation, plainLanguage: `Currently on ${session.currentLocation}.`, evidenceClass: 'derived-intelligence' });

  // ── Trigger sequence (Derived) ────────────────────────────────────────────
  const triggerSequence: string[] = [];
  if (Array.isArray(behaviour.patterns)) triggerSequence.push(...(behaviour.patterns as string[]).map(patternPlain));
  if (Array.isArray(ai.emergingBehaviour)) triggerSequence.push(...(ai.emergingBehaviour as string[]).map(e => `Emerging: ${e.replace(/_/g, ' ')}`));
  if (escalation === 'critical' || escalation === 'elevated') triggerSequence.push(`Risk escalated to ${escalation}.`);

  // ── Supporting evidence (Recorded Facts from projections/events) ───────────
  const supportingEvidence: Indicator[] = [];
  const p = input.player;
  if (p) {
    supportingEvidence.push({ indicator: 'total-wagered', value: p.totalWagered, plainLanguage: `Recorded total wagered: ${p.totalWagered}.`, evidenceClass: 'recorded-fact' });
    supportingEvidence.push({ indicator: 'bet-count', value: p.betCount, plainLanguage: `Recorded bets: ${p.betCount}.`, evidenceClass: 'recorded-fact' });
    if (p.riskFlags.length) supportingEvidence.push({ indicator: 'risk-flags', value: p.riskFlags, plainLanguage: `Risk flags recorded on events: ${p.riskFlags.join(', ')}.`, evidenceClass: 'recorded-fact' });
    if (p.interventionCount > 0) supportingEvidence.push({ indicator: 'interventions', value: p.interventionCount, plainLanguage: `${p.interventionCount} intervention(s) recorded on the journey.`, evidenceClass: 'recorded-fact' });
  }

  // ── Decision timeline (WS2): Recorded → Derived → Policy → Recommended → Outcome
  const decisionTimeline = buildTimeline(input, escalation, intervention);

  // ── Recommendation (WS3): from the intervention stage + a policy decision ──
  const recommendation = buildRecommendation(input, intervention, ai, escalation, confidence);

  // ── Evidence availability (UAT-OP-1 P0-2) ─────────────────────────────────
  // If the certified intelligence produced no drivers AND there are no recorded
  // facts for this player, we must not present a confident-sounding generic
  // explanation. Say the evidence is insufficient — explicitly and per player.
  const driverCount = behavioural.length + sessionInd.length + machineInd.length;
  const hasIntelligence = input.intelligence != null && Object.keys(intel).length > 0;
  const driverAvailability: 'present' | 'insufficient' =
    (driverCount > 0 || supportingEvidence.length > 0 || escalation !== 'none') ? 'present' : 'insufficient';
  const driverNote = driverAvailability === 'insufficient'
    ? (hasIntelligence
        ? 'No risk drivers or recorded activity are on record for this player in the certified intelligence. No risk is indicated and no explanation can be derived beyond that.'
        : 'This player has no certified intelligence on record (they may not have been observed on this floor). Nothing can be explained.')
    : null;
  if (driverAvailability === 'insufficient') {
    // Replace the generic "shows no elevated risk" headline with an explicit one.
    summary.headline = hasIntelligence
      ? 'No risk drivers on record for this player — no elevated risk indicated.'
      : 'No certified intelligence on record for this player.';
  }

  return {
    playerId: input.playerId,
    casinoId: input.casinoId,
    summary,
    contributingIndicators: { behavioural, session: sessionInd, machine: machineInd },
    triggerSequence,
    supportingEvidence,
    decisionTimeline,
    recommendation,
    driverAvailability,
    driverNote,
    source: 'domain-intelligence',
    evidence: {
      summary: 'derived-intelligence', contributingIndicators: 'derived-intelligence',
      supportingEvidence: 'recorded-fact', decisionTimeline: 'recorded-fact',
      recommendation: 'policy-decision',
    },
    generatedAt: new Date().toISOString(),
  };
}

function patternPlain(p: string): string {
  const map: Record<string, string> = {
    loss_chasing_flagged: 'Loss-chasing flagged on recorded events.',
    loss_chasing_inferred: 'Loss-chasing inferred from betting behaviour.',
    rapid_betting: 'Rapid betting detected.',
    extended_session: 'Session length is extended.',
  };
  return map[p] ?? p.replace(/_/g, ' ');
}

function buildTimeline(input: ExplanationInput, escalation: string, intervention: Record<string, unknown>): TimelineStep[] {
  const steps: TimelineStep[] = [];
  // Recorded facts: notable events (bets, interventions).
  const firstBet = input.events.find(e => e.event_type === 'BET_PLACED');
  if (firstBet) steps.push({ stage: 'recorded-fact', label: 'Activity recorded', detail: 'Betting activity recorded on the immutable event log.', at: String(firstBet.occurred_at ?? '') });
  // Derived intelligence.
  if (escalation !== 'none') steps.push({ stage: 'derived-intelligence', label: `Risk assessed: ${escalation}`, detail: 'The Domain Intelligence Platform derived the risk level from behaviour and recorded facts.' });
  // Policy decision.
  const rgDecision = input.decisions.find(d => d.subject.kind === 'player' && d.subject.id === input.playerId && d.executionRequired);
  if (rgDecision) steps.push({ stage: 'policy-decision', label: `Policy: ${rgDecision.action}`, detail: `${rgDecision.reason} (${rgDecision.policyReference})` });
  // Recommended intervention.
  if (intervention.recommendedIntervention) steps.push({ stage: 'recommended-intervention', label: `Recommended: ${intervention.recommendedIntervention}`, detail: 'Recommended by intelligence + policy — not executed automatically.' });
  // Recorded outcome.
  const interventionEvent = input.events.find(e => e.event_type === 'INTERVENTION_TRIGGERED');
  if (interventionEvent) steps.push({ stage: 'recorded-outcome', label: 'Intervention recorded', detail: `Effectiveness: ${intervention.interventionEffectiveness ?? 'inconclusive'}.`, at: String(interventionEvent.occurred_at ?? '') });
  return steps;
}

function buildRecommendation(
  input: ExplanationInput, intervention: Record<string, unknown>, ai: Record<string, unknown>,
  escalation: string, confidence: number,
): RecommendationExplanation | null {
  const action = (intervention.recommendedIntervention as string | null) ?? null;
  if (!action && escalation === 'none') return null;
  const recs = Array.isArray(ai.recommendations) ? ai.recommendations as string[] : [];
  const supporting: string[] = [];
  if (escalation !== 'none') supporting.push(`Risk escalation is ${escalation}.`);
  for (const r of recs) supporting.push(r.replace(/_/g, ' '));
  const effectiveness = String(intervention.interventionEffectiveness ?? 'not_applicable');
  return {
    action,
    reason: action
      ? `Recommended because risk is ${escalation}${recs.length ? ` and intelligence advises ${recs.join(', ').replace(/_/g, ' ')}` : ''}.`
      : `Continued observation recommended (risk ${escalation}).`,
    confidence,
    expectedBenefit: escalation === 'critical' ? 'Reduce imminent harm to the player.' : escalation === 'elevated' ? 'Prevent escalation to critical risk.' : 'Maintain player wellbeing.',
    historicalEffectiveness: effectiveness === 'not_applicable' ? 'No prior intervention on record.' : `Prior intervention outcome: ${effectiveness}.`,
    supportingEvidence: supporting,
    note: 'The platform recommends; the operator decides. Interventions are never executed automatically.',
    evidenceClass: 'policy-decision',
  };
}

// ── WS4 AI Performance (evaluation, not training) — composes existing data ────

export interface AiPerformanceView {
  casinoId: string;
  riskDistribution: { critical: number; high: number; medium: number; low: number };
  interventions: { recorded: number; playersMonitored: number };
  confidenceCalibration: { averageConfidence: number; sampleSize: number };
  predictionTrend: string;
  note: string;
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export interface AiPerformanceInput {
  casinoId: string;
  aggregates: { riskCritical: number; riskHigh: number; riskMedium: number; riskLow: number };
  players: { intelligence: Record<string, unknown> | null; interventionCount: number; requiresMonitoring: boolean }[];
}

export function shapeAiPerformance(input: AiPerformanceInput): AiPerformanceView {
  const confidences: number[] = [];
  let recorded = 0, monitored = 0, rising = 0;
  for (const pl of input.players) {
    const risk = obj(obj(pl.intelligence).risk);
    if (risk.riskConfidence != null) confidences.push(num(risk.riskConfidence));
    if (risk.riskTrend === 'rising') rising += 1;
    recorded += pl.interventionCount;
    if (pl.requiresMonitoring) monitored += 1;
  }
  const avg = confidences.length ? Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 100) / 100 : 0;
  return {
    casinoId: input.casinoId,
    riskDistribution: { critical: input.aggregates.riskCritical, high: input.aggregates.riskHigh, medium: input.aggregates.riskMedium, low: input.aggregates.riskLow },
    interventions: { recorded, playersMonitored: monitored },
    confidenceCalibration: { averageConfidence: avg, sampleSize: confidences.length },
    predictionTrend: rising > 0 ? `${rising} player(s) with rising risk` : 'stable',
    note: 'Evaluation dashboard — composes the Domain Intelligence Platform\'s existing outputs. No model training; no recalculation.',
    evidence: { riskDistribution: 'recorded-fact', interventions: 'recorded-fact', confidenceCalibration: 'derived-intelligence' },
    generatedAt: new Date().toISOString(),
  };
}

// ── WS5 Executive Intelligence — composes certified aggregates ────────────────

export interface ExecutiveIntelligenceView {
  casinoId: string;
  strategicRisks: string[];
  wellbeingIndicators: { playersMonitored: number; interventions: number; criticalRisk: number };
  operationalPerformance: { activePlayers: number; ggr: number; occupancy: number | null };
  emergingTrends: string[];
  note: string;
  evidence: Record<string, EvidenceClass>;
  generatedAt: string;
}

export interface ExecutiveInput {
  casinoId: string;
  aggregates: { activePlayers: number; ggr: number; riskCritical: number; riskHigh: number };
  playersMonitored: number;
  interventions: number;
  busiestOccupancy: number | null;
  emerging: string[];
}

export function shapeExecutiveIntelligence(input: ExecutiveInput): ExecutiveIntelligenceView {
  const strategicRisks: string[] = [];
  if (input.aggregates.riskCritical > 0) strategicRisks.push(`${input.aggregates.riskCritical} player(s) at critical risk — regulatory and wellbeing exposure.`);
  if (input.playersMonitored > 0) strategicRisks.push(`${input.playersMonitored} player(s) under active monitoring.`);
  if (input.aggregates.riskHigh > 0) strategicRisks.push(`${input.aggregates.riskHigh} player(s) at high risk — watch for escalation.`);
  return {
    casinoId: input.casinoId,
    strategicRisks,
    wellbeingIndicators: { playersMonitored: input.playersMonitored, interventions: input.interventions, criticalRisk: input.aggregates.riskCritical },
    operationalPerformance: { activePlayers: input.aggregates.activePlayers, ggr: input.aggregates.ggr, occupancy: input.busiestOccupancy },
    emergingTrends: input.emerging,
    note: 'Executive intelligence composed from certified platform aggregates. No recalculation.',
    evidence: { wellbeingIndicators: 'recorded-fact', operationalPerformance: 'recorded-fact', strategicRisks: 'derived-intelligence' },
    generatedAt: new Date().toISOString(),
  };
}
