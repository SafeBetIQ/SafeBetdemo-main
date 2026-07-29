// Unit tests for the Enterprise Event Platform (Phase 3.2).
// Run: node --test tests/eventPlatform.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVELOPE_SCHEMA_VERSION,
  EventPlatform,
  EventValidationError,
  getEventPlatform,
} from '../lib/eventPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3'; // pinned IRS vector for demo-patron-1 @ casino …0001

// Fake store modelling the Phase 4.3 idempotent-insert + versioned-write path.
// The event store dedupes on (casino_id, dedupe_key); .select() after upsert
// returns only the rows actually inserted (duplicates omitted).
function makeClient() {
  const inserts = { casino_event_log: [], live_events: [] };
  const seenDedupe = new Set();
  const rpcCalls = [];
  return {
    inserts,
    rpcCalls,
    from(table) {
      const builder = {
        _pendingInserted: [],
        insert(rows) {
          (inserts[table] ??= []).push(...rows);
          return Promise.resolve({ error: null });
        },
        upsert(rows, opts) {
          const inserted = [];
          for (const r of rows) {
            const key = `${r.casino_id}:${r.dedupe_key}`;
            if (opts?.ignoreDuplicates && seenDedupe.has(key)) continue; // retried event
            if (r.dedupe_key !== undefined) seenDedupe.add(key);
            (inserts[table] ??= []).push(r);
            inserted.push(r);
          }
          builder._pendingInserted = inserted;
          return builder; // allow chained .select()
        },
        select() {
          // After upsert → the inserted rows; otherwise a read builder.
          if (builder._pendingInserted.length || inserts[table]) {
            const rows = builder._pendingInserted;
            const p = Promise.resolve({ data: rows.map(r => ({ event_id: r.event_id })), error: null });
            return Object.assign(p, {
              eq() { return { in: async () => ({ data: [], error: null }) }; },
              in: async () => ({ data: [], error: null }),
            });
          }
          return {
            eq() { return { in: async () => ({ data: [], error: null }) }; },
            in: async () => ({ data: [], error: null }),
          };
        },
        delete() { return { eq: async () => ({ error: null }) }; },
      };
      return builder;
    },
    rpc(fn, args) {
      rpcCalls.push({ fn, args });
      if (fn === 'sbiq_write_projection_states') {
        return Promise.resolve({ data: [{ ok: true }], error: null });
      }
      return Promise.resolve({
        data: [{ out_safebet_player_id: args.p_safebet_id, out_status: 'created' }],
        error: null,
      });
    },
  };
}

function draft(overrides = {}) {
  return {
    eventType: 'BET_PLACED',
    occurredAt: new Date().toISOString(),
    safeBetPlayerId: PLAYER,
    sessionId: crypto.randomUUID(),
    machineId: 'M-001',
    payload: { bet_amount: 50, game_type: 'slots', is_simulated: true },
    ...overrides,
  };
}

const ctx = (client) => ({ casinoId: CASINO, producer: 'test-producer', client });

// ─── One lifecycle, one envelope ──────────────────────────────────────────────

test('ingest produces a complete enterprise envelope (incl. idempotencyKey)', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(draft(), ctx(client));
  for (const field of [
    'eventId', 'correlationId', 'traceId', 'tenantId', 'casinoId', 'jurisdiction',
    'safeBetPlayerId', 'sessionId', 'machineId', 'producer', 'schemaVersion',
    'eventType', 'occurredAt', 'receivedAt', 'processedAt', 'replayNumber',
    'idempotencyKey', 'payload',
  ]) {
    assert.ok(field in e, `envelope missing '${field}'`);
    assert.notEqual(e[field], undefined, `envelope field '${field}' is undefined`);
  }
  assert.equal(e.schemaVersion, ENVELOPE_SCHEMA_VERSION);
  assert.equal(e.replayNumber, 0);
  assert.equal(e.tenantId, CASINO);
  assert.equal(e.jurisdiction, 'ZA');
});

test('envelopes are immutable (deep-frozen)', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(draft(), ctx(client));
  assert.ok(Object.isFrozen(e), 'envelope must be frozen');
  assert.ok(Object.isFrozen(e.payload), 'payload must be frozen');
  assert.throws(() => { e.eventType = 'JACKPOT'; }, TypeError);
  assert.throws(() => { e.payload.bet_amount = 999; }, TypeError);
});

test('one ingest → ONE persisted event; the legacy live_events adapter is gone (3.7)', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(draft(), ctx(client));
  assert.equal(client.inserts.casino_event_log.length, 1);
  assert.equal(client.inserts.casino_event_log[0].event_id, e.eventId);
  // Distribution IS the insert — no second channel, no legacy rows.
  assert.equal(client.inserts.live_events.length, 0);
});

test('persisted row maps the envelope exactly, field for field', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(draft(), ctx(client));
  const row = client.inserts.casino_event_log[0];
  assert.deepEqual(row, {
    event_id: e.eventId,
    correlation_id: e.correlationId,
    trace_id: e.traceId,
    tenant_id: e.tenantId,
    casino_id: e.casinoId,
    jurisdiction: e.jurisdiction,
    safebet_player_id: e.safeBetPlayerId,
    session_id: e.sessionId,
    machine_id: e.machineId,
    producer: e.producer,
    schema_version: e.schemaVersion,
    event_type: e.eventType,
    occurred_at: e.occurredAt,
    received_at: e.receivedAt,
    processed_at: e.processedAt,
    replay_number: e.replayNumber,
    dedupe_key: e.idempotencyKey,
    payload: e.payload,
  });
});

test('batch shares one traceId; correlation follows the session journey', async () => {
  const client = makeClient();
  const session = crypto.randomUUID();
  const [a, b, c] = await new EventPlatform().ingestBatch([
    draft({ eventType: 'CARD_INSERT', sessionId: session, correlationId: session }),
    draft({ eventType: 'SESSION_START', sessionId: session, correlationId: session }),
    draft({ eventType: 'BET_PLACED', sessionId: session, correlationId: session }),
  ], ctx(client));
  assert.equal(a.traceId, b.traceId);
  assert.equal(b.traceId, c.traceId);
  assert.equal(new Set([a.eventId, b.eventId, c.eventId]).size, 3);
  assert.equal(a.correlationId, session);
  assert.equal(c.correlationId, session);
});

// ─── Validation: reject, never repair ─────────────────────────────────────────

test('unknown event type is rejected before anything is persisted', async () => {
  const client = makeClient();
  await assert.rejects(
    () => new EventPlatform().ingest(draft({ eventType: 'PLAYER_RENAMED' }), ctx(client)),
    EventValidationError,
  );
  assert.equal(client.inserts.casino_event_log.length, 0);
});

test('missing identity is rejected', async () => {
  const client = makeClient();
  await assert.rejects(
    () => new EventPlatform().ingest(draft({ safeBetPlayerId: undefined }), ctx(client)),
    /identity required/,
  );
});

test('malformed SafeBet id is rejected, not repaired', async () => {
  const client = makeClient();
  await assert.rejects(
    () => new EventPlatform().ingest(draft({ safeBetPlayerId: 'PLAYER-123' }), ctx(client)),
    /not a canonical SB-PLR id/,
  );
  assert.equal(client.inserts.casino_event_log.length, 0);
});

test('future timestamps beyond skew are rejected', async () => {
  const client = makeClient();
  await assert.rejects(
    () => new EventPlatform().ingest(
      draft({ occurredAt: new Date(Date.now() + 3600_000).toISOString() }), ctx(client)),
    /future beyond tolerated clock skew/,
  );
});

test('one invalid draft rejects the whole batch atomically', async () => {
  const client = makeClient();
  await assert.rejects(
    () => new EventPlatform().ingestBatch([draft(), draft({ eventType: 'NOT_A_TYPE' })], ctx(client)),
    EventValidationError,
  );
  assert.equal(client.inserts.casino_event_log.length, 0);
});

test('ingest without a persistence client is refused (nothing lives only in memory)', async () => {
  await assert.rejects(
    () => new EventPlatform().ingest(draft(), { casinoId: CASINO, producer: 't', client: undefined }),
    /must never exist only in memory/,
  );
});

// ─── Enrichment: identity resolved once, in-flow ──────────────────────────────

test('raw casino reference is resolved through the IRS during enrichment', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(
    draft({ safeBetPlayerId: undefined, casinoPlayerRef: 'demo-patron-1' }),
    ctx(client),
  );
  assert.equal(e.safeBetPlayerId, 'SB-PLR-707371C39AE04D71BBA3E495'); // v2 pinned vector (ADR-001)
  const identityCalls = client.rpcCalls.filter(c => c.fn === 'resolve_player_identity');
  assert.equal(identityCalls.length, 1);
  // The raw reference never reaches storage.
  const stored = JSON.stringify(client.inserts);
  assert.ok(!stored.includes('demo-patron-1'));
});

test('pre-resolved identity passes through with zero identity round-trips', async () => {
  const client = makeClient();
  const e = await new EventPlatform().ingest(draft(), ctx(client));
  assert.equal(e.safeBetPlayerId, PLAYER);
  assert.equal(client.rpcCalls.filter(c => c.fn === 'resolve_player_identity').length, 0);
});

// ─── Boundaries ───────────────────────────────────────────────────────────────

test('replay is reserved, loudly', () => {
  assert.throws(() => getEventPlatform().replay(), /reserved for the Projection Engine phase/);
});

test('platform public API exposes no business-engine surface', async () => {
  const api = await import('../lib/eventPlatform/index.ts');
  const surface = Object.keys(api).join(' ').toLowerCase();
  for (const forbidden of ['risk', 'behaviour', 'intervention', 'machineallocat', 'session_manage', 'ai']) {
    assert.ok(!surface.includes(forbidden), `platform API must not expose '${forbidden}'`);
  }
});
