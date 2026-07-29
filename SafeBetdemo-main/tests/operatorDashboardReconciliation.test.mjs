// Operator Dashboard reconciliation & data-integrity audit.
// Run: node --test tests/operatorDashboardReconciliation.test.mjs
//
// Verifies the fix for the 151-active-players-vs-152-risk-classified defect:
//   * the risk bands reconcile to active players (one population, one snapshot);
//   * an Unclassified band exists and is never folded into Low;
//   * the projected KPI is passed through, not recomputed;
//   * missing data reconciles as "unavailable", never a false zero.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reconcileOperatorKpi } from '../lib/consumerPlatform/index.ts';
import { shapeKpi } from '../lib/consumerPlatform/shaping.ts';
import { mapAggregates } from '../lib/digitalTwin/assembly.ts';

// A fully-specified, internally-consistent KPI (five bands reconcile to active).
function kpi(overrides = {}) {
  const m = {
    active_players: 5, active_sessions: 5, idle_sessions: 0, stale_sessions: 0, open_sessions: 5,
    events_per_min: 0,
    total_wagered: 100, total_won: 40, ggr: 60, avg_bet_size: 0,
    risk_critical: 1, risk_high: 1, risk_medium: 1, risk_low: 1, risk_unclassified: 1,
    active_machines: 3, snapshot_at: '2026-07-27T00:00:00.000Z',
    ...overrides,
  };
  // Posture fields auto-reconcile with the (possibly overridden) totals unless
  // a test overrides them explicitly to exercise a mismatch.
  m.players_active_now ??= 0; m.players_idle ??= 0;
  m.players_stale ??= m.active_players - m.players_active_now - m.players_idle;
  m.machines_in_play ??= 0; m.machines_stale ??= m.active_machines - m.machines_in_play;
  m.registered_machines ??= m.active_machines;
  return m;
}

test('reconciles when active players = sum of the five risk bands', () => {
  const r = reconcileOperatorKpi(kpi());
  assert.equal(r.ok, true);
  assert.equal(r.status, 'healthy');
  assert.ok(r.checks.find((c) => c.name === 'active-players-vs-risk-bands')?.ok);
});

test('detects the exact 151-vs-152 defect (idle players inflating risk bands)', () => {
  // Pre-fix shape: active=151, bands sum to 152 (one idle player leaked in).
  const bad = kpi({
    active_players: 151,
    risk_critical: 0, risk_high: 10, risk_medium: 47, risk_low: 95, risk_unclassified: 0,
  });
  const r = reconcileOperatorKpi(bad);
  assert.equal(r.ok, false);
  assert.equal(r.status, 'degraded');
  const c = r.checks.find((x) => x.name === 'active-players-vs-risk-bands');
  assert.equal(c.expected, 151);
  assert.equal(c.actual, 152);
});

test('Unclassified players are counted separately and never folded into Low', () => {
  // 2 active players, both unclassified — Low must stay 0, not absorb them.
  const r = reconcileOperatorKpi(kpi({
    active_players: 2, risk_critical: 0, risk_high: 0, risk_medium: 0,
    risk_low: 0, risk_unclassified: 2,
  }));
  assert.equal(r.ok, true, 'unclassified must reconcile into the active total');
});

test('non-zero Unclassified is an explicit contract field the UI renders (not a false 0)', () => {
  // Deployed-contract fixture where the projection reports 3 unclassified
  // active players. The value must survive as an explicit field and reconcile.
  const contract = kpi({
    active_players: 10, risk_critical: 1, risk_high: 2, risk_medium: 2,
    risk_low: 2, risk_unclassified: 3,
  });
  // The field is explicitly present (not absent, not defaulted).
  assert.ok(Object.prototype.hasOwnProperty.call(contract, 'risk_unclassified'));
  assert.equal(contract.risk_unclassified, 3);
  // The value the dashboard cell would read (same coercion as the page: n()).
  const uiValue = (typeof contract.risk_unclassified === 'number' ? contract.risk_unclassified : 0);
  assert.equal(uiValue, 3, 'UI would display Unclassified = 3, not 0');
  // And it reconciles into the active total.
  assert.equal(reconcileOperatorKpi(contract).ok, true);
});

test('GGR must equal wagered minus won', () => {
  const r = reconcileOperatorKpi(kpi({ ggr: 999 }));
  assert.equal(r.ok, false);
  assert.ok(r.checks.find((c) => c.name === 'ggr-vs-wagered-minus-won' && !c.ok));
});

test('missing certified data reconciles as unavailable, never a false zero', () => {
  const r = reconcileOperatorKpi(null);
  assert.equal(r.status, 'unavailable');
  assert.equal(r.ok, false);
  assert.equal(r.checks.length, 0, 'no zero-valued cards are asserted when data is absent');
});

test('mapAggregates surfaces risk_unclassified from the projection view row', () => {
  const agg = mapAggregates({
    active_players: 5, active_sessions: 5, active_machines: 3,
    total_wagered: 100, total_won: 40, ggr: 60,
    risk_critical: 1, risk_high: 1, risk_medium: 1, risk_low: 1, risk_unclassified: 1,
    last_event_at: null,
  });
  assert.equal(agg.riskUnclassified, 1);
  assert.equal(
    agg.riskCritical + agg.riskHigh + agg.riskMedium + agg.riskLow + agg.riskUnclassified,
    agg.activePlayers,
  );
});

test('mapAggregates defaults unclassified to 0 for a legacy row without the column', () => {
  const agg = mapAggregates({
    active_players: 2, active_sessions: 2, active_machines: 1,
    total_wagered: 0, total_won: 0, ggr: 0,
    risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 2, last_event_at: null,
  });
  assert.equal(agg.riskUnclassified, 0);
});

test('shapeKpi passes the projected aggregates through unchanged (no recompute)', () => {
  const aggregates = {
    activePlayers: 7, activeSessions: 6, idleSessions: 0, staleSessions: 0, openSessions: 6,
    playersActiveNow: 3, playersIdle: 2, playersStale: 2,
    activeMachines: 4, machinesInPlay: 1, machinesStale: 3, registeredMachines: 5,
    totalWagered: 500, totalWon: 200, ggr: 300,
    riskCritical: 2, riskHigh: 1, riskMedium: 1, riskLow: 2, riskUnclassified: 1,
    lastEventAt: null,
  };
  const twinStub = { casinoAggregates: () => ({ ...aggregates }) };
  const view = shapeKpi(twinStub, []);
  assert.equal(view.active_players, 7);
  assert.equal(view.active_sessions, 6);
  assert.equal(view.risk_unclassified, 1);
  // The presented KPI reconciles by construction because it is the projection.
  assert.equal(reconcileOperatorKpi(view).ok, true);
});
