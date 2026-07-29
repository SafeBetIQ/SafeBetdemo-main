// ─── Deployed Runtime — model (Milestone 4.6) ────────────────────────────────
//
// Deployment environment classification, federation FEATURE FLAGS (off by
// default; approved test-tenant + explicit jurisdiction activation; unapproved
// denial; emergency shutdown; restart persistence), health-status types, and
// safe deployment VERSION metadata (all engine versions; NO secrets).
//
// HONEST SCOPE: this composition runs IN-PROCESS as the deployed-service topology
// would. It is a "deployed non-production runtime" COMPOSITION — it is NOT a real
// deployment to a managed platform (that evidence remains a deployment binding).

import type { JurisdictionCode } from '../types.ts';

export const RUNTIME_ENVIRONMENTS = ['in-process-composition', 'deployed-non-production', 'pilot-sandbox', 'staging'] as const;
export type RuntimeEnvironment = (typeof RUNTIME_ENVIRONMENTS)[number];

export class RuntimeError extends Error { readonly code: string; constructor(code: string, message: string) { super(`[${code}] ${message}`); this.name = 'RuntimeError'; this.code = code; } }

// ── Feature flags (federation OFF by default) ────────────────────────────────
export interface FeatureFlagStore { load(): FeatureFlagSnapshot | undefined; save(s: FeatureFlagSnapshot): void; }
export interface FeatureFlagSnapshot { masterEnabled: boolean; jurisdictions: JurisdictionCode[]; tenants: string[]; }

export class InMemoryFeatureFlagStore implements FeatureFlagStore {
  private snap: FeatureFlagSnapshot | undefined;
  load(): FeatureFlagSnapshot | undefined { return this.snap ? { ...this.snap, jurisdictions: this.snap.jurisdictions.slice(), tenants: this.snap.tenants.slice() } : undefined; }
  save(s: FeatureFlagSnapshot): void { this.snap = { ...s, jurisdictions: s.jurisdictions.slice(), tenants: s.tenants.slice() }; }
}

/**
 * Federation feature flags. Federation is OFF by default; it may be enabled only
 * for explicitly APPROVED synthetic test tenants + explicitly activated
 * jurisdictions. Emergency shutdown disables all. State persists across restart
 * via an injected store. Production flags are never touched here.
 */
export class FederationFeatureFlags {
  private masterEnabled = false;
  private readonly jurisdictions = new Set<JurisdictionCode>();
  private readonly tenants = new Set<string>();
  private readonly approvedTenants: ReadonlySet<string>;
  private readonly store?: FeatureFlagStore;

  constructor(opts: { approvedTestTenants: string[]; store?: FeatureFlagStore } = { approvedTestTenants: [] }) {
    this.approvedTenants = new Set(opts.approvedTestTenants);
    this.store = opts.store;
    const s = this.store?.load();
    if (s) { this.masterEnabled = s.masterEnabled; for (const j of s.jurisdictions) this.jurisdictions.add(j); for (const t of s.tenants) this.tenants.add(t); }
  }

  /** Enable federation for an APPROVED synthetic test tenant in an explicit jurisdiction. */
  enableTestTenant(tenant: string, jurisdiction: JurisdictionCode): void {
    if (!this.approvedTenants.has(tenant)) throw new RuntimeError('tenant-not-approved', `tenant '${tenant}' is not an approved synthetic test tenant`);
    this.masterEnabled = true; this.jurisdictions.add(jurisdiction); this.tenants.add(tenant); this.persist();
  }
  activateJurisdiction(jurisdiction: JurisdictionCode): void { this.jurisdictions.add(jurisdiction); this.persist(); }
  isEnabled(jurisdiction: JurisdictionCode, tenant?: string): boolean {
    if (!this.masterEnabled || !this.jurisdictions.has(jurisdiction)) return false;
    return tenant ? this.tenants.has(tenant) : this.tenants.size > 0;
  }
  /** Emergency shutdown — disable all federation (production flags untouched). */
  emergencyShutdown(): void { this.masterEnabled = false; this.jurisdictions.clear(); this.tenants.clear(); this.persist(); }
  snapshot(): FeatureFlagSnapshot { return { masterEnabled: this.masterEnabled, jurisdictions: Array.from(this.jurisdictions).sort(), tenants: Array.from(this.tenants).sort() }; }
  private persist(): void { this.store?.save(this.snapshot()); }
}

// ── Health ───────────────────────────────────────────────────────────────────
export const HEALTH_STATES = ['healthy', 'degraded', 'unavailable', 'disabled', 'misconfigured'] as const;
export type HealthState = (typeof HEALTH_STATES)[number];
export interface ComponentHealth { component: string; state: HealthState; detail: string; }
export interface RuntimeHealth { environment: RuntimeEnvironment; overall: HealthState; components: ComponentHealth[]; checkedAt: string; }

// ── Version metadata (safe; no secrets) ──────────────────────────────────────
export interface DeploymentVersion {
  applicationVersion: string; buildId: string; environment: RuntimeEnvironment; architectureVersion: string; adr: string;
  eventSchemaVersions: Record<string, string>; projectionVersion: string;
  matchingEngineVersion: string; decisionEngineVersion: string; registryVersion: string;
  correlationEngineVersion: string; nationalPolicyEngineVersion: string;
  connectorVersion: string; financialProjectionVersion: string;
  cryptoAlgorithm: string; canonicalFormatVersion: string;
  featureFlags: FeatureFlagSnapshot;
}
