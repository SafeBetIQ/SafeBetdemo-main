// ─── SafeBet Guardian — authorisation gate (ARCH-V4-C8) ───────────────────────
//
// The safety-critical deterministic gate. AUTHORISED requires ALL of: current+applicable
// policy; action permitted by policy; authority present; jurisdiction match; complete legal
// review (SUFFICIENT_FOR_AUTHORISATION_REVIEW); evidence present + integrity VERIFIED;
// separation of duties (Investigator != Legal Reviewer != Authorising Officer); a HUMAN
// Authorising Officer (never SYSTEM_SERVICE — machine authorisation impossible); bounded scope;
// no unresolved blocking exception. Any failure -> AUTHORIZATION_BLOCKED + explicit reason
// codes. C8 NEVER executes or notifies a provider (isEnforcementExecuted / isProviderNotified
// are ALWAYS false).

import { evaluatePolicyApplicability } from './policy.ts';
import type { ProposedActionInput, AuthorisationPrincipals, AuthorisationDecision, AuthReasonCode } from './types.ts';

const AUTHORISED_WINDOW_DEFAULT_DAYS = 90;

export function evaluateAuthorisation(inp: ProposedActionInput, who: AuthorisationPrincipals): AuthorisationDecision {
  const now = who.now ?? new Date();
  const reasons: AuthReasonCode[] = [];
  const policy = inp.policyVersion;
  const applicability = evaluatePolicyApplicability(policy, { jurisdiction: inp.jurisdiction, actionType: inp.actionType, now });

  // Policy gates.
  if (!policy) reasons.push('POLICY_NOT_FOUND');
  else {
    if (applicability === 'EXPIRED') reasons.push('POLICY_EXPIRED');
    if (applicability === 'SUPERSEDED') reasons.push('POLICY_SUPERSEDED');
    if (policy.jurisdiction !== inp.jurisdiction) reasons.push('JURISDICTION_MISMATCH');
    if (!policy.authorityReference) reasons.push('AUTHORITY_NOT_ESTABLISHED');
    const perm = policy.permittedActions.find((p) => p.actionType === inp.actionType);
    if (!perm || !perm.permitted) reasons.push('ACTION_TYPE_NOT_PERMITTED');
    if (policy.exceptions.includes('MANUAL_ESCALATION_REQUIRED') || policy.exceptions.includes('COURT_REVIEW_REQUIRED')) reasons.push('POLICY_EXCEPTION_ESCALATION');
    if (policy.requiredLegalReview && who.legalReviewOutcome !== 'SUFFICIENT_FOR_AUTHORISATION_REVIEW') {
      reasons.push(who.legalReviewOutcome == null ? 'LEGAL_REVIEW_REQUIRED' : 'LEGAL_REVIEW_INCOMPLETE');
    }
    // Evidence gate (hard): required count + integrity VERIFIED + jurisdiction match.
    const usable = inp.evidence.filter((e) => e.jurisdiction === inp.jurisdiction);
    if (usable.length < Math.max(1, policy.minEvidenceTypes)) reasons.push('EVIDENCE_MISSING');
    if (usable.some((e) => e.integrityStatus === 'INTEGRITY_FAILED')) reasons.push('EVIDENCE_INTEGRITY_FAILED');
    if (usable.length > 0 && usable.every((e) => e.integrityStatus !== 'VERIFIED')) reasons.push('EVIDENCE_MISSING');
  }

  // Jurisdiction of the proposed action vs evidence.
  if (inp.evidence.some((e) => e.jurisdiction !== inp.jurisdiction)) reasons.push('JURISDICTION_MISMATCH');

  // Separation of duties: the three duties must be three distinct principals.
  const ids = [who.investigatorId, who.legalReviewerId, who.authorisingOfficerId];
  if (new Set(ids).size !== 3) reasons.push('SOD_VIOLATION');

  // Final authorisation MUST be a HUMAN Authorising Officer (never SYSTEM_SERVICE).
  if (who.authorisingOfficerRole !== 'AUTHORISING_OFFICER') reasons.push('AUTHORISER_NOT_PERMITTED');

  // Scope must be bounded (a concrete target + type + jurisdiction).
  if (!inp.targetReference || !inp.targetType || !inp.jurisdiction) reasons.push('SCOPE_INVALID');

  const reasonCodes = dedupe(reasons);
  const authorised = reasonCodes.length === 0;
  const expiresAt = authorised ? new Date(now.getTime() + (policy?.maxAuthorisationDays ?? AUTHORISED_WINDOW_DEFAULT_DAYS) * 86400000).toISOString() : null;

  return {
    product: 'GUARDIAN', jurisdiction: inp.jurisdiction, proposedActionId: inp.proposedActionId, caseReference: inp.caseReference,
    actionType: inp.actionType, targetReference: inp.targetReference, policyVersionId: policy?.versionId ?? null, policyApplicability: applicability,
    outcome: authorised ? 'AUTHORISED' : 'AUTHORIZATION_BLOCKED', authorisationStatus: authorised ? 'AUTHORISED' : 'PENDING',
    reasonCodes, authorisingOfficer: authorised ? who.authorisingOfficerId : null, expiresAt,
    scopeSnapshot: { actionType: inp.actionType, targetType: inp.targetType, targetReference: inp.targetReference, jurisdiction: inp.jurisdiction, policyVersionId: policy?.versionId ?? null, caseReference: inp.caseReference, evidenceManifestHash: inp.evidenceManifestHash ?? null },
    evidenceManifestHash: inp.evidenceManifestHash ?? null,
    isLegalDetermination: false, isEnforcementExecuted: false, isProviderNotified: false,
    note: 'Synthetic human-authority authorisation decision. C8 records a human-approved AUTHORISED ACTION RECORD and STOPS — it does NOT execute the action and does NOT notify any provider. Action types are authorisable, not executable in C8.',
  };
}

function dedupe<T>(a: T[]): T[] { return a.filter((v, i) => a.indexOf(v) === i); }
