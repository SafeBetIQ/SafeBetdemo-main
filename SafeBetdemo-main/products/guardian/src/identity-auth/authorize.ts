// ─── SafeBet Guardian — privileged authorization gates + SoD (ARCH-V4-PR1 §14–§18/§32/§39/§40) ─
//
// Capability gates over an AUTHENTICATED principal. Separation of Duties is preserved
// and strengthened: INVESTIGATOR != LEGAL_REVIEWER != AUTHORISING_OFFICER; POLICY_ADMINISTRATOR
// and GUARDIAN_ADMINISTRATOR never gain business-authorisation capability. The final C8
// AUTHORISATION_GRANTED gate requires a HUMAN AUTHORISING_OFFICER with MFA — a service
// principal or any self-asserted role can never reach it.

import type { AuthenticatedGuardianPrincipal } from './principal.ts';
import type { PrivilegedGuardianRole } from './entitlement.ts';

export type GuardianCapability =
  | 'CASE_VIEW' | 'CASE_REVIEW' | 'EVIDENCE_ACCESS' | 'LEGAL_REVIEW' | 'POLICY_ADMINISTER'
  | 'PROPOSE_ACTION' | 'AUTHORISE_ACTION' | 'ORCHESTRATION_VIEW' | 'REENTRY_REVIEW' | 'IDENTITY_ADMINISTER';

// Role → capabilities. Deliberately disjoint where SoD requires it.
const ROLE_CAPS: Record<PrivilegedGuardianRole, GuardianCapability[]> = {
  INVESTIGATOR:          ['CASE_VIEW', 'CASE_REVIEW', 'EVIDENCE_ACCESS', 'PROPOSE_ACTION', 'ORCHESTRATION_VIEW', 'REENTRY_REVIEW'],
  LEGAL_REVIEWER:        ['CASE_VIEW', 'EVIDENCE_ACCESS', 'LEGAL_REVIEW', 'ORCHESTRATION_VIEW', 'REENTRY_REVIEW'],
  AUTHORISING_OFFICER:   ['CASE_VIEW', 'EVIDENCE_ACCESS', 'AUTHORISE_ACTION', 'ORCHESTRATION_VIEW'],
  POLICY_ADMINISTRATOR:  ['POLICY_ADMINISTER', 'CASE_VIEW'],
  GUARDIAN_ADMINISTRATOR:['IDENTITY_ADMINISTER'],   // administrative scope only — NO business authorisation
};

export function hasCapability(p: AuthenticatedGuardianPrincipal, cap: GuardianCapability): boolean {
  return (ROLE_CAPS[p.role] ?? []).includes(cap);
}

/** The strongest gate (§14): only a HUMAN AUTHORISING_OFFICER with MFA may reach the C8
 *  final-authorisation gate. Service principals and non-officers are denied. */
export function mayReachC8AuthorisationGate(p: AuthenticatedGuardianPrincipal): boolean {
  return p.principalKind === 'HUMAN' && p.role === 'AUTHORISING_OFFICER' && p.mfaSatisfied === true;
}

/** §10/§39/§40: the authenticated principal's permitted jurisdiction governs access; a
 *  request may name a resource jurisdiction for routing but cannot elevate beyond this. */
export function principalMayAccessJurisdiction(p: AuthenticatedGuardianPrincipal, resourceJurisdiction: string): boolean {
  return p.jurisdiction === resourceJurisdiction;
}

/** SoD (§16): the same principal cannot act as two conflicting roles. Role is single-valued
 *  per entitlement, so conflicts are structurally impossible — restated for reviewers/tests. */
export function violatesSeparationOfDuties(p: AuthenticatedGuardianPrincipal, requiredCapability: GuardianCapability): boolean {
  // An INVESTIGATOR can never AUTHORISE_ACTION; a LEGAL_REVIEWER can never AUTHORISE_ACTION;
  // only AUTHORISING_OFFICER holds AUTHORISE_ACTION (and holds no PROPOSE_ACTION/LEGAL_REVIEW).
  return !hasCapability(p, requiredCapability);
}
