// ─── SafeBet Guardian — product composition root (ARCH-V4-C0) ─────────────────
//
// Public surface of the Guardian foundation package. Consumers (the Guardian API
// namespace, the standalone service entry, and tests) import from here. The only
// cross-product dependencies are the GOVERNED Shared Platform Foundation contracts
// (../../../lib/platform/audit/index.ts, ../../../lib/platform/evidence/index.ts) — no SafeBet IQ business module
// is imported anywhere in this package (hard independence).

export * from './product.ts';
export * from './identity.ts';
export * from './sod.ts';
export * from './jurisdiction.ts';
export * from './envelope.ts';
export * from './case.ts';
export * from './audit.ts';
export * from './evidence.ts';
export * from './worker.ts';
export * from './observability.ts';

import { guardianHealth, guardianVersion } from './observability.ts';
import { GUARDIAN_PRODUCT, GUARDIAN_SCHEMA_VERSION, GUARDIAN_INVARIANTS } from './product.ts';
import { MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE } from './identity.ts';

/** One-call foundation self-description used by the service entry + a smoke test.
 *  Proves the product can report itself with NO SafeBet IQ runtime present. */
export function guardianFoundationDescriptor() {
  return {
    product: GUARDIAN_PRODUCT,
    schemaVersion: GUARDIAN_SCHEMA_VERSION,
    standalone: true,
    dependsOnSafebetIqBusinessData: false,
    dependsOnSafebetIqRuntime: false,
    mfaRequiredForRealPrivilegedUse: MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE,
    invariants: GUARDIAN_INVARIANTS,
    health: guardianHealth(),
    version: guardianVersion(),
  };
}
