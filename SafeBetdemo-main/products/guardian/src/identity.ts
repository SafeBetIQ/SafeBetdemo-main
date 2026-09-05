// ─── SafeBet Guardian — identity contract (ARCH-V4-C0) ───────────────────────
//
// Guardian-specific identity, built on Shared identity primitives but with its
// own product boundary. A SafeBet IQ role (e.g. casino_admin) must NEVER grant
// Guardian access. C0 allows SYNTHETIC/TEST principals only — no real Investigator,
// Legal Reviewer, or Authorising Officer until the future MFA milestone proves
// enrolment→challenge→verification→enforcement→recovery→audit.

import { GUARDIAN_PRODUCT, type ProductTag } from './product.ts';

export type GuardianRole =
  | 'INVESTIGATOR'
  | 'LEGAL_REVIEWER'
  | 'AUTHORISING_OFFICER'
  | 'EXTERNAL_PROVIDER'
  | 'SYSTEM_SERVICE';

export const GUARDIAN_ROLES: readonly GuardianRole[] = [
  'INVESTIGATOR', 'LEGAL_REVIEWER', 'AUTHORISING_OFFICER', 'EXTERNAL_PROVIDER', 'SYSTEM_SERVICE',
];

/** Human roles that require real MFA before any real (non-synthetic) privileged use. */
export const GUARDIAN_HUMAN_PRIVILEGED_ROLES: readonly GuardianRole[] = [
  'INVESTIGATOR', 'LEGAL_REVIEWER', 'AUTHORISING_OFFICER',
];

export type AuthAssurance = 'SYNTHETIC_TEST' | 'PASSWORD_ONLY' | 'MFA_VERIFIED' | 'SERVICE_KEY';

export interface GuardianPrincipal {
  principalId: string;
  product: ProductTag;            // always GUARDIAN
  jurisdiction: string;           // e.g. 'ZA-GP' (synthetic)
  role: GuardianRole;
  authAssurance: AuthAssurance;
  purpose: string;                // purpose/context of access (POPIA purpose limitation)
  isSynthetic: boolean;           // C0: must be true for every principal
  delegatedBy?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
}

export class GuardianIdentityError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) { super(message); this.name = 'GuardianIdentityError'; this.status = status; }
}

/** The A5 MFA hard gate, surfaced at the product boundary. */
export const MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE = true;

/** True when this principal would be a REAL privileged human user (blocked at C0). */
export function isRealPrivilegedHuman(p: GuardianPrincipal): boolean {
  return !p.isSynthetic && GUARDIAN_HUMAN_PRIVILEGED_ROLES.includes(p.role);
}

/** Build + validate a Guardian principal. C0 rejects any real privileged human and
 *  any non-Guardian product tag; only synthetic/test or service identities pass. */
export function makeGuardianPrincipal(input: Omit<GuardianPrincipal, 'product'> & { product?: ProductTag }): GuardianPrincipal {
  const p: GuardianPrincipal = { ...input, product: GUARDIAN_PRODUCT };
  if (!p.principalId) throw new GuardianIdentityError('principalId required', 400);
  if (!p.jurisdiction) throw new GuardianIdentityError('jurisdiction required', 400);
  if (!GUARDIAN_ROLES.includes(p.role)) throw new GuardianIdentityError(`unknown Guardian role: ${p.role}`, 400);
  if (isRealPrivilegedHuman(p)) {
    // Enforce the recorded A5 MFA hard gate: no real privileged Guardian user at C0.
    if (MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE && p.authAssurance !== 'MFA_VERIFIED') {
      throw new GuardianIdentityError('real privileged Guardian access blocked: MFA enforcement not yet proven (A5 hard gate)', 403);
    }
    throw new GuardianIdentityError('real privileged Guardian users are not authorised at C0 (synthetic only)', 403);
  }
  return p;
}

/** A SafeBet IQ identity (any IQ role) must never be accepted as a Guardian principal.
 *  Guardian principals carry product=GUARDIAN and a Guardian role vocabulary; an IQ
 *  role string is not in that vocabulary, so this always denies. */
export function assertNotSafebetIqIdentity(role: string): void {
  const iqRoles = ['super_admin', 'casino_admin', 'regulator', 'provincial_regulator', 'staff', 'player'];
  if (iqRoles.includes(role)) {
    throw new GuardianIdentityError(`SafeBet IQ role '${role}' cannot access Guardian resources`, 403);
  }
}
