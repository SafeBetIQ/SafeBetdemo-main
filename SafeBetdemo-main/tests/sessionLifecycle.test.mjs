// Session lifecycle integrity — certified session posture.
// Run: node --test tests/sessionLifecycle.test.mjs
//
// Covers the fix for the 4,572-stale-active-sessions defect: session close
// semantics + evidence reason, idempotent close, and the certified session
// posture (active + idle + stale = open) reconciliation. Supersession and
// freshness classification are enforced by the certified projection (SQL
// trigger + posture view); these tests cover the TS contract + reducer + the
// read-only reconciliation validator.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reduceSession } from '../lib/projectionPlatform/reducers.ts';
import { newSessionState } from '../lib/projectionPlatform/readModels.ts';
import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { reconcileOperatorKpi } from '../lib/consumerPlatform/index.ts';
import { shapeKpi } from '../lib/consumerPlatform/shaping.ts';
import { mapAggregates } from '../lib/digitalTwin/assembly.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-859D2993145EFF36E3FC3986';

let seq = 0;
const evt = (o) => ({
  eventId: `e-${++seq}`, casinoId: CASINO, safeBetPlayerId: PLAYER,
  sessionId: 'session-1', machineId: 'M-001',
  occurredAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(), payload: {}, ...o,
});

function kpi(o = {}) {
  const m = {
    active_players: 5, active_sessions: 2, idle_sessions: 1, stale_sessions: 2, open_sessions: 5,
    events_per_min: 0, total_wagered: 100, total_won: 40, ggr: 60, avg_bet_size: 0,
    risk_critical: 1, risk_high: 1, risk_medium: 1, risk_low: 1, risk_unclassified: 1,
    active_machines: 3, snapshot_at: '2026-07-28T00:00:00.000Z', ...o,
  };
  m.players_active_now ??= 0; m.players_idle ??= 0;
  m.players_stale ??= m.active_players - m.players_active_now - m.players_idle;
  m.machines_in_play ??= 0; m.machines_stale ??= m.active_machines - m.machines_in_play;
  m.registered_machines ??= m.active_machines;
  return m;
}

test('a session opens active and closes with an evidence-derived reason', () => {
  let s = newSessionState('session-1', CASINO, PLAYER);
  s = reduceSession(s, evt({ eventType: 'SESSION_START' }));
  assert.equal(s.status, 'active');
  assert.equal(s.ended_reason, null);
  s = reduceSession(s, evt({ eventType: 'SESSION_END' }));
  assert.equal(s.status, 'ended');
  assert.equal(s.ended_reason, 'session-end');
  assert.ok(s.ended_at);
});

test('CARD_REMOVED closes the session with the card-removed reason', () => {
  let s = reduceSession(newSessionState('session-1', CASINO, PLAYER), evt({ eventType: 'CARD_INSERT' }));
  assert.equal(s.status, 'active');
  s = reduceSession(s, evt({ eventType: 'CARD_REMOVED' }));
  assert.equal(s.status, 'ended');
  assert.equal(s.ended_reason, 'card-removed');
});

// ─── SQL/TS projector parity: supersession + replay equivalence ──────────────
function startEvt(sessionId, tOffset) {
  return {
    eventId: `e-${sessionId}`, casinoId: CASINO, safeBetPlayerId: PLAYER,
    sessionId, machineId: 'M-001', eventType: 'SESSION_START',
    occurredAt: new Date(1_700_000_000_000 + tOffset * 1000).toISOString(), payload: {},
  };
}

test('TS projector supersession matches the SQL trigger: only the newest session stays open', () => {
  const envelopes = [startEvt('s1', 1), startEvt('s2', 2), startEvt('s3', 3)];
  const states = reduceEnvelopes(emptyStates(), envelopes);
  const byId = (id) => states.sessions.get(id);
  assert.equal(byId('s1').status, 'ended');
  assert.equal(byId('s1').ended_reason, 'superseded');
  assert.equal(byId('s2').status, 'ended');
  assert.equal(byId('s2').ended_reason, 'superseded');
  assert.equal(byId('s3').status, 'active', 'the newest session is the only open one');
  const open = Array.from(states.sessions.values()).filter((s) => s.status === 'active');
  assert.equal(open.length, 1, 'concurrency policy: one open session per player');
});

test('replay is deterministic and idempotent (re-applying events yields the same state)', () => {
  const envelopes = [startEvt('s1', 1), startEvt('s2', 2), startEvt('s3', 3)];
  const once = reduceEnvelopes(emptyStates(), envelopes);
  const twice = reduceEnvelopes(reduceEnvelopes(emptyStates(), envelopes), envelopes); // replay
  const snap = (st) => Array.from(st.sessions.entries()).map(([id, s]) => `${id}:${s.status}:${s.ended_reason ?? ''}`).sort();
  assert.deepEqual(snap(twice), snap(once), 'replayed events produce identical session state');
});

test('out-of-order openers still leave exactly the latest-started session open', () => {
  // Deliberately shuffle arrival order; reduceEnvelopes sorts by occurred_at.
  const states = reduceEnvelopes(emptyStates(), [startEvt('s3', 3), startEvt('s1', 1), startEvt('s2', 2)]);
  assert.equal(states.sessions.get('s3').status, 'active');
  assert.equal(states.sessions.get('s1').status, 'ended');
  assert.equal(states.sessions.get('s2').status, 'ended');
});

test('a duplicate close event is idempotent (stays ended)', () => {
  let s = reduceSession(newSessionState('session-1', CASINO, PLAYER), evt({ eventType: 'SESSION_START' }));
  s = reduceSession(s, evt({ eventType: 'SESSION_END' }));
  const firstEndedAt = s.ended_at;
  s = reduceSession(s, evt({ eventType: 'SESSION_END' }));
  assert.equal(s.status, 'ended');
  assert.equal(s.ended_at, firstEndedAt, 'a second close does not change the recorded close time');
});

test('session posture partitions open sessions (active + idle + stale = open)', () => {
  assert.equal(reconcileOperatorKpi(kpi()).ok, true);
});

test('detects the stale-session defect shape (all open sessions stale, none fresh)', () => {
  // Post-repair certified truth for an idle simulator: 152 open, all stale.
  const r = reconcileOperatorKpi(kpi({
    active_players: 151, active_sessions: 0, idle_sessions: 0, stale_sessions: 152, open_sessions: 152,
    risk_critical: 0, risk_high: 11, risk_medium: 57, risk_low: 83, risk_unclassified: 0,
  }));
  assert.equal(r.ok, true, 'active+idle+stale must equal open');
  assert.ok(r.checks.find((c) => c.name === 'session-posture-vs-open')?.ok);
});

test('flags a broken session posture (postures do not sum to open)', () => {
  const r = reconcileOperatorKpi(kpi({ active_sessions: 0, idle_sessions: 0, stale_sessions: 0, open_sessions: 152 }));
  assert.equal(r.ok, false);
  const c = r.checks.find((x) => x.name === 'session-posture-vs-open');
  assert.equal(c.expected, 152);
  assert.equal(c.actual, 0);
});

test('mapAggregates surfaces session posture columns from the projection row', () => {
  const agg = mapAggregates({
    active_players: 5, active_sessions: 2, idle_sessions: 1, stale_sessions: 2, open_sessions: 5,
    active_machines: 3, total_wagered: 0, total_won: 0, ggr: 0,
    risk_critical: 0, risk_high: 0, risk_medium: 0, risk_low: 0, risk_unclassified: 5, last_event_at: null,
  });
  assert.equal(agg.idleSessions, 1);
  assert.equal(agg.staleSessions, 2);
  assert.equal(agg.openSessions, 5);
  assert.equal(agg.activeSessions + agg.idleSessions + agg.staleSessions, agg.openSessions);
});

test('shapeKpi passes session posture through unchanged (no recompute)', () => {
  const aggregates = {
    activePlayers: 7, activeSessions: 3, idleSessions: 2, staleSessions: 4, openSessions: 9,
    playersActiveNow: 3, playersIdle: 2, playersStale: 2,
    activeMachines: 4, machinesInPlay: 1, machinesStale: 3, registeredMachines: 5,
    totalWagered: 500, totalWon: 200, ggr: 300,
    riskCritical: 2, riskHigh: 1, riskMedium: 1, riskLow: 2, riskUnclassified: 1, lastEventAt: null,
  };
  const view = shapeKpi({ casinoAggregates: () => ({ ...aggregates }) }, []);
  assert.equal(view.active_sessions, 3);
  assert.equal(view.idle_sessions, 2);
  assert.equal(view.stale_sessions, 4);
  assert.equal(view.open_sessions, 9);
  assert.equal(reconcileOperatorKpi(view).ok, true);
});
