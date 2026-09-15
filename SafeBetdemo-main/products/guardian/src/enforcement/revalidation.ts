// ─── SafeBet Guardian — authorisation revalidation (ARCH-V4-C9 §4/§5) ─────────
// C9 may consume ONLY a valid C8 AuthorisedActionContract, revalidated immediately before
// dispatch (no stale snapshot). Expired/withdrawn/superseded/scope-mutated/missing-field →
// ORCHESTRATION BLOCKED, no provider request generated.

import type { AuthorisedActionSnapshot, OrchestrationReasonCode } from './types.ts';
import type { ActionType, TargetType } from '../authorisation/types.ts';

export interface RequestedScope { actionType: ActionType; targetType: TargetType; targetReference: string; jurisdiction: string }

export interface RevalidationVerdict { ok: boolean; reasonCodes: OrchestrationReasonCode[] }

/** Revalidate an authorised action against the CURRENT time and the requested scope. */
export function revalidateAuthorisation(a: AuthorisedActionSnapshot | null, requested: RequestedScope, now: Date = new Date()): RevalidationVerdict {
  const reasons: OrchestrationReasonCode[] = [];
  if (!a) return { ok: false, reasonCodes: ['AUTHORISATION_NOT_FOUND'] };
  if (a.status !== 'AUTHORISED') reasons.push(a.status === 'WITHDRAWN' ? 'AUTHORISATION_WITHDRAWN' : a.status === 'SUPERSEDED' ? 'AUTHORISATION_SUPERSEDED' : a.status === 'EXPIRED' ? 'AUTHORISATION_EXPIRED' : 'AUTHORISATION_NOT_AUTHORISED');
  if (a.expiresAt && now.getTime() > Date.parse(a.expiresAt)) reasons.push('AUTHORISATION_EXPIRED');
  if (!a.jurisdiction || a.jurisdiction !== requested.jurisdiction) reasons.push('JURISDICTION_INVALID');
  if (!a.policyReference) reasons.push('POLICY_REFERENCE_MISSING');
  if (!a.authorityReference) reasons.push('AUTHORITY_REFERENCE_MISSING');
  if (!a.evidenceManifestReference || !a.evidenceManifestHash) reasons.push('EVIDENCE_MANIFEST_MISSING');
  // Scope immutability: C9 cannot widen/mutate the authorised scope (§18/§44).
  if (a.actionType !== requested.actionType || a.targetType !== requested.targetType || a.targetReference !== requested.targetReference) reasons.push('SCOPE_MUTATED');
  return { ok: reasons.length === 0, reasonCodes: dedupe(reasons) };
}

function dedupe<T>(x: T[]): T[] { return x.filter((v, i) => x.indexOf(v) === i); }
