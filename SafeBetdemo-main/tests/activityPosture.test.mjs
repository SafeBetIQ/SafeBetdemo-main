// Certified player & machine activity posture.
// Run: node --test tests/activityPosture.test.mjs
//
// Players/machines no longer read "active" indefinitely: their live posture is
// derived from certified activity freshness and PARTITIONS the observed active
// population. These tests cover the read-only reconciliation validator and the
// contract passthrough (the freshness classification itself is in the certified
// projection view, not recomputed here).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reconcileOperatorKpi } from '../lib/consumerPlatform/index.ts';
import { shapeKpi } from '../lib/consumerPlatform/shaping.ts';
import { mapAggregates } from '../lib/digitalTwin/assembly.ts';

function kpi(o = {}) {
  const m = {
    active_players: 10, active_sessions: 4, idle_sessions: 0, stale_sessions: 6, open_sessions: 10,
    events_per_min: 0, total_wagered: 100, total_won: 40, ggr: 60, avg_bet_size: 0,
    risk_critical: 2, risk_high: 2, risk_medium: 2, risk_low: 2, risk_unclassified: 2,
    active_machines: 8, snapshot_at: '2026-07-29T00:00:00.000Z', ...o,
  };
  m.players_active_now ??= 4; m.players_idle ??= 2;
  m.players_stale ??= m.active_players - m.players_active_now - m.players_idle;
  m.machines_in_play ??= 3; m.machines_stale ??= m.active_machines - m.machines_in_play;
  m.registered_machines ??= m.active_machines + 2;
  return m;
}

test('player posture partitions the active-player population', () => {
  const r = reconcileOperatorKpi(kpi());
  assert.equal(r.ok, true);
  assert.ok(r.checks.find((c) => c.name === 'player-posture-vs-active')?.ok);
});

test('machine posture partitions the active-machine population', () => {
  assert.ok(reconcileOperatorKpi(kpi()).checks.find((c) => c.name === 'machine-posture-vs-active')?.ok);
});

test('the "active indefinitely" defect reconciles honestly (all observed players stale, none fresh)', () => {
  // Simulator idle: 151 observed active players, 0 fresh, all stale — a full,
  // internally-consistent Prestige snapshot (risk + sessions also reconcile).
  const r = reconcileOperatorKpi(kpi({
    active_players: 151,
    risk_critical: 0, risk_high: 11, risk_medium: 57, risk_low: 83, risk_unclassified: 0,
    active_sessions: 0, idle_sessions: 0, stale_sessions: 152, open_sessions: 152,
    players_active_now: 0, players_idle: 0, players_stale: 151,
    active_machines: 71, machines_in_play: 0, machines_stale: 71, registered_machines: 71,
  }));
  assert.equal(r.ok, true, 'posture must partition the observed active population');
  assert.ok(r.checks.find((c) => c.name === 'player-posture-vs-active')?.ok);
  assert.ok(r.checks.find((c) => c.name === 'machine-posture-vs-active')?.ok);
});

test('flags a broken player posture (postures do not sum to active players)', () => {
  const r = reconcileOperatorKpi(kpi({ active_players: 151, players_active_now: 0, players_idle: 0, players_stale: 0 }));
  assert.equal(r.ok, false);
  const c = r.checks.find((x) => x.name === 'player-posture-vs-active');
  assert.equal(c.expected, 151);
  assert.equal(c.actual, 0);
});

test('flags a broken machine posture (postures do not sum to active machines)', () => {
  const r = reconcileOperatorKpi(kpi({ active_machines: 71, machines_in_play: 0, machines_stale: 0 }));
  assert.equal(r.ok, false);
  assert.ok(r.checks.find((x) => x.name === 'machine-posture-vs-active' && !x.ok));
});

test('mapAggregates surfaces player & machine posture from the projection row', () => {
  const agg = mapAggregates({
    active_players: 10, active_sessions: 4, idle_sessions: 0, stale_sessions: 6, open_sessions: 10,
    players_active_now: 4, players_idle: 2, players_stale: 4,
    active_machines: 8, machines_in_play: 3, machines_stale: 5, registered_machines: 10,
    total_wagered: 0, total_won: 0, ggr: 0,
    risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0, risk_unclassified: 10, last_event_at: null,
  });
  assert.equal(agg.playersActiveNow + agg.playersIdle + agg.playersStale, agg.activePlayers);
  assert.equal(agg.machinesInPlay + agg.machinesStale, agg.activeMachines);
  assert.equal(agg.registeredMachines, 10);
});

test('shapeKpi passes player & machine posture through unchanged (no recompute)', () => {
  const aggregates = {
    activePlayers: 10, activeSessions: 4, idleSessions: 0, staleSessions: 6, openSessions: 10,
    playersActiveNow: 4, playersIdle: 2, playersStale: 4,
    activeMachines: 8, machinesInPlay: 3, machinesStale: 5, registeredMachines: 10,
    totalWagered: 0, totalWon: 0, ggr: 0,
    riskCritical: 0, riskHigh: 0, riskMedium: 0, riskLow: 0, riskUnclassified: 10, lastEventAt: null,
  };
  const view = shapeKpi({ casinoAggregates: () => ({ ...aggregates }) }, []);
  assert.equal(view.players_active_now, 4);
  assert.equal(view.players_stale, 4);
  assert.equal(view.machines_in_play, 3);
  assert.equal(view.registered_machines, 10);
  assert.equal(reconcileOperatorKpi(view).ok, true);
});
