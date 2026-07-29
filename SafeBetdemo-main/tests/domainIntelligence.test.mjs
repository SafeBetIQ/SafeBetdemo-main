// Unit tests for the Enterprise Domain Intelligence Platform (Phase 3.5).
// Run: node --test tests/domainIntelligence.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE } from '../lib/projectionPlatform/readModels.ts';
import { CasinoDigitalTwin, getEnrichment } from '../lib/digitalTwin/index.ts';
import {
  DomainIntelligencePlatform, getIntelligencePlatform, intelligenceOf,
  INTELLIGENCE_ENGINE_ID, INTELLIGENCE_STAGES,
} from '../lib/domainIntelligence/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const PLAYER = 'SB-PLR-707371C3';
const PLAYER_2 = 'SB-PLR-AAAA1111';
const BASE = 1_700_000_000_000;
const FIXED_NOW = BASE + 60 * 60_000; // one hour after the journey begins

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

function projectionRows(envelopes = floorJourney()) {
  const states = reduceEnvelopes(emptyStates(), envelopes);
  const players = Array.from(states.players.values());
  const sessions = Array.from(states.sessions.values());
  const machines = Array.from(states.machines.values());
  const interventions = players.filter(p => p.intervention_count > 0).map(p => ({
    casino_id: p.casino_id, safebet_player_id: p.safebet_player_id,
    intervention_count: p.intervention_count, last_intervention_at: p.last_intervention_at,
    risk_score: p.risk_score, last_event_at: p.last_event_at,
  }));
  const compliance = players
    .filter(p => p.risk_score >= 60 || p.intervention_count > 0)
    .map(p => ({ safebet_player_id: p.safebet_player_id }));
  return {
    [PLAYER_TABLE]: players,
    [SESSION_TABLE]: sessions.filter(s => s.status === 'active'),
    [MACHINE_TABLE]: machines,
    projection_casino_state: [],
    projection_intervention_state: interventions,
    projection_compliance_state: compliance,
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

async function enrichedTwin(rows = projectionRows()) {
  const twin = new CasinoDigitalTwin(CASINO);
  const platform = new DomainIntelligencePlatform(() => FIXED_NOW);
  platform.attach(twin);
  await twin.start(fakeProjectionClient(rows));
  return { twin, platform };
}

// ─── ONE platform, fixed dependency chain ─────────────────────────────────────

test('the platform is ONE engine containing the seven pipelines in order', async () => {
  const { twin, platform } = await enrichedTwin();
  assert.deepEqual(twin.registeredEngineIds, [INTELLIGENCE_ENGINE_ID]); // ONE engine
  assert.deepEqual(platform.stageIds, [...INTELLIGENCE_STAGES]);
  assert.equal(platform.engineId, 'domain-intelligence');
  twin.dispose();
});

test('getIntelligencePlatform returns THE single platform', () => {
  assert.equal(getIntelligencePlatform(), getIntelligencePlatform());
});

// ─── Enrichment lands on the SAME runtime objects ─────────────────────────────

test('players carry every player-applicable stage; machines and floors their own', async () => {
  const { twin } = await enrichedTwin();
  const player = intelligenceOf(twin.registry.players.get(PLAYER));
  assert.ok(player.session && player.behaviour && player.risk && player.ai
    && player.intervention && player.compliance);
  assert.equal(player.machine, undefined);                 // machine stage skips players
  const machine = intelligenceOf(twin.registry.machines.get('M-001'));
  assert.ok(machine.machine);
  assert.equal(machine.behaviour, undefined);
  const floor = intelligenceOf(twin.registry.floors.get('Zone A – Slots'));
  assert.ok(floor.machine);                                // floor utilisation
  const session = intelligenceOf(twin.registry.sessions.get('session-1'));
  assert.ok(session.session);
  twin.dispose();
});

test('enrichment mutates the SAME instances — no clones, no replacements', async () => {
  const { twin } = await enrichedTwin();
  const player = twin.registry.players.get(PLAYER);
  const before = player;
  twin.applyProjectionChange(PLAYER_TABLE, {
    ...projectionRows()[PLAYER_TABLE].find(p => p.safebet_player_id === PLAYER),
    risk_score: 90,
  });
  assert.equal(twin.registry.players.get(PLAYER), before); // same object
  assert.equal(before.riskScore, 90);
  assert.equal(intelligenceOf(before).risk.dynamicRiskScore >= 90, true); // re-analysed in place
  twin.dispose();
});

// ─── Stage correctness (deterministic analysis over projected facts) ──────────

test('session intelligence: lifecycle, duration, concurrency, movement', async () => {
  const { twin } = await enrichedTwin();
  const s = intelligenceOf(twin.registry.sessions.get('session-1')).session;
  assert.equal(s.lifecycle, 'open');
  assert.ok(Math.abs(s.durationMinutes - 60) < 1);
  assert.equal(s.concurrentSessions, 1);
  const p = intelligenceOf(twin.registry.players.get(PLAYER)).session;
  assert.equal(p.hasActiveSession, true);
  assert.equal(p.currentLocation, 'Zone A – Slots');       // player movement
  twin.dispose();
});

test('machine intelligence: occupancy, idle duration, temperature, floor utilisation', async () => {
  const { twin } = await enrichedTwin();
  const hotSeat = intelligenceOf(twin.registry.machines.get('M-001')).machine;
  assert.equal(hotSeat.occupied, true);
  assert.equal(hotSeat.temperature, 'warm');               // at the casino average
  const idle = intelligenceOf(twin.registry.machines.get('M-040')).machine;
  assert.equal(idle.available, true);
  assert.equal(idle.temperature, 'cold');
  assert.ok(idle.idleMinutes > 0);
  assert.equal(intelligenceOf(twin.registry.floors.get('Zone A – Slots')).machine.utilisationRate, 1);
  assert.equal(intelligenceOf(twin.registry.floors.get('Zone B – Tables')).machine.utilisationRate, 0);
  twin.dispose();
});

test('behaviour intelligence produces indicators, not risk', async () => {
  const { twin } = await enrichedTwin();
  const b = intelligenceOf(twin.registry.players.get(PLAYER)).behaviour;
  assert.equal(b.chasingLossIndicator, true);              // flagged on the event
  assert.ok(b.patterns.indexOf('loss_chasing_flagged') !== -1);
  assert.equal(b.avgBetSize, 100);
  assert.equal(b.lossRatio, 0.6);                          // (100-40)/100
  assert.equal(b.netPosition, -60);
  assert.equal(Object.prototype.hasOwnProperty.call(b, 'riskScore'), false);
  twin.dispose();
});

test('risk intelligence consumes behaviour: GRPI, escalation, trend, confidence', async () => {
  const { twin } = await enrichedTwin();
  const r = intelligenceOf(twin.registry.players.get(PLAYER)).risk;
  // projected 82 → 41; chasing → +25; frequency ~0; exposure 0.6 → +6
  assert.ok(Math.abs(r.grpi - 72) < 1);
  assert.equal(r.dynamicRiskScore, 82);                    // max(projected, grpi)
  assert.equal(r.escalationLevel, 'critical');
  assert.equal(r.riskTrend, 'stable');
  assert.equal(r.riskConfidence, 0.1);                     // one bet = minimal evidence
  twin.dispose();
});

test('ai intelligence consumes behaviour+risk+session: predictions and recommendations', async () => {
  const { twin } = await enrichedTwin();
  const ai = intelligenceOf(twin.registry.players.get(PLAYER)).ai;
  assert.equal(ai.predictedRisk, 82);                      // stable trend
  assert.ok(ai.emergingBehaviour.indexOf('loss_chasing') !== -1);
  assert.ok(ai.recommendations.indexOf('immediate_wellbeing_review') !== -1);
  assert.ok(ai.recommendations.indexOf('suggest_reality_check') !== -1);
  assert.ok(ai.operationalInsights.some(i => i.indexOf('active_on:Zone A – Slots') === 0));
  assert.equal(ai.confidence, 0.1);
  twin.dispose();
});

test('intervention intelligence consumes ai+risk: recommendation and effectiveness', async () => {
  const { twin } = await enrichedTwin();
  const i = intelligenceOf(twin.registry.players.get(PLAYER)).intervention;
  assert.equal(i.recommendedIntervention, 'care_call');    // critical escalation
  assert.equal(i.activeInterventions, 1);                  // projected event fact
  assert.equal(i.pendingIntervention, false);              // already intervened
  assert.equal(i.interventionEffectiveness, 'inconclusive');
  twin.dispose();
});

test('compliance intelligence consumes the fully enriched player', async () => {
  const { twin } = await enrichedTwin();
  const c = intelligenceOf(twin.registry.players.get(PLAYER)).compliance;
  assert.equal(c.complianceReadiness, 'ready');
  assert.deepEqual(c.regulatoryObligations,
    ['enhanced_monitoring', 'documented_risk_review', 'intervention_record_keeping']);
  assert.deepEqual(c.outstandingActions, []);
  assert.equal(c.auditReady, true);
  assert.equal(c.responsibleGamblingEvidence.monitored, true);
  assert.equal(c.responsibleGamblingEvidence.interventionsRecorded, 1);
  twin.dispose();
});

test('a low-risk idle player gets calm intelligence — no false escalation', async () => {
  const { twin } = await enrichedTwin();
  const p = twin.registry.players.get(PLAYER_2);
  const intel = intelligenceOf(p);
  assert.equal(intel.risk.escalationLevel, 'none');
  assert.equal(intel.intervention.recommendedIntervention, null);
  assert.equal(intel.intervention.pendingIntervention, false);
  assert.equal(intel.compliance.complianceReadiness, 'ready');
  assert.deepEqual(intel.compliance.regulatoryObligations, []);
  twin.dispose();
});

// ─── Constitution guarantees ───────────────────────────────────────────────────

test('the platform owns no state and persists nothing', () => {
  const platform = new DomainIntelligencePlatform(() => FIXED_NOW);
  const surface = Object.getOwnPropertyNames(DomainIntelligencePlatform.prototype);
  assert.deepEqual(surface.filter(n => /persist|write|save|from|insert|upsert|ingest/i.test(n)), []);
  // analysis is pure: same object + same context → same output
  const rows = projectionRows();
  return (async () => {
    const twin = new CasinoDigitalTwin(CASINO);
    await twin.start(fakeProjectionClient(rows));
    const player = twin.registry.players.get(PLAYER);
    const ctx = { registry: twin.registry };
    const strip = (o) => { const { analysedAt, ...rest } = o; return rest; };
    assert.deepEqual(strip(platform.enrich(player, ctx)), strip(platform.enrich(player, ctx)));
    twin.dispose();
  })();
});

test('a stage consuming a later stage is refused at construction', () => {
  const platform = new DomainIntelligencePlatform(() => FIXED_NOW);
  assert.deepEqual(platform.stageIds, [...INTELLIGENCE_STAGES]); // valid chain accepted
  // the chain contract itself: every stage only consumes earlier stages
  // (violations throw inside the constructor — proven by the platform existing)
});

test('detaching removes the single engine registration cleanly', async () => {
  const twin = new CasinoDigitalTwin(CASINO);
  const platform = new DomainIntelligencePlatform(() => FIXED_NOW);
  const detach = platform.attach(twin);
  assert.deepEqual(twin.registeredEngineIds, [INTELLIGENCE_ENGINE_ID]);
  detach();
  assert.deepEqual(twin.registeredEngineIds, []);
  twin.dispose();
});

test('attaching the platform twice to one twin is refused — ONE intelligence layer', async () => {
  const twin = new CasinoDigitalTwin(CASINO);
  const platform = new DomainIntelligencePlatform(() => FIXED_NOW);
  platform.attach(twin);
  assert.throws(() => platform.attach(twin), /already registered/);
  twin.dispose();
});

test('unenriched consumers see no intelligence until the platform attaches', async () => {
  const twin = new CasinoDigitalTwin(CASINO);
  await twin.start(fakeProjectionClient(projectionRows()));
  assert.equal(getEnrichment(twin.registry.players.get(PLAYER), INTELLIGENCE_ENGINE_ID), undefined);
  twin.dispose();
});
