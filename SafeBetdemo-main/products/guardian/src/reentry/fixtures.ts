// ─── SafeBet Guardian — synthetic re-entry fixtures (ARCH-V4-C10) ─────────────
// SYNTHETIC only. No real orchestration/observation/provider/crawl. These stand in for the
// bounded C9 Orchestration Reference Contract + synthetic re-entry signals + explicit C8
// authority-coverage metadata a real deployment would read from governed contract views.

import type {
  OrchestrationReferenceSnapshot, ReentrySignal, AuthorityCoverageMetadata,
} from './types.ts';

/** A prior C9 orchestration that reached ACTIONED + VERIFIED (historic verified state). */
export function syntheticVerifiedOrchestration(over: Partial<OrchestrationReferenceSnapshot> = {}): OrchestrationReferenceSnapshot {
  return {
    orchestrationReference: 'ORCH-SYNTH-0001', authorisationReference: 'AUTH-SYNTH-0001',
    actionType: 'DOMAIN_BLOCK', targetType: 'DOMAIN', targetReference: 'licensed-example-003.test',
    jurisdiction: 'ZA-GP', providerChannel: 'PCH-SYNTH-DNS-ZAGP', orchestrationStatus: 'VERIFIED',
    latestProviderState: 'ACTIONED', latestVerificationState: 'VERIFIED',
    createdAt: '2026-09-12T00:00:00Z', closedAt: null, referenceStatus: 'ACTIVE', ...over,
  };
}

/** No re-entry: the enforced target remains unavailable on follow-up. */
export const SIGNAL_STILL_UNAVAILABLE: ReentrySignal = {
  signalType: 'NONE', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-003.test',
  observedState: 'TARGET_UNAVAILABLE', sourceReference: 'SYN-OBS-0001', evidenceReference: null,
};

/** Same original target reappears (available again). */
export const SIGNAL_SAME_TARGET_AVAILABLE: ReentrySignal = {
  signalType: 'ORIGINAL_TARGET_REAPPEARED', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-003.test',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0002', evidenceReference: 'EVID-SYNTH-RE-0001',
  sharedReferences: { domain: 'licensed-example-003.test' },
};

export const SIGNAL_KNOWN_ALIAS: ReentrySignal = {
  signalType: 'ALIAS', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-003-alias.test',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0003', evidenceReference: 'EVID-SYNTH-RE-0002',
  sharedReferences: { brand: 'BRAND-SYNTH-01' },
};

export const SIGNAL_MIRROR: ReentrySignal = {
  signalType: 'MIRROR', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-003-mirror.test',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0004', evidenceReference: 'EVID-SYNTH-RE-0003',
};

export const SIGNAL_APP_RELISTING: ReentrySignal = {
  signalType: 'APP_RELISTING', candidateTargetType: 'MOBILE_APP', candidateTargetReference: 'com.synthetic.reentry.app01',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0005', evidenceReference: 'EVID-SYNTH-RE-0004',
  sharedReferences: { app: 'com.synthetic.reentry.app01' },
};

export const SIGNAL_PAYMENT_REUSE: ReentrySignal = {
  signalType: 'PAYMENT_REUSE', candidateTargetType: 'MERCHANT', candidateTargetReference: 'MER-SYNTH-REUSE-01',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0006', evidenceReference: 'EVID-SYNTH-RE-0005',
  sharedReferences: { payment: 'MER-SYNTH-REUSE-01' },
};

export const SIGNAL_GEO_CHANGE: ReentrySignal = {
  signalType: 'GEO_CHANGE', candidateTargetType: 'SERVICE', candidateTargetReference: 'SVC-SYNTH-GEO-01',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0007', evidenceReference: 'EVID-SYNTH-RE-0006',
};

/** Operator signal WITH two corroborating shared references (may reach ENTITY_RELATIONSHIP). */
export const SIGNAL_OPERATOR_STRONG: ReentrySignal = {
  signalType: 'OPERATOR', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-004.test',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0008', evidenceReference: 'EVID-SYNTH-RE-0007',
  sharedReferences: { operator: 'OP-SYNTH-01', payment: 'MER-SYNTH-REUSE-01' },
};

/** Operator signal with only ONE weak shared reference (must NOT assert same entity). */
export const SIGNAL_OPERATOR_WEAK: ReentrySignal = {
  signalType: 'OPERATOR', candidateTargetType: 'DOMAIN', candidateTargetReference: 'licensed-example-005.test',
  observedState: 'TARGET_AVAILABLE', sourceReference: 'SYN-OBS-0009', evidenceReference: 'EVID-SYNTH-RE-0008',
  sharedReferences: { operator: 'OP-SYNTH-02' },
};

// ── Explicit authority-coverage metadata fixtures (only EXPLICIT statements support coverage) ──
export function coverageExplicit(over: Partial<AuthorityCoverageMetadata> = {}): AuthorityCoverageMetadata {
  return {
    authorisationReference: 'AUTH-SYNTH-0001', status: 'AUTHORISED', jurisdiction: 'ZA-GP',
    explicitlyCoversRelationshipTypes: ['SAME_TARGET_REAPPEARED'],
    explicitlyCoversTargetReferences: ['licensed-example-003.test'], ...over,
  };
}
export const COVERAGE_EXPIRED: AuthorityCoverageMetadata = { authorisationReference: 'AUTH-SYNTH-0001', status: 'EXPIRED', jurisdiction: 'ZA-GP' };
export const COVERAGE_WITHDRAWN: AuthorityCoverageMetadata = { authorisationReference: 'AUTH-SYNTH-0001', status: 'WITHDRAWN', jurisdiction: 'ZA-GP' };
