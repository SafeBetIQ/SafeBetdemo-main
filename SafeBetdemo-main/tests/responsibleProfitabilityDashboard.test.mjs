// SafeBet IQ — Responsible Profitability B3 (dashboard presentation) pure-logic tests.
//   node --test tests/responsibleProfitabilityDashboard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  availabilityPresentation, AVAILABILITY_PRESENTATION, isChartable, breakdownToChartData,
  csvCell, buildGovernedCsv, SCOPE_ALL_RECORDED,
} from '../lib/responsibleProfitability/index.ts';

// ── distinct visual meaning for each state (owner §5) ──
test('each state has a distinct presentation; none collapses to another', () => {
  const states = ['MEASURABLE', 'ZERO', 'PARTIAL', 'SUPPRESSED', 'NOT_AVAILABLE', 'STALE', 'UNAVAILABLE'];
  const labels = new Set(states.map((s) => availabilityPresentation(s).label));
  assert.equal(labels.size, states.length);                 // all distinct
  assert.match(availabilityPresentation('SUPPRESSED').label, /suppress/i);
  assert.match(availabilityPresentation('NOT_AVAILABLE').label, /not available/i);
  assert.equal(availabilityPresentation('STALE').tone, 'destructive');
});

// ── charts never render suppressed / unavailable data ──
test('isChartable: only genuinely measurable metrics with a value/breakdown are chartable', () => {
  assert.equal(isChartable({ availability: 'MEASURABLE', value: 158 }), true);
  assert.equal(isChartable({ availability: 'MEASURABLE', breakdown: { a: 1, b: 2 } }), true);
  assert.equal(isChartable({ availability: 'SUPPRESSED', value: null, breakdown: null }), false);
  assert.equal(isChartable({ availability: 'NOT_AVAILABLE', value: null }), false);
  assert.equal(isChartable({ availability: 'MEASURABLE', value: null, breakdown: null }), false);
  assert.equal(isChartable(null), false);
});
test('breakdownToChartData returns [] for suppressed/unavailable (no zero-filled chart)', () => {
  assert.deepEqual(breakdownToChartData({ availability: 'SUPPRESSED', breakdown: null }), []);
  assert.deepEqual(breakdownToChartData({ availability: 'NOT_AVAILABLE', breakdown: { a: 1 } }), []);
  assert.deepEqual(breakdownToChartData({ availability: 'MEASURABLE', breakdown: { accepted: 30, declined: 48 } }),
    [{ name: 'accepted', value: 30 }, { name: 'declined', value: 48 }]);
});

// ── CSV injection safety ──
test('csvCell neutralises spreadsheet formula injection and escapes delimiters', () => {
  assert.equal(csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""');
  assert.equal(csvCell('R 250 229'), 'R 250 229');
  assert.equal(csvCell(null), '');
});

// ── governed CSV: time-scope isolation + suppression + no raw figures ──
const b1 = [
  { id: 'certified_ggr', name: 'Certified GGR (period)', availability: 'MEASURABLE', display: 'R 250 229', provenance: 'CERTIFIED' },
  { id: 'elevated_risk_exposure', name: 'Elevated harm-risk exposure', availability: 'SUPPRESSED', display: '—', provenance: 'OPERATIONAL_PROJECTION' },
];
const b2 = [
  { id: 'interventions_recorded', name: 'Interventions recorded', availability: 'MEASURABLE', display: '158', provenance: 'DEMO_INTERVENTION_RECORD' },
  { id: 'causal_effectiveness', name: 'Intervention causal effectiveness', availability: 'NOT_AVAILABLE', display: '—', provenance: 'NONE' },
];
function csv() {
  return buildGovernedCsv({
    casinoId: 'c1', financialPeriod: 'MTD', currency: 'ZAR', financialStatus: 'CERTIFIED',
    reconciliation: 'RECONCILES_TO_CERTIFIED_POSTURE', containsSyntheticData: true,
    b1Metrics: b1, b2Metrics: b2, b2ObservationWindow: 'ALL_RECORDED',
    metricsVersionB1: '1.0.0', metricsVersionB2: '1.0.0', generatedAt: '2026-09-24T10:00:00Z',
  });
}
test('CSV keeps B1 financial period and B2 ALL_RECORDED scope separate (never conflated)', () => {
  const rows = csv().split('\r\n');
  const b1row = rows.find((r) => r.includes('certified_ggr'));
  const b2row = rows.find((r) => r.includes('interventions_recorded'));
  assert.match(b1row, /B1_FINANCIAL_RG,certified_ggr,.*,MTD,/);        // B1 carries the financial period
  assert.match(b2row, /B2_INTERVENTION_OUTCOMES,interventions_recorded,.*,ALL_RECORDED,/); // B2 carries ALL_RECORDED
  assert.doesNotMatch(b2row, /,MTD,/);                                 // B2 never labelled with the financial period
});
test('CSV exports the already-suppressed display only (no re-derived figure for a suppressed metric)', () => {
  const rows = csv();
  const supp = rows.split('\r\n').find((r) => r.includes('elevated_risk_exposure'));
  assert.match(supp, /,SUPPRESSED,—,/);   // suppressed → "—", never a number
});
test('CSV carries scope, provenance, availability, version, reconciliation + synthetic flag', () => {
  const header = csv().split('\r\n')[0];
  for (const col of ['section', 'metric_id', 'time_scope', 'availability', 'value_display', 'provenance', 'metrics_version', 'reconciliation', 'contains_synthetic_data'])
    assert.ok(header.includes(col), `missing ${col}`);
  assert.equal(SCOPE_ALL_RECORDED.includes('not a financial period'), true);
});
test('CSV contains no raw player identifiers', () => {
  const blob = csv();
  assert.doesNotMatch(blob, /SB-PLR-[0-9A-F]{8}/);
  assert.doesNotMatch(blob, /player_id|players\.id/);
});
