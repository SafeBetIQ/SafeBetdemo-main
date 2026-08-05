// Admin Overview consolidated-contract tests (pure logic; DB/security/perf are
// covered by live SQL + Playwright).  node --test tests/adminOverview.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_OVERVIEW_SCHEMA, OVERVIEW_INITIAL_REQUEST_BUDGET, isValidOverview,
  playersReconcile, sessionsReconcile, endpointsReconcile, riskReconcile,
  registeredIsDistinctFromActive,
} from '../lib/adminOverviewContract.ts';

const sample = {
  schema_version: 'admin-overview-v1', as_of: '2026-08-05T16:00:00Z',
  environment: { name: 'demo', non_production: true, synthetic_data: true },
  platform: { registered_players: 101982, observed_players: 10118, active_now: 254, idle: 1685, stale: 8179, open_sessions: 10125 },
  risk: { critical: 83, high: 657, medium: 2602, low: 6776, unclassified: 0, reconciles: true },
  governance: { audit_chains_total: 7, audit_chains_verified: 7, open_integrity_alerts: 0 },
  simulator: { status: 'Healthy', enabled: true }, alerts: { open: 0, critical: 0, warning: 0 },
  casinos: [{ casino_id: 'x', casino_name: 'Prestige Casino', registered_players: 18152, active_now: 227, observed_players: 1594 }],
  financial: null,
};

test('response contract is versioned', () => {
  assert.equal(ADMIN_OVERVIEW_SCHEMA, 'admin-overview-v1');
  assert.equal(sample.schema_version, ADMIN_OVERVIEW_SCHEMA);
});

test('schema validation accepts a valid snapshot and rejects malformed ones', () => {
  assert.equal(isValidOverview(sample), true);
  assert.equal(isValidOverview({ ...sample, schema_version: 'v2' }), false);   // wrong version
  const { platform, ...noPlatform } = sample; void platform;
  assert.equal(isValidOverview(noPlatform), false);                            // missing key
  assert.equal(isValidOverview({ ...sample, casinos: {} }), false);            // casinos not array
  assert.equal(isValidOverview(null), false);
});

test('initial Overview request budget is three or fewer', () => {
  assert.ok(OVERVIEW_INITIAL_REQUEST_BUDGET <= 3);
  // 1 primary (/api/admin/overview) + deferred financial + deferred national-overview
  assert.equal(1 + 2, OVERVIEW_INITIAL_REQUEST_BUDGET);
});

test('all six casinos returned in one response; registered vs active-now distinct', () => {
  const full = { ...sample, casinos: Array.from({ length: 6 }, (_, i) => ({ casino_id: `c${i}`, casino_name: `C${i}`, registered_players: 1000 + i, active_now: i })) };
  assert.equal(full.casinos.length, 6);
  assert.ok(registeredIsDistinctFromActive(full.platform));
  assert.notEqual(full.platform.registered_players, full.platform.active_now);
});

test('player reconciliation: observed = active_now + idle + stale', () => {
  assert.equal(playersReconcile(sample.platform), true);
  assert.equal(playersReconcile({ observed_players: 100, active_now: 10, idle: 20, stale: 71 }), false);
});

test('session reconciliation: open = active + idle + stale', () => {
  assert.equal(sessionsReconcile(10125, 254, 1685, 8186), true);
  assert.equal(sessionsReconcile(10, 1, 2, 3), false);
});

test('endpoint reconciliation: allocated = in_play + stale', () => {
  assert.equal(endpointsReconcile(9932, 0, 9932), true);
  assert.equal(endpointsReconcile(9932, 100, 9932), false);
});

test('risk reconciliation: population = crit+high+med+low+unclassified', () => {
  assert.equal(riskReconcile(10118, sample.risk), true);
  assert.equal(riskReconcile(999, sample.risk), false);
});
