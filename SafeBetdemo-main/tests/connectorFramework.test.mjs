// Unit/integration tests for the Connector Framework (v1.1).
// Run: node --test tests/connectorFramework.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  translateRecord, translateBatch, normalizeTimestamp,
  validateMappingConfig, ConnectorConfigError,
  runConnector, BUILT_IN_PROFILES,
} from '../lib/connectorFramework/index.ts';
import { EVENT_TYPE_SET } from '../lib/eventPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3';

// Event-store double modelling the certified persist + versioned-write path.
function makeClient() {
  const inserts = { casino_event_log: [] };
  const seen = new Set();
  const rpcCalls = [];
  return {
    inserts, rpcCalls,
    from() {
      const b = {
        _ins: [],
        upsert(rows, opts) {
          b._ins = [];
          for (const r of rows) {
            const k = `${r.casino_id}:${r.dedupe_key}`;
            if (opts?.ignoreDuplicates && seen.has(k)) continue;
            seen.add(k); inserts.casino_event_log.push(r); b._ins.push(r);
          }
          return b;
        },
        select() {
          const p = Promise.resolve({ data: b._ins.map(r => ({ event_id: r.event_id })), error: null });
          return Object.assign(p, { eq: () => ({ in: async () => ({ data: [], error: null }) }), in: async () => ({ data: [], error: null }) });
        },
        delete() { return { eq: async () => ({ error: null }) }; },
      };
      return b;
    },
    rpc(fn, args) {
      rpcCalls.push({ fn, args });
      if (fn === 'sbiq_write_projection_states') return Promise.resolve({ data: [{ ok: true }], error: null });
      return Promise.resolve({ data: [{ out_safebet_player_id: args.p_safebet_id ?? PLAYER, out_status: 'created' }], error: null });
    },
  };
}

// ─── Translation: external record → CasinoEventDraft (adapter only) ───────────

test('a slot-management record translates into a valid CasinoEventDraft', () => {
  const cfg = BUILT_IN_PROFILES['slot-management'];
  const { draft, diagnostics } = translateRecord({
    player_card: 'loyalty-99', session: 'sess-1', machine: '12', ts: '2026-07-13T10:00:00Z',
    type: 'spin', wager: 50, win: 0, game: 'slots', machine_type: 'slot',
    zone: 'Zone A – Slots', txn_id: 'txn-abc',
  }, cfg);
  assert.equal(diagnostics.length, 0);
  assert.equal(draft.eventType, 'BET_PLACED');            // 'spin' → BET_PLACED
  assert.equal(draft.casinoPlayerRef, 'loyalty-99');       // identity → resolved downstream
  assert.equal(draft.machineId, 'M-12');                   // prefix normalised
  assert.equal(draft.idempotencyKey, 'txn-abc');
  assert.equal(draft.payload.bet_amount, 50);
  assert.equal(draft.payload.metadata.casino_floor_location, 'Zone A – Slots');
  assert.ok(EVENT_TYPE_SET.has(draft.eventType));
});

test('translation carries NO business logic — it copies fields verbatim', () => {
  const cfg = BUILT_IN_PROFILES['slot-management'];
  const { draft } = translateRecord({
    player_card: 'p', machine: '3', ts: 1_752_400_000, type: 'spin',
    wager: 12345, win: 999, txn_id: 'x',
  }, cfg);
  assert.equal(draft.payload.bet_amount, 12345);           // not recomputed
  assert.equal(draft.payload.win_amount, 999);
});

test('event-type mapping and default type both work', () => {
  assert.equal(translateRecord({ subject: 'p', raised_at: '2026-07-13T10:00:00Z', signal: 'intervention', signal_id: '1' }, BUILT_IN_PROFILES['rg-system']).draft.eventType, 'INTERVENTION_TRIGGERED');
  assert.equal(translateRecord({ player: 'p', machine: '1', timestamp: '2026-07-13T10:00:00Z', row_id: 'r1' }, BUILT_IN_PROFILES['batch-file']).draft.eventType, 'BET_PLACED');
});

// ─── Timestamp normalisation ──────────────────────────────────────────────────

test('normalizeTimestamp handles ISO, epoch seconds/millis, and naive+offset', () => {
  assert.equal(normalizeTimestamp('2026-07-13T10:00:00Z'), '2026-07-13T10:00:00.000Z');
  assert.equal(normalizeTimestamp(1_752_400_800), new Date(1_752_400_800_000).toISOString());   // seconds
  assert.equal(normalizeTimestamp(1_752_400_800_000), new Date(1_752_400_800_000).toISOString()); // millis
  // naive local 12:00 at +120min offset → 10:00 UTC
  assert.equal(normalizeTimestamp('2026-07-13T12:00:00', 120), '2026-07-13T10:00:00.000Z');
  assert.equal(normalizeTimestamp('not-a-date'), null);
});

// ─── Data quality: actionable diagnostics ─────────────────────────────────────

test('missing identity is a fatal diagnostic and blocks the draft', () => {
  const { draft, diagnostics } = translateRecord({ machine: '1', ts: '2026-07-13T10:00:00Z', type: 'spin' }, BUILT_IN_PROFILES['slot-management']);
  assert.equal(draft, null);
  assert.ok(diagnostics.some(d => d.code === 'MISSING_IDENTITY' && d.severity === 'error' && d.hint));
});

test('unmapped event type and bad timestamp produce actionable diagnostics', () => {
  const r1 = translateRecord({ player_card: 'p', machine: '1', ts: '2026-07-13T10:00:00Z', type: 'unknown_code', txn_id: 't' }, BUILT_IN_PROFILES['slot-management']);
  assert.ok(r1.diagnostics.some(d => d.code === 'UNMAPPED_EVENT_TYPE'));
  const r2 = translateRecord({ player_card: 'p', machine: '1', ts: 'garbage', type: 'spin', txn_id: 't' }, BUILT_IN_PROFILES['slot-management']);
  assert.ok(r2.diagnostics.some(d => d.code === 'TIMESTAMP_ANOMALY'));
});

test('unknown machine is a non-fatal warning when a known-machine set is supplied', () => {
  const { draft, diagnostics } = translateRecord(
    { player_card: 'p', machine: '999', ts: '2026-07-13T10:00:00Z', type: 'spin', txn_id: 't' },
    BUILT_IN_PROFILES['slot-management'], { knownMachineIds: new Set(['M-001']) });
  assert.ok(draft);                                           // still produced (warning only)
  assert.ok(diagnostics.some(d => d.code === 'UNKNOWN_MACHINE' && d.severity === 'warning'));
});

// ─── Config validation (reject-never-repair) ──────────────────────────────────

test('mapping validation rejects unknown types, missing fields, and bad event maps', () => {
  assert.throws(() => validateMappingConfig({ connectorType: 'nope', name: 'x', fields: { occurredAt: 't', playerRef: 'p' } }), ConnectorConfigError);
  assert.throws(() => validateMappingConfig({ connectorType: 'loyalty', name: 'x', fields: { playerRef: 'p' } }), /occurredAt is required/);
  assert.throws(() => validateMappingConfig({ connectorType: 'loyalty', name: 'x', fields: { occurredAt: 't', playerRef: 'p', eventType: 'e' }, eventTypeMap: { a: 'NOT_A_TYPE' } }), /not a SafeBet event type/);
  // a valid config passes
  assert.ok(validateMappingConfig(BUILT_IN_PROFILES['slot-management']));
});

test('every built-in profile is a valid configuration', () => {
  for (const [key, cfg] of Object.entries(BUILT_IN_PROFILES)) {
    assert.doesNotThrow(() => validateMappingConfig(cfg), `${key} must be valid`);
  }
});

// ─── End-to-end: connector → Enterprise Event Platform (single path) ──────────

test('runConnector submits translated events through the ONE Event Platform', async () => {
  const client = makeClient();
  const records = [
    { player_card: 'loyalty-1', session: 's1', machine: '1', ts: '2026-07-13T10:00:00Z', type: 'allocate', txn_id: 'e1' },
    { player_card: 'loyalty-1', session: 's1', machine: '1', ts: '2026-07-13T10:00:05Z', type: 'spin', bet_amount: 50, game_type: 'slots', txn_id: 'e2' },
    { machine: '1', ts: '2026-07-13T10:00:06Z', type: 'spin', txn_id: 'e3' }, // missing identity → rejected pre-flight
  ];
  const summary = await runConnector(records, { config: BUILT_IN_PROFILES['slot-management'], casinoId: CASINO, jurisdiction: 'ZA', client });
  assert.equal(summary.received, 3);
  assert.equal(summary.translated, 2);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.submitted, 2);
  assert.equal(summary.failed, 0);
  // Events reached the certified event store; identity was resolved via the IRS RPC.
  assert.equal(client.inserts.casino_event_log.length, 2);
  assert.ok(client.rpcCalls.some(c => c.fn === 'resolve_player_identity'));
  assert.equal(summary.connectorType, 'slot-management');
});

test('connector idempotency: replaying the same records de-duplicates at the store', async () => {
  const client = makeClient();
  const records = [{ player_card: 'p', session: 's', machine: '1', ts: '2026-07-13T10:00:00Z', type: 'spin', bet_amount: 10, txn_id: 'dup-1' }];
  await runConnector(records, { config: BUILT_IN_PROFILES['slot-management'], casinoId: CASINO, client });
  await runConnector(records, { config: BUILT_IN_PROFILES['slot-management'], casinoId: CASINO, client }); // replay
  assert.equal(client.inserts.casino_event_log.length, 1, 'same idempotency key → stored once');
});

test('connectors never bypass identity: a raw ref is forwarded for IRS resolution, never stored raw', async () => {
  const client = makeClient();
  await runConnector([{ player_card: 'secret-loyalty-42', machine: '1', ts: '2026-07-13T10:00:00Z', type: 'spin', txn_id: 'e' }],
    { config: BUILT_IN_PROFILES['slot-management'], casinoId: CASINO, client });
  const stored = JSON.stringify(client.inserts);
  assert.ok(!stored.includes('secret-loyalty-42'), 'raw casino reference must never reach the event store');
  assert.ok(client.rpcCalls.some(c => c.fn === 'resolve_player_identity'));
});
