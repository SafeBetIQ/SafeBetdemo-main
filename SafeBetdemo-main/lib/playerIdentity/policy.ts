// ─── Identity Policy Layer (Phase 3.1B) ──────────────────────────────────────
//
// A DECISION POINT, not an engine.
//
// This module is a pure function consulted by IdentityResolutionService in the
// middle of the one event flow:
//
//   Casino Event → IdentityResolutionService → [Identity Policy] → IdentityProvider
//                → SB-PLR id → event continues on the Casino Event Bus
//
// It answers identity-governance questions and immediately returns control:
//   • Is identity resolution permitted for this tenant / jurisdiction?
//   • Which provider should be used?
//   • Is cross-casino resolution permitted?
//   • Is identity federation permitted?
//
// It owns NO runtime state, NO events, NO projections, NO business logic,
// NO dashboards, and it never touches the event payload. Evaluating the same
// context twice always yields the same decision.

import type { IdentityContext } from './provider.ts';
import { type IdentityConfig, providerNameFor } from './config.ts';

/** Tenant/jurisdiction governance rules. Defaults preserve current behavior. */
export interface IdentityPolicyRules {
  /** Casinos for which identity resolution is refused outright. */
  deniedCasinos: string[];
  /** Jurisdictions for which identity resolution is refused outright. */
  deniedJurisdictions: string[];
  /** May one casino's reference resolve against another casino's identity space? */
  allowCrossCasino: boolean;
  /** May identities be federated to external identity systems? */
  allowFederation: boolean;
}

export const DEFAULT_POLICY_RULES: IdentityPolicyRules = {
  deniedCasinos: [],
  deniedJurisdictions: [],
  // Privacy-safe defaults: identity spaces are strictly per-casino and
  // never federated unless a jurisdictional policy explicitly enables it.
  allowCrossCasino: false,
  allowFederation: false,
};

/** The complete, immutable outcome of one policy evaluation. */
export interface IdentityPolicyDecision {
  /** False ⇒ the service refuses resolution and the event does not continue. */
  permitted: boolean;
  /** Provider selected under tenant → jurisdiction → environment → default. */
  providerName: string;
  crossCasinoPermitted: boolean;
  federationPermitted: boolean;
  /** Human-readable grounds when permitted === false. */
  reason?: string;
}

/**
 * Evaluate identity policy for one resolution request. Pure and stateless:
 * decision = f(context, config, rules). Nothing is recorded, emitted or kept.
 */
export function evaluateIdentityPolicy(
  ctx: IdentityContext,
  config: IdentityConfig,
  rules: IdentityPolicyRules,
): IdentityPolicyDecision {
  const providerName = providerNameFor(config, ctx.casinoId, ctx.jurisdiction);

  if (rules.deniedCasinos.includes(ctx.casinoId)) {
    return {
      permitted: false,
      providerName,
      crossCasinoPermitted: false,
      federationPermitted: false,
      reason: `identity resolution is not permitted for casino '${ctx.casinoId}'`,
    };
  }

  if (ctx.jurisdiction && rules.deniedJurisdictions.includes(ctx.jurisdiction)) {
    return {
      permitted: false,
      providerName,
      crossCasinoPermitted: false,
      federationPermitted: false,
      reason: `identity resolution is not permitted in jurisdiction '${ctx.jurisdiction}'`,
    };
  }

  return {
    permitted: true,
    providerName,
    crossCasinoPermitted: rules.allowCrossCasino,
    federationPermitted: rules.allowFederation,
  };
}
