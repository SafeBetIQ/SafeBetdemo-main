// ─── SafeBet Guardian — jurisdiction access boundary (ARCH-V4-C0) ────────────
//
// Guardian data is scoped by (product, jurisdiction, principal/service role). A
// Guardian principal for jurisdiction A must never obtain jurisdiction B's data,
// and a SafeBet IQ tenant must never obtain any Guardian data. Synthetic tests
// prove both denials. This mirrors, at the application layer, the RLS scoping on
// the `guardian` schema.

import { GUARDIAN_PRODUCT, type ProductTag } from './product.ts';
import { GuardianIdentityError, type GuardianPrincipal } from './identity.ts';

export interface GuardianResourceScope {
  product: ProductTag;   // always GUARDIAN
  jurisdiction: string;
}

/** True only when the principal is a Guardian principal whose jurisdiction matches
 *  the resource jurisdiction. SYSTEM_SERVICE is still jurisdiction-bound at C0
 *  (a service principal is provisioned per jurisdiction context). */
export function principalMayAccessGuardianResource(p: GuardianPrincipal, r: GuardianResourceScope): boolean {
  if (p.product !== GUARDIAN_PRODUCT) return false;
  if (r.product !== GUARDIAN_PRODUCT) return false;
  return p.jurisdiction === r.jurisdiction;
}

/** Throwing guard for API/worker paths. Distinguishes cross-product from
 *  cross-jurisdiction denials so audit reasons are precise. */
export function assertMayAccess(p: GuardianPrincipal, r: GuardianResourceScope): void {
  if (r.product !== GUARDIAN_PRODUCT) {
    throw new GuardianIdentityError('resource is not a Guardian resource', 400);
  }
  if (p.product !== GUARDIAN_PRODUCT) {
    throw new GuardianIdentityError('non-Guardian principal denied', 403);
  }
  if (p.jurisdiction !== r.jurisdiction) {
    throw new GuardianIdentityError(
      `cross-jurisdiction access denied: principal ${p.jurisdiction} → resource ${r.jurisdiction}`,
      403,
    );
  }
}
