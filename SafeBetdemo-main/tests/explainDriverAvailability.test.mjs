// UAT-OP-1 P0-2 — explanations are derived from THIS player's drivers, and are
// explicit when no drivers exist (rather than emitting identical generic text).
import test from 'node:test';
import assert from 'node:assert/strict';
import { explainPlayer } from '../lib/consumerPlatform/explain.ts';

const base = (over = {}) => ({
  playerId: 'SB-PLR-X', casinoId: 'c1',
  player: null, intelligence: null, decisions: [], events: [],
  ...over,
});

function intel(escalation, extra = {}) {
  return { risk: { escalationLevel: escalation, dynamicRiskScore: 0, riskConfidence: 0.5, riskTrend: 'stable' }, ...extra };
}

test('no intelligence -> insufficient, explicit, not generic', () => {
  const e = explainPlayer(base());
  assert.equal(e.driverAvailability, 'insufficient');
  assert.match(e.summary.headline, /no certified intelligence/i);
  assert.ok(e.driverNote);
});

test('intelligence present but no drivers and no risk -> insufficient (honest)', () => {
  const e = explainPlayer(base({ intelligence: intel('none') }));
  assert.equal(e.driverAvailability, 'insufficient');
  assert.match(e.summary.headline, /no risk drivers on record/i);
});

test('HIGH-risk player with drivers -> present, driver-derived', () => {
  const e = explainPlayer(base({
    playerId: 'SB-PLR-HIGH',
    intelligence: intel('elevated', { behaviour: { chasingLossIndicator: true, patterns: ['rapid_betting'] } }),
    player: { riskScore: 72, riskFlags: ['loss_chasing'], totalWagered: 5000, totalWon: 1200, betCount: 300, interventionCount: 1, lastInterventionAt: null, requiresMonitoring: true },
  }));
  assert.equal(e.driverAvailability, 'present');
  assert.equal(e.summary.riskLevel, 'elevated');
  const drivers = [...e.contributingIndicators.behavioural].map(i => i.indicator);
  assert.ok(drivers.includes('loss-chasing'));
  assert.ok(drivers.includes('rapid_betting'));
});

test('CRITICAL and LOW players get materially DIFFERENT explanations', () => {
  const critical = explainPlayer(base({
    playerId: 'SB-PLR-CRIT',
    intelligence: intel('critical', { behaviour: { chasingLossIndicator: true, patterns: ['loss_chasing_flagged', 'extended_session'] } }),
    player: { riskScore: 95, riskFlags: ['loss_chasing'], totalWagered: 90000, totalWon: 8000, betCount: 4000, interventionCount: 3, lastInterventionAt: '2026-08-01', requiresMonitoring: true },
  }));
  const low = explainPlayer(base({ playerId: 'SB-PLR-LOW', intelligence: intel('none') }));
  assert.notEqual(critical.summary.headline, low.summary.headline);
  assert.notEqual(critical.driverAvailability, low.driverAvailability);
  assert.notEqual(critical.summary.riskLevel, low.summary.riskLevel);
  assert.ok(critical.contributingIndicators.behavioural.length > 0);
  assert.equal(low.contributingIndicators.behavioural.length, 0);
});

test('same input -> stable explanation (no cross-call drift; headline deterministic)', () => {
  const inp = base({ intelligence: intel('watch', { behaviour: { patterns: ['rapid_betting'] } }) });
  const a = explainPlayer(inp), b = explainPlayer(inp);
  assert.equal(a.summary.headline, b.summary.headline);
  assert.equal(a.driverAvailability, b.driverAvailability);
  assert.deepEqual(a.contributingIndicators.behavioural.map(i => i.indicator),
                   b.contributingIndicators.behavioural.map(i => i.indicator));
});

test('two different players never share the same explanation object (no cache leak by construction)', () => {
  const p1 = explainPlayer(base({ playerId: 'SB-PLR-1', intelligence: intel('elevated', { behaviour: { patterns: ['rapid_betting'] } }) }));
  const p2 = explainPlayer(base({ playerId: 'SB-PLR-2', intelligence: intel('none') }));
  assert.notEqual(p1.playerId, p2.playerId);
  assert.notEqual(p1.summary.headline, p2.summary.headline);
});
