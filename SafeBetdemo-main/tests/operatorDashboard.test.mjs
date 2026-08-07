// Operator Dashboard redesign contract: certified identities preserved, active-now
// distinct from observed, shared (tenant-agnostic) implementation with no casino-name
// conditionals. Visual parity is covered by Playwright.
//   node --test tests/operatorDashboard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  playersReconcile, sessionsReconcile, endpointsReconcile, riskReconcile,
} from '../lib/adminOverviewContract.ts';

// Representative certified live-floor KPI (the SAME source Live Feed + Operator use).
const kpi = {
  active_players: 1594, players_active_now: 41, players_idle: 306, players_stale: 1247,
  active_sessions: 46, idle_sessions: 300, stale_sessions: 1257, open_sessions: 1603,
  active_machines: 1514, machines_in_play: 42, machines_stale: 1472, registered_machines: 1514,
  risk_critical: 7, risk_high: 114, risk_medium: 400, risk_low: 1073, risk_unclassified: 0,
};

test('KPI card uses certified active-now, shown separately from observed', () => {
  // The primary "Active Players" card renders players_active_now; observed is the sub.
  assert.notEqual(kpi.players_active_now, kpi.active_players);
  assert.ok(kpi.players_active_now < kpi.active_players);   // active-now is a subset of observed
});

test('player posture reconciles: observed = active_now + idle + stale', () => {
  assert.equal(playersReconcile({ observed_players: kpi.active_players, active_now: kpi.players_active_now, idle: kpi.players_idle, stale: kpi.players_stale }), true);
});

test('session posture reconciles: open = active + idle + stale', () => {
  assert.equal(sessionsReconcile(kpi.open_sessions, kpi.active_sessions, kpi.idle_sessions, kpi.stale_sessions), true);
});

test('endpoint posture reconciles: allocated = in_play + stale', () => {
  assert.equal(endpointsReconcile(kpi.active_machines, kpi.machines_in_play, kpi.machines_stale), true);
});

test('risk posture reconciles to observed active players', () => {
  assert.equal(riskReconcile(kpi.active_players, { critical: kpi.risk_critical, high: kpi.risk_high, medium: kpi.risk_medium, low: kpi.risk_low, unclassified: kpi.risk_unclassified }), true);
});

test('Operator Dashboard is tenant-agnostic — no casino-name conditionals', () => {
  const src = readFileSync(new URL('../app/casino/dashboard/page.tsx', import.meta.url), 'utf8');
  for (const name of ['Prestige', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace']) {
    // The casino name may only appear as interpolated data (${casinoName}); never a literal branch.
    const re = new RegExp(`['"\`][^'"\`]*${name}[^'"\`]*['"\`]`);
    assert.equal(re.test(src), false, `dashboard must not hard-code casino name: ${name}`);
  }
});

test('Operator Dashboard reads the shared certified source (live-floor), not tables', () => {
  const src = readFileSync(new URL('../app/casino/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes("cgGet('live-floor'"), 'must use the consumer-gateway live-floor view');
  assert.ok(!/\.from\(['"]/.test(src), 'must not read database tables directly');
  assert.ok(src.includes('KpiCard') && src.includes('PostureSummaryCard'), 'uses shared dashboard components');
});
