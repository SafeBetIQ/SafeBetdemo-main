// ─── Responsible Gambling baseline policies — CONFIGURATION (Phase 3.6) ──────
//
// Platform-wide RG floor that applies in every jurisdiction; jurisdiction
// packs tighten it, never weaken it. Pure data: every rule is a
// JSON-serializable PolicyRule — changing thresholds is a configuration
// change, not a code change.

import type { PolicyRule } from '../model.ts';

export const RESPONSIBLE_GAMBLING_POLICIES: PolicyRule[] = [
  {
    policyId: 'RG-001',
    scope: 'responsible-gambling',
    appliesTo: 'player',
    when: { path: 'intelligence.risk.escalationLevel', op: 'eq', value: 'critical' },
    action: 'INTERVENTION_REQUIRED',
    priority: 'critical',
    reason: 'Player risk escalation is critical — an intervention is required now.',
    policyReference: 'SafeBet IQ RG Baseline §1.1 (critical escalation)',
    executionRequired: true,
    confidenceFrom: 'intelligence.risk.riskConfidence',
  },
  {
    policyId: 'RG-002',
    scope: 'responsible-gambling',
    appliesTo: 'player',
    when: { path: 'intelligence.risk.escalationLevel', op: 'eq', value: 'elevated' },
    action: 'RESPONSIBLE_GAMBLING_ACTION_REQUIRED',
    priority: 'high',
    reason: 'Player risk escalation is elevated — apply the recommended responsible-gambling action.',
    policyReference: 'SafeBet IQ RG Baseline §1.2 (elevated escalation)',
    executionRequired: true,
    confidenceFrom: 'intelligence.risk.riskConfidence',
  },
  {
    policyId: 'RG-003',
    scope: 'responsible-gambling',
    appliesTo: 'player',
    when: { path: 'intelligence.behaviour.chasingLossIndicator', op: 'eq', value: true },
    action: 'MONITORING_REQUIRED',
    priority: 'high',
    reason: 'Loss-chasing behaviour indicators are present — enhanced monitoring is required.',
    policyReference: 'SafeBet IQ RG Baseline §2.1 (loss chasing)',
    executionRequired: false,
  },
  {
    policyId: 'RG-004',
    scope: 'responsible-gambling',
    appliesTo: 'session',
    when: { path: 'intelligence.session.durationMinutes', op: 'gte', value: 180 },
    action: 'RESPONSIBLE_GAMBLING_ACTION_REQUIRED',
    priority: 'medium',
    reason: 'Session has exceeded the baseline continuous-play limit — a mandatory break is due.',
    policyReference: 'SafeBet IQ RG Baseline §3.1 (session duration, 180 min)',
    executionRequired: true,
  },
  {
    policyId: 'RG-005',
    scope: 'responsible-gambling',
    appliesTo: 'player',
    when: { path: 'requiresMonitoring', op: 'eq', value: true },
    action: 'MONITORING_REQUIRED',
    priority: 'medium',
    reason: 'Player is a compliance-monitoring cohort member — continue active monitoring.',
    policyReference: 'SafeBet IQ RG Baseline §2.2 (monitoring cohort)',
    executionRequired: false,
  },
];
