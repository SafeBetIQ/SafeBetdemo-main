// Unit tests for the Enterprise Projection Platform (Phase 3.3).
// Run: node --test tests/projectionPlatform.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { rowToEnvelope } from '../lib/projectionPlatform/rebuild.ts';
import { READ_MODEL_CATALOGUE, PROJECTION_VERSION } from '../lib/projectionPlatform/readModels.ts';
import { envelopeToRow } from '../lib/eventPlatform/persistence.ts';
import { EventPlatform } from '../lib/eventPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3';

let seq = 0;
function envelope(overrides = {}) {
  seq += 1;
  return {
    eventId: crypto.randomUUID(),
    correlationId: overrides.sessionId ?? 'corr-1',
    traceId: '11111111-1111-4111-8111-111111111111',
    tenantId: CASINO,
    casinoId: CASINO,
    jurisdiction: 'ZA',
    safeBetPlayerId: PLAYER,
    sessionId: 'session-1',
    machineId: 'M-001',
    producer: 'test',
    schemaVersion: 1,
    eventType: 'BET_PLACED',
    occurredAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
    receivedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    replayNumber: 0,
    idempotencyKey: crypto.randomUUID(),
    payload: {},
    ...overrides,
  };
}

function journey() {
  return [
    envelope({ eventType: 'CARD_INSERT', payload: { risk_score: 20 } }),
    envelope({ eventType: 'MACHINE_ALLOCATED', payload: { risk_score: 20, metadata: { machine_type: 'slot' } } }),
    envelope({ eventType: 'SESSION_START', payload: { game_type: 'slots', risk_score: 20 } }),
    envelope({ eventType: 'BET_PLACED', payload: { bet_amount: 100, win_amount: 0, risk_score: 35, game_type: 'slots' } }),
    envelope({ eventType: 'BET_PLACED', payload: { bet_amount: 50, win_amount: 120, risk_score: 42, risk_flags: ['loss_chasing'], game_type: 'slots' } }),
    envelope({ eventType: 'INTERVENTION_TRIGGERED', payload: { risk_score: 82 } }),
    envelope({ eventType: 'CASH_OUT', payload: { risk_score: 82 } }),
    envelope({ eventType: 'SESSION_END', payload: { risk_score: 82 } }),
    envelope({ eventType: 'CARD_REMOVED', payload: {} }),
    envelope({ eventType: 'MACHINE_IDLE', sessionId: null, payload: {} }),
  ];
}

// ─── Reducers: pure materialization of event facts ────────────────────────────

test('a full session journey projects correct player state', () => {
  const states = reduceEnvelopes(emptyStates(), journey());
  const p = states.players.get(`${CASINO}:${PLAYER}`);
  assert.equal(p.total_wagered, 150);
  assert.equal(p.total_won, 120);
  assert.equal(p.bet_count, 2);
  assert.equal(p.session_count, 1);
  assert.equal(p.intervention_count, 1);
  assert.deepEqual(p.risk_flags, ['loss_chasing']);
  assert.equal(p.status, 'idle'); // journey ended
  assert.equal(p.current_session_id, null);
  assert.equal(p.projection_version, PROJECTION_VERSION);
});

test('session state opens, accumulates, and closes from the same events', () => {
  const states = reduceEnvelopes(emptyStates(), journey());
  const s = states.sessions.get('session-1');
  assert.equal(s.status, 'ended');
  assert.equal(s.total_wagered, 150);
  assert.equal(s.bet_count, 2);
  assert.equal(s.game_type, 'slots');
  assert.ok(s.started_at && s.ended_at && s.started_at < s.ended_at);
});

test('machine state allocates and releases from the same events', () => {
  const states = reduceEnvelopes(emptyStates(), journey());
  const m = states.machines.get(`${CASINO}:M-001`);
  assert.equal(m.status, 'idle'); // released at MACHINE_IDLE
  assert.equal(m.current_player_id, null);
  assert.equal(m.machine_type, 'slot');
});

test('mid-journey snapshot: machine is occupied while the session is live', () => {
  const states = reduceEnvelopes(emptyStates(), journey().slice(0, 5));
  const m = states.machines.get(`${CASINO}:M-001`);
  assert.equal(m.status, 'active');
  assert.equal(m.current_player_id, PLAYER);
  assert.equal(m.session_wagered, 150);
  const p = states.players.get(`${CASINO}:${PLAYER}`);
  assert.equal(p.status, 'active');
  assert.equal(p.current_machine_id, 'M-001');
});

test('reducers are deterministic regardless of input order (sorted by occurredAt)', () => {
  const events = journey();
  const shuffled = [...events].reverse();
  const a = reduceEnvelopes(emptyStates(), events);
  const b = reduceEnvelopes(emptyStates(), shuffled);
  const strip = (s) => JSON.parse(JSON.stringify(s, (k, v) => (k === 'updated_at' ? undefined : v)));
  assert.deepEqual(strip([...a.players.values()]), strip([...b.players.values()]));
  assert.deepEqual(strip([...a.sessions.values()]), strip([...b.sessions.values()]));
  assert.deepEqual(strip([...a.machines.values()]), strip([...b.machines.values()]));
});

test('immediate duplicate events are not applied twice', () => {
  const bet = envelope({ eventType: 'BET_PLACED', payload: { bet_amount: 100, win_amount: 0, risk_score: 10 } });
  const states = reduceEnvelopes(emptyStates(), [bet, bet]);
  assert.equal(states.players.get(`${CASINO}:${PLAYER}`).total_wagered, 100);
});

// ─── Replay: projections are disposable ───────────────────────────────────────

test('rowToEnvelope is the exact inverse of envelopeToRow', () => {
  const e = envelope({ payload: { bet_amount: 5, metadata: { x: 1 } } });
  assert.deepEqual(rowToEnvelope(envelopeToRow(e)), e);
});

test('replaying persisted rows rebuilds identical state (dispose loses nothing)', () => {
  const events = journey();
  const live = reduceEnvelopes(emptyStates(), events);
  // Simulate dispose + rebuild: rows come back from the log and replay.
  const replayed = reduceEnvelopes(emptyStates(), events.map(e => rowToEnvelope(envelopeToRow(e))));
  const strip = (s) => JSON.parse(JSON.stringify(s, (k, v) => (k === 'updated_at' ? undefined : v)));
  assert.deepEqual(strip([...live.players.values()]), strip([...replayed.players.values()]));
  assert.deepEqual(strip([...live.sessions.values()]), strip([...replayed.sessions.values()]));
  assert.deepEqual(strip([...live.machines.values()]), strip([...replayed.machines.values()]));
});

// ─── One flow: the Event Platform drives projections with the SAME envelopes ─

test('ingest applies projections in the same flow with the same envelopes', async () => {
  const tables = {};
  const client = {
    from(table) {
      tables[table] ??= [];
      const rows = tables[table];
      const builder = {
        _inserted: [],
        insert(r) { rows.push(...r); return Promise.resolve({ error: null }); },
        upsert(r) { rows.push(...r); builder._inserted = r; return builder; },
        select() {
          const p = Promise.resolve({ data: builder._inserted.map(x => ({ event_id: x.event_id })), error: null });
          return Object.assign(p, {
            eq() { return { in: async () => ({ data: [], error: null }) }; },
            in: async () => ({ data: [], error: null }),
          });
        },
        delete() { return { eq: async () => ({ error: null }) }; },
      };
      return builder;
    },
    // The versioned-write RPC materializes the reduced states (as the DB
    // function does) so the flow assertions below can observe them.
    rpc(fn, args) {
      if (fn === 'sbiq_write_projection_states') {
        (tables.projection_player_state ??= []).push(...(args.p_players ?? []));
        (tables.projection_session_state ??= []).push(...(args.p_sessions ?? []));
        (tables.projection_machine_state ??= []).push(...(args.p_machines ?? []));
        return Promise.resolve({ data: [{ ok: true }], error: null });
      }
      return Promise.resolve({ data: [{ out_safebet_player_id: PLAYER, out_status: 'existing' }], error: null });
    },
  };

  const [env] = await new EventPlatform().ingestBatch([{
    eventType: 'BET_PLACED',
    occurredAt: new Date().toISOString(),
    safeBetPlayerId: PLAYER,
    sessionId: 'session-9',
    machineId: 'M-009',
    payload: { bet_amount: 75, win_amount: 0, risk_score: 30, game_type: 'slots' },
  }], { casinoId: CASINO, producer: 'test', client });

  // Same eventId flowed into: event store + projections. Nothing else —
  // the legacy live_events / machine_activity mirrors were retired in 3.7.
  assert.equal(tables.casino_event_log[0].event_id, env.eventId);
  assert.equal(tables.projection_player_state[0].last_event_id, env.eventId);
  assert.equal(tables.projection_session_state[0].last_event_id, env.eventId);
  assert.equal(tables.projection_machine_state[0].last_event_id, env.eventId);
  assert.equal(tables.projection_player_state[0].total_wagered, 75);
  assert.equal(tables.live_events, undefined);
  assert.equal(tables.machine_activity, undefined);
  assert.equal(tables.live_kpi_snapshots, undefined);
});

// ─── Boundaries ───────────────────────────────────────────────────────────────

test('read-model catalogue covers the mandated enterprise views', () => {
  for (const model of [
    'projection_player_state', 'projection_session_state', 'projection_machine_state',
    'projection_casino_state', 'projection_risk_state', 'projection_behaviour_state',
    'projection_intervention_state', 'projection_compliance_state',
    'projection_executive_state', 'projection_regulator_state',
  ]) {
    assert.ok(READ_MODEL_CATALOGUE.includes(model), `catalogue missing ${model}`);
  }
});

test('projection platform API exposes no business-engine surface', async () => {
  const api = await import('../lib/projectionPlatform/index.ts');
  const surface = Object.keys(api).join(' ').toLowerCase();
  for (const forbidden of ['calculaterisk', 'riskengine', 'behaviourengine', 'intervene', 'allocate']) {
    assert.ok(!surface.includes(forbidden), `projection API must not expose '${forbidden}'`);
  }
});
