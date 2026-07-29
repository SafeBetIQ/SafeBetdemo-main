// ─── Consumer Platform — authorization model (Phase 3.7) ─────────────────────
//
// Authorization FILTERS information; it never creates business logic.
// Each consumer profile is granted a set of views; the gateway refuses
// anything else. Field-level filtering is a property of the contracts
// themselves: a profile can only ever see the fields its granted views
// carry (e.g. regulators get compliance posture, never operator revenue
// detail beyond the published aggregates).

import type { ConsumerProfile, ConsumerView } from './contracts.ts';
import type { AuthenticatedPrincipal } from '../security/principal.ts';
import { principalMayAccessCasino } from '../security/principal.ts';

/** View grants per consumer profile. */
export const VIEW_GRANTS: Record<ConsumerProfile, ConsumerView[]> = {
  'casino-operator': ['live-floor', 'activity-feed', 'summary', 'integration', 'explanation', 'ai-performance', 'executive-intelligence'],
  'regulator': ['compliance', 'national-overview', 'cross-operator', 'operator-compliance', 'investigation', 'evidence-package', 'regulatory-report', 'explanation'],
  'executive': ['summary', 'ai-performance', 'executive-intelligence'],
  'compliance-officer': ['actions', 'compliance', 'explanation'],
  'administrator': ['live-floor', 'activity-feed', 'compliance', 'summary', 'actions', 'integration', 'national-overview', 'cross-operator', 'operator-compliance', 'investigation', 'evidence-package', 'regulatory-report', 'explanation', 'ai-performance', 'executive-intelligence'],
  'api-client': ['activity-feed', 'summary'],
};

export class ConsumerAuthorizationError extends Error {
  readonly status = 403;
  constructor(consumer: string, view: string) {
    super(`consumer profile '${consumer}' is not authorized for view '${view}'`);
    this.name = 'ConsumerAuthorizationError';
  }
}

/** Authorize a profile for a view — reject, never widen. */
export function authorizeView(consumer: ConsumerProfile, view: ConsumerView): void {
  const grants = VIEW_GRANTS[consumer];
  if (!grants || grants.indexOf(view) === -1) {
    throw new ConsumerAuthorizationError(consumer, view);
  }
}

/**
 * Map an application role (users.role enum) to a consumer profile.
 * Unknown roles receive NO profile — the gateway refuses them.
 */
export function profileForRole(role: string | null | undefined): ConsumerProfile | null {
  switch (role) {
    case 'casino_admin':
    case 'casino_operator':
    case 'staff': return 'casino-operator';
    case 'regulator':
    case 'national_regulator':
    case 'provincial_regulator': return 'regulator';
    case 'executive': return 'executive';
    case 'compliance_officer': return 'compliance-officer';
    case 'super_admin': return 'administrator';
    case 'api_client': return 'api-client';
    default: return null;
  }
}

// ─── Verified scope resolution (Phase 4.1) ────────────────────────────────────
//
// The gateway's ONLY source of consumer identity and scope. Inputs come
// exclusively from cryptographically verified material: the principal
// (verified JWT subject + server-side users registry) and the casinos
// registry. Query parameters may REQUEST a casino; they can never widen
// what the principal is entitled to. Jurisdiction is ALWAYS the registry's
// value for the resolved casino — a caller can never choose the policy
// pack that judges it.

export interface CasinoRegistryEntry {
  id: string;
  jurisdiction: string;
  province: string | null;
}

export class ConsumerScopeError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'ConsumerScopeError';
    this.status = status;
  }
}

export interface ResolvedConsumerScope {
  consumer: ConsumerProfile;
  casinoId: string;
  /** From the casino registry — never from the caller. */
  jurisdiction: string;
}

export function resolveConsumerScope(
  principal: AuthenticatedPrincipal,
  requestedCasinoId: string | null,
  casino: CasinoRegistryEntry | null,
): ResolvedConsumerScope {
  const consumer = profileForRole(principal.isServiceRole ? 'super_admin' : principal.role);
  if (!consumer) throw new ConsumerScopeError(`role '${principal.role}' has no consumer profile`);

  // Operators/compliance are pinned to their own casino: a differing
  // requested casino is refused, never silently substituted.
  if (consumer !== 'administrator' && consumer !== 'regulator') {
    if (!principal.casinoId) throw new ConsumerScopeError('principal has no casino assignment');
    if (requestedCasinoId && requestedCasinoId !== principal.casinoId) {
      throw new ConsumerScopeError('cross-casino access denied');
    }
  }

  if (!casino) throw new ConsumerScopeError('unknown casino', 404);
  if (!principalMayAccessCasino(principal, casino)) {
    throw new ConsumerScopeError('casino outside principal scope');
  }
  return { consumer, casinoId: casino.id, jurisdiction: casino.jurisdiction };
}
