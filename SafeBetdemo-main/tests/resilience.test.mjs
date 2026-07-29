// Phase 4.3 — ingestion idempotency, projection concurrency, ordering, replay.
// Run: node --test tests/resilience.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EventPlatform } from '../lib/eventPlatform/index.ts';
import { emptyStates, reduceEnvelopes, writeStatesVersioned } from '../lib/projectionPlatform/apply.ts';
import { getProjectionPlatform } from '../lib/projectionPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3';

/**
 * In-memory store modelling the Phase 4.3 database semantics:
 *  • event log: UNIQUE(casino_id, dedupe_key); upsert-ignore returns only
 *    newly-inserted rows.
 *  • projections: row_version optimistic concurrency via
 *    sbiq_write_projection_states (advisory-lock check-then-write).
 */
function makeStore() {
  const eventLog = new Map();            // dedupe_key → row
  const players = new Map();             // safebet_player_id → row (incl. row_version)
  const sessions = new Map();
  const machines = new Map();
  let identityRpc = 0, writeRpc = 0, writeConflicts = 0;

  const store = {
    eventLog, players, sessions, machines,
    get counts() { return { identityRpc, writeRpc, writeConflicts, events: eventLog.size, players: players.size }; },
    from(table) {
      const b = {
        _inserted: [],
        upsert(rows, opts) {
          b._inserted = [];
          if (table === 'casino_event_log') {
            for (const r of rows) {
              const key = `${r.casino_id}:${r.dedupe_key}`;
              if (opts?.ignoreDuplicates && eventLog.has(key)) continue;
              eventLog.set(key, r);
              b._inserted.push(r);
            }
          }
          return b;
        },
        select(cols) {
          if (b._inserted !== undefined && table === 'casino_event_log') {
            const p = Promise.resolve({ data: b._inserted.map(r => ({ event_id: r.event_id })), error: null });
            return Object.assign(p, { eq: () => ({ in: async () => ({ data: [], error: null }) }), in: async () => ({ data: [], error: null }) });
          }
          // read path for loadStates: return current projection rows
          const rowsFor = table === 'projection_player_state' ? [...players.values()]
            : table === 'projection_session_state' ? [...sessions.values()]
            : table === 'projection_machine_state' ? [...machines.values()] : [];
          const api = {
            eq() { return api; },
            in: async () => ({ data: rowsFor, error: null }),
            then: (res) => res({ data: rowsFor, error: null }),
          };
          return api;
        },
        delete() { return { eq: async () => ({ error: null }) }; },
      };
      return b;
    },
    rpc(fn, args) {
      if (fn === 'resolve_player_identity') {
        identityRpc++;
        return Promise.resolve({ data: [{ out_safebet_player_id: args.p_safebet_id, out_status: 'created' }], error: null });
      }
      if (fn === 'sbiq_write_projection_states') {
        writeRpc++;
        // Version check (the advisory-lock check-then-write, modelled).
        const check = (map, keyOf, list) => {
          for (const r of (list ?? [])) {
            const cur = map.get(keyOf(r));
            if (cur ? cur.row_version !== r.row_version : r.row_version !== 0) return false;
          }
          return true;
        };
        const ok = check(players, r => r.safebet_player_id, args.p_players)
          && check(sessions, r => r.session_id, args.p_sessions)
          && check(machines, r => r.machine_id, args.p_machines);
        if (!ok) { writeConflicts++; return Promise.resolve({ data: [{ ok: false }], error: null }); }
        for (const r of (args.p_players ?? [])) players.set(r.safebet_player_id, { ...r, row_version: r.row_version + 1 });
        for (const r of (args.p_sessions ?? [])) sessions.set(r.session_id, { ...r, row_version: r.row_version + 1 });
        for (const r of (args.p_machines ?? [])) machines.set(r.machine_id, { ...r, row_version: r.row_version + 1 });
        return Promise.resolve({ data: [{ ok: true }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
  return store;
}

const draft = (o = {}) => ({
  eventType: 'BET_PLACED', occurredAt: new Date().toISOString(),
  safeBetPlayerId: PLAYER, sessionId: 'session-1', machineId: 'M-001',
  payload: { bet_amount: 50, win_amount: 0, risk_score: 30, game_type: 'slots' }, ...o,
});
const ctx = (client) => ({ casinoId: CASINO, producer: 'test', client });

// ─── WS1 — Idempotent ingestion ───────────────────────────────────────────────

test('a retried event (same idempotency key) is stored and projected exactly once', async () => {
  const store = makeStore();
  const platform = new EventPlatform();
  const d = draft({ idempotencyKey: 'evt-abc', occurredAt: new Date(1_700_000_000_000).toISOString() });

  await platform.ingest(d, ctx(store));
  const playerAfterFirst = { ...store.players.get(PLAYER) };
  await platform.ingest(d, ctx(store)); // retry — identical key
  await platform.ingest(d, ctx(store)); // retry again

  assert.equal(store.eventLog.size, 1, 'event stored once');
  assert.equal(store.players.get(PLAYER).total_wagered, 50, 'projected once (not 150)');
  assert.equal(store.players.get(PLAYER).bet_count, 1);
  assert.equal(store.players.get(PLAYER).row_version, playerAfterFirst.row_version, 'no reprojection on retry');
});

test('distinct events with distinct keys all persist and project', async () => {
  const store = makeStore();
  const platform = new EventPlatform();
  for (let i = 0; i < 4; i++) {
    await platform.ingest(draft({ idempotencyKey: `evt-${i}`, occurredAt: new Date(1_700_000_000_000 + i * 1000).toISOString() }), ctx(store));
  }
  assert.equal(store.eventLog.size, 4);
  assert.equal(store.players.get(PLAYER).total_wagered, 200); // 4 × 50
  assert.equal(store.players.get(PLAYER).bet_count, 4);
});

test('absent idempotency key ⇒ every event distinct (pre-4.3 behaviour preserved)', async () => {
  const store = makeStore();
  const platform = new EventPlatform();
  await platform.ingest(draft({ occurredAt: new Date(1_700_000_000_000).toISOString() }), ctx(store));
  await platform.ingest(draft({ occurredAt: new Date(1_700_000_001_000).toISOString() }), ctx(store));
  assert.equal(store.eventLog.size, 2, 'no key → deduped by eventId → both distinct');
});

// ─── WS2 — Projection concurrency (optimistic, retry converges) ───────────────

test('a stale-version write is rejected, reloaded, and retried to a correct result', async () => {
  const store = makeStore();
  // Seed a committed player at row_version 3.
  store.players.set(PLAYER, {
    casino_id: CASINO, safebet_player_id: PLAYER, status: 'active',
    total_wagered: 100, bet_count: 2, row_version: 3,
    risk_flags: [], last_event_id: 'x',
  });

  // A batch that loaded the STALE version 0 must be refused, not committed.
  const stale = emptyStates();
  stale.players.set(`${CASINO}:${PLAYER}`, {
    casino_id: CASINO, safebet_player_id: PLAYER, status: 'active',
    total_wagered: 999, bet_count: 99, row_version: 0, risk_flags: [], last_event_id: 'stale',
  });
  const committed = await writeStatesVersioned(store, CASINO, stale);
  assert.equal(committed, false, 'stale write refused (lost-update prevented)');
  assert.equal(store.players.get(PLAYER).total_wagered, 100, 'committed state untouched');

  // A batch that loaded the CURRENT version 3 commits and advances to 4.
  const fresh = emptyStates();
  fresh.players.set(`${CASINO}:${PLAYER}`, { ...store.players.get(PLAYER), total_wagered: 150, bet_count: 3 });
  assert.equal(await writeStatesVersioned(store, CASINO, fresh), true);
  assert.equal(store.players.get(PLAYER).total_wagered, 150);
  assert.equal(store.players.get(PLAYER).row_version, 4);
});

test('the apply retry loop converges after a concurrent writer moves the version', async () => {
  const store = makeStore();
  const platform = getProjectionPlatform();
  const env = (o) => ({
    eventId: crypto.randomUUID(), correlationId: 'c', traceId: '11111111-1111-4111-8111-111111111111',
    tenantId: CASINO, casinoId: CASINO, jurisdiction: 'ZA', safeBetPlayerId: PLAYER,
    sessionId: 'session-1', machineId: 'M-001', producer: 'test', schemaVersion: 1,
    eventType: 'BET_PLACED', occurredAt: new Date(1_700_000_000_000).toISOString(),
    receivedAt: new Date().toISOString(), processedAt: new Date().toISOString(),
    replayNumber: 0, idempotencyKey: crypto.randomUUID(),
    payload: { bet_amount: 50, win_amount: 0, risk_score: 30 }, ...o,
  });

  // Inject one concurrent version bump between load and write on the first attempt.
  const realRpc = store.rpc.bind(store);
  let bumped = false;
  store.rpc = (fn, args) => {
    if (fn === 'sbiq_write_projection_states' && !bumped) {
      bumped = true;
      const cur = store.players.get(PLAYER);
      if (cur) store.players.set(PLAYER, { ...cur, row_version: cur.row_version + 1 }); // rival commit
    }
    return realRpc(fn, args);
  };

  store.players.set(PLAYER, { casino_id: CASINO, safebet_player_id: PLAYER, status: 'active', total_wagered: 0, bet_count: 0, row_version: 0, risk_flags: [], last_event_id: null });
  await platform.applyEnvelopes(store, [env()]);
  assert.ok(store.counts.writeConflicts >= 1, 'at least one optimistic conflict occurred');
  assert.ok(store.counts.writeRpc >= 2, 'retried after the conflict');
  assert.equal(store.players.get(PLAYER).status, 'active');
});

// ─── Ordering + replay determinism (unchanged guarantees) ─────────────────────

test('reduction is order-independent (sorted by occurredAt) — ordering preserved', () => {
  const base = 1_700_000_000_000;
  const mk = (i, type, payload) => ({
    eventId: `e${i}`, correlationId: 'c', traceId: 't', tenantId: CASINO, casinoId: CASINO,
    jurisdiction: 'ZA', safeBetPlayerId: PLAYER, sessionId: 'session-1', machineId: 'M-001',
    producer: 'test', schemaVersion: 1, eventType: type,
    occurredAt: new Date(base + i * 1000).toISOString(), receivedAt: '', processedAt: '',
    replayNumber: 0, idempotencyKey: `e${i}`, payload,
  });
  const events = [
    mk(0, 'SESSION_START', { risk_score: 10 }),
    mk(1, 'BET_PLACED', { bet_amount: 100, win_amount: 0, risk_score: 20 }),
    mk(2, 'BET_PLACED', { bet_amount: 50, win_amount: 30, risk_score: 25 }),
    mk(3, 'SESSION_END', { risk_score: 25 }),
  ];
  const forward = reduceEnvelopes(emptyStates(), events);
  const shuffled = reduceEnvelopes(emptyStates(), [events[3], events[1], events[0], events[2]]);
  const strip = (s) => { const p = s.players.get(`${CASINO}:${PLAYER}`); const { updated_at, ...rest } = p; return rest; };
  assert.deepEqual(strip(shuffled), strip(forward), 'same final state regardless of arrival order');
  assert.equal(forward.players.get(`${CASINO}:${PLAYER}`).total_wagered, 150);
});
