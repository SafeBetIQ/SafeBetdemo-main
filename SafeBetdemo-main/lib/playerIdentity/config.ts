// ─── Identity provider configuration (Phase 3.1A) ────────────────────────────
//
// Selects the active IdentityProvider WITHOUT code changes, resolved in
// precedence order:
//
//   1. casinoProviders[casinoId]          (tenant/casino configuration)
//   2. jurisdictionProviders[jurisdiction] (regulatory configuration)
//   3. SAFEBET_IDENTITY_PROVIDER env       (deployment configuration:
//      NEXT_PUBLIC_SAFEBET_IDENTITY_PROVIDER in the browser build,
//      SAFEBET_IDENTITY_PROVIDER in Deno edge functions / Node)
//   4. defaultProvider                     ('sha256-v2' — 96-bit, ADR-001)
//
// Runtime-agnostic: guards every environment probe so the same module loads
// in the browser, Deno, and Node.

export interface IdentityConfig {
  defaultProvider: string;
  /** casino_id → provider name */
  casinoProviders: Record<string, string>;
  /** jurisdiction code → provider name */
  jurisdictionProviders: Record<string, string>;
}

export const DEFAULT_PROVIDER_NAME = 'sha256-v2'; // 96-bit production standard (ADR-001)

function envProvider(): string | undefined {
  // Next.js inlines this literal reference at build time for the browser.
  try {
    if (typeof process !== 'undefined' && process.env) {
      const fromNext = process.env.NEXT_PUBLIC_SAFEBET_IDENTITY_PROVIDER;
      if (fromNext) return fromNext;
      const fromNode = process.env.SAFEBET_IDENTITY_PROVIDER;
      if (fromNode) return fromNode;
    }
  } catch { /* no process in this runtime */ }
  try {
    const deno = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno;
    const fromDeno = deno?.env?.get?.('SAFEBET_IDENTITY_PROVIDER');
    if (fromDeno) return fromDeno;
  } catch { /* env access not permitted */ }
  return undefined;
}

export function loadIdentityConfig(overrides?: Partial<IdentityConfig>): IdentityConfig {
  return {
    defaultProvider: overrides?.defaultProvider ?? envProvider() ?? DEFAULT_PROVIDER_NAME,
    casinoProviders: overrides?.casinoProviders ?? {},
    jurisdictionProviders: overrides?.jurisdictionProviders ?? {},
  };
}

/** Resolve the provider name for a request context. */
export function providerNameFor(
  config: IdentityConfig,
  casinoId: string,
  jurisdiction?: string,
): string {
  return (
    config.casinoProviders[casinoId] ??
    (jurisdiction ? config.jurisdictionProviders[jurisdiction] : undefined) ??
    config.defaultProvider
  );
}
