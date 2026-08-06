// Certified financial-rollup contract (pure). Exact DB parity vs
// projection_financial_posture is proven separately by live SQL.
//   node --test tests/financialRollup.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollupFreshness, registeredIsStale, ggr, unsupportedValue, capabilityStatus, dataMode,
  sastDayStartUtcMs, sastBoundaryIsHourAligned, financialSectionValid,
} from '../lib/financialRollup.ts';

test('rollup freshness thresholds (never Current just because a job exists)', () => {
  const now = 1_000_000_000_000;
  assert.equal(rollupFreshness(null, now), 'Unknown');
  assert.equal(rollupFreshness(now - 60_000, now), 'Current');       // 1 min
  assert.equal(rollupFreshness(now - 5 * 60_000, now), 'Delayed');   // 5 min
  assert.equal(rollupFreshness(now - 14 * 60_000, now), 'Delayed');
  assert.equal(rollupFreshness(now - 15 * 60_000, now), 'Stale');    // 15 min
});

test('registered staleness uses the configured threshold', () => {
  const now = 1_000_000_000_000;
  assert.equal(registeredIsStale(now - 8, now), false);
  assert.equal(registeredIsStale(now - 7 * 3600_000, now, 21600), true);   // >6h
  assert.equal(registeredIsStale(null, now), true);
});

test('GGR = settled stakes − player winnings', () => {
  assert.equal(Math.round(ggr(344485.29, 250093.33) * 100) / 100, 94391.96);
  assert.equal(ggr(0, 0), 0);
  assert.equal(ggr(1000, 720), 280);
});

test('unsupported categories are NULL, never 0 (unless supported)', () => {
  assert.equal(unsupportedValue(false), null);   // unsupported → null
  assert.equal(unsupportedValue(true), 0);        // supported → 0 (no such events)
});

test('capability status: partial unless voids AND reversals supported', () => {
  assert.equal(capabilityStatus(0, false, false), 'unavailable');
  assert.equal(capabilityStatus(100, false, false), 'partial');
  assert.equal(capabilityStatus(100, true, false), 'partial');
  assert.equal(capabilityStatus(100, true, true), 'healthy');
});

test('data mode reflects synthetic disclosure', () => {
  assert.equal(dataMode(0, 0, 0), 'unavailable');
  assert.equal(dataMode(100, 100, 0), 'synthetic');
  assert.equal(dataMode(100, 0, 100), 'live');
  assert.equal(dataMode(100, 50, 50), 'mixed');
});

test('SAST boundaries are hour-aligned (UTC+2) so whole hourly buckets sum exactly', () => {
  assert.equal(sastBoundaryIsHourAligned(), true);
  // SAST midnight = 22:00 UTC the previous day → minutes/seconds are zero.
  const now = Date.UTC(2026, 7, 6, 6, 18, 59);        // 2026-08-06 06:18:59 UTC = 08:18:59 SAST
  const dayStart = sastDayStartUtcMs(now);
  assert.equal(new Date(dayStart).getUTCMinutes(), 0);
  assert.equal(new Date(dayStart).getUTCHours(), 22);  // 22:00 UTC = 00:00 SAST
});

test('financial section contract has the required fields', () => {
  const ok = { currency: 'ZAR', ggr_today: 100, status: 'partial', is_simulated: true, snapshot_at: 't', source: 'rollup', freshness: 'Current', rollup_version: 1 };
  assert.equal(financialSectionValid(ok), true);
  const missing = { ...ok }; delete missing.freshness;
  assert.equal(financialSectionValid(missing), false);
  assert.equal(financialSectionValid(null), false);
});
