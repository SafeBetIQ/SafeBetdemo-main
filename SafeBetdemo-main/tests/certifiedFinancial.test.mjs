// Certified financial PRESENTATION contract — one contract, many presentations.
// Proves the null-not-zero rule, ZAR formatting, SAST period selection, controlled
// status vocabulary, and Operator/Report reconciliation (same certified field →
// same rendered value on every screen).
//   node --test tests/certifiedFinancial.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINANCIAL_UNAVAILABLE, zar, certifiedMoney,
  FINANCIAL_PERIODS, ggrForPeriod, stakesForPeriod, winningsForPeriod,
  financialStatusLabel, financialStatusTone, financialCurrency, financialTimezone,
  syntheticDisclosure,
} from '../lib/certifiedFinancial.ts';

// A representative certified posture (mirrors projection_financial_posture →
// FinancialPostureView). voided/reversed/bonus are null = unsupported.
const fp = {
  currency: 'ZAR', timezone: 'Africa/Johannesburg', status: 'healthy',
  snapshotAt: '2026-08-24T10:00:00Z', projectionLagSeconds: 3,
  ggrCurrentShift: 1200, ggrToday: 4200, ggrLast24Hours: 5000, ggrMonthToDate: 91000,
  stakesCurrentShift: 3000, stakesToday: 10000, stakesLast24Hours: 12000, stakesMonthToDate: 210000,
  playerWinningsCurrentShift: 1800, playerWinningsToday: 5800, playerWinningsLast24Hours: 7000, playerWinningsMonthToDate: 119000,
  settledBetsToday: 340,
  voidedBetsToday: null, reversedTransactionsToday: null, bonusWagersToday: null,
  voidsSupported: false, reversalsSupported: false, bonusSupported: false,
  combinedWagerSettlement: true, separateSettlement: false, capabilityVersion: 2,
  containsSyntheticData: true, syntheticEventCount: 1200, nonSyntheticEventCount: 0, dataMode: 'synthetic',
};

test('RULE 1 — null certified value is never a false zero', () => {
  assert.equal(certifiedMoney(null), FINANCIAL_UNAVAILABLE);
  assert.equal(certifiedMoney(undefined), FINANCIAL_UNAVAILABLE);
  assert.equal(certifiedMoney(''), FINANCIAL_UNAVAILABLE);
  // The unsupported categories on the certified posture must render as "—".
  assert.equal(certifiedMoney(fp.voidedBetsToday), FINANCIAL_UNAVAILABLE);
  assert.equal(certifiedMoney(fp.reversedTransactionsToday), FINANCIAL_UNAVAILABLE);
});

test('a genuine certified zero renders as R 0, not "—"', () => {
  assert.equal(certifiedMoney(0), 'R 0');
  assert.equal(certifiedMoney(0, 2), 'R 0.00');
});

test('ZAR formatting: space thousands, decimals, sign preserved', () => {
  assert.equal(zar(4200), 'R 4 200');
  assert.equal(zar(1250430), 'R 1 250 430');
  assert.equal(zar(4200.5, 2), 'R 4 200.50');
  // A negative certified GGR (house net-loss) must keep its sign, not be hidden.
  assert.equal(zar(-1500), '-R 1 500');
  assert.equal(certifiedMoney(-1500.25, 2), '-R 1 500.25');
});

test('non-finite / non-numeric certified values are unavailable, not zero', () => {
  assert.equal(zar(NaN), FINANCIAL_UNAVAILABLE);
  assert.equal(zar('not-a-number'), FINANCIAL_UNAVAILABLE);
  assert.equal(zar(Infinity), FINANCIAL_UNAVAILABLE);
});

test('period selection returns the certified value for each SAST period', () => {
  assert.equal(ggrForPeriod(fp, 'TODAY'), 4200);
  assert.equal(ggrForPeriod(fp, 'SHIFT'), 1200);
  assert.equal(ggrForPeriod(fp, 'ROLLING_24H'), 5000);
  assert.equal(ggrForPeriod(fp, 'MTD'), 91000);
  assert.equal(stakesForPeriod(fp, 'TODAY'), 10000);
  assert.equal(winningsForPeriod(fp, 'MTD'), 119000);
  // GGR must equal certified stakes − winnings for the same period (no drift).
  assert.equal(ggrForPeriod(fp, 'TODAY'), stakesForPeriod(fp, 'TODAY') - winningsForPeriod(fp, 'TODAY'));
});

test('period selection on a null posture is unavailable (not zero)', () => {
  assert.equal(ggrForPeriod(null, 'TODAY'), null);
  assert.equal(certifiedMoney(ggrForPeriod(null, 'MTD')), FINANCIAL_UNAVAILABLE);
  assert.equal(FINANCIAL_PERIODS.length, 4);
});

test('RULE 3 — periods do not mix: each key maps to its own field', () => {
  const keys = FINANCIAL_PERIODS.map((p) => p.key);
  assert.deepEqual(keys, ['TODAY', 'SHIFT', 'ROLLING_24H', 'MTD']);
  const vals = keys.map((k) => ggrForPeriod(fp, k));
  assert.equal(new Set(vals).size, 4); // all distinct — no accidental aliasing
});

test('controlled status vocabulary only reflects real certified status', () => {
  assert.equal(financialStatusLabel({ ...fp, status: 'healthy' }), 'CERTIFIED');
  assert.equal(financialStatusLabel({ ...fp, status: 'partial' }), 'PARTIAL');
  assert.equal(financialStatusLabel({ ...fp, status: 'delayed' }), 'DELAYED');
  assert.equal(financialStatusLabel({ ...fp, status: 'degraded' }), 'DEGRADED');
  assert.equal(financialStatusLabel({ ...fp, status: 'unavailable' }), 'UNAVAILABLE');
  assert.equal(financialStatusLabel(null), 'UNAVAILABLE');
  assert.equal(financialStatusTone('CERTIFIED'), 'secondary');
  assert.equal(financialStatusTone('UNAVAILABLE'), 'destructive');
  assert.equal(financialStatusTone('PARTIAL'), 'default');
});

test('Operator dashboard and Reporting Centre reconcile (same source → same value)', () => {
  // The dashboard reads financial.ggrToday; the report reads ggrForPeriod(fp,'TODAY').
  // Same certified posture must yield the same rendered figure on both screens.
  const dashboardValue = certifiedMoney(fp.ggrToday);
  const reportValue = certifiedMoney(ggrForPeriod(fp, 'TODAY'));
  assert.equal(dashboardValue, reportValue);
  assert.equal(dashboardValue, 'R 4 200');
});

test('currency/timezone/synthetic disclosure come from the certified posture', () => {
  assert.equal(financialCurrency(fp), 'ZAR');
  assert.equal(financialTimezone(fp), 'Africa/Johannesburg');
  assert.equal(financialCurrency(null), 'ZAR');
  assert.match(syntheticDisclosure(fp), /Synthetic demo data/);
  assert.equal(syntheticDisclosure({ ...fp, containsSyntheticData: false }), null);
});
