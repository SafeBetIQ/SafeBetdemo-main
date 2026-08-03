// Tests for the Regulator Intelligence Portal (v1.2).
// Run: node --test tests/regulatorPortal.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shapeNationalOverview, shapeCrossOperator, shapeOperatorCompliance,
  shapeInvestigation, buildEvidencePackage, shapeRegulatoryReport,
  REGULATOR_VIEWS,
} from '../lib/consumerPlatform/regulator.ts';
import { VIEW_GRANTS, authorizeView, ConsumerAuthorizationError } from '../lib/consumerPlatform/index.ts';
import { ConsumerGateway } from '../lib/consumerPlatform/gateway.ts';

const P1 = 'SB-PLR-707371C39AE04D71BBA3E495';
const P2 = 'SB-PLR-AAAA1111BBBB2222CCCC3333';

// A national rollup exactly as sbiq_regulator_national() returns it.
function nationalRollup() {
  return {
    jurisdiction: 'ZA', operators: 2,
    active_players: 40, observed_players: 40, players_active_now: 6, active_sessions: 30, active_machines: 28,
    risk_critical: 2, risk_high: 5, risk_medium: 12, risk_low: 21,
    total_wagered: 500000, ggr: 90000, players_monitored: 7, interventions: 4,
    last_event_at: '2026-07-14T12:00:00Z',
    operators_detail: [
      { casino_id: 'a1b2c3d4-0000-0000-0000-000000000001', casino_name: 'Prestige Casino', province: 'Gauteng',
        active_players: 25, players_active_now: 4, active_sessions: 18, active_machines: 16,
        risk_critical: 2, risk_high: 3, risk_medium: 8, risk_low: 12,
        total_wagered: 300000, ggr: 55000, players_monitored: 5, interventions: 3, last_event_at: '2026-07-14T12:00:00Z' },
      { casino_id: 'cc000003-0000-0000-0000-000000000003', casino_name: 'Royal Palace', province: 'KwaZulu-Natal',
        active_players: 15, players_active_now: 2, active_sessions: 12, active_machines: 12,
        risk_critical: 0, risk_high: 2, risk_medium: 4, risk_low: 9,
        total_wagered: 200000, ggr: 35000, players_monitored: 2, interventions: 1, last_event_at: '2026-07-14T11:00:00Z' },
    ],
  };
}

// ─── WS1 National overview — composed facts, evidence-classified ──────────────

test('national overview aggregates projected facts and classifies evidence', () => {
  const v = shapeNationalOverview(nationalRollup());
  assert.equal(v.operators, 2);
  assert.equal(v.activePlayers, 6);      // ACTIVE NOW (freshness) = sum of per-casino active-now
  assert.equal(v.observedPlayers, 40);   // OBSERVED = sum of per-casino observed
  assert.deepEqual(v.riskTiers, { critical: 2, high: 5, medium: 12, low: 21 });
  assert.equal(v.playersMonitored, 7);
  assert.equal(v.interventions, 4);
  assert.equal(v.operatorHealth.length, 2);
  assert.equal(v.evidence.activePlayers, 'recorded-fact');
  assert.equal(v.evidence.emergingRisks, 'derived-intelligence');
  assert.ok(v.emergingRisks.some(r => r.code === 'CRITICAL_RISK_PRESENT'));
});

// ─── WS2 Cross-operator — AGGREGATE only, per-player linkage denied ────────────

test('cross-operator intelligence is aggregate-only and documents the privacy boundary', () => {
  const v = shapeCrossOperator(nationalRollup());
  assert.equal(v.identityModel, 'per-operator-anonymous');
  assert.equal(v.perPlayerLinkage, 'not-available-by-design');
  assert.equal(v.operators.length, 2);
  assert.equal(v.operators[0].interventionRate, Math.round((3 / 25) * 1000) / 1000);
  assert.deepEqual(v.nationalRiskDistribution, { critical: 2, high: 5, medium: 12, low: 21 });
  assert.match(v.note, /denied by the Identity Policy/);
  // No player-level identifiers anywhere in a cross-operator view.
  assert.ok(!JSON.stringify(v).includes('SB-PLR-'));
});

// ─── WS5 Operator compliance — status read from projected facts ───────────────

test('operator compliance status derives from projected tiers/monitoring, not recomputed risk', () => {
  const v = shapeOperatorCompliance(nationalRollup());
  const prestige = v.operators.find(o => o.name === 'Prestige Casino');
  const royal = v.operators.find(o => o.name === 'Royal Palace');
  assert.equal(prestige.complianceStatus, 'attention'); // has critical
  assert.equal(royal.complianceStatus, 'monitor');       // monitored but no critical
});

// ─── WS3 Investigation — timeline is recorded fact; classified throughout ─────

function investigationInput() {
  return {
    playerId: P1, casinoId: 'a1b2c3d4-0000-0000-0000-000000000001',
    events: [
      { event_id: 'e1', event_type: 'SESSION_START', occurred_at: '2026-07-14T10:00:00Z', machine_id: 'M-001', session_id: 's1', payload: {} },
      { event_id: 'e2', event_type: 'BET_PLACED', occurred_at: '2026-07-14T10:01:00Z', machine_id: 'M-001', session_id: 's1', payload: { bet_amount: 100, win_amount: 20 } },
      { event_id: 'e3', event_type: 'INTERVENTION_TRIGGERED', occurred_at: '2026-07-14T10:05:00Z', machine_id: 'M-001', session_id: 's1', payload: { risk_score: 82 } },
    ],
    intelligence: { risk: { escalationLevel: 'critical', dynamicRiskScore: 82 } },
    interventionCount: 1, lastInterventionAt: '2026-07-14T10:05:00Z',
    decisions: [
      { decisionId: 'd1', policyId: 'ZA-RG-001', scope: 'jurisdiction', jurisdiction: 'ZA', action: 'INTERVENTION_REQUIRED', priority: 'critical', reason: 'r', policyReference: 'ZA Act s.16', confidence: 0.3, executionRequired: true, subject: { kind: 'player', id: P1, casinoId: 'a1b2c3d4-0000-0000-0000-000000000001' }, evaluatedAt: '' },
      { decisionId: 'd2', policyId: 'OP-001', scope: 'operator', jurisdiction: null, action: 'OPERATIONAL_RECOMMENDATION', priority: 'low', reason: 'r', policyReference: 'ref', confidence: 1, executionRequired: false, subject: { kind: 'machine', id: 'M-001', casinoId: 'a1b2c3d4-0000-0000-0000-000000000001' }, evaluatedAt: '' },
    ],
  };
}

test('investigation composes recorded timeline + derived intelligence + policy decisions', () => {
  const v = shapeInvestigation(investigationInput());
  assert.equal(v.playerId, P1);
  assert.equal(v.timeline.length, 3);
  assert.ok(v.timeline.every(e => e.evidenceClass === 'recorded-fact'));
  assert.equal(v.timeline[1].amounts.bet, 100);
  assert.equal(v.intelligence.risk.escalationLevel, 'critical');
  // only THIS player's decisions (the machine decision is excluded)
  assert.equal(v.decisions.length, 1);
  assert.equal(v.decisions[0].policyId, 'ZA-RG-001');
  assert.equal(v.replayReference.deterministic, true);
  assert.equal(v.evidence.timeline, 'recorded-fact');
  assert.equal(v.evidence.intelligence, 'derived-intelligence');
  assert.equal(v.evidence.decisions, 'policy-decision');
});

// ─── WS4 Evidence package — every section classified, attested ────────────────

test('evidence package classifies every section and references deterministic replay', () => {
  const pkg = buildEvidencePackage(shapeInvestigation(investigationInput()), 'ZA');
  assert.equal(pkg.sections.length, 4);
  assert.deepEqual(pkg.sections.map(s => s.evidenceClass), ['recorded-fact', 'derived-intelligence', 'policy-decision', 'recorded-fact']);
  assert.equal(pkg.subject.jurisdiction, 'ZA');
  assert.match(pkg.attestation, /no PII/);
  assert.equal(pkg.replayReference.source, 'casino_event_log');
});

// ─── WS6 Reporting — export-ready sections, evidence-classified ────────────────

test('regulatory report renders classified sections from projected facts', () => {
  const r = shapeRegulatoryReport('intervention-statistics', nationalRollup());
  assert.equal(r.title, 'Intervention Statistics');
  assert.equal(r.sections.length, 2);
  assert.equal(r.sections[0].evidenceClass, 'recorded-fact');
  assert.equal(r.sections[1].rows.length, 2);
});

// ─── Permissions + composition-only guarantees ────────────────────────────────

test('regulator grants cover all regulator views; operators are refused them', () => {
  for (const view of REGULATOR_VIEWS) {
    assert.doesNotThrow(() => authorizeView('regulator', view));
    assert.throws(() => authorizeView('casino-operator', view), ConsumerAuthorizationError);
    assert.throws(() => authorizeView('executive', view), ConsumerAuthorizationError);
  }
});

test('serveRegulator refuses a non-regulator view and enforces grants', async () => {
  const gw = new ConsumerGateway();
  const sources = { jurisdiction: 'ZA', national: async () => nationalRollup() };
  await assert.rejects(() => gw.serveRegulator({ consumer: 'regulator', view: 'live-floor' }, sources), /not a regulator view/);
  await assert.rejects(() => gw.serveRegulator({ consumer: 'executive', view: 'national-overview' }, sources), /not authorized/);
  const res = await gw.serveRegulator({ consumer: 'regulator', view: 'national-overview' }, sources);
  assert.equal(res.view, 'national-overview');
  assert.equal(res.data.operators, 2);
});

test('the portal recalculates nothing: shapers only read rollup values', () => {
  // Same input → identical output (pure composition).
  const a = shapeNationalOverview(nationalRollup());
  const b = shapeNationalOverview(nationalRollup());
  const strip = v => ({ ...v, generatedAt: null });
  assert.deepEqual(strip(a), strip(b));
});
