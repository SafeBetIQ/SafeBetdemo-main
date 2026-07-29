// ─── Jurisdiction policy packs — CONFIGURATION (Phase 3.6) ───────────────────
//
// Regulator-defined rules selected by jurisdiction code at evaluation time.
// Adding a jurisdiction = adding a rule array here (or loading one from an
// external source) — ZERO code changes, no jurisdiction-specific forks.
// Every pack runs through the SAME evaluator over the SAME enriched twin.

import type { PolicyRule } from '../model.ts';

/** South Africa — National Gambling Board. */
export const ZA_POLICIES: PolicyRule[] = [
  {
    policyId: 'ZA-RG-001',
    scope: 'jurisdiction',
    jurisdiction: 'ZA',
    appliesTo: 'player',
    when: { path: 'intelligence.risk.dynamicRiskScore', op: 'gte', value: 80 },
    action: 'INTERVENTION_REQUIRED',
    priority: 'critical',
    reason: 'Dynamic risk meets the ZA problem-gambling intervention threshold.',
    policyReference: 'ZA National Gambling Act 7 of 2004, s.16 (problem gambling)',
    executionRequired: true,
    confidenceFrom: 'intelligence.risk.riskConfidence',
  },
  {
    policyId: 'ZA-RG-002',
    scope: 'jurisdiction',
    jurisdiction: 'ZA',
    appliesTo: 'session',
    when: { path: 'intelligence.session.durationMinutes', op: 'gte', value: 120 },
    action: 'RESPONSIBLE_GAMBLING_ACTION_REQUIRED',
    priority: 'medium',
    reason: 'Session exceeds the ZA continuous-play limit — offer a break (stricter than baseline).',
    policyReference: 'ZA NGB Responsible Gambling Code, continuous play (120 min)',
    executionRequired: true,
  },
  {
    policyId: 'ZA-REP-001',
    scope: 'jurisdiction',
    jurisdiction: 'ZA',
    appliesTo: 'casino',
    when: { path: 'riskCritical', op: 'gte', value: 1 },
    action: 'REGULATOR_NOTIFICATION_REQUIRED',
    priority: 'high',
    reason: 'One or more critically-at-risk players present — NGB notification obligations apply.',
    policyReference: 'ZA NGB reporting directive (critical-risk cohort)',
    executionRequired: true,
  },
  {
    policyId: 'ZA-CMP-001',
    scope: 'jurisdiction',
    jurisdiction: 'ZA',
    appliesTo: 'player',
    when: {
      all: [
        { path: 'interventionCount', op: 'gte', value: 1 },
        { path: 'intelligence.intervention.interventionEffectiveness', op: 'eq', value: 'ineffective' },
      ],
    },
    action: 'COMPLIANCE_REVIEW_REQUIRED',
    priority: 'high',
    reason: 'Prior intervention was ineffective — the intervention strategy needs a documented review.',
    policyReference: 'ZA NGB intervention effectiveness review',
    executionRequired: true,
  },
];

/** Botswana — Gambling Authority (stricter intervention threshold). */
export const BW_POLICIES: PolicyRule[] = [
  {
    policyId: 'BW-RG-001',
    scope: 'jurisdiction',
    jurisdiction: 'BW',
    appliesTo: 'player',
    when: { path: 'intelligence.risk.dynamicRiskScore', op: 'gte', value: 75 },
    action: 'INTERVENTION_REQUIRED',
    priority: 'critical',
    reason: 'Dynamic risk meets the Botswana intervention threshold (75).',
    policyReference: 'BW Gambling Act 2012, responsible gambling provisions',
    executionRequired: true,
    confidenceFrom: 'intelligence.risk.riskConfidence',
  },
  {
    policyId: 'BW-REP-001',
    scope: 'jurisdiction',
    jurisdiction: 'BW',
    appliesTo: 'casino',
    when: { path: 'riskCritical', op: 'gte', value: 3 },
    action: 'REGULATOR_NOTIFICATION_REQUIRED',
    priority: 'medium',
    reason: 'Critical-risk cohort exceeds the Botswana notification threshold.',
    policyReference: 'BW Gambling Authority reporting requirements',
    executionRequired: true,
  },
];

/** Kenya — Betting Control and Licensing Board. */
export const KE_POLICIES: PolicyRule[] = [
  {
    policyId: 'KE-RG-001',
    scope: 'jurisdiction',
    jurisdiction: 'KE',
    appliesTo: 'player',
    when: { path: 'intelligence.risk.escalationLevel', op: 'in', value: ['elevated', 'critical'] },
    action: 'MONITORING_REQUIRED',
    priority: 'high',
    reason: 'Player escalation requires monitoring under BCLB responsible-gambling guidance.',
    policyReference: 'KE BCLB responsible gambling guidelines',
    executionRequired: false,
  },
  {
    policyId: 'KE-REP-001',
    scope: 'jurisdiction',
    jurisdiction: 'KE',
    appliesTo: 'casino',
    when: { path: 'riskHigh', op: 'gte', value: 5 },
    action: 'REGULATOR_NOTIFICATION_REQUIRED',
    priority: 'medium',
    reason: 'High-risk cohort exceeds the BCLB notification threshold.',
    policyReference: 'KE BCLB reporting requirements',
    executionRequired: true,
  },
];

/**
 * Registered extension points: jurisdictions awaiting regulator
 * configuration. Each becomes live by supplying a PolicyRule[] — the
 * evaluator, twin and intelligence layers need no changes.
 */
export const JURISDICTION_EXTENSION_POINTS = [
  { code: 'NA', name: 'Namibia', authority: 'Gambling Board of Namibia', status: 'configuration-pending' },
  { code: 'NG', name: 'Nigeria', authority: 'National Lottery Regulatory Commission / state gaming boards', status: 'configuration-pending' },
  { code: 'GH', name: 'Ghana', authority: 'Gaming Commission of Ghana', status: 'configuration-pending' },
  { code: 'MU', name: 'Mauritius', authority: 'Gambling Regulatory Authority', status: 'configuration-pending' },
] as const;

export const JURISDICTION_POLICIES: PolicyRule[] = [
  ...ZA_POLICIES,
  ...BW_POLICIES,
  ...KE_POLICIES,
];
