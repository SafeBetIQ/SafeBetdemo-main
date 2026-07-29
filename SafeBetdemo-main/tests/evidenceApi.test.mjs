// Certified Evidence API — shared framework.
// Run: node --test tests/evidenceApi.test.mjs
//
// Covers the security + integrity invariants of the evidence framework:
// narrow-only scope, pagination that never changes aggregates, CSV
// formula-injection safety, and per-domain reconciliation (which must match the
// dashboard cards). The edge function does the JWT-scoped DB reads; these test
// the pure framework it calls.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePagination, narrowCasinoScope, buildEnvelope, EvidenceError,
  reconcileSession, reconcilePlayer, reconcileMachine, reconcileFinancial,
  csvCell, toCsv, MAX_PAGE_SIZE,
} from '../lib/consumerPlatform/index.ts';

const CASINO = 'a1b2c3d4-0000-0000-0000-000000000001';
const OTHER = 'cc000001-0000-0000-0000-000000000001';

test('scope narrowing: a matching casino is allowed, a different one is denied', () => {
  assert.equal(narrowCasinoScope(CASINO, null), CASINO);
  assert.equal(narrowCasinoScope(CASINO, CASINO), CASINO);
  assert.throws(() => narrowCasinoScope(CASINO, OTHER), (e) => e instanceof EvidenceError && e.status === 403);
});

test('pagination validates and rejects an unbounded/oversized request', () => {
  assert.deepEqual(validatePagination(2, 25), { page: 2, pageSize: 25, offset: 25 });
  assert.throws(() => validatePagination(1, MAX_PAGE_SIZE + 1), /exceeds maximum/);
  assert.throws(() => validatePagination(0, 25), /page must be/);
});

test('pagination never changes aggregate totals (aggregates come from the full set)', () => {
  const aggregates = { active_sessions: 0, idle_sessions: 0, stale_sessions: 152, open_sessions: 152 };
  const p1 = buildEnvelope({ scope: {}, snapshot: {}, reconciliation: { status: 'passed', checks: [] }, filters: {}, page: 1, pageSize: 25, totalRecords: 152, aggregates, records: new Array(25).fill({}), correlationId: 'c' });
  const p2 = buildEnvelope({ scope: {}, snapshot: {}, reconciliation: { status: 'passed', checks: [] }, filters: {}, page: 2, pageSize: 25, totalRecords: 152, aggregates, records: new Array(25).fill({}), correlationId: 'c' });
  assert.deepEqual(p1.aggregates, p2.aggregates, 'aggregates identical across pages');
  assert.equal(p1.pagination.totalRecords, p2.pagination.totalRecords);
  assert.equal(p1.pagination.totalPages, 7); // ceil(152/25)
});

test('CSV formula injection is neutralised and delimiters are quoted', () => {
  assert.equal(csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(csvCell('+1'), "'+1");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('he"llo'), '"he""llo"');
  const csv = toCsv(['a', 'b'], [{ a: '=cmd', b: 'ok' }]);
  assert.equal(csv, "a,b\n'=cmd,ok");
});

test('session reconciliation matches the dashboard invariant', () => {
  assert.equal(reconcileSession({ active_sessions: 0, idle_sessions: 0, stale_sessions: 152, open_sessions: 152 }).status, 'passed');
  assert.equal(reconcileSession({ active_sessions: 0, idle_sessions: 0, stale_sessions: 0, open_sessions: 152 }).status, 'failed');
});

test('player reconciliation covers both posture and risk invariants', () => {
  const ok = reconcilePlayer({ active_players: 151, players_active_now: 0, players_idle: 0, players_stale: 151, risk_critical: 0, risk_high: 11, risk_medium: 57, risk_low: 83, risk_unclassified: 0 });
  assert.equal(ok.status, 'passed');
  assert.equal(ok.checks.length, 2);
});

test('machine reconciliation matches the certified invariant', () => {
  assert.equal(reconcileMachine({ active_machines: 71, machines_in_play: 0, machines_stale: 71 }).status, 'passed');
});

test('financial reconciliation: GGR identity + synthetic split + unsupported-null', () => {
  const ok = reconcileFinancial({
    financial_data_status: 'partial', stakes_today: 1800, player_winnings_today: 680, ggr_today: 1120,
    financial_events_total: 8, synthetic_event_count: 6, non_synthetic_event_count: 2,
    voids_supported: false, voided_bets_today: null, reversals_supported: false, reversed_transactions_today: null,
  });
  assert.equal(ok.status, 'passed');
  const bad = reconcileFinancial({
    financial_data_status: 'partial', stakes_today: 1800, player_winnings_today: 680, ggr_today: 1120,
    financial_events_total: 8, synthetic_event_count: 6, non_synthetic_event_count: 2,
    voids_supported: false, voided_bets_today: 0, // unsupported presented as 0 → violation
  });
  assert.equal(bad.status, 'failed');
  assert.equal(reconcileFinancial({ financial_data_status: 'unavailable' }).status, 'unavailable');
});
