// ─── National Identity Federation — configuration & feature flags (v2.0, ADR-006)
//
// Phase 3.1 Foundation. Federation is DENIED BY DEFAULT (Constitution §7 as
// amended) and enabled only per jurisdiction under regulator authority. This
// module is the single source of the enablement decision; nothing federates
// unless a jurisdiction flag is explicitly on.

import { JURISDICTION_CODES, type JurisdictionCode } from './types.ts';

export interface FederationConfig {
  /** Master kill-switch — if false, federation is fully off regardless of per-jurisdiction flags. */
  masterEnabled: boolean;
  /** Per-jurisdiction enablement (default: all false). */
  jurisdictions: Record<JurisdictionCode, boolean>;
}

/** The safe default: everything OFF (backward-compatible with v1.5.2). */
export function defaultFederationConfig(): FederationConfig {
  return {
    masterEnabled: false,
    jurisdictions: JURISDICTION_CODES.reduce((acc, j) => { acc[j] = false; return acc; }, {} as Record<JurisdictionCode, boolean>),
  };
}

/**
 * Resolve config from an environment-style map (composition-root friendly).
 * SAFEBET_FEDERATION_ENABLED=true enables the master switch; a comma list in
 * SAFEBET_FEDERATION_JURISDICTIONS=ZA,KE enables those jurisdictions. Absent →
 * everything off. Feature flags only; no behaviour beyond enablement.
 */
export function resolveFederationConfig(env: Record<string, string | undefined> = {}): FederationConfig {
  const cfg = defaultFederationConfig();
  cfg.masterEnabled = String(env.SAFEBET_FEDERATION_ENABLED ?? '').toLowerCase() === 'true';
  const list = String(env.SAFEBET_FEDERATION_JURISDICTIONS ?? '')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  for (const j of list) {
    if ((JURISDICTION_CODES as readonly string[]).includes(j)) cfg.jurisdictions[j as JurisdictionCode] = true;
  }
  return cfg;
}

/** Is federation enabled for this jurisdiction? Master switch AND the per-jurisdiction flag. */
export function isFederationEnabled(cfg: FederationConfig, j: JurisdictionCode): boolean {
  return !!cfg.masterEnabled && !!cfg.jurisdictions[j];
}
