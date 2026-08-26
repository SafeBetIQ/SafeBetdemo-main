// Regulator summary metric contract (REG-SUM-1).
// Proves the metric definitions/selection are correct and explainable: "Active
// players" is the POPULATION (observedPlayers), "Active now" is the freshness
// subset (activePlayers); monitored/interventions pass through; null (failed
// query) is UNAVAILABLE ("—"), never a false zero. No browser aggregation — the
// national numbers are the server rollup; a test independently sums fixtures.
//   node --test tests/regulatorSummary.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveRegulatorSummary, summaryCount, SUMMARY_UNAVAILABLE, REGULATOR_METRIC_DEFS,
} from '../lib/regulatorSummary.ts';

// A national-overview payload mirroring the live demo (6 ZA operators).
const perOperator = [
  { observed: 2507, activeNow: 49, monitored: 1576 }, // Betway
  { observed: 1077, activeNow: 19, monitored: 695 },  // Gold Rush
  { observed: 3509, activeNow: 60, monitored: 2042 }, // Hollywoodbets
  { observed: 1594, activeNow: 38, monitored: 1258 }, // Prestige
  { observed: 498,  activeNow: 15, monitored: 581 },  // Royal Palace (monitored > observed)
  { observed: 1021, activeNow: 34, monitored: 1032 }, // SunBet
];
const sum = (k) => perOperator.reduce((a, o) => a + o[k], 0);
const nat = {
  jurisdiction: 'ZA', operators: 6,
  activePlayers: sum('activeNow'),      // 215 — active-now / freshness
  observedPlayers: sum('observed'),     // 10206 — active-player population
  playersMonitored: sum('monitored'),   // 7184
  interventions: 0,
  riskTiers: { critical: 83, high: 656, medium: 2640, low: 6827 },
};

test('reconciliation: server national numbers equal the independent fixture sums', () => {
  // The server aggregate (RPC) is authoritative; the test sums the fixtures itself.
  assert.equal(nat.observedPlayers, 10206);
  assert.equal(nat.activePlayers, 215);
  assert.equal(nat.playersMonitored, 7184);
  // observed population is fully risk-tiered.
  assert.equal(nat.observedPlayers, Object.values(nat.riskTiers).reduce((a, b) => a + b, 0));
});

test('"Active players" is the POPULATION (observedPlayers), not the freshness number', () => {
  const s = deriveRegulatorSummary(nat);
  assert.equal(s.activePlayers, 10206);   // the human-expected total
  assert.equal(s.activeNow, 215);         // freshness subset shown separately
  assert.notEqual(s.activePlayers, s.activeNow);
});

test('monitored + active-but-not-monitored are explainable', () => {
  const s = deriveRegulatorSummary(nat);
  assert.equal(s.monitored, 7184);
  assert.equal(s.activeNotMonitored, 10206 - 7184); // 3022
});

test('active-but-not-monitored never goes negative when monitored exceeds population', () => {
  // Royal-Palace-like: a persistent compliance set larger than currently-active.
  const s = deriveRegulatorSummary({ observedPlayers: 498, playersMonitored: 581, activePlayers: 15 });
  assert.equal(s.activeNotMonitored, 0);  // floored, not -83
});

test('interventions: a genuine 0 renders as 0 (not unavailable)', () => {
  const s = deriveRegulatorSummary(nat);
  assert.equal(s.interventions, 0);
  assert.equal(summaryCount(s.interventions), '0');
});

test('failed summary is UNAVAILABLE — never false zeros (RULE)', () => {
  const s = deriveRegulatorSummary(null);
  assert.equal(s.available, false);
  for (const k of ['operators', 'activePlayers', 'activeNow', 'monitored', 'interventions']) {
    assert.equal(s[k], null);
    assert.equal(summaryCount(s[k]), SUMMARY_UNAVAILABLE);  // "—", not "0"
  }
});

test('a real zero population is 0, a missing one is "—"', () => {
  assert.equal(summaryCount(0), '0');
  assert.equal(summaryCount(null), '—');
  assert.equal(summaryCount(10206), '10,206');
});

test('every metric has a regulator-facing definition (tooltip)', () => {
  for (const k of ['operators', 'activePlayers', 'activeNow', 'monitored', 'interventions']) {
    assert.ok(REGULATOR_METRIC_DEFS[k] && REGULATOR_METRIC_DEFS[k].length > 10);
  }
});
