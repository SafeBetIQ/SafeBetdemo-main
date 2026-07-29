// Unit tests for the Enterprise Policy & Rules Platform (Phase 3.6).
// Run: node --test tests/policyPlatform.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyStates, reduceEnvelopes } from '../lib/projectionPlatform/apply.ts';
import { PLAYER_TABLE, SESSION_TABLE, MACHINE_TABLE } from '../lib/projectionPlatform/readModels.ts';
import { CasinoDigitalTwin } from '../lib/digitalTwin/index.ts';
import { DomainIntelligencePlatform, intelligenceOf } from '../lib/domainIntelligence/index.ts';
import { evaluateCondition, validateCondition } from '../lib/policyPlatform/conditions.ts';
import {
  PolicyRulesPlatform, getPolicyPlatform, validateRule,
  defaultConfiguration, JURISDICTION_EXTENSION_POINTS,
} from '../lib/policyPlatform/index.ts';

const CASINO = '00000000-0000-0000-0000-000000000001';
const OTHER_CASINO = '00000000-0000-0000-0000-000000000002';
const PLAYER = 'SB-PLR-707371C3';
const PLAYER_2 = 'SB-PLR-AAAA1111';
const BASE = 1_700_000_000_000;
const FIXED_NOW = BASE + 130 * 60_000; // 130 minutes into the journey

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

function projectionRows() {
  const states = reduceEnvelopes(emptyStates(), floorJourney());
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
      last_event_at: new Date(BASE + 6000).toISOString(),
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

async function enrichedTwin({ withIntelligence = true } = {}) {
  const twin = new CasinoDigitalTwin(CASINO);
  if (withIntelligence) new DomainIntelligencePlatform(() => FIXED_NOW).attach(twin);
  await twin.start(fakeProjectionClient(projectionRows()));
  return twin;
}

// ─── Condition language ────────────────────────────────────────────────────────

test('conditions compare declaratively: ops, nesting, missing facts', () => {
  const facts = { riskScore: 82, riskFlags: ['loss_chasing'], intelligence: { risk: { escalationLevel: 'critical' } } };
  assert.equal(evaluateCondition({ path: 'riskScore', op: 'gte', value: 80 }, facts), true);
  assert.equal(evaluateCondition({ path: 'riskFlags', op: 'contains', value: 'loss_chasing' }, facts), true);
  assert.equal(evaluateCondition({ path: 'intelligence.risk.escalationLevel', op: 'in', value: ['elevated', 'critical'] }, facts), true);
  assert.equal(evaluateCondition({ all: [{ path: 'riskScore', op: 'gt', value: 80 }, { not: { path: 'missing', op: 'exists' } }] }, facts), true);
  assert.equal(evaluateCondition({ any: [{ path: 'riskScore', op: 'lt', value: 10 }, { path: 'riskScore', op: 'eq', value: 82 }] }, facts), true);
  // a comparison on a missing fact is FALSE — policies never invent evidence
  assert.equal(evaluateCondition({ path: 'intelligence.behaviour.lossRatio', op: 'gte', value: 0 }, facts), false);
});

test('malformed conditions and rules are rejected, never repaired', () => {
  assert.throws(() => validateCondition({ path: 'x', op: 'between' }, 'test'), /unknown op/);
  assert.throws(() => validateCondition({ all: [] }, 'test'), /non-empty/);
  assert.throws(() => validateRule({ policyId: 'X', scope: 'nope' }), /unknown scope/);
  assert.throws(() => validateRule({
    policyId: 'X', scope: 'platform', appliesTo: 'player', action: 'DO_MAGIC',
    priority: 'high', reason: 'r', policyReference: 'ref', executionRequired: false,
    when: { path: 'a', op: 'eq', value: 1 },
  }), /unknown action/);
});

// ─── ONE platform, configuration-driven ────────────────────────────────────────

test('THE policy platform ships one validated default configuration', () => {
  const platform = new PolicyRulesPlatform();
  assert.equal(platform.policyCount, defaultConfiguration().length);
  assert.equal(getPolicyPlatform(), getPolicyPlatform()); // ONE platform
});

test('policy change is a configuration change — no code changes', async () => {
  const twin = await enrichedTwin();
  const platform = new PolicyRulesPlatform();
  const before = platform.evaluate(twin, { jurisdiction: 'ZA' });
  assert.equal(before.decisions.some(d => d.policyId === 'TEST-VIP-50'), false);
  // a new rule arrives as pure data (e.g. from a database or regulator feed)
  platform.configure([...platform.policies, {
    policyId: 'TEST-VIP-50', scope: 'operator', appliesTo: 'player',
    when: { path: 'totalWagered', op: 'gte', value: 50 },
    action: 'OPERATIONAL_RECOMMENDATION', priority: 'low',
    reason: 'test threshold', policyReference: 'test', executionRequired: false,
  }]);
  const after = platform.evaluate(twin, { jurisdiction: 'ZA' });
  assert.equal(after.decisions.some(d => d.policyId === 'TEST-VIP-50' && d.subject.id === PLAYER), true);
  twin.dispose();
});

// ─── Evaluation over the enriched twin ─────────────────────────────────────────

test('ZA evaluation returns the expected decisions, priority-ordered', async () => {
  const twin = await enrichedTwin();
  const set = new PolicyRulesPlatform().evaluate(twin, { jurisdiction: 'ZA' });
  assert.deepEqual(set.decisions.map(d => d.policyId),
    ['RG-001', 'ZA-RG-001', 'RG-003', 'ZA-REP-001', 'OP-003', 'PLT-001', 'RG-005', 'ZA-RG-002']);
  assert.equal(set.jurisdiction, 'ZA');
  assert.equal(set.casinoId, CASINO);
  assert.ok(set.policiesEvaluated > 0 && set.subjectsEvaluated >= 6); // 2 players, 1 session, 2 machines, 2 floors? + casino
  twin.dispose();
});

test('decisions carry full provenance and READ confidence from intelligence', async () => {
  const twin = await enrichedTwin();
  const set = new PolicyRulesPlatform().evaluate(twin, { jurisdiction: 'ZA' });
  const d = set.decisions.find(x => x.policyId === 'ZA-RG-001');
  assert.equal(d.action, 'INTERVENTION_REQUIRED');
  assert.equal(d.priority, 'critical');
  assert.equal(d.executionRequired, true);
  assert.equal(d.subject.kind, 'player');
  assert.equal(d.subject.id, PLAYER);
  assert.equal(d.jurisdiction, 'ZA');
  assert.match(d.policyReference, /National Gambling Act/);
  assert.equal(d.confidence, intelligenceOf(twin.registry.players.get(PLAYER)).risk.riskConfidence);
  const casinoDecision = set.decisions.find(x => x.policyId === 'ZA-REP-001');
  assert.equal(casinoDecision.subject.kind, 'casino');
  const floorDecision = set.decisions.find(x => x.policyId === 'OP-003');
  assert.equal(floorDecision.subject.kind, 'floor');
  assert.equal(floorDecision.subject.id, 'Zone A – Slots');
  twin.dispose();
});

test('jurisdiction packs select by configuration — no forks', async () => {
  const twin = await enrichedTwin();
  const platform = new PolicyRulesPlatform();
  const bw = platform.evaluate(twin, { jurisdiction: 'BW' });
  assert.equal(bw.decisions.some(d => d.policyId.indexOf('ZA-') === 0), false);
  assert.equal(bw.decisions.some(d => d.policyId === 'BW-RG-001'), true); // 82 ≥ 75
  const ke = platform.evaluate(twin, { jurisdiction: 'KE' });
  assert.equal(ke.decisions.some(d => d.policyId === 'KE-RG-001'), true);
  assert.equal(ke.decisions.some(d => d.policyId === 'BW-RG-001'), false);
  // a jurisdiction with no pack still gets the platform-wide baselines
  const na = platform.evaluate(twin, { jurisdiction: 'NA' });
  assert.equal(na.decisions.some(d => d.policyId === 'RG-001'), true);
  assert.equal(na.decisions.some(d => d.scope === 'jurisdiction'), false);
  twin.dispose();
});

test('operator-scoped rules apply only to their casino', async () => {
  const twin = await enrichedTwin();
  const platform = new PolicyRulesPlatform([{
    policyId: 'OPX-1', scope: 'operator', casinoId: OTHER_CASINO, appliesTo: 'player',
    when: { path: 'totalWagered', op: 'gte', value: 0 },
    action: 'OPERATIONAL_RECOMMENDATION', priority: 'low',
    reason: 'other operator only', policyReference: 'test', executionRequired: false,
  }]);
  assert.equal(platform.evaluate(twin, { jurisdiction: 'ZA' }).decisions.length, 0);
  platform.configure([{
    policyId: 'OPX-2', scope: 'operator', casinoId: CASINO, appliesTo: 'player',
    when: { path: 'totalWagered', op: 'gte', value: 0 },
    action: 'OPERATIONAL_RECOMMENDATION', priority: 'low',
    reason: 'this operator', policyReference: 'test', executionRequired: false,
  }]);
  assert.equal(platform.evaluate(twin, { jurisdiction: 'ZA' }).decisions.length, 2); // both players
  twin.dispose();
});

// ─── Constitution guarantees ───────────────────────────────────────────────────

test('evaluation leaves the twin untouched — decisions only, no enrichment', async () => {
  const twin = await enrichedTwin();
  const player = twin.registry.players.get(PLAYER);
  const enrichmentsBefore = JSON.stringify(player.enrichments);
  const riskBefore = player.riskScore;
  new PolicyRulesPlatform().evaluate(twin, { jurisdiction: 'ZA' });
  assert.equal(JSON.stringify(player.enrichments), enrichmentsBefore); // no policy enrichment
  assert.equal(player.riskScore, riskBefore);
  assert.deepEqual(Object.keys(player.enrichments), ['domain-intelligence']); // intelligence only
  twin.dispose();
});

test('the platform never recalculates intelligence — absent intelligence, rules simply do not fire', async () => {
  const twin = await enrichedTwin({ withIntelligence: false });
  const set = new PolicyRulesPlatform().evaluate(twin, { jurisdiction: 'ZA' });
  // intelligence-dependent policies are silent…
  assert.equal(set.decisions.some(d => d.policyId === 'RG-001'), false);
  assert.equal(set.decisions.some(d => d.policyId === 'ZA-RG-001'), false);
  // …twin-fact policies still decide…
  assert.equal(set.decisions.some(d => d.policyId === 'RG-005' && d.subject.id === PLAYER), true);
  // …and the platform did NOT compute intelligence to fill the gap.
  assert.equal(intelligenceOf(twin.registry.players.get(PLAYER)), undefined);
  twin.dispose();
});

test('the platform exposes no execution, persistence, or analysis surface', () => {
  const surface = Object.getOwnPropertyNames(PolicyRulesPlatform.prototype);
  const forbidden = /execute|persist|write|save|insert|upsert|enrich|calculate|score|analyse|predict/i;
  assert.deepEqual(surface.filter(n => forbidden.test(n)), []);
});

test('evaluation is deterministic', async () => {
  const twin = await enrichedTwin();
  const platform = new PolicyRulesPlatform();
  const strip = set => set.decisions.map(({ decisionId, evaluatedAt, ...rest }) => rest);
  assert.deepEqual(
    strip(platform.evaluate(twin, { jurisdiction: 'ZA' })),
    strip(platform.evaluate(twin, { jurisdiction: 'ZA' })),
  );
  twin.dispose();
});

test('future African jurisdictions are registered extension points', () => {
  assert.deepEqual(JURISDICTION_EXTENSION_POINTS.map(j => j.code), ['NA', 'NG', 'GH', 'MU']);
  JURISDICTION_EXTENSION_POINTS.forEach(j => assert.equal(j.status, 'configuration-pending'));
});
