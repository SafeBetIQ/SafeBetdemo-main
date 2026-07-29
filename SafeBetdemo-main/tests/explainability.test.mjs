// Tests for Explainable Intelligence (v1.4).
// Run: node --test tests/explainability.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  explainPlayer, shapeAiPerformance, shapeExecutiveIntelligence,
} from '../lib/consumerPlatform/explain.ts';

const PLR = 'SB-PLR-707371C39AE04D71BBA3E495';
const CASINO = 'a1b2c3d4-0000-0000-0000-000000000001';

// The Domain Intelligence enrichment as the certified platform already produced it.
function intelligence() {
  return {
    session: { hasActiveSession: true, durationMinutes: 95, currentLocation: 'Zone A – Slots' },
    behaviour: { chasingLossIndicator: true, patterns: ['loss_chasing_flagged', 'rapid_betting'], playStyle: 'burst', betFrequency: 7, lossRatio: 0.6 },
    risk: { grpi: 72, dynamicRiskScore: 82, escalationLevel: 'critical', riskTrend: 'stable', riskConfidence: 0.3 },
    ai: { predictedRisk: 82, emergingBehaviour: ['loss_chasing', 'acceleration'], recommendations: ['immediate_wellbeing_review', 'suggest_reality_check'], confidence: 0.3 },
    intervention: { recommendedIntervention: 'care_call', activeInterventions: 1, pendingIntervention: false, interventionEffectiveness: 'inconclusive' },
    compliance: { complianceReadiness: 'ready', regulatoryObligations: ['enhanced_monitoring'] },
  };
}

function input(overrides = {}) {
  return {
    playerId: PLR, casinoId: CASINO,
    player: { riskScore: 82, riskFlags: ['loss_chasing'], totalWagered: 150, totalWon: 40, betCount: 5, interventionCount: 1, lastInterventionAt: '2026-07-14T10:05:00Z', requiresMonitoring: true },
    intelligence: intelligence(),
    decisions: [
      { decisionId: 'd1', policyId: 'ZA-RG-001', scope: 'jurisdiction', jurisdiction: 'ZA', action: 'INTERVENTION_REQUIRED', priority: 'critical', reason: 'Dynamic risk meets the ZA threshold.', policyReference: 'ZA National Gambling Act s.16', confidence: 0.3, executionRequired: true, subject: { kind: 'player', id: PLR, casinoId: CASINO }, evaluatedAt: '' },
    ],
    events: [
      { event_id: 'e1', event_type: 'BET_PLACED', occurred_at: '2026-07-14T10:00:00Z', payload: { bet_amount: 100 } },
      { event_id: 'e2', event_type: 'INTERVENTION_TRIGGERED', occurred_at: '2026-07-14T10:05:00Z', payload: { risk_score: 82 } },
    ],
    ...overrides,
  };
}

// ─── WS1 Explainable intelligence — reads existing intelligence, phrases it ───

test('explanation summarises risk from the EXISTING intelligence (no recalculation)', () => {
  const ex = explainPlayer(input());
  assert.equal(ex.source, 'domain-intelligence');            // provenance: the ONE engine
  assert.equal(ex.summary.riskLevel, 'critical');            // read verbatim from risk.escalationLevel
  assert.equal(ex.summary.dynamicRiskScore, 82);             // not recomputed
  assert.equal(ex.summary.confidence, 0.3);
  assert.equal(ex.summary.trend, 'stable');
  assert.match(ex.summary.headline, /immediate attention/);
});

test('contributing indicators come from each intelligence stage, classified as derived', () => {
  const ex = explainPlayer(input());
  assert.ok(ex.contributingIndicators.behavioural.some(i => i.indicator === 'loss-chasing'));
  assert.ok(ex.contributingIndicators.behavioural.every(i => i.evidenceClass === 'derived-intelligence'));
  assert.ok(ex.contributingIndicators.session.some(i => i.indicator === 'session-duration'));
  assert.ok(ex.contributingIndicators.machine.some(i => i.value === 'Zone A – Slots'));
});

test('supporting evidence is Recorded Fact from projections/events', () => {
  const ex = explainPlayer(input());
  assert.ok(ex.supportingEvidence.every(i => i.evidenceClass === 'recorded-fact'));
  assert.ok(ex.supportingEvidence.some(i => i.indicator === 'total-wagered' && i.value === 150));
  assert.ok(ex.supportingEvidence.some(i => i.indicator === 'interventions'));
});

// ─── WS2 Decision timeline — Recorded → Derived → Policy → Recommended → Outcome

test('decision timeline traces the full chain with correct stages', () => {
  const ex = explainPlayer(input());
  const stages = ex.decisionTimeline.map(s => s.stage);
  assert.ok(stages.includes('recorded-fact'));
  assert.ok(stages.includes('derived-intelligence'));
  assert.ok(stages.includes('policy-decision'));
  assert.ok(stages.includes('recommended-intervention'));
  assert.ok(stages.includes('recorded-outcome'));
  const policy = ex.decisionTimeline.find(s => s.stage === 'policy-decision');
  assert.match(policy.detail, /National Gambling Act/);       // references the real policy
});

// ─── WS3 Recommendation — reason, confidence, benefit; operator decides ───────

test('recommendation explains WHY with confidence, and never automates', () => {
  const ex = explainPlayer(input());
  assert.equal(ex.recommendation.action, 'care_call');
  assert.match(ex.recommendation.reason, /critical/);
  assert.equal(ex.recommendation.confidence, 0.3);
  assert.match(ex.recommendation.expectedBenefit, /imminent harm/);
  assert.match(ex.recommendation.note, /operator decides/);
  assert.equal(ex.recommendation.evidenceClass, 'policy-decision');
});

test('a low-risk player yields a calm explanation and no forced action', () => {
  const calm = input({
    intelligence: { risk: { escalationLevel: 'none', dynamicRiskScore: 10, riskTrend: 'stable', riskConfidence: 0.1 }, behaviour: {}, session: {}, ai: {}, intervention: { recommendedIntervention: null } },
    player: { riskScore: 10, riskFlags: [], totalWagered: 20, totalWon: 5, betCount: 1, interventionCount: 0, lastInterventionAt: null, requiresMonitoring: false },
    decisions: [], events: [],
  });
  const ex = explainPlayer(calm);
  assert.equal(ex.summary.riskLevel, 'none');
  assert.equal(ex.recommendation, null);                     // nothing forced
});

// ─── Provenance + no-recalculation guarantees ─────────────────────────────────

test('the explainer NEVER recomputes intelligence — absent intelligence yields an empty-but-valid explanation', () => {
  const ex = explainPlayer({ playerId: PLR, casinoId: CASINO, player: null, intelligence: null, decisions: [], events: [] });
  assert.equal(ex.source, 'domain-intelligence');
  assert.equal(ex.summary.riskLevel, 'none');                // read default, not computed
  assert.deepEqual(ex.contributingIndicators.behavioural, []);
  assert.deepEqual(ex.triggerSequence, []);
});

test('explanation is pure: identical input → identical output', () => {
  const strip = (v) => ({ ...v, generatedAt: null });
  assert.deepEqual(strip(explainPlayer(input())), strip(explainPlayer(input())));
});

// ─── WS4 AI Performance (evaluation only) ─────────────────────────────────────

test('AI performance composes intelligence outputs — evaluation, no training', () => {
  const v = shapeAiPerformance({
    casinoId: CASINO,
    aggregates: { riskCritical: 1, riskHigh: 3, riskMedium: 8, riskLow: 12 },
    players: [
      { intelligence: { risk: { riskConfidence: 0.3, riskTrend: 'rising' } }, interventionCount: 1, requiresMonitoring: true },
      { intelligence: { risk: { riskConfidence: 0.9, riskTrend: 'stable' } }, interventionCount: 0, requiresMonitoring: false },
    ],
  });
  assert.deepEqual(v.riskDistribution, { critical: 1, high: 3, medium: 8, low: 12 });
  assert.equal(v.interventions.recorded, 1);
  assert.equal(v.confidenceCalibration.averageConfidence, 0.6);
  assert.equal(v.confidenceCalibration.sampleSize, 2);
  assert.match(v.predictionTrend, /rising/);
  assert.match(v.note, /No model training/);
});

// ─── WS5 Executive Intelligence ───────────────────────────────────────────────

test('executive intelligence composes certified aggregates into strategic view', () => {
  const v = shapeExecutiveIntelligence({
    casinoId: CASINO,
    aggregates: { activePlayers: 25, ggr: 55000, riskCritical: 2, riskHigh: 3 },
    playersMonitored: 5, interventions: 3, busiestOccupancy: 0.9, emerging: ['acceleration'],
  });
  assert.ok(v.strategicRisks.some(r => /critical risk/.test(r)));
  assert.equal(v.wellbeingIndicators.playersMonitored, 5);
  assert.equal(v.operationalPerformance.ggr, 55000);
  assert.deepEqual(v.emergingTrends, ['acceleration']);
  assert.match(v.note, /No recalculation/);
});
