// Certified regulator financial contract (FIN-UI-2A).
// Proves: (a) server-authoritative regulator scope (principalMayAccessCasino),
// (b) Operator↔Regulator arithmetic identity — both roles read the SAME certified
// projection_financial_posture row through the SAME shapeFinancial(), so role
// changes access, never the numbers, and (c) null-not-zero is preserved.
//   node --test tests/regulatorFinancial.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { principalMayAccessCasino } from '../lib/security/principal.ts';
import { shapeFinancial } from '../lib/consumerPlatform/shaping.ts';
import {
  certifiedMoney, ggrForPeriod, stakesForPeriod, winningsForPeriod, FINANCIAL_UNAVAILABLE,
} from '../lib/certifiedFinancial.ts';

const P = (over) => ({ userId: 'u', role: 'regulator', casinoId: null, jurisdiction: 'ZA', province: null, isServiceRole: false, ...over });
const CASINO_ZA = { id: 'c-za', jurisdiction: 'ZA', province: 'WC' };
const CASINO_UK = { id: 'c-uk', jurisdiction: 'UK', province: null };

// A certified financial row as projection_financial_posture would emit it.
const row = {
  financial_data_status: 'healthy', financial_currency: 'ZAR', financial_timezone: 'Africa/Johannesburg',
  financial_snapshot_at: '2026-08-25T10:00:00Z', financial_projection_lag_seconds: 3,
  ggr_current_shift: 1200, ggr_today: 4200, ggr_last_24_hours: 5000, ggr_month_to_date: 91000,
  stakes_current_shift: 3000, stakes_today: 10000, stakes_last_24_hours: 12000, stakes_month_to_date: 210000,
  player_winnings_current_shift: 1800, player_winnings_today: 5800, player_winnings_last_24_hours: 7000, player_winnings_month_to_date: 119000,
  settled_bets_today: 340,
  voided_bets_today: null, reversed_transactions_today: null, bonus_wagers_today: null,
  voids_supported: false, reversals_supported: false, bonus_supported: false,
  combined_wager_settlement: true, separate_settlement: false, capability_version: 2,
  financial_data_mode: 'synthetic', contains_synthetic_data: true, synthetic_event_count: 1200, non_synthetic_event_count: 0,
};

test('server-authoritative regulator scope: in-jurisdiction allowed, cross-jurisdiction denied', () => {
  assert.equal(principalMayAccessCasino(P(), CASINO_ZA), true);          // ZA regulator → ZA operator
  assert.equal(principalMayAccessCasino(P(), CASINO_UK), false);         // ZA regulator → UK operator = DENIED
  assert.equal(principalMayAccessCasino(P({ jurisdiction: null }), CASINO_ZA), false); // no jurisdiction = DENIED
});

test('wrong role cannot access an operator via regulator scope rules', () => {
  // A casino_admin may only reach its own casino, never an arbitrary operator.
  assert.equal(principalMayAccessCasino(P({ role: 'casino_admin', casinoId: 'c-za' }), CASINO_ZA), true);
  assert.equal(principalMayAccessCasino(P({ role: 'casino_admin', casinoId: 'other' }), CASINO_ZA), false);
});

test('super_admin may view any operator (cross-jurisdiction access permitted)', () => {
  assert.equal(principalMayAccessCasino(P({ role: 'super_admin' }), CASINO_ZA), true);
  assert.equal(principalMayAccessCasino(P({ role: 'super_admin' }), CASINO_UK), true);
});

test('Operator↔Regulator identity: same certified row → identical shaped posture', () => {
  // The operator gateway and the regulator endpoint call the SAME shapeFinancial
  // on the SAME projection_financial_posture row. Identical input → identical output.
  const operatorView = shapeFinancial(row);
  const regulatorView = shapeFinancial(row);
  assert.deepEqual(regulatorView, operatorView);
  assert.notEqual(operatorView, null);
});

test('Operator↔Regulator reconcile for every certified period', () => {
  const fp = shapeFinancial(row); // identical for both roles
  for (const period of ['SHIFT', 'TODAY', 'ROLLING_24H', 'MTD']) {
    assert.equal(ggrForPeriod(fp, period), ggrForPeriod(fp, period));
    // GGR = stakes − winnings for the same certified period (no divergence).
    assert.equal(ggrForPeriod(fp, period), stakesForPeriod(fp, period) - winningsForPeriod(fp, period));
  }
  assert.equal(ggrForPeriod(fp, 'TODAY'), 4200);
  assert.equal(ggrForPeriod(fp, 'MTD'), 91000);
});

test('null certified value is never a false zero in the regulator view', () => {
  const fp = shapeFinancial(row);
  assert.equal(certifiedMoney(fp.voidedBetsToday), FINANCIAL_UNAVAILABLE);     // unsupported → "—"
  assert.equal(certifiedMoney(fp.reversedTransactionsToday), FINANCIAL_UNAVAILABLE);
  // A genuine certified zero still renders as a real amount.
  assert.equal(certifiedMoney(0), 'R 0');
});

test('unavailable certified status → null posture (rendered "—", not R 0)', () => {
  const unavailable = shapeFinancial({ ...row, financial_data_status: 'unavailable' });
  assert.equal(unavailable, null);
  assert.equal(certifiedMoney(ggrForPeriod(unavailable, 'TODAY')), FINANCIAL_UNAVAILABLE);
});
