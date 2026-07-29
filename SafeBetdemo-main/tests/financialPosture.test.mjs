// Certified period-scoped GGR & financial posture.
// Run: node --test tests/financialPosture.test.mjs
//
// GGR = settled stakes − player winnings, per period, from the certified
// financial event log. These tests cover the passthrough shaper and the
// read-only financial reconciliation validator (period windowing, timezone and
// currency are enforced by the certified projection_financial_posture view).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reconcileFinancialPosture } from '../lib/consumerPlatform/index.ts';
import { shapeFinancial } from '../lib/consumerPlatform/shaping.ts';

// A projection_financial_posture row (Prestige, post-seed shape). The demo
// source is a combined wager+settlement record with NO void/reversal/bonus
// observability → status partial, those categories null, synthetic disclosed.
function row(o = {}) {
  return {
    financial_currency: 'ZAR', financial_timezone: 'Africa/Johannesburg',
    financial_data_status: 'partial', financial_data_mode: 'mixed',
    financial_snapshot_at: '2026-07-28T12:00:00Z', financial_projection_lag_seconds: 0,
    ggr_current_shift: 570, ggr_today: 1120, ggr_last_24_hours: 1120, ggr_month_to_date: 1590,
    stakes_current_shift: 750, stakes_today: 1800, stakes_last_24_hours: 1800, stakes_month_to_date: 2670,
    player_winnings_current_shift: 180, player_winnings_today: 680, player_winnings_last_24_hours: 680, player_winnings_month_to_date: 1080,
    settled_bets_today: 4, voided_bets_today: null, reversed_transactions_today: null, bonus_wagers_today: null,
    voids_supported: false, reversals_supported: false, bonus_supported: false,
    combined_wager_settlement: true, separate_settlement: false, capability_version: 1,
    financial_events_total: 8, synthetic_event_count: 6, non_synthetic_event_count: 2, contains_synthetic_data: true,
    ...o,
  };
}

test('a settled losing wager increases GGR; a win subtracts winnings (identity holds)', () => {
  const f = shapeFinancial(row());
  assert.equal(f.ggrToday, f.stakesToday - f.playerWinningsToday); // 1800 - 680 = 1120
  assert.equal(reconcileFinancialPosture(f).ok, true);
});

test('period windows are distinct (shift ≤ today ≤ month-to-date)', () => {
  const f = shapeFinancial(row());
  assert.ok(f.ggrCurrentShift <= f.ggrToday && f.ggrToday <= f.ggrMonthToDate);
});

test('negative GGR (winnings exceed stakes) reconciles correctly', () => {
  const f = shapeFinancial(row({ ggr_today: -350, stakes_today: 600, player_winnings_today: 950 }));
  assert.equal(f.ggrToday, -350);
  assert.equal(reconcileFinancialPosture(f).ok, true, '-350 = 600 - 950');
});

test('the GGR identity validator flags a mismatch (no silent overwrite)', () => {
  const f = shapeFinancial(row({ ggr_today: 9999 }));
  const r = reconcileFinancialPosture(f);
  assert.equal(r.ok, false);
  assert.ok(r.checks.find((c) => c.name === 'ggr-identity-today' && !c.ok));
});

test('unavailable financial data is null (rendered as “—”), never a false zero', () => {
  assert.equal(shapeFinancial(row({ financial_data_status: 'unavailable' })), null);
  assert.equal(shapeFinancial(null), null);
  const r = reconcileFinancialPosture(null);
  assert.equal(r.status, 'unavailable');
  assert.equal(r.ok, false);
});

test('currency is preserved from the certified projection', () => {
  assert.equal(shapeFinancial(row({ financial_currency: 'ZAR' })).currency, 'ZAR');
});

test('unsupported void/reversal/bonus render as null (NOT a certified zero)', () => {
  const f = shapeFinancial(row());
  assert.equal(f.voidedBetsToday, null);
  assert.equal(f.reversedTransactionsToday, null);
  assert.equal(f.bonusWagersToday, null);
  assert.equal(f.voidsSupported, false);
  assert.equal(f.reversalsSupported, false);
  assert.equal(f.settledBetsToday, 4);
  assert.equal(reconcileFinancialPosture(f).ok, true, 'null unsupported values reconcile');
});

test('the validator flags an unsupported category presented as a numeric zero', () => {
  // A source that cannot observe voids but reports 0 is a semantic violation.
  const f = shapeFinancial(row({ voided_bets_today: 0 })); // voids_supported still false
  const r = reconcileFinancialPosture(f);
  assert.equal(r.ok, false);
  assert.ok(r.checks.find((c) => c.name === 'unsupported-values-are-null' && !c.ok));
});

test('BET_PLACED combined-record source yields Partial status, not Healthy', () => {
  const f = shapeFinancial(row());
  assert.equal(f.status, 'partial');
  assert.equal(f.combinedWagerSettlement, true);
  assert.equal(f.separateSettlement, false);
});

test('synthetic contribution is disclosed and reconciles to the total', () => {
  const f = shapeFinancial(row());
  assert.equal(f.containsSyntheticData, true);
  assert.equal(f.dataMode, 'mixed');
  assert.equal(f.syntheticEventCount + f.nonSyntheticEventCount, 8);
  assert.equal(f.syntheticEventCount, 6);
  assert.equal(f.nonSyntheticEventCount, 2);
});

test('a fully-capable reconciled source is permitted to be Healthy with zero voids', () => {
  const f = shapeFinancial(row({
    financial_data_status: 'healthy', voids_supported: true, reversals_supported: true,
    voided_bets_today: 0, reversed_transactions_today: 0,
  }));
  assert.equal(f.status, 'healthy');
  assert.equal(f.voidedBetsToday, 0); // 0 is certified here because voids ARE observable
  assert.equal(reconcileFinancialPosture(f).ok, true);
});
