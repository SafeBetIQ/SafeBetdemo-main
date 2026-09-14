// ─── SafeBet Guardian — Authorised Action Contract (ARCH-V4-C8 → C9 handoff) ──
//
// A bounded, immutable snapshot that a FUTURE C9 enforcement-orchestration milestone will
// consume. C8 DEFINES this contract but NEVER invokes C9 and NEVER performs any external
// action. Only status=AUTHORISED, not expired, not withdrawn is eligible for future C9
// consumption (eligibility helper below).

import type { AuthorisationDecision, ActionType, TargetType, AuthorisationStatus } from './types.ts';

export interface AuthorisedActionContract {
  authorisationReference: string;
  actionType: ActionType;
  targetType: TargetType;
  targetReference: string;
  jurisdiction: string;
  policyReference: string | null;
  authorityReference: string | null;
  caseReference: string;
  evidenceManifestReference: string | null;
  evidenceManifestHash: string | null;
  authorisedAt: string | null;
  expiresAt: string | null;
  conditions: string[];
  status: AuthorisationStatus;
  // Present so any consumer can see C8 performed no execution/notification.
  isEnforcementExecuted: false;
  isProviderNotified: false;
}

export function toAuthorisedActionContract(d: AuthorisationDecision, extra: { authorisationReference: string; authorityReference: string | null; authorisedAt: string | null; conditions?: string[]; evidenceManifestReference?: string | null }): AuthorisedActionContract {
  return {
    authorisationReference: extra.authorisationReference,
    actionType: d.actionType, targetType: d.scopeSnapshot.targetType, targetReference: d.targetReference,
    jurisdiction: d.jurisdiction, policyReference: d.policyVersionId, authorityReference: extra.authorityReference,
    caseReference: d.caseReference, evidenceManifestReference: extra.evidenceManifestReference ?? null, evidenceManifestHash: d.evidenceManifestHash,
    authorisedAt: extra.authorisedAt, expiresAt: d.expiresAt, conditions: extra.conditions ?? [], status: d.authorisationStatus,
    isEnforcementExecuted: false, isProviderNotified: false,
  };
}

/** Future-C9 eligibility: ONLY an AUTHORISED, not-expired, not-withdrawn record qualifies.
 *  C8 does not consume this — it is a read-only gate for a later milestone. */
export function isEligibleForOrchestration(c: AuthorisedActionContract, now: Date = new Date()): boolean {
  if (c.status !== 'AUTHORISED') return false;
  if (c.expiresAt && now.getTime() > Date.parse(c.expiresAt)) return false;
  return true;
}
