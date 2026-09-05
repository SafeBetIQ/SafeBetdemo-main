// ─── SafeBet Guardian — health / version / observability (ARCH-V4-C0) ─────────
//
// Guardian has its OWN service health and version, independent of SafeBet IQ's
// /api/health. All observability metadata carries product=GUARDIAN. The version
// producer reads Guardian's own provenance (its own version manifest), so a
// Guardian deployment SHA is never confused with the SafeBet IQ runtime SHA.

import { GUARDIAN_PRODUCT, GUARDIAN_SCHEMA_VERSION } from './product.ts';

export interface GuardianHealth {
  status: 'ok';
  product: typeof GUARDIAN_PRODUCT;
  component: string;
  ts: string;
  dependsOnSafebetIqRuntime: false;
}

export function guardianHealth(component = 'guardian-foundation'): GuardianHealth {
  return {
    status: 'ok',
    product: GUARDIAN_PRODUCT,
    component,
    ts: new Date().toISOString(),
    dependsOnSafebetIqRuntime: false,
  };
}

export interface GuardianVersion {
  product: typeof GUARDIAN_PRODUCT;
  service: 'safebet-guardian';
  environment: string;
  environmentClass: string;
  dataClass: 'synthetic';
  schemaVersion: string;
  gitCommit: string;
  deploymentVersion: string;
  builtAt: string;
}

/** Build Guardian version from an injected provenance source (its OWN manifest at
 *  deploy time, or explicit fields in tests). Never falls back to IQ provenance. */
export function guardianVersion(provenance: Partial<GuardianVersion> = {}): GuardianVersion {
  return {
    product: GUARDIAN_PRODUCT,
    service: 'safebet-guardian',
    environment: provenance.environment ?? process.env.NEXT_PUBLIC_ENV ?? 'demo',
    environmentClass: provenance.environmentClass ?? 'non-production',
    dataClass: 'synthetic',
    schemaVersion: provenance.schemaVersion ?? GUARDIAN_SCHEMA_VERSION,
    gitCommit: provenance.gitCommit ?? process.env.GUARDIAN_GIT_COMMIT ?? 'unknown',
    deploymentVersion: provenance.deploymentVersion ?? process.env.GUARDIAN_DEPLOYMENT_VERSION ?? 'guardian-c0-local',
    builtAt: provenance.builtAt ?? 'unknown',
  };
}
