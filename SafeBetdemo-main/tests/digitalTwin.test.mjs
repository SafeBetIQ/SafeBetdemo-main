// Unit tests for the Enterprise Casino Digital Twin (Phase 3.4).
// Run: node --test tests/digitalTwin.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { PROJECTION_VERSION, PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE } from '../lib/projectionPlatform/readModels.ts';
import { CasinoDigitalTwin, getDigitalTwin, getEnrichment } from '../lib/digitalTwin/index.ts';
import { mapAggregates } from '../lib/digitalTwin/assembly.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const OTHER_CASINO = '00000000-0000-0000-0000-000000000002';
const PLAYER = 'SB-PLR-707371C3';
const PLAYER_2 = 'SB-PLR-AAAA1111';

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
    payload: {},
    ...overrides,
  };
}

/** Two players on two floors; one journey ends, one stays live with an intervention. */
function floorJourney() {
  return [
    envelope({ eventType: 'SESSION_START', payload: { game_type: 'slots', risk_score: 20, metadata: { machine_type: 'slot', casino_floor_location: 'Zone A – Slots' } } }),
    envelope({ eventType: 'BET_PLACED', payload: { bet_amount: 100, win_amount: 40, risk_score: 35, game_type: 'slots' } }),
    envelope({ eventType: 'INTERVENTION_TRIGGERED', payload: { risk_score: 82, risk_flags: ['loss_chasing'] } }),
    envelope({
      eventType: 'SESSION_START', safeBetPlayerId: PLAYER_2, sessionId: 'session-2', machineId: 'M-040',
      payload: { game_type: 'blackjack', risk_score: 10, metadata: { machine_type: 'table', casino_floor_location: 'Zone B – Tables' } },
    }),
    envelope({
      eventType: 'SESSION_END', safeBetPlayerId: PLAYER_2, sessionId: 'session-2', machineId: 'M-040',
      payload: { risk_score: 10 },
    }),
    envelope({
      eventType: 'MACHINE_IDLE', safeBetPlayerId: PLAYER_2, sessionId: null, machineId: 'M-040', payload: {},
    }),
  ];
}

/** Projection rows exactly as the Projection Platform would write them. */
function projectionRows(envelopes = floorJourney()) {
  const states = reduceEnvelopes(emptyStates(), envelopes);
  const players = Array.from(states.players.values());
  const sessions = Array.from(states.sessions.values());
  const machines = Array.from(states.machines.values());
  // View rows exactly as the catalogue SQL defines them (thresholds live THERE).
  const interventions = players.filter(p => p.intervention_count > 0).map(p => ({
    casino_id: p.casino_id, safebet_player_id: p.safebet_player_id,
    intervention_count: p.intervention_count, last_intervention_at: p.last_intervention_at,
    risk_score: p.risk_score, last_event_at: p.last_event_at,
  }));
  const compliance = players
    .filter(p => p.risk_score >= 60 || p.intervention_count > 0)
    .map(p => ({ safebet_player_id: p.safebet_player_id }));
  const casino = [{
    casino_id: CASINO,
    active_players: players.filter(p => p.status === 'active').length,
    active_sessions: sessions.filter(s => s.status === 'active').length,
    active_machines: machines.filter(m => m.status === 'active').length,
    total_wagered: players.reduce((s, p) => s + p.total_wagered, 0),
    total_won: players.reduce((s, p) => s + p.total_won, 0),
    ggr: players.reduce((s, p) => s + p.total_wagered - p.total_won, 0),
    risk_critical: players.filter(p => p.risk_score >= 80).length,
    risk_high: players.filter(p => p.risk_score >= 60 && p.risk_score < 80).length,
    risk_medium: players.filter(p => p.risk_score >= 40 && p.risk_score < 60).length,
    risk_low: players.filter(p => p.risk_score < 40).length,
    last_event_at: envelopes[envelopes.length - 1].occurredAt,
  }];
  return {
    [PLAYER_TABLE]: players,
    [SESSION_TABLE]: sessions.filter(s => s.status === 'active'),
    [MACHINE_TABLE]: machines,
    projection_casino_state: casino,
    projection_intervention_state: interventions,
    projection_compliance_state: compliance,
  };
}

/** Structural ProjectionStoreClient over fixed read-model rows. */
function fakeProjectionClient(rowsByModel) {
  return {
    from(model) {
      const q = {
        select: () => q,
        eq: () => q,
        then: (resolve) => resolve({ data: rowsByModel[model] ?? [], error: null }),
      };
      return q;
    },
  };
}

async function startedTwin(rows = projectionRows()) {
  const twin = new CasinoDigitalTwin(CASINO);
  await twin.start(fakeProjectionClient(rows));
  return twin;
}

// ─── Projection v2: floor location is a materialized event fact ───────────────

test('machine projection materializes floor_location from event metadata (v2)', () => {
  const states = reduceEnvelopes(emptyStates(), floorJourney());
  assert.equal(PROJECTION_VERSION, 2);
  assert.equal(states.machines.get(`${CASINO}:M-001`).floor_location, 'Zone A – Slots');
  assert.equal(states.machines.get(`${CASINO}:M-040`).floor_location, 'Zone B – Tables');
});

// ─── Assembly: the twin consumes projections only ──────────────────────────────

test('the twin assembles the casino from the projection read models', async () => {
  const twin = await startedTwin();
  assert.equal(twin.state, 'live');
  const snapshot = twin.snapshot();
  assert.equal(snapshot.activePlayers, 1);          // PLAYER live, PLAYER_2 ended
  assert.equal(snapshot.openSessions, 1);
  assert.equal(snapshot.occupiedMachines, 1);
  assert.equal(snapshot.activeInterventions, 1);
  assert.equal(snapshot.playersRequiringMonitoring, 1);
  assert.equal(snapshot.aggregates.ggr, 60);        // projected, not computed here
  assert.equal(snapshot.floors.length, 2);
  twin.dispose();
});

test('twin fields carry projection facts verbatim — no recalculation', async () => {
  const twin = await startedTwin();
  const player = twin.registry.players.get(PLAYER);
  assert.equal(player.riskScore, 82);               // exactly as the event recorded
  assert.deepEqual(player.riskFlags, ['loss_chasing']);
  assert.equal(player.totalWagered, 100);
  assert.equal(player.requiresMonitoring, true);    // compliance VIEW membership
  const idle = twin.registry.players.get(PLAYER_2);
  assert.equal(idle.requiresMonitoring, false);
  twin.dispose();
});

// ─── Shared object model: ONE runtime instance per entity ─────────────────────

test('projection changes mutate the SAME runtime instance (references stay valid)', async () => {
  const twin = await startedTwin();
  const before = twin.registry.players.get(PLAYER);
  const updated = { ...projectionRows()[PLAYER_TABLE].find(p => p.safebet_player_id === PLAYER), risk_score: 90 };
  assert.equal(twin.applyProjectionChange(PLAYER_TABLE, updated), true);
  const after = twin.registry.players.get(PLAYER);
  assert.equal(after, before);                      // same object, mutated in place
  assert.equal(after.riskScore, 90);
  twin.dispose();
});

test('re-assembly preserves surviving instances and their enrichments', async () => {
  const twin = await startedTwin();
  const before = twin.registry.players.get(PLAYER);
  twin.registerEngine({ engineId: 'risk-engine', enrich: o => (o.kind === 'player' ? { tier: 'watch' } : undefined) });
  twin.applyProjectionChange(PLAYER_TABLE, projectionRows()[PLAYER_TABLE].find(p => p.safebet_player_id === PLAYER));
  assert.deepEqual(getEnrichment(before, 'risk-engine'), { tier: 'watch' });
  await twin.refresh();
  const after = twin.registry.players.get(PLAYER);
  assert.equal(after, before);                      // refresh did NOT recreate it
  assert.deepEqual(getEnrichment(after, 'risk-engine'), { tier: 'watch' });
  twin.dispose();
});

test('gaming floors group the SAME machine instances — never copies', async () => {
  const twin = await startedTwin();
  const machine = twin.registry.machines.get('M-001');
  const floor = twin.registry.floors.get('Zone A – Slots');
  assert.equal(floor.machines.get('M-001'), machine);
  twin.dispose();
});

test('ended sessions leave the live model — history stays in the event log', async () => {
  const twin = await startedTwin();
  assert.equal(twin.registry.sessions.has('session-2'), false); // ended before assembly
  const live = projectionRows()[SESSION_TABLE].find(s => s.session_id === 'session-1');
  twin.applyProjectionChange(SESSION_TABLE, { ...live, status: 'ended', ended_at: new Date().toISOString() });
  assert.equal(twin.registry.sessions.has('session-1'), false);
  twin.dispose();
});

// ─── Operational questions ─────────────────────────────────────────────────────

test('the twin answers "at this exact moment" questions by assembly only', async () => {
  const twin = await startedTwin();
  assert.deepEqual(twin.activePlayers().map(p => p.playerId), [PLAYER]);
  assert.deepEqual(twin.openSessions().map(s => s.sessionId), ['session-1']);
  assert.deepEqual(twin.occupiedMachines().map(m => m.machineId), ['M-001']);
  const busiest = twin.busiestFloor();
  assert.equal(busiest.floorLocation, 'Zone A – Slots');
  assert.equal(busiest.occupiedCount, 1);
  assert.equal(busiest.occupancyRate, 1);
  const alerts = twin.operationalAlerts();
  assert.ok(alerts.some(a => a.type === 'RISK_FLAGS_PRESENT' && a.playerId === PLAYER));
  assert.ok(alerts.some(a => a.type === 'INTERVENTION_ACTIVE' && a.playerId === PLAYER));
  assert.ok(alerts.some(a => a.type === 'MONITORING_REQUIRED' && a.playerId === PLAYER));
  twin.dispose();
});

test('health reports twin freshness relative to the projections', async () => {
  const twin = await startedTwin();
  const health = twin.health();
  assert.equal(health.state, 'live');
  assert.equal(typeof health.projectionLagMs, 'number');
  assert.deepEqual(health.entityCounts, { players: 2, sessions: 1, machines: 2, floors: 2, interventions: 1 });
  twin.dispose();
});

// ─── Extension points for Phase 3.5 Shared Domain Engines ─────────────────────

test('engines enrich the same instances and never replace them', async () => {
  const twin = await startedTwin();
  const machine = twin.registry.machines.get('M-001');
  twin.registerEngine({
    engineId: 'machine-engine',
    enrich: o => (o.kind === 'machine' ? { utilisation: 'observed' } : undefined),
  });
  twin.applyProjectionChange(MACHINE_TABLE, projectionRows()[MACHINE_TABLE].find(m => m.machine_id === 'M-001'));
  assert.equal(twin.registry.machines.get('M-001'), machine);
  assert.deepEqual(getEnrichment(machine, 'machine-engine'), { utilisation: 'observed' });
  assert.deepEqual(twin.registeredEngineIds, ['machine-engine']);
  twin.dispose();
});

test('a second instance of the same engine is refused', async () => {
  const twin = await startedTwin();
  const engine = { engineId: 'risk-engine', enrich: () => undefined };
  twin.registerEngine(engine);
  assert.throws(() => twin.registerEngine({ ...engine }), /already registered/);
  twin.dispose();
});

// ─── ONE twin, no bypass, no persistence ───────────────────────────────────────

test('getDigitalTwin returns THE single twin per casino', () => {
  const a = getDigitalTwin(CASINO);
  const b = getDigitalTwin(CASINO);
  assert.equal(a, b);
  a.dispose();
  const c = getDigitalTwin(CASINO);               // disposed → a fresh single twin
  assert.notEqual(c, a);
  c.dispose();
});

test('sync refuses rows from other casinos and unknown tables', async () => {
  const twin = await startedTwin();
  const foreign = { ...projectionRows()[PLAYER_TABLE][0], casino_id: OTHER_CASINO };
  assert.equal(twin.applyProjectionChange(PLAYER_TABLE, foreign), false);
  assert.equal(twin.applyProjectionChange('casino_event_log', { casino_id: CASINO }), false);
  twin.dispose();
});

test('the twin exposes no ingestion, persistence, or business-engine surface', () => {
  const surface = Object.getOwnPropertyNames(CasinoDigitalTwin.prototype);
  const forbidden = /ingest|persist|write|save|calculate|score|decide/i;
  assert.deepEqual(surface.filter(name => forbidden.test(name)), []);
});

test('a disposed twin cannot be restarted — no zombie runtime models', async () => {
  const twin = await startedTwin();
  twin.dispose();
  assert.equal(twin.state, 'disposed');
  await assert.rejects(() => twin.start(fakeProjectionClient(projectionRows())), /disposed/);
});

// ─── Replay: rebuilding projections reconstructs the twin ─────────────────────

test('rebuilding projections from the same events reconstructs an identical twin', async () => {
  const events = floorJourney();
  const liveTwin = await startedTwin(projectionRows(events));
  const rebuiltTwin = await startedTwin(projectionRows(events)); // rebuild = same reducers, same events
  const strip = s => ({ ...s, assembledAt: null, health: null });
  assert.deepEqual(strip(rebuiltTwin.snapshot()), strip(liveTwin.snapshot()));
  liveTwin.dispose();
  rebuiltTwin.dispose();
});

// ─── Aggregates map the casino view verbatim ──────────────────────────────────

test('casino aggregates are mapped 1:1 from projection_casino_state', () => {
  const aggregates = mapAggregates({
    active_players: 3, active_sessions: 2, idle_sessions: 0, stale_sessions: 0, open_sessions: 2,
    players_active_now: 2, players_idle: 0, players_stale: 1,
    active_machines: 2, machines_in_play: 1, machines_stale: 1, registered_machines: 3,
    total_wagered: 500, total_won: 350, ggr: 150,
    risk_critical: 1, risk_high: 0, risk_medium: 1, risk_low: 1, risk_unclassified: 0,
    last_event_at: '2026-07-10T12:00:00.000Z',
  });
  assert.deepEqual(aggregates, {
    activePlayers: 3, activeSessions: 2, idleSessions: 0, staleSessions: 0, openSessions: 2,
    playersActiveNow: 2, playersIdle: 0, playersStale: 1,
    activeMachines: 2, machinesInPlay: 1, machinesStale: 1, registeredMachines: 3,
    totalWagered: 500, totalWon: 350, ggr: 150,
    riskCritical: 1, riskHigh: 0, riskMedium: 1, riskLow: 1, riskUnclassified: 0,
    lastEventAt: '2026-07-10T12:00:00.000Z',
  });
  assert.deepEqual(mapAggregates(undefined).activePlayers, 0);
});
