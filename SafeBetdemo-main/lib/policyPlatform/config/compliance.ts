// ─── Compliance policy pack — CONFIGURATION (Phase 3.6) ──────────────────────
//
// Platform-wide compliance baseline: evidence, audit readiness and
// outstanding-action obligations, decided over Compliance Intelligence.

import type { PolicyRule } from '../model.ts';

export const COMPLIANCE_POLICIES: PolicyRule[] = [
  {
    policyId: 'CMP-001',
    scope: 'compliance',
    appliesTo: 'player',
    when: { path: 'intelligence.compliance.complianceReadiness', op: 'eq', value: 'attention_required' },
    action: 'COMPLIANCE_REVIEW_REQUIRED',
    priority: 'high',
    reason: 'Compliance posture needs attention — outstanding actions are recorded on this player.',
    policyReference: 'SafeBet IQ Compliance Baseline §1.1 (outstanding actions)',
    executionRequired: true,
  },
  {
    policyId: 'CMP-002',
    scope: 'compliance',
    appliesTo: 'player',
    when: { path: 'intelligence.compliance.auditReady', op: 'eq', value: false },
    action: 'COMPLIANCE_REVIEW_REQUIRED',
    priority: 'medium',
    reason: 'Player journey evidence is incomplete — audit readiness must be restored.',
    policyReference: 'SafeBet IQ Compliance Baseline §2.1 (audit evidence)',
    executionRequired: false,
  },
  {
    policyId: 'CMP-003',
    scope: 'compliance',
    appliesTo: 'casino',
    when: { path: 'riskCritical', op: 'gte', value: 5 },
    action: 'COMPLIANCE_REVIEW_REQUIRED',
    priority: 'high',
    reason: 'Critical-risk cohort is large — a portfolio-level compliance review is required.',
    policyReference: 'SafeBet IQ Compliance Baseline §3.1 (portfolio review)',
    executionRequired: true,
  },
];
