// Unit tests for the Enterprise Consumer Platform (Phase 3.7).
// Run: node --test tests/consumerPlatform.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE } from '../lib/projectionPlatform/readModels.ts';
import { envelopeToRow } from '../lib/eventPlatform/persistence.ts';
import { CasinoDigitalTwin } from '../lib/digitalTwin/index.ts';
import { DomainIntelligencePlatform, intelligenceOf } from '../lib/domainIntelligence/index.ts';
import { PolicyRulesPlatform } from '../lib/policyPlatform/index.ts';
import {
  getConsumerGateway, ConsumerGateway,
  VIEW_GRANTS, authorizeView, profileForRole,
  CONSUMER_PROFILES, shapeEventRow, riskLevelFor,
} from '../lib/consumerPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3';
const PLAYER_2 = 'SB-PLR-AAAA1111';
const BASE = 1_700_000_000_000;
const FIXED_NOW = BASE + 130 * 60_000;

let seq = 0;
function envelope(overrides = {}) {
  seq += 1;
  return {
    eventId: crypto.randomUUID(),
    correlationId: overrides.sessionId ?? 'corr-1',
    traceId: '11111111-1111-4111-8111-111111111111',
    tenantId: CASINO, casinoId: CASINO, jurisdiction: 'ZA',
    safeBetPlayerId: PLAYER, sessionId: 'session-1', machineId: 'M-001',
    producer: 'test', schemaVersion: 1, eventType: 'BET_PLACED',
    occurredAt: new Date(BASE + seq * 1000).toISOString(),
    receivedAt: new Date().toISOString(), processedAt: new Date().toISOString(),
    replayNumber: 0, payload: {},
    ...overrides,
  };
}

function floorJourney() {
  return [
    envelope({ eventType: 'SESSION_START', payload: { game_type: 'slots', risk_score: 20, metadata: { machine_type: 'slot', casino_floor_location: 'Zone A – Slots' } } }),
    envelope({ eventType: 'BET_PLACED', payload: { bet_amount: 100, win_amount: 40, risk_score: 35, game_type: 'slots' } }),
    envelope({ eventType: 'INTERVENTION_TRIGGERED', payload: { risk_score: 82, risk_flags: ['loss_chasing'] } }),
    envelope({
      eventType: 'SESSION_START', safeBetPlayerId: PLAYER_2, sessionId: 'session-2', machineId: 'M-040',
      payload: { game_type: 'blackjack', risk_score: 10, metadata: { machine_type: 'table', casino_floor_location: 'Zone B – Tables' } },
    }),
    envelope({ eventType: 'SESSION_END', safeBetPlayerId: PLAYER_2, sessionId: 'session-2', machineId: 'M-040', payload: { risk_score: 10 } }),
    envelope({ eventType: 'MACHINE_IDLE', safeBetPlayerId: PLAYER_2, sessionId: null, machineId: 'M-040', payload: {} }),
  ];
}

function projectionRows(events) {
  const states = reduceEnvelopes(emptyStates(), events);
  const players = Array.from(states.players.values());
  const sessions = Array.from(states.sessions.values());
  const machines = Array.from(states.machines.values());
  return {
    [PLAYER_TABLE]: players,
    [SESSION_TABLE]: sessions.filter(s => s.status === 'active'),
    [MACHINE_TABLE]: machines,
    projection_casino_state: [{
      casino_id: CASINO, active_players: 1, active_sessions: 1, active_machines: 1,
      total_wagered: 100, total_won: 40, ggr: 60,
      risk_critical: 1, risk_high: 0, risk_medium: 0, risk_low: 1,
      last_event_at: events[events.length - 1].occurredAt,
    }],
    projection_intervention_state: players.filter(p => p.intervention_count > 0).map(p => ({
      casino_id: p.casino_id, safebet_player_id: p.safebet_player_id,
      intervention_count: p.intervention_count, last_intervention_at: p.last_intervention_at,
      risk_score: p.risk_score, last_event_at: p.last_event_at,
    })),
    projection_compliance_state: players
      .filter(p => p.risk_score >= 60 || p.intervention_count > 0)
      .map(p => ({ safebet_player_id: p.safebet_player_id })),
  };
}

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

/** The full enterprise read side, wired exactly like the consumer-gateway host. */
async function gatewaySources() {
  const events = floorJourney();
  const twin = new CasinoDigitalTwin(CASINO);
  new DomainIntelligencePlatform(() => FIXED_NOW).attach(twin);
  await twin.start(fakeProjectionClient(projectionRows(events)));
  const policy = new PolicyRulesPlatform();
  return {
    twin,
    sources: {
      twin,
      recentEvents: async () => events.slice().reverse().map(envelopeToRow),
      decisions: () => policy.evaluate(twin, { jurisdiction: 'ZA' }),
    },
  };
}

const serve = (req, sources) => new ConsumerGateway().serve(req, sources);

// ─── ONE gateway, versioned contracts ─────────────────────────────────────────

test('getConsumerGateway returns THE single gateway', () => {
  assert.equal(getConsumerGateway(), getConsumerGateway());
});

test('version negotiation: v1 default, unknown versions refused', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'casino-operator', view: 'summary', casinoId: CASINO }, sources);
  assert.equal(res.contractVersion, 'v1');
  await assert.rejects(
    () => serve({ consumer: 'casino-operator', view: 'summary', casinoId: CASINO, version: 'v9' }, sources),
    /unsupported contract version 'v9' — supported: v1/,
  );
  twin.dispose();
});

test('unknown profiles and views are refused', async () => {
  const { twin, sources } = await gatewaySources();
  await assert.rejects(() => serve({ consumer: 'hacker', view: 'summary', casinoId: CASINO }, sources), /unknown consumer profile/);
  await assert.rejects(() => serve({ consumer: 'casino-operator', view: 'everything', casinoId: CASINO }, sources), /unknown view/);
  twin.dispose();
});

// ─── Authorization filters, never widens ──────────────────────────────────────

test('authorization matrix: every profile only reaches its granted views', async () => {
  CONSUMER_PROFILES.forEach(profile => assert.ok(VIEW_GRANTS[profile], `${profile} has grants`));
  assert.throws(() => authorizeView('regulator', 'live-floor'), /not authorized/);
  assert.throws(() => authorizeView('executive', 'actions'), /not authorized/);
  assert.throws(() => authorizeView('api-client', 'compliance'), /not authorized/);
  assert.doesNotThrow(() => authorizeView('regulator', 'compliance'));
  VIEW_GRANTS['administrator'].forEach(view => assert.doesNotThrow(() => authorizeView('administrator', view)));
});

test('application roles map onto consumer profiles; unknown roles get none', () => {
  assert.equal(profileForRole('casino_admin'), 'casino-operator');
  assert.equal(profileForRole('regulator'), 'regulator');
  assert.equal(profileForRole('super_admin'), 'administrator');
  assert.equal(profileForRole('compliance_officer'), 'compliance-officer');
  assert.equal(profileForRole('intruder'), null);
  assert.equal(profileForRole(undefined), null);
});

// ─── Views shape enterprise information — never recalculate it ────────────────

test('live-floor: 80-position grid, twin machines overlaid, KPIs verbatim from aggregates', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'casino-operator', view: 'live-floor', casinoId: CASINO }, sources);
  const view = res.data;
  assert.equal(view.machines.length, 80);
  const m1 = view.machines.find(m => m.machine_id === 'M-001');
  assert.equal(m1.status, 'active');
  assert.equal(m1.current_game, 'slots');
  assert.equal(m1.total_wagered_session, 100);          // projected fact, verbatim
  const aggregates = twin.casinoAggregates();
  assert.equal(view.kpi.ggr, aggregates.ggr);           // presented, not recomputed
  assert.equal(view.kpi.risk_critical, aggregates.riskCritical);
  const player = view.players.find(p => p.playerId === PLAYER);
  assert.equal(player.riskScore, 82);
  assert.equal(player.riskLevel, riskLevelFor(82));     // published banding
  assert.equal(view.interventions.length, 1);
  assert.equal(view.interventions[0].triggerType, 'loss_chasing');
  assert.ok(view.floors.length >= 2);
  twin.dispose();
});

test('activity-feed shapes distributed event rows 1:1', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'casino-operator', view: 'activity-feed', casinoId: CASINO }, sources);
  const events = res.data.events;
  assert.equal(events.length, 6);
  const bet = events.find(e => e.event_type === 'BET_PLACED');
  assert.equal(bet.player_id, PLAYER);
  assert.equal(bet.bet_amount, 100);
  assert.equal(bet.win_amount, 40);
  assert.equal(bet.machine_id, 'M-001');
  twin.dispose();
});

test('regulator compliance view: tiers, monitoring, decisions passed through verbatim', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'regulator', view: 'compliance', casinoId: CASINO }, sources);
  const view = res.data;
  assert.deepEqual(view.riskTiers, { critical: 1, high: 0, medium: 0, low: 1 });
  assert.equal(view.playersRequiringMonitoring.length, 1);
  assert.equal(view.playersRequiringMonitoring[0].playerId, PLAYER);
  const expected = sources.decisions().decisions
    .filter(d => d.action === 'REGULATOR_NOTIFICATION_REQUIRED' || d.action === 'COMPLIANCE_REVIEW_REQUIRED');
  assert.equal(view.regulatoryDecisions.length, expected.length);
  assert.ok(view.regulatoryDecisions.every(d => d.policyReference.length > 0));
  assert.ok(view.auditEvidence.eventsObserved);
  twin.dispose();
});

test('executive summary: headline decisions are critical/high only', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'executive', view: 'summary', casinoId: CASINO }, sources);
  const view = res.data;
  assert.ok(view.headlineDecisions.length > 0);
  assert.ok(view.headlineDecisions.every(d => d.priority === 'critical' || d.priority === 'high'));
  assert.ok(view.floors.every(f => typeof f.occupancyRate === 'number'));
  assert.equal(view.operationalHealth.state, 'live');
  twin.dispose();
});

test('compliance actions view: outstanding actions from intelligence, executionRequired decisions', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'compliance-officer', view: 'actions', casinoId: CASINO }, sources);
  const view = res.data;
  assert.ok(view.executionRequired.length > 0);
  assert.ok(view.executionRequired.every(d => d.executionRequired === true));
  assert.ok(view.alerts.some(a => a.type === 'INTERVENTION_ACTIVE' && a.playerId === PLAYER));
  twin.dispose();
});

// ─── Constitution guarantees ───────────────────────────────────────────────────

test('serving every view leaves the twin untouched', async () => {
  const { twin, sources } = await gatewaySources();
  const player = twin.registry.players.get(PLAYER);
  const before = JSON.stringify(player.enrichments);
  const riskBefore = player.riskScore;
  for (const [consumer, view] of [
    ['casino-operator', 'live-floor'], ['casino-operator', 'activity-feed'],
    ['regulator', 'compliance'], ['executive', 'summary'], ['compliance-officer', 'actions'],
  ]) {
    await serve({ consumer, view, casinoId: CASINO }, sources);
  }
  assert.equal(twin.registry.players.get(PLAYER), player);
  assert.equal(JSON.stringify(player.enrichments), before);
  assert.equal(player.riskScore, riskBefore);
  assert.notEqual(intelligenceOf(player), undefined);
  twin.dispose();
});

test('the gateway exposes no mutation, evaluation, or calculation surface', () => {
  const surface = Object.getOwnPropertyNames(ConsumerGateway.prototype);
  const forbidden = /insert|upsert|write|save|persist|ingest|evaluate|calculate|score|enrich/i;
  assert.deepEqual(surface.filter(n => forbidden.test(n)), []);
});

test('responses travel in the versioned consumer envelope', async () => {
  const { twin, sources } = await gatewaySources();
  const res = await serve({ consumer: 'administrator', view: 'summary', casinoId: CASINO }, sources);
  assert.equal(res.contractVersion, 'v1');
  assert.equal(res.consumer, 'administrator');
  assert.equal(res.view, 'summary');
  assert.equal(res.casinoId, CASINO);
  assert.ok(res.generatedAt);
  assert.ok(res.data);
  twin.dispose();
});

test('shapeEventRow is the client-side shaper for the distributed envelope', () => {
  const row = envelopeToRow(envelope({
    eventType: 'BET_PLACED',
    payload: { bet_amount: 50, win_amount: 120, risk_score: 42, game_type: 'roulette', outcome: 'win' },
  }));
  const shaped = shapeEventRow(row);
  assert.equal(shaped.event_type, 'BET_PLACED');
  assert.equal(shaped.bet_amount, 50);
  assert.equal(shaped.win_amount, 120);
  assert.equal(shaped.outcome, 'win');
  assert.equal(shaped.game_type, 'roulette');
  assert.equal(shaped.player_id, PLAYER);
});
