// UAT-OP-5 P2-1 — onboarding trial/licence countdown never shows negative days.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDaysRemaining, daysRemainingTone } from '../lib/commercial/trialCountdown.ts';

test('future days -> "N days remaining"', () => {
  assert.equal(formatDaysRemaining(15), '15 days remaining');
  assert.equal(daysRemainingTone(15), 'ok');
});
test('within a week -> warn tone', () => {
  assert.equal(formatDaysRemaining(5), '5 days remaining');
  assert.equal(daysRemainingTone(5), 'warn');
});
test('exactly 1 day -> singular', () => {
  assert.equal(formatDaysRemaining(1), '1 day remaining');
});
test('today (0) -> "Ends today", not "0 days"', () => {
  assert.equal(formatDaysRemaining(0), 'Ends today');
  assert.equal(daysRemainingTone(0), 'expired');
});
test('expired (negative) -> "Trial expired", NEVER negative days', () => {
  assert.equal(formatDaysRemaining(-15), 'Trial expired');
  assert.doesNotMatch(formatDaysRemaining(-15), /-?\d/);
  assert.equal(daysRemainingTone(-15), 'expired');
});
test('null/NaN -> honest unknown', () => {
  assert.equal(formatDaysRemaining(null), 'Expiry unknown');
  assert.equal(formatDaysRemaining(undefined), 'Expiry unknown');
  assert.equal(formatDaysRemaining(NaN), 'Expiry unknown');
});
