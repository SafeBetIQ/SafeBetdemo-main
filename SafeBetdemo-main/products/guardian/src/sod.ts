// ─── SafeBet Guardian — Separation of Duties (ARCH-V4-C0) ────────────────────
//
// Reusable SoD rule specification for enforcement decisions. For a SINGLE
// enforcement decision on a single case, the Investigator, the Legal Reviewer and
// the Authorising Officer MUST be three distinct human principals:
//
//     INVESTIGATOR ≠ LEGAL_REVIEWER ≠ AUTHORISING_OFFICER
//
// C0 does not implement the enforcement workflow — it proves the authorisation
// model can REJECT incompatible same-principal roles on the same case. Synthetic.

import type { GuardianPrincipal, GuardianRole } from './identity.ts';

/** The three duties that must be separated for one enforcement decision. */
export const SOD_SEPARATED_DUTIES: readonly GuardianRole[] = [
  'INVESTIGATOR', 'LEGAL_REVIEWER', 'AUTHORISING_OFFICER',
];

export interface SodAssignment {
  caseId: string;
  investigator: GuardianPrincipal;
  legalReviewer: GuardianPrincipal;
  authorisingOfficer: GuardianPrincipal;
}

export interface SodResult {
  ok: boolean;
  violations: string[];
}

/** Evaluate SoD for one enforcement decision. Fails when the same principal holds
 *  more than one of the three separated duties, when roles are mismatched, or when
 *  jurisdictions differ across the decision. */
export function evaluateSod(a: SodAssignment): SodResult {
  const violations: string[] = [];
  const slots: Array<[GuardianRole, GuardianPrincipal]> = [
    ['INVESTIGATOR', a.investigator],
    ['LEGAL_REVIEWER', a.legalReviewer],
    ['AUTHORISING_OFFICER', a.authorisingOfficer],
  ];

  // Each slot must actually hold its required role.
  for (const [required, p] of slots) {
    if (p.role !== required) violations.push(`slot ${required} filled by role ${p.role}`);
  }

  // No principal may hold two separated duties on the same decision.
  const ids = slots.map(([, p]) => p.principalId);
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      if (ids[i] === ids[j]) {
        violations.push(`principal ${ids[i]} holds both ${slots[i][0]} and ${slots[j][0]} on case ${a.caseId}`);
      }
    }
  }

  // A single enforcement decision is jurisdiction-bound.
  const jurisdictionList = slots.map(([, p]) => p.jurisdiction);
  const distinctJurisdictions = jurisdictionList.filter((j, i) => jurisdictionList.indexOf(j) === i);
  if (distinctJurisdictions.length > 1) {
    violations.push(`mixed jurisdictions on case ${a.caseId}: ${distinctJurisdictions.join(', ')}`);
  }

  return { ok: violations.length === 0, violations };
}
