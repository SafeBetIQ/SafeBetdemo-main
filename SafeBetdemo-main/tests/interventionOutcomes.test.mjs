// SafeBet IQ — Responsible Profitability B2 (Intervention Outcome Intelligence).
//   node --test tests/interventionOutcomes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  B2_METRICS_VERSION, B2_METRIC_DEFINITIONS, B2_SOURCE, b2MetricById,
  computeInterventionOutcomes, assertNoEffectivenessOrOpportunityClaims,
} from '../lib/responsibleProfitability/index.ts';

// Aggregate modelled on real Demo data (player_protection_interventions, one casino).
function agg(over = {}) {
  return {
    casinoId: 'c1', interventionsRecorded: 158, distinctPlayers: 25,
    outcomeAccepted: 30, outcomeDeclined: 48, outcomePending: 27, outcomeSuccessful: 28, outcomeUnsuccessful: 25,
    statusSent: 108, statusDelivered: 50, followUpRequired: 76, nrgpReported: 28,
    withOutcome: 158, withDeliveredAt: 0, withAcknowledgedAt: 0, withRiskScoreAfter: 7,
    lastInterventionAt: '2026-09-20T10:00:00Z', ...over,
  };
}
const get = (o, id) => o.metrics.find((m) => m.id === id);

test('version + catalogue present; canonical source is a single table (no 586+50 sum)', () => {
  assert.equal(B2_METRICS_VERSION, '1.0.0');
  assert.equal(B2_SOURCE, 'player_protection_interventions');
  assert.ok(B2_METRIC_DEFINITIONS.length >= 12);
  // intervention_history must NOT be a source of the primary metrics (distinct subsystem)
  for (const m of B2_METRIC_DEFINITIONS) assert.ok(!m.sourceRecords.includes('intervention_history'));
});

test('measurable occurrence/outcome metrics compute from the aggregate', () => {
  const o = computeInterventionOutcomes('c1', agg());
  assert.equal(get(o, 'interventions_recorded').value, 158);
  assert.equal(o.observationWindow, 'ALL_RECORDED');   // NOT a financial period
  assert.match(o.dataProvenanceNote, /DEMO|not verified real-world/i);
  assert.equal(get(o, 'interventions_recorded').provenance, 'DEMO_INTERVENTION_RECORD');
});

// ── §2 coverage: qualifying coverage is NOT_AVAILABLE (no cohort/bridge) ──
test('qualifying intervention coverage is NOT_AVAILABLE with the identity/eligibility reason', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const m = get(o, 'qualifying_intervention_coverage');
  assert.equal(m.availability, 'NOT_AVAILABLE');
  assert.equal(m.value, null); assert.equal(m.display, '—');
  assert.match(m.reason, /identity|bridge|eligible|denominator|historical risk/i);
});
test('coverage is never a naive records ÷ current-elevated ratio', () => {
  const o = computeInterventionOutcomes('c1', agg());
  // no metric exposes a coverage ratio derived from the record count
  assert.equal(get(o, 'qualifying_intervention_coverage').ratio ?? null, null);
});

// ── §3 pending ≠ completed; no invented timestamps / completion ──
test('outcome distribution keeps pending distinct and never derives "completed"', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const m = get(o, 'intervention_outcome_distribution');
  assert.equal(m.breakdown.pending, 27);
  assert.ok(!('completed' in m.breakdown));   // never invents a completed bucket
  assert.match(b2MetricById('intervention_outcome_distribution').prohibitedInterpretations.join(' '), /pending ≠ completed/i);
});
test('delivery timeliness NOT_AVAILABLE (delivered_at absent — never inferred from triggered_at)', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const m = get(o, 'delivery_timeliness');
  assert.equal(m.availability, 'NOT_AVAILABLE');
  assert.match(m.reason, /delivered_at|acknowledged_at|not.*infer/i);
});
test('follow-up completion NOT_AVAILABLE (no completion field — never inferred from due date)', () => {
  const o = computeInterventionOutcomes('c1', agg());
  assert.equal(get(o, 'follow_up_completion').availability, 'NOT_AVAILABLE');
  assert.match(get(o, 'follow_up_completion').reason, /completion|follow_up_date/i);
});
test('follow_up_required is a REQUIRED rate, explicitly not completion', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const m = get(o, 'follow_up_required_rate');
  assert.equal(m.availability, 'MEASURABLE');
  assert.ok(Math.abs(m.ratio - 76 / 158) < 1e-9);
  assert.match(b2MetricById('follow_up_required_rate').prohibitedInterpretations.join(' '), /REQUIRED is not.*COMPLETED/i);
});

// ── §4 sparse outcome data not generalised; no causal claim ──
test('observed risk trajectory NOT_AVAILABLE (sparse risk_score_after not generalised)', () => {
  const o = computeInterventionOutcomes('c1', agg());
  assert.equal(get(o, 'observed_risk_trajectory').availability, 'NOT_AVAILABLE');
  assert.match(get(o, 'observed_risk_trajectory').reason, /sparse|small minority|generalis/i);
});
test('causal effectiveness NOT_AVAILABLE and never claimed', () => {
  const o = computeInterventionOutcomes('c1', agg());
  assert.equal(get(o, 'causal_effectiveness').availability, 'NOT_AVAILABLE');
  assert.match(get(o, 'causal_effectiveness').reason, /no control|causal.*not/i);
});
test('evidence completeness honestly surfaces the gaps (delivered_at/ack 0%, risk_after sparse)', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const m = get(o, 'intervention_evidence_completeness');
  assert.equal(m.availability, 'MEASURABLE');
  assert.equal(m.breakdown.delivered_at, '0%');
  assert.equal(m.breakdown.acknowledged_at, '0%');
  assert.equal(m.breakdown.risk_score_after, '4%');   // 7/158
});
test('safeguard: no measurable metric claims causal effectiveness or opportunity framing', () => {
  const o = computeInterventionOutcomes('c1', agg());
  assert.doesNotThrow(() => assertNoEffectivenessOrOpportunityClaims(o));
});

// ── privacy: anonymization + k-anon suppression ──
test('no player identifier VALUES are surfaced (counts only; schema words in governance prose are allowed)', () => {
  const o = computeInterventionOutcomes('c1', agg());
  const blob = JSON.stringify(o);
  // No actual anonymised-id value (SB-PLR-XXXXXXXX) and no raw UUID value anywhere.
  assert.doesNotMatch(blob, /SB-PLR-[0-9A-F]{8}/);
  assert.doesNotMatch(blob, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  // distinct players is a count only; no per-player rows exist on the overview
  assert.equal(typeof get(o, 'distinct_intervention_players').value, 'number');
  for (const m of o.metrics) assert.ok(!('player' in (m.breakdown ?? {})));
});
test('distinct-player count is k-anon suppressed below the floor', () => {
  const o = computeInterventionOutcomes('c1', agg({ distinctPlayers: 6 }));
  const m = get(o, 'distinct_intervention_players');
  assert.equal(m.availability, 'SUPPRESSED');
  assert.equal(m.value, null); assert.equal(m.display, '—');
});
test('a genuine 0 distinct players is not suppressed as identifying (whole casino NOT_AVAILABLE instead)', () => {
  const o = computeInterventionOutcomes('c1', agg({ interventionsRecorded: 0 }));
  // no records → measurable metrics NOT_AVAILABLE, never zero-filled
  assert.equal(get(o, 'interventions_recorded').availability, 'NOT_AVAILABLE');
  assert.equal(get(o, 'intervention_outcome_distribution').availability, 'NOT_AVAILABLE');
});

// ── missing projection (e.g. pre-release / view absent) ──
test('null aggregate → measurable metrics NOT_AVAILABLE (never fabricated), NA metrics still present', () => {
  const o = computeInterventionOutcomes('c1', null);
  assert.equal(get(o, 'interventions_recorded').availability, 'NOT_AVAILABLE');
  assert.equal(get(o, 'causal_effectiveness').availability, 'NOT_AVAILABLE');
  assert.equal(get(o, 'qualifying_intervention_coverage').availability, 'NOT_AVAILABLE');
});

test('every B2 definition carries safeguards + NOT_AVAILABLE reasons where applicable', () => {
  for (const d of B2_METRIC_DEFINITIONS) {
    assert.ok(Array.isArray(d.safeguards) && d.safeguards.length >= 4);
    if (d.availability === 'NOT_AVAILABLE') assert.ok(d.notAvailableReason && d.notAvailableReason.length > 20);
  }
});
