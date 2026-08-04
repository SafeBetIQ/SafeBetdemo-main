// Demo simulator GOVERNANCE contract (mirrors the SQL enforcement).
//   node --test tests/demoSimGovernance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_SIM_LIMITS, volumeMode, boundedNeed, showcaseDecision, cappedExpiryMinutes,
  storageState, overallHealth, snapshotAge,
} from '../lib/demoSimGovernance.ts';

test('daily volume gate: normal / warning(reduced) / hardstop thresholds', () => {
  assert.equal(volumeMode(10000), 'normal');
  assert.equal(volumeMode(DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_WARNING), 'reduced');
  assert.equal(volumeMode(DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_WARNING + 1), 'reduced');
  assert.equal(volumeMode(DEMO_SIM_LIMITS.SIM_EVENTS_PER_DAY_HARDSTOP), 'hardstop');
  assert.equal(volumeMode(999999), 'hardstop');
});

test('per-casino need bounded by per-casino cap and remaining tick budget', () => {
  assert.equal(boundedNeed(1000, 1000), DEMO_SIM_LIMITS.MAX_SIM_EVENTS_PER_CASINO_PER_TICK); // 250 cap
  assert.equal(boundedNeed(200, 40), 40);   // tick budget binds
  assert.equal(boundedNeed(5, 999), 5);     // small need passes
  assert.equal(boundedNeed(50, 0), 0);      // no budget => none
});

test('showcase: first activation accepted, repeat within cooldown does not extend', () => {
  const base = { showcaseEnabled: true, isRegulator: false, activationsLastHour: 0, activeWindowCount: 1 };
  assert.equal(showcaseDecision({ ...base, hasActiveWindow: false, minutesSinceActivation: 0 }), 'accepted');
  assert.equal(showcaseDecision({ ...base, hasActiveWindow: true, minutesSinceActivation: 3 }), 'cooldown');
  assert.equal(showcaseDecision({ ...base, hasActiveWindow: true, minutesSinceActivation: 20 }), 'extended');
});

test('showcase: casino vs regulator activation-per-hour limits', () => {
  const casino = { showcaseEnabled: true, isRegulator: false, hasActiveWindow: false, minutesSinceActivation: 0, activeWindowCount: 1 };
  assert.equal(showcaseDecision({ ...casino, activationsLastHour: 3 }), 'rate_limited'); // limit 3
  assert.equal(showcaseDecision({ ...casino, activationsLastHour: 2 }), 'accepted');
  const reg = { ...casino, isRegulator: true };
  assert.equal(showcaseDecision({ ...reg, activationsLastHour: 2 }), 'rate_limited');    // limit 2
  assert.equal(showcaseDecision({ ...reg, activationsLastHour: 1 }), 'accepted');
});

test('showcase: max concurrent windows and disabled flag', () => {
  const base = { showcaseEnabled: true, isRegulator: false, hasActiveWindow: false, minutesSinceActivation: 0, activationsLastHour: 0 };
  assert.equal(showcaseDecision({ ...base, activeWindowCount: DEMO_SIM_LIMITS.MAX_ACTIVE_SHOWCASE_WINDOWS }), 'max_windows');
  assert.equal(showcaseDecision({ ...base, activeWindowCount: 0, showcaseEnabled: false }), 'disabled');
});

test('extension is capped at max-minutes from original activation (no indefinite extend)', () => {
  // casino cap 45: at 40 min in, a 30-min request can only add 5.
  assert.equal(cappedExpiryMinutes(40, 30, false), 5);
  assert.equal(cappedExpiryMinutes(0, 30, false), 30);
  assert.equal(cappedExpiryMinutes(50, 30, false), 0);  // already past cap
  assert.equal(cappedExpiryMinutes(50, 30, true), 10);  // regulator cap 60
});

test('storage state warn/critical thresholds', () => {
  assert.equal(storageState(100), 'ok');
  assert.equal(storageState(DEMO_SIM_LIMITS.STORAGE_INTERNAL_ALLOC_MB * 0.72), 'warning');
  assert.equal(storageState(DEMO_SIM_LIMITS.STORAGE_INTERNAL_ALLOC_MB * 0.90), 'critical');
});

test('overall health is never Healthy just because the cron exists', () => {
  const ok = { simulatorEnabled: true, lastSuccessfulTickMinutesAgo: 2, reconcilesAll: true, maxOpenAlertSeverity: 0, pctOfDailyHardstop: 5, eventsToday: 6000, storagePct: 4 };
  assert.equal(overallHealth(ok), 'Healthy');
  assert.equal(overallHealth({ ...ok, simulatorEnabled: false }), 'Disabled');
  assert.equal(overallHealth({ ...ok, lastSuccessfulTickMinutesAgo: null }), 'Unknown');
  assert.equal(overallHealth({ ...ok, lastSuccessfulTickMinutesAgo: 12 }), 'Critical');   // late tick
  assert.equal(overallHealth({ ...ok, reconcilesAll: false }), 'Critical');               // reconciliation fail
  assert.equal(overallHealth({ ...ok, maxOpenAlertSeverity: 3 }), 'Critical');            // critical alert
  assert.equal(overallHealth({ ...ok, pctOfDailyHardstop: 100 }), 'Critical');            // volume limit
  assert.equal(overallHealth({ ...ok, eventsToday: 80000 }), 'Warning');                  // volume warning
  assert.equal(overallHealth({ ...ok, storagePct: 72 }), 'Warning');                      // storage warning
  assert.equal(overallHealth({ ...ok, maxOpenAlertSeverity: 2 }), 'Warning');             // warning alert
});

test('snapshot age uses certified as_of and flags stale past threshold', () => {
  const now = 1_000_000_000_000;
  assert.deepEqual(snapshotAge(now - 18_000, now, 120), { ageSeconds: 18, stale: false });
  assert.equal(snapshotAge(now - 200_000, now, 120).stale, true);
  // stale threshold boundary
  assert.equal(snapshotAge(now - 120_000, now, 120).stale, false);
  assert.equal(snapshotAge(now - 121_000, now, 120).stale, true);
});
