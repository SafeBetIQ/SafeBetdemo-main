// ─── SafeBet Guardian — C9 Orchestration Reference Contract resolver (ARCH-V4-C10 §13/§14) ─
//
// The TS side of the bounded C9 Orchestration Reference Contract. C10 consumes ONLY these bounded
// fields (never the C9 enforcement_orchestration / provider_response / enforcement_verification
// base tables). Mirrors the DB view guardian.orchestration_reference.

import type { OrchestrationReferenceSnapshot } from './types.ts';

export interface OrchestrationReferenceRow {
  orchestration_reference: string;
  authorisation_reference: string;
  action_type: string;
  target_type: string;
  target_reference: string;
  jurisdiction: string;
  provider_channel: string | null;
  orchestration_status: string;
  latest_provider_state: string | null;
  latest_verification_state: string | null;
  created_at: string | null;
  closed_at: string | null;
  reference_status: string | null;
}

/** Resolve a bounded orchestration reference from a contract-view row (or null → not found). */
export function resolveOrchestrationReference(row: OrchestrationReferenceRow | null | undefined): OrchestrationReferenceSnapshot {
  if (!row) {
    return {
      orchestrationReference: 'unknown', authorisationReference: 'unknown', actionType: 'MONITOR_ONLY',
      targetType: 'UNKNOWN', targetReference: 'unknown', jurisdiction: 'unknown', providerChannel: null,
      orchestrationStatus: 'UNKNOWN', latestProviderState: null, latestVerificationState: null,
      createdAt: null, closedAt: null, referenceStatus: 'REFERENCE_NOT_FOUND',
    };
  }
  return {
    orchestrationReference: row.orchestration_reference, authorisationReference: row.authorisation_reference,
    actionType: row.action_type, targetType: row.target_type, targetReference: row.target_reference,
    jurisdiction: row.jurisdiction, providerChannel: row.provider_channel, orchestrationStatus: row.orchestration_status,
    latestProviderState: row.latest_provider_state, latestVerificationState: row.latest_verification_state,
    createdAt: row.created_at, closedAt: row.closed_at, referenceStatus: 'ACTIVE',
  };
}

/** Historic verification is immutable: a prior VERIFIED state remains historically true for its
 *  observation time even after a later re-entry candidate is appended (§4/§26/§30). */
export function historicVerificationIsImmutable(snapshot: OrchestrationReferenceSnapshot): boolean {
  return snapshot.latestVerificationState === 'VERIFIED';
}
