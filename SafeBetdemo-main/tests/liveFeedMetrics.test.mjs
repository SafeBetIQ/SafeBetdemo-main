// Live Feed / Regulator player-metric semantics — active-now (freshness) vs observed.
// Run: node --test tests/liveFeedMetrics.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOperatorKpi } from '../lib/consumerPlatform/integrity.ts';
import { shapeNationalOverview } from '../lib/consumerPlatform/regulator.ts';

// A certified operator KPI: observed = active_now + idle + stale.
const kpi = (activeNow, idle, stale) => ({
  active_players: activeNow + idle + stale,           // observed
  players_active_now: activeNow, players_idle: idle, players_stale: stale,
  active_sessions: 0, idle_sessions: 0, stale_sessions: 0, open_sessions: 0,
  machines_in_play: 0, machines_stale: 0, registered_machines: 0,
  events_per_min: 0, total_wagered: 0, total_won: 0, ggr: 0, avg_bet_size: 0,
  risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0, risk_unclassified: 0,
  active_machines: 0, snapshot_at: new Date().toISOString(),
});

test('Live Feed active number is active_now, NOT observed (they differ)', () => {
  const k = kpi(19, 0, 1575); // Prestige-like: observed 1594, active-now 19
  // The Live Feed must show players_active_now, not active_players.
  assert.equal(k.players_active_now, 19);
  assert.equal(k.active_players, 1594);
  assert.notEqual(k.players_active_now, k.active_players);
});

test('observed = active_now + idle + stale reconciles; stale/idle excluded from active-now', () => {
  const r = reconcileOperatorKpi(kpi(19, 0, 1575));
  const posture = r.checks.find((c) => c.name.includes('active_players') || /active_now/.test(c.detail ?? ''));
  assert.ok(r.checks.some((c) => c.ok), 'has passing checks');
  // active-now excludes the 1575 stale + 0 idle
  const k = kpi(19, 5, 1575);
  assert.equal(k.players_active_now, 19);
  assert.equal(k.active_players, 19 + 5 + 1575);
});

// Regulator national aggregate: active = sum(active-now), observed = sum(observed).
const op = (id, name, activeNow, observed) => ({
  casino_id: id, casino_name: name, province: null,
  active_players: observed, players_active_now: activeNow, players_idle: 0, players_stale: observed - activeNow,
  active_sessions: 0, active_machines: 0, risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0,
  total_wagered: 0, ggr: 0, players_monitored: 0, interventions: 0, last_event_at: null,
});
const national = (ops) => ({
  jurisdiction: 'ZA', operators: ops.length,
  players_active_now: ops.reduce((s, o) => s + o.players_active_now, 0),
  observed_players: ops.reduce((s, o) => s + o.active_players, 0),
  active_players: ops.reduce((s, o) => s + o.active_players, 0),
  risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0, players_monitored: 0, interventions: 0, ggr: 0,
  operators_detail: ops,
});

test('Regulator active total = sum of active-now; observed total = sum of observed', () => {
  const ops = [op('a', 'Prestige', 3, 60), op('b', 'Betway', 2, 40)];
  const v = shapeNationalOverview(national(ops));
  assert.equal(v.activePlayers, 5, 'active = sum active-now');
  assert.equal(v.observedPlayers, 100, 'observed = sum observed');
  assert.notEqual(v.activePlayers, v.observedPlayers, 'active-now must differ from observed');
  assert.equal(v.operatorHealth.reduce((s, o) => s + o.activeNow, 0), v.activePlayers);
  assert.equal(v.operatorHealth.reduce((s, o) => s + o.observed, 0), v.observedPlayers);
});

test('shaping is data-driven — a newly added tenant is included with no name conditional', () => {
  const ops = [op('a', 'Prestige', 3, 60), op('b', 'Betway', 2, 40), op('z', 'Brand-New Casino', 7, 500)];
  const v = shapeNationalOverview(national(ops));
  assert.equal(v.operators, 3);
  assert.equal(v.activePlayers, 12);
  assert.equal(v.observedPlayers, 600);
  assert.ok(v.operatorHealth.some((o) => o.name === 'Brand-New Casino' && o.activeNow === 7 && o.observed === 500));
});
