// ─── IdentityResolutionService (Phase 3.1A) ──────────────────────────────────
//
// The single entry point through which the entire application obtains
// SafeBet IQ player identities. Depends only on the IdentityProvider
// interface; selects the concrete provider from configuration per request
// context (casino → jurisdiction → environment → default).
//
// Adding a new identity strategy = implement IdentityProvider + register it
// here (or pass a custom registry). No consumer changes.

import type { IdentityContext, IdentityProvider } from './provider.ts';
import { type IdentityConfig, loadIdentityConfig } from './config.ts';
import {
  DEFAULT_POLICY_RULES,
  type IdentityPolicyDecision,
  type IdentityPolicyRules,
  evaluateIdentityPolicy,
} from './policy.ts';
import { SHA256IdentityProvider, SHA256_V1_HEX_WIDTH } from './providers/sha256.ts';

export class IdentityResolutionService {
  private readonly providers = new Map<string, IdentityProvider>();
  private readonly config: IdentityConfig;
  private readonly policyRules: IdentityPolicyRules;

  constructor(
    providers: IdentityProvider[],
    config?: Partial<IdentityConfig>,
    policyRules?: Partial<IdentityPolicyRules>,
  ) {
    for (const p of providers) this.providers.set(p.name, p);
    this.config = loadIdentityConfig(config);
    this.policyRules = { ...DEFAULT_POLICY_RULES, ...policyRules };
  }

  /** True if a provider with this registry name is available. */
  supportsProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Identity Policy decision point (Phase 3.1B). Pure evaluation — exposed
   * for governance introspection; owns no state and emits nothing.
   */
  evaluatePolicy(ctx: IdentityContext): IdentityPolicyDecision {
    return evaluateIdentityPolicy(ctx, this.config, this.policyRules);
  }

  private select(ctx: IdentityContext): IdentityProvider {
    // In-flow decision point: policy governs whether resolution may proceed
    // and which provider handles it, then control returns immediately.
    const decision = this.evaluatePolicy(ctx);
    if (!decision.permitted) {
      throw new Error(`identity policy refused resolution: ${decision.reason}`);
    }
    const provider = this.providers.get(decision.providerName);
    if (!provider) {
      throw new Error(`identity provider '${decision.providerName}' is not registered`);
    }
    if (ctx.jurisdiction && !provider.supportsJurisdiction(ctx.jurisdiction)) {
      throw new Error(`identity provider '${decision.providerName}' does not support jurisdiction '${ctx.jurisdiction}'`);
    }
    if (!provider.supportsCasino(ctx.casinoId)) {
      throw new Error(`identity provider '${decision.providerName}' does not support casino '${ctx.casinoId}'`);
    }
    return provider;
  }

  /** Resolve one casino player reference to its SafeBet IQ Player ID. */
  async resolveIdentity(casinoRef: string, ctx: IdentityContext): Promise<string> {
    return this.select(ctx).resolveIdentity(casinoRef, ctx);
  }

  /** Explicitly register an identity mapping (idempotent). */
  async createIdentity(casinoRef: string, ctx: IdentityContext): Promise<string> {
    return this.select(ctx).createIdentity(casinoRef, ctx);
  }

  /** Identity for a reference if determinable without durable writes. */
  async getExistingIdentity(casinoRef: string, ctx: IdentityContext): Promise<string | null> {
    return this.select(ctx).getExistingIdentity(casinoRef, ctx);
  }

  /** Validate an identifier against the provider active for the context. */
  validateIdentity(candidate: string, ctx: IdentityContext): boolean {
    return this.select(ctx).validateIdentity(candidate);
  }

  /** Resolve many references; result order matches input order. */
  async resolveBatch(casinoRefs: string[], ctx: IdentityContext): Promise<string[]> {
    return this.select(ctx).resolveBatch(casinoRefs, ctx);
  }
}

// ─── Default composition root ────────────────────────────────────────────────
// The only place in the application that instantiates a concrete provider.

let defaultService: IdentityResolutionService | undefined;

/**
 * Application-wide IdentityResolutionService with the standard registry.
 * Both provider versions are registered: sha256-v2 (96-bit, the default)
 * and sha256-v1 (32-bit legacy, retained for deterministic historical
 * replay and backward compatibility). The active provider is chosen by
 * configuration (config.ts precedence) — default sha256-v2.
 */
export function getIdentityService(): IdentityResolutionService {
  if (!defaultService) {
    defaultService = new IdentityResolutionService([
      new SHA256IdentityProvider(),                                              // sha256-v2 (default)
      new SHA256IdentityProvider({ name: 'sha256-v1', hexWidth: SHA256_V1_HEX_WIDTH }),
    ]);
  }
  return defaultService;
}
