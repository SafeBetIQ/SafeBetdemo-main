// ─── SafeBet Guardian — synthetic policy + proposed-action fixtures (ARCH-V4-C8) ─
// SYNTHETIC only. No real policy, legal authority, regulator, provider, or enforcement.

import type { PolicyVersionFixture, ProposedActionInput } from './types.ts';

export const SYNTHETIC_POLICY_VERSIONS: Record<string, PolicyVersionFixture> = {
  // Active ZA-GP policy: permits DOMAIN_BLOCK (review required) + MONITOR_ONLY; denies PAYMENT_REFERRAL.
  'POLV-0001-1': {
    policyId: 'POL-SYNTH-0001', versionId: 'POLV-0001-1', jurisdiction: 'ZA-GP', status: 'ACTIVE', authorityReference: 'SYN-AUTH-REF-0001',
    effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: '2027-12-31T00:00:00Z',
    permittedActions: [{ actionType: 'DOMAIN_BLOCK', permitted: true, reviewRequired: true }, { actionType: 'MONITOR_ONLY', permitted: true, reviewRequired: false }, { actionType: 'PAYMENT_REFERRAL', permitted: false, reviewRequired: true }],
    minEvidenceTypes: 1, requiredLegalReview: true, exceptions: [], maxAuthorisationDays: 90,
  },
  // Expired policy.
  'POLV-0002-1': {
    policyId: 'POL-SYNTH-0002', versionId: 'POLV-0002-1', jurisdiction: 'ZA-GP', status: 'EXPIRED', authorityReference: 'SYN-AUTH-REF-0002',
    effectiveFrom: '2020-01-01T00:00:00Z', effectiveUntil: '2023-12-31T00:00:00Z',
    permittedActions: [{ actionType: 'DOMAIN_BLOCK', permitted: true, reviewRequired: true }],
    minEvidenceTypes: 1, requiredLegalReview: true, exceptions: [], maxAuthorisationDays: 90,
  },
  // Superseded policy version.
  'POLV-0003-1': {
    policyId: 'POL-SYNTH-0003', versionId: 'POLV-0003-1', jurisdiction: 'ZA-GP', status: 'SUPERSEDED', authorityReference: 'SYN-AUTH-REF-0003',
    effectiveFrom: '2025-01-01T00:00:00Z', effectiveUntil: '2027-12-31T00:00:00Z',
    permittedActions: [{ actionType: 'DOMAIN_BLOCK', permitted: true, reviewRequired: true }],
    minEvidenceTypes: 1, requiredLegalReview: true, exceptions: [], maxAuthorisationDays: 90,
  },
  // Active policy requiring MANUAL_ESCALATION_REQUIRED exception → BLOCKED/escalation.
  'POLV-0004-1': {
    policyId: 'POL-SYNTH-0004', versionId: 'POLV-0004-1', jurisdiction: 'ZA-GP', status: 'ACTIVE', authorityReference: 'SYN-AUTH-REF-0004',
    effectiveFrom: '2026-01-01T00:00:00Z', effectiveUntil: '2027-12-31T00:00:00Z',
    permittedActions: [{ actionType: 'DOMAIN_BLOCK', permitted: true, reviewRequired: true }],
    minEvidenceTypes: 1, requiredLegalReview: true, exceptions: ['MANUAL_ESCALATION_REQUIRED'], maxAuthorisationDays: 90,
  },
};

/** A canonical valid ZA-GP proposed DOMAIN_BLOCK with one VERIFIED evidence item. */
export function syntheticProposedAction(over: Partial<ProposedActionInput> = {}): ProposedActionInput {
  return {
    proposedActionId: 'PA-SYNTH-0001', caseReference: 'GC-INTAKE-0001', jurisdiction: 'ZA-GP',
    actionType: 'DOMAIN_BLOCK', targetType: 'DOMAIN', targetReference: 'licensed-example-003.test',
    policyVersion: SYNTHETIC_POLICY_VERSIONS['POLV-0001-1'],
    evidence: [{ evidenceReference: 'EV-REF-0001', integrityStatus: 'VERIFIED', jurisdiction: 'ZA-GP' }],
    evidenceManifestReference: 'EXPORT-SYNTH-0001', evidenceManifestHash: 'a'.repeat(64), proposedBy: 'syn-inv-001', ...over,
  };
}
