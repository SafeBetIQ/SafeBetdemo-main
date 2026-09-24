// ─── SafeBet IQ — Responsible Profitability B2: Intervention Outcome Intelligence ─
//
// B2 measures intervention coverage, status, follow-up, reporting and OBSERVED outcomes
// from real Demo intervention records (player_protection_interventions), aggregated to
// CASINO grain. It is honest by construction:
//   • It NEVER claims causal effectiveness (no control group / causal model exists).
//   • pending ≠ completed; an "accepted"/"successful" flag is a RECORDED self-report, not
//     independently-established behavioural improvement.
//   • It NEVER invents timestamps (delivered_at / acknowledged_at are absent → those states
//     resolve to OUTCOME_UNAVAILABLE) and never infers follow-up completion from a due date.
//   • Player-attributed COVERAGE is NOT_AVAILABLE: the intervention identity space
//     (players.id) does not have a verified bridge to the anonymised projection cohort
//     (safebet_player_id), and no historical risk-state timing exists to define an eligible
//     denominator — so a sound coverage ratio cannot be established.
//   • Records are persisted DEMO data, NOT verified real-world player interventions.
//   • Small cohorts are k-anon suppressed; no player identifiers are ever surfaced.

import { RP_UNIVERSAL_SAFEGUARDS, RP_MIN_COHORT } from './definitions.ts';

export const B2_METRICS_VERSION = '1.0.0';

/** Provenance for B2: these are persisted Demo intervention records, not verified real-world outcomes. */
export type B2Provenance = 'DEMO_INTERVENTION_RECORD' | 'DERIVED' | 'NONE';
export type B2Availability = 'MEASURABLE' | 'PARTIAL' | 'NOT_AVAILABLE' | 'SUPPRESSED';
export type B2Framing = 'COVERAGE_GAP' | 'PROTECTION' | 'DATA_QUALITY' | 'OUTCOME_OBSERVED';

export interface B2MetricDefinition {
  id: string;
  name: string;
  meaning: string;
  numerator?: string;
  denominator?: string;
  eligiblePopulation: string;
  observationWindow: string;
  exclusions: string;
  sourceRecords: string[];
  freshness: string;
  missingDataBehaviour: string;
  provenance: B2Provenance;
  safeguards: string[];
  prohibitedInterpretations: string[];
  availability: B2Availability;          // catalogue-level default; re-evaluated at runtime
  notAvailableReason?: string;
}

// The canonical B2 source is player_protection_interventions (586 Demo records, 96 players,
// all 6 casinos). intervention_history (50 records, distinct behavioural subsystem, different
// type vocabulary, 40 overlapping players) is a SEPARATE source and is deliberately NOT summed
// in — B2 does not treat 586+50 as 636 unique interventions.
export const B2_SOURCE = 'player_protection_interventions';

export const B2_METRIC_DEFINITIONS: B2MetricDefinition[] = [
  {
    id: 'interventions_recorded',
    name: 'Interventions recorded',
    meaning: 'Distinct responsible-gambling interventions recorded for the casino (all recorded history).',
    numerator: 'count(distinct intervention id)',
    eligiblePopulation: 'all interventions recorded for the casino',
    observationWindow: 'ALL_RECORDED (not aligned to a certified financial period)',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'last_intervention_at surfaced.',
    missingDataBehaviour: 'NOT_AVAILABLE when the source projection is absent; never 0-filled.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Occurrence is not completion and not effectiveness.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'distinct_intervention_players',
    name: 'Distinct players with an intervention',
    meaning: 'Distinct players (counted, never identified) with ≥1 recorded intervention at the casino.',
    numerator: 'count(distinct player)',
    eligiblePopulation: 'players in the intervention source identity space (legacy players.id), casino-scoped',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when absent; SUPPRESSED below the k-anonymity floor.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['A count only — no player identifiers are surfaced; not a targeting list.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'intervention_status_distribution',
    name: 'Intervention dispatch-status distribution',
    meaning: 'Recorded dispatch_status of interventions (sent / delivered). A recorded status field only.',
    eligiblePopulation: 'all recorded interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when absent.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: [
      'dispatch_status is a recorded label, NOT delivery TIMING — delivered_at timestamps are absent so delivery timeliness is not measurable.',
    ],
    availability: 'MEASURABLE',
  },
  {
    id: 'intervention_outcome_distribution',
    name: 'Recorded outcome distribution',
    meaning: 'Distribution of the recorded outcome field (accepted / declined / pending / successful / unsuccessful).',
    eligiblePopulation: 'all recorded interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when absent.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: [
      'pending ≠ completed; accepted/successful are RECORDED self-reports, NOT independently-established causal effectiveness.',
    ],
    availability: 'MEASURABLE',
  },
  {
    id: 'follow_up_required_rate',
    name: 'Follow-up required rate',
    meaning: 'Share of recorded interventions flagged as requiring follow-up.',
    numerator: 'interventions with follow_up_required = true', denominator: 'interventions recorded',
    eligiblePopulation: 'all recorded interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when absent; ratio null when denominator 0.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Follow-up REQUIRED is not follow-up COMPLETED — completion is not recorded (see follow_up_completion).'],
    availability: 'MEASURABLE',
  },
  {
    id: 'reporting_completeness',
    name: 'Regulator-reporting completeness',
    meaning: 'Share of recorded interventions marked as reported to the national responsible-gambling programme (NRGP).',
    numerator: 'interventions with nrgp_reported = true', denominator: 'interventions recorded',
    eligiblePopulation: 'all recorded interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'NOT_AVAILABLE when absent; ratio null when denominator 0.',
    provenance: 'DEMO_INTERVENTION_RECORD',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['A recorded reporting flag; not proof of regulator acceptance.'],
    availability: 'MEASURABLE',
  },
  {
    id: 'intervention_evidence_completeness',
    name: 'Intervention evidence completeness',
    meaning: 'How complete the recorded evidence is per lifecycle field (outcome / delivered_at / acknowledged_at / risk_score_after). Honestly surfaces gaps.',
    eligiblePopulation: 'all recorded interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'point-in-time.',
    missingDataBehaviour: 'each field reported as a populated-share; absent fields honestly shown as 0%.',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Low completeness is a data gap, never grounds to fabricate the missing values.'],
    availability: 'MEASURABLE',
  },

  // ── DEFINED BUT NOT MEASURABLE FROM CURRENT SOURCE (honest NOT_AVAILABLE) ──
  {
    id: 'qualifying_intervention_coverage',
    name: 'Qualifying intervention coverage',
    meaning: 'Distinct eligible (elevated-risk) players with a qualifying intervention ÷ distinct eligible players in the same governed cohort and window.',
    numerator: 'distinct eligible players with a qualifying intervention', denominator: 'distinct eligible players in cohort/window',
    eligiblePopulation: 'elevated-risk players in the reporting window (requires historical risk-state timing)',
    observationWindow: 'period-aligned to a governed risk cohort',
    exclusions: 'restricted / self-excluded handled per policy',
    sourceRecords: [B2_SOURCE, 'projection_risk_state (historical)', 'safebet_identity_map'],
    freshness: 'period-aligned.',
    missingDataBehaviour: 'NOT_AVAILABLE — never a naive 586/current-elevated-count ratio.',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Never compute as records ÷ current elevated-risk count; never join historical interventions to current risk and call it coverage.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'The eligible denominator cannot be established: intervention records key on the legacy players.id identity space, which has no verified bridge to the anonymised projection cohort (safebet_player_id), and no historical risk-state timing exists to define who was elevated-risk during the window. A sound distinct-player coverage ratio cannot be computed.',
  },
  {
    id: 'delivery_timeliness',
    name: 'Intervention delivery timeliness',
    meaning: 'Time from trigger to delivery / acknowledgement.',
    eligiblePopulation: 'delivered interventions',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'n/a',
    missingDataBehaviour: 'NOT_AVAILABLE — delivered_at / acknowledged_at timestamps are absent; never inferred from triggered_at.',
    provenance: 'NONE',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['delivered_at must never be inferred from triggered_at.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'delivered_at and acknowledged_at are unpopulated in the source; delivery/acknowledgement timing cannot be measured and must not be inferred from the trigger time.',
  },
  {
    id: 'follow_up_completion',
    name: 'Follow-up completion',
    meaning: 'Share of required follow-ups that were completed.',
    numerator: 'follow-ups completed', denominator: 'follow-ups required',
    eligiblePopulation: 'interventions with follow_up_required = true',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'n/a',
    missingDataBehaviour: 'NOT_AVAILABLE — no follow-up-completed field exists; never inferred from follow_up_date.',
    provenance: 'NONE',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['A past follow_up_date must never be read as completion.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'The source records follow_up_required and follow_up_date but no completion field; follow-up completion is not measurable and must not be inferred from the due date.',
  },
  {
    id: 'observed_risk_trajectory',
    name: 'Observed post-intervention risk trajectory',
    meaning: 'Observed change in risk posture after an intervention (risk_score_after vs prior).',
    eligiblePopulation: 'interventions with a recorded post-intervention risk score',
    observationWindow: 'ALL_RECORDED',
    exclusions: 'none',
    sourceRecords: [B2_SOURCE],
    freshness: 'n/a',
    missingDataBehaviour: 'NOT_AVAILABLE — risk_score_after is populated on too few records to generalise; a sparse subset must not be projected onto the population.',
    provenance: 'DERIVED',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['A sparse risk_score_after subset must NOT be generalised to all interventions; and any change is observational, not causal.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'risk_score_after is populated on only a small minority of records; generalising it to the intervention population would be misleading. Reported instead via evidence-completeness.',
  },
  {
    id: 'causal_effectiveness',
    name: 'Intervention causal effectiveness',
    meaning: 'Whether interventions CAUSED reduced harm-risk.',
    eligiblePopulation: 'n/a',
    observationWindow: 'n/a',
    exclusions: 'n/a',
    sourceRecords: ['(required) controlled/longitudinal design — DOES NOT EXIST'],
    freshness: 'n/a',
    missingDataBehaviour: 'NOT_AVAILABLE — no causal claim is ever made.',
    provenance: 'NONE',
    safeguards: RP_UNIVERSAL_SAFEGUARDS,
    prohibitedInterpretations: ['Occurrence/completion/observed change are NOT causal effectiveness; no causal claim may be made.'],
    availability: 'NOT_AVAILABLE',
    notAvailableReason: 'There is no control group or causal-inference design; causal effectiveness cannot be and is not claimed.',
  },
];

export function b2MetricById(id: string): B2MetricDefinition | undefined {
  return B2_METRIC_DEFINITIONS.find((m) => m.id === id);
}

// ─── Runtime computation ─────────────────────────────────────────────────────

/** Casino-grain aggregate from projection_intervention_outcome_state (no player identifiers). */
export interface InterventionOutcomeAggregate {
  casinoId: string;
  interventionsRecorded: number;
  distinctPlayers: number;
  outcomeAccepted: number;
  outcomeDeclined: number;
  outcomePending: number;
  outcomeSuccessful: number;
  outcomeUnsuccessful: number;
  statusSent: number;
  statusDelivered: number;
  followUpRequired: number;
  nrgpReported: number;
  withOutcome: number;
  withDeliveredAt: number;
  withAcknowledgedAt: number;
  withRiskScoreAfter: number;
  lastInterventionAt: string | null;
}

export interface B2MetricResult {
  id: string;
  name: string;
  availability: B2Availability;
  value: number | null;
  ratio?: number | null;
  breakdown?: Record<string, number | string> | null;
  display: string;
  provenance: B2Provenance;
  reason?: string;
  framing: B2Framing;
}

export interface B2Overview {
  metricsVersion: string;
  casinoId: string;
  observationWindow: 'ALL_RECORDED';
  source: string;
  generatedAt: string;
  dataProvenanceNote: string;
  lastInterventionAt: string | null;
  metrics: B2MetricResult[];
}

const suppressed = (c: number | null): boolean => c !== null && c > 0 && c < RP_MIN_COHORT;
const pct = (num: number, den: number): number | null => (den > 0 ? num / den : null);
const pctDisplay = (num: number, den: number): string => (den > 0 ? `${((num / den) * 100).toFixed(0)}% (${num}/${den})` : '—');

function na(id: string, framing: B2Framing): B2MetricResult {
  const d = b2MetricById(id)!;
  return { id, name: d.name, availability: 'NOT_AVAILABLE', value: null, display: '—', provenance: d.provenance, reason: d.notAvailableReason, framing };
}

const COHORT_SUPPRESS_REASON =
  'This casino’s intervention population is below the identifiable-exposure floor; the full intervention breakdown (counts, distributions, ratios and completeness) is suppressed together to prevent recovery of a small cohort through complementary calculation.';

/** Whole-metric suppression: no value, no ratio, no breakdown — nothing that could be subtracted or combined. */
function cohortSuppress(id: string, framing: B2Framing): B2MetricResult {
  const d = b2MetricById(id)!;
  return { id, name: d.name, availability: 'SUPPRESSED', value: null, ratio: null, breakdown: null, display: '—', provenance: d.provenance, reason: COHORT_SUPPRESS_REASON, framing };
}

// Framing per measurable metric id — used for both the live and the suppressed rendering.
const B2_MEASURABLE_FRAMING: Record<string, B2Framing> = {
  interventions_recorded: 'COVERAGE_GAP',
  distinct_intervention_players: 'PROTECTION',
  intervention_status_distribution: 'DATA_QUALITY',
  intervention_outcome_distribution: 'OUTCOME_OBSERVED',
  follow_up_required_rate: 'COVERAGE_GAP',
  reporting_completeness: 'DATA_QUALITY',
  intervention_evidence_completeness: 'DATA_QUALITY',
};
const B2_MEASURABLE_IDS = Object.keys(B2_MEASURABLE_FRAMING);

/**
 * Compute the B2 intervention-outcome overview from a casino-grain aggregate.
 * `agg` null (view absent / no rows for the casino) → the measurable metrics report
 * NOT_AVAILABLE (never 0). All measures are ALL_RECORDED and are NOT joined to B1's
 * certified financial periods or to the current risk cohort.
 */
export function computeInterventionOutcomes(casinoId: string, agg: InterventionOutcomeAggregate | null, now?: string): B2Overview {
  const metrics: B2MetricResult[] = [];
  const provNote = 'Figures are derived from persisted DEMO intervention records (not verified real-world player interventions). Occurrence and recorded outcomes are shown; no causal effectiveness is claimed.';

  // Whole-cohort suppression: if the casino's DISTINCT-PLAYER population is a small group
  // (0 < players < floor), the ENTIRE measurable block is suppressed together — not just the
  // player count. Surfacing the intervention count, status/outcome distributions, follow-up and
  // reporting/evidence figures for a sub-floor population would let a small cohort be recovered
  // by complementary subtraction, ratios×denominators, or values repeated across metric objects.
  const cohortSuppressed = !!agg && agg.interventionsRecorded > 0 && suppressed(agg.distinctPlayers);

  if (!agg || agg.interventionsRecorded <= 0) {
    // No source rows for this casino → measurable metrics NOT_AVAILABLE (never zero-filled).
    for (const id of B2_MEASURABLE_IDS) {
      metrics.push({ ...na(id, B2_MEASURABLE_FRAMING[id]), reason: 'No intervention records are present for this casino.' });
    }
  } else if (cohortSuppressed) {
    // Small casino population → suppress the whole measurable set (value/ratio/breakdown withheld).
    for (const id of B2_MEASURABLE_IDS) metrics.push(cohortSuppress(id, B2_MEASURABLE_FRAMING[id]));
  } else {
    const n = agg.interventionsRecorded;
    metrics.push({ id: 'interventions_recorded', name: b2MetricById('interventions_recorded')!.name, availability: 'MEASURABLE',
      value: n, display: String(n), provenance: 'DEMO_INTERVENTION_RECORD', framing: 'COVERAGE_GAP' });

    // distinct players — count only, k-anon suppressed below the floor
    const dp = agg.distinctPlayers;
    metrics.push({ id: 'distinct_intervention_players', name: b2MetricById('distinct_intervention_players')!.name,
      availability: suppressed(dp) ? 'SUPPRESSED' : 'MEASURABLE',
      value: suppressed(dp) ? null : dp, display: suppressed(dp) ? '—' : String(dp),
      provenance: 'DEMO_INTERVENTION_RECORD', framing: 'PROTECTION',
      reason: suppressed(dp) ? 'Cohort below the identifiable-exposure floor; suppressed.' : undefined });

    // dispatch status distribution (recorded field; NOT timing)
    metrics.push({ id: 'intervention_status_distribution', name: b2MetricById('intervention_status_distribution')!.name, availability: 'MEASURABLE',
      value: n, breakdown: { sent: agg.statusSent, delivered: agg.statusDelivered },
      display: `sent ${agg.statusSent} · delivered ${agg.statusDelivered}`, provenance: 'DEMO_INTERVENTION_RECORD', framing: 'DATA_QUALITY' });

    // recorded outcome distribution (pending != completed; not causal)
    metrics.push({ id: 'intervention_outcome_distribution', name: b2MetricById('intervention_outcome_distribution')!.name, availability: 'MEASURABLE',
      value: n, breakdown: { accepted: agg.outcomeAccepted, declined: agg.outcomeDeclined, pending: agg.outcomePending, successful: agg.outcomeSuccessful, unsuccessful: agg.outcomeUnsuccessful },
      display: `accepted ${agg.outcomeAccepted} · declined ${agg.outcomeDeclined} · pending ${agg.outcomePending} · successful ${agg.outcomeSuccessful} · unsuccessful ${agg.outcomeUnsuccessful}`,
      provenance: 'DEMO_INTERVENTION_RECORD', framing: 'OUTCOME_OBSERVED' });

    metrics.push({ id: 'follow_up_required_rate', name: b2MetricById('follow_up_required_rate')!.name, availability: 'MEASURABLE',
      value: agg.followUpRequired, ratio: pct(agg.followUpRequired, n), display: pctDisplay(agg.followUpRequired, n),
      provenance: 'DEMO_INTERVENTION_RECORD', framing: 'COVERAGE_GAP' });

    metrics.push({ id: 'reporting_completeness', name: b2MetricById('reporting_completeness')!.name, availability: 'MEASURABLE',
      value: agg.nrgpReported, ratio: pct(agg.nrgpReported, n), display: pctDisplay(agg.nrgpReported, n),
      provenance: 'DEMO_INTERVENTION_RECORD', framing: 'DATA_QUALITY' });

    // evidence completeness — HONESTLY surfaces the gaps (delivered_at/ack ~0%, risk_after sparse)
    metrics.push({ id: 'intervention_evidence_completeness', name: b2MetricById('intervention_evidence_completeness')!.name, availability: 'MEASURABLE',
      value: n, breakdown: {
        outcome: `${((agg.withOutcome / n) * 100).toFixed(0)}%`,
        delivered_at: `${((agg.withDeliveredAt / n) * 100).toFixed(0)}%`,
        acknowledged_at: `${((agg.withAcknowledgedAt / n) * 100).toFixed(0)}%`,
        risk_score_after: `${((agg.withRiskScoreAfter / n) * 100).toFixed(0)}%`,
      },
      display: `outcome ${((agg.withOutcome / n) * 100).toFixed(0)}% · delivered_at ${((agg.withDeliveredAt / n) * 100).toFixed(0)}% · ack ${((agg.withAcknowledgedAt / n) * 100).toFixed(0)}% · risk_after ${((agg.withRiskScoreAfter / n) * 100).toFixed(0)}%`,
      provenance: 'DERIVED', framing: 'DATA_QUALITY' });
  }

  // Always-NOT_AVAILABLE governed metrics (honest, with reasons)
  metrics.push(na('qualifying_intervention_coverage', 'COVERAGE_GAP'));
  metrics.push(na('delivery_timeliness', 'DATA_QUALITY'));
  metrics.push(na('follow_up_completion', 'COVERAGE_GAP'));
  metrics.push(na('observed_risk_trajectory', 'OUTCOME_OBSERVED'));
  metrics.push(na('causal_effectiveness', 'OUTCOME_OBSERVED'));

  return {
    metricsVersion: B2_METRICS_VERSION, casinoId, observationWindow: 'ALL_RECORDED', source: B2_SOURCE,
    generatedAt: now ?? new Date().toISOString(), dataProvenanceNote: provNote,
    lastInterventionAt: agg?.lastInterventionAt ?? null, metrics,
  };
}

/** Safeguard guard: no B2 metric may frame interventions/vulnerable players commercially or claim causation. */
export function assertNoEffectivenessOrOpportunityClaims(o: B2Overview): void {
  const banned = /opportunit|upsell|win.?back|recover(y| the)|reactivat|incentiv|target (high|critical)|caus(al|ed|es|e) (effect|reduction)|proven effective|guarantee/i;
  for (const m of o.metrics) {
    const hay = `${m.name} ${m.display} ${m.reason ?? ''}`;
    // "causal_effectiveness" is the id of the NOT_AVAILABLE metric whose NAME legitimately contains "causal";
    // only flag if a MEASURABLE metric makes a causal/opportunity claim.
    if (m.availability === 'MEASURABLE' && banned.test(hay)) {
      throw new Error(`B2 safeguard violation on ${m.id}: causal/opportunity framing`);
    }
  }
}
