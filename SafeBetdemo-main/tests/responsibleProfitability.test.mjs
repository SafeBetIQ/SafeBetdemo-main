// SafeBet IQ — Responsible Profitability B1 (governed metric foundation).
//   node --test tests/responsibleProfitability.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RP_METRICS_VERSION, RP_METRIC_DEFINITIONS, RP_MIN_COHORT, rpMetricById,
  computeResponsibleProfitability, assertNoOpportunityFraming,
  gatewayAuthorizationOutcome, resolveRpScope, isOverviewForPeriod,
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
test('per-band distribution masks small non-zero bands but shows a genuine 0', () => {
  const o = computeResponsibleProfitability({ ...base, kpi: { active_players: 30, risk_critical: 3, risk_high: 2, risk_medium: 0, risk_low: 25 } });
  const d = get(o, 'risk_posture_distribution').display;
  assert.match(d, /<10 critical/);   // 3 masked
  assert.match(d, /<10 high/);       // 2 masked
  assert.match(d, /0 medium/);       // genuine 0 shown, not masked
  assert.match(d, /25 low/);         // large band shown
  assert.doesNotMatch(d, /3 critical|2 high/); // raw small counts never exposed
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

// ── FINAL REVIEW REMEDIATION — one regression per finding ─────────────────────

// Finding 1: unsuccessful gateway authorization must prevent the service-role read.
test('F1: gateway authorization outcome propagates 401/403 and blocks reads on any non-2xx', () => {
  assert.deepEqual(gatewayAuthorizationOutcome(200), { authorized: true, denyStatus: null });
  assert.deepEqual(gatewayAuthorizationOutcome(204), { authorized: true, denyStatus: null });
  assert.deepEqual(gatewayAuthorizationOutcome(401), { authorized: false, denyStatus: 401 });
  assert.deepEqual(gatewayAuthorizationOutcome(403), { authorized: false, denyStatus: 403 });
  // gateway unavailable / network (0, 500, 502): NOT authorized (no privileged read), but not a hard deny
  for (const s of [0, 500, 502, 504]) {
    assert.deepEqual(gatewayAuthorizationOutcome(s), { authorized: false, denyStatus: null });
  }
});
test('F1: scope resolution pins operators and handles administrators without a casino assignment', () => {
  // operator with own casino, no request → own casino
  assert.deepEqual(resolveRpScope('casino-operator', 'c1', undefined), { scopeCasino: 'c1' });
  // operator with own casino, matching request → own casino
  assert.deepEqual(resolveRpScope('casino-operator', 'c1', 'c1'), { scopeCasino: 'c1' });
  // operator requesting a DIFFERENT casino → denied
  assert.deepEqual(resolveRpScope('casino-operator', 'c1', 'c2'), { deny: 403 });
  // operator with no casino assignment → denied
  assert.deepEqual(resolveRpScope('casino-operator', undefined, 'c1'), { deny: 403 });
  // administrator without a casino assignment MUST name a casino
  assert.deepEqual(resolveRpScope('administrator', undefined, 'c9'), { scopeCasino: 'c9' });
  assert.deepEqual(resolveRpScope('administrator', undefined, undefined), { deny: 403 });
  // ineligible profiles (regulator / unknown / null) → denied
  for (const p of ['regulator', 'executive', 'api-client', null]) {
    assert.deepEqual(resolveRpScope(p, 'c1', 'c1'), { deny: 403 });
  }
});

// Finding 2: no small-cohort disclosure via ratio / aggregate / complementary calc.
test('F2: a small component band cannot be recovered from the elevated sum minus a visible band', () => {
  // critical = 3 (small) but high = 1104 (large) → elevated sum 1107 would be > floor.
  const o = computeResponsibleProfitability({ ...base, kpi: { active_players: 18152, risk_critical: 3, risk_high: 1104, risk_medium: 7667, risk_low: 9218 } });
  const e = get(o, 'elevated_risk_exposure');
  assert.equal(e.availability, 'SUPPRESSED');   // suppressed because a component is small
  assert.equal(e.value, null);                  // no sum → cannot do sum − high = critical
  assert.ok(e.ratio == null);                   // no ratio → cannot do ratio × active = count
  assert.equal(e.display, '—');
  // distribution masks the small band and emits NO aggregate numeric value
  const d = get(o, 'risk_posture_distribution');
  assert.match(d.display, /<10 critical/);
  assert.equal(d.value, null);
});
test('F2: elevated ratio is withheld whenever the metric is suppressed', () => {
  const o = computeResponsibleProfitability({ ...base, kpi: { active_players: 100, risk_critical: 2, risk_high: 3, risk_medium: 10, risk_low: 80 } });
  const e = get(o, 'elevated_risk_exposure');
  assert.equal(e.availability, 'SUPPRESSED');
  assert.ok(e.ratio == null);
  assert.equal(e.value, null);
});

// Finding 3: a MISSING risk band is not interpreted as zero.
test('F3: a missing (null) critical band makes elevated exposure NOT_AVAILABLE, never treated as 0', () => {
  const o = computeResponsibleProfitability({ ...base, kpi: { active_players: 18152, risk_critical: null, risk_high: 1104, risk_medium: 7667, risk_low: 9218 } });
  const e = get(o, 'elevated_risk_exposure');
  assert.equal(e.availability, 'NOT_AVAILABLE');   // NOT computed as 0 + 1104 = 1104
  assert.equal(e.value, null);
  assert.match(e.reason, /missing/i);
  // distribution shows the missing band as "—", not "0"
  assert.match(get(o, 'risk_posture_distribution').display, /— critical/);
});

// Finding 4: stale financial must not display under a newly-selected period.
test('F4: overview is accepted only when its period matches the current selection', () => {
  const forToday = { period: 'TODAY' };
  assert.equal(isOverviewForPeriod(forToday, 'TODAY'), true);
  assert.equal(isOverviewForPeriod(forToday, 'MTD'), false);   // a stale TODAY payload is rejected under MTD
  assert.equal(isOverviewForPeriod(null, 'TODAY'), false);
  assert.equal(isOverviewForPeriod(undefined, 'TODAY'), false);
});

// Finding 5: reconciliation is not reported when the selected period's value is unavailable.
test('F5: reconciliation is UNAVAILABLE when the selected period certified value is null', () => {
  // posture present, but the MTD certified value is unavailable for this period
  const fp = posture({ ggrMonthToDate: null });
  const o = computeResponsibleProfitability({ ...base, financial: fp, period: 'MTD' });
  assert.equal(get(o, 'certified_ggr').availability, 'NOT_AVAILABLE');
  assert.equal(get(o, 'certified_ggr').display, '—');
  assert.equal(o.reconciliation, 'UNAVAILABLE');   // nothing to reconcile to for this period
  // and a period WITH a value still reconciles
  const o2 = computeResponsibleProfitability({ ...base, financial: fp, period: 'TODAY' });
  assert.equal(o2.reconciliation, 'RECONCILES_TO_CERTIFIED_POSTURE');
});
