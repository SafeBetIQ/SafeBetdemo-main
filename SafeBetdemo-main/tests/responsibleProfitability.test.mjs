// SafeBet IQ — Responsible Profitability B1 (governed metric foundation).
//   node --test tests/responsibleProfitability.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RP_METRICS_VERSION, RP_METRIC_DEFINITIONS, RP_MIN_COHORT, rpMetricById,
  computeResponsibleProfitability, assertNoOpportunityFraming,
} from '../lib/responsibleProfitability/index.ts';
import { ggrForPeriod } from '../lib/certifiedFinancial.ts';

// Minimal certified posture (camelCase consumer-platform contract shape).
function posture(over = {}) {
  return {
    currency: 'ZAR', timezone: 'Africa/Johannesburg', status: 'healthy', snapshotAt: '2026-09-20T10:00:00Z', projectionLagSeconds: 3,
    ggrCurrentShift: 1000, ggrToday: 5000, ggrLast24Hours: 6000, ggrMonthToDate: 90000,
    stakesCurrentShift: 4000, stakesToday: 20000, stakesLast24Hours: 24000, stakesMonthToDate: 300000,
    playerWinningsCurrentShift: 3000, playerWinningsToday: 15000, playerWinningsLast24Hours: 18000, playerWinningsMonthToDate: 210000,
    settledBetsToday: 100, voidedBetsToday: 0, reversedTransactionsToday: 0, bonusWagersToday: 0,
    voidsSupported: true, reversalsSupported: true, bonusSupported: true, combinedWagerSettlement: false, separateSettlement: true,
    capabilityVersion: 2, containsSyntheticData: true, syntheticEventCount: 100, nonSyntheticEventCount: 0, dataMode: 'synthetic',
    ...over,
  };
}
const kpi = { active_players: 18152, risk_critical: 163, risk_high: 1104, risk_medium: 7667, risk_low: 9218 };
const base = { casinoId: 'c1', period: 'TODAY', financial: posture(), kpi, activeSelfExclusions: 30, interventionCoverage: null, now: 't' };
const get = (o, id) => o.metrics.find((m) => m.id === id);

test('version + definitions catalogue present', () => {
  assert.equal(RP_METRICS_VERSION, '1.0.0');
  assert.ok(RP_METRIC_DEFINITIONS.length >= 10);
  assert.ok(rpMetricById('certified_ggr'));
});

// ── §2 reconciliation: financial values are the certified posture verbatim ──
test('certified GGR reconciles to the certified posture (never recomputed)', () => {
  const o = computeResponsibleProfitability(base);
  assert.equal(get(o, 'certified_ggr').value, ggrForPeriod(posture(), 'TODAY'));  // === 5000
  assert.equal(get(o, 'certified_ggr').value, 5000);
  assert.equal(o.reconciliation, 'RECONCILES_TO_CERTIFIED_POSTURE');
  for (const p of ['SHIFT', 'ROLLING_24H', 'MTD']) {
    const oo = computeResponsibleProfitability({ ...base, period: p });
    assert.equal(get(oo, 'certified_ggr').value, ggrForPeriod(posture(), p));
  }
});

// ── §4 NOT_AVAILABLE: no unsupported revenue attribution / retention / outcome ──
test('GGR-attributable-to-risk-cohort is NOT_AVAILABLE with provenance (never inferred)', () => {
  const o = computeResponsibleProfitability(base);
  const m = get(o, 'ggr_attributable_to_elevated_risk');
  assert.equal(m.availability, 'NOT_AVAILABLE');
  assert.equal(m.value, null); assert.equal(m.display, '—');
  assert.match(m.reason, /casino-aggregate|not period-aligned|no authorised/i);
});
test('harm-adjusted profitability / retention / intervention-outcome are NOT_AVAILABLE', () => {
  const o = computeResponsibleProfitability(base);
  for (const id of ['harm_adjusted_profitability', 'healthy_player_retention', 'intervention_outcome_effectiveness']) {
    assert.equal(get(o, id).availability, 'NOT_AVAILABLE');
    assert.equal(get(o, id).display, '—');
    assert.ok(get(o, id).reason && get(o, id).reason.length > 10);
  }
});

// ── measurable metrics ──
test('risk posture + elevated exposure are measurable (exposure-to-reduce framing)', () => {
  const o = computeResponsibleProfitability(base);
  assert.equal(get(o, 'elevated_risk_exposure').value, 163 + 1104);
  assert.equal(get(o, 'elevated_risk_exposure').framing, 'EXPOSURE_TO_REDUCE');
  assert.equal(get(o, 'risk_posture_distribution').availability, 'MEASURABLE');
});
test('self-exclusion protection is measurable with PROTECTION framing', () => {
  const o = computeResponsibleProfitability(base);
  assert.equal(get(o, 'self_exclusion_protection').value, 30);
  assert.equal(get(o, 'self_exclusion_protection').framing, 'PROTECTION');
});

// ── intervention coverage: NOT_AVAILABLE when unseeded; measurable + provenance when present ──
test('intervention coverage is NOT_AVAILABLE when intervention state is unpopulated', () => {
  const o = computeResponsibleProfitability({ ...base, interventionCoverage: null });
  assert.equal(get(o, 'intervention_coverage').availability, 'NOT_AVAILABLE');
  assert.match(get(o, 'intervention_coverage').reason, /unpopulated|no operational/i);
});
test('intervention coverage carries SYNTHETIC_DEMO provenance when a labelled fixture supplies it', () => {
  const o = computeResponsibleProfitability({ ...base, interventionCoverage: { elevatedRiskPlayers: 1267, elevatedRiskWithIntervention: 900, provenance: 'SYNTHETIC_DEMO' } });
  const m = get(o, 'intervention_coverage');
  assert.equal(m.availability, 'MEASURABLE'); assert.equal(m.provenance, 'SYNTHETIC_DEMO');
  assert.ok(m.ratio > 0 && m.ratio <= 1);
});

// ── null-not-zero + zero-denominator ──
test('missing certified financial → "—" not 0', () => {
  const o = computeResponsibleProfitability({ ...base, financial: null });
  assert.equal(get(o, 'certified_ggr').display, '—');
  assert.equal(get(o, 'certified_ggr').value, null);
  assert.equal(o.reconciliation, 'UNAVAILABLE');
});
test('missing KPI → risk metrics NOT_AVAILABLE (not zero)', () => {
  const o = computeResponsibleProfitability({ ...base, kpi: null });
  assert.equal(get(o, 'elevated_risk_exposure').availability, 'NOT_AVAILABLE');
});
test('zero elevated-risk cohort → coverage NOT_AVAILABLE (no divide-by-zero)', () => {
  const o = computeResponsibleProfitability({ ...base, interventionCoverage: { elevatedRiskPlayers: 0, elevatedRiskWithIntervention: 0, provenance: 'OPERATIONAL_PROJECTION' } });
  assert.equal(get(o, 'intervention_coverage').availability, 'NOT_AVAILABLE');
});

// ── §7 small-group suppression (identifiable-exposure guard) ──
test('small cohorts below the k-anon floor are suppressed', () => {
  const o = computeResponsibleProfitability({ ...base, kpi: { active_players: 12, risk_critical: 2, risk_high: 3, risk_medium: 3, risk_low: 4 }, activeSelfExclusions: 4 });
  assert.equal(get(o, 'elevated_risk_exposure').availability, 'SUPPRESSED');   // 5 < 10
  assert.equal(get(o, 'self_exclusion_protection').availability, 'SUPPRESSED'); // 4 < 10
  assert.ok(RP_MIN_COHORT >= 10);
});

// ── §5 safeguards: no growth/upsell/recovery framing anywhere ──
test('no opportunity/upsell/recovery framing on any metric (safeguard)', () => {
  const o = computeResponsibleProfitability(base);
  assert.doesNotThrow(() => assertNoOpportunityFraming(o));
  // every measurable risk metric uses an exposure/protection/coverage framing, never PERFORMANCE-on-risk
  assert.equal(get(o, 'elevated_risk_exposure').framing, 'EXPOSURE_TO_REDUCE');
  assert.equal(get(o, 'self_exclusion_protection').framing, 'PROTECTION');
});
test('every definition carries the universal safeguards + prohibited interpretations', () => {
  for (const d of RP_METRIC_DEFINITIONS) {
    assert.ok(Array.isArray(d.safeguards) && d.safeguards.length >= 4);
    if (d.availability === 'NOT_AVAILABLE') assert.ok(d.notAvailableReason && d.notAvailableReason.length > 20);
  }
});
