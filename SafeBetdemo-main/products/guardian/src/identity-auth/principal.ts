// ─── SafeBet Guardian — authenticated human principal (ARCH-V4-PR1 §8/§32) ────
//
// A bounded principal built ONLY from trusted token/session claims + a governed
// entitlement. Authority-bearing fields (role, jurisdiction, mfa) are never taken
// from a request body. Clearly distinguishes HUMAN from SERVICE; the final C8
// human authorisation gate is HUMAN-only.

import type { JwtClaims } from './jwt.ts';
import type { PrivilegedGuardianRole, AccountState } from './entitlement.ts';
import type { AssuranceLevel } from './assurance.ts';

export type PrincipalKind = 'HUMAN' | 'SERVICE';

export interface AuthenticatedGuardianPrincipal {
  product: 'GUARDIAN';
  principalKind: PrincipalKind;      // HUMAN for token-authenticated users
  subject: string;                   // trusted token sub
  identityProvider: string;          // iss
  authTime: number | null;           // auth_time (epoch s)
  mfaSatisfied: boolean;             // from trusted amr/acr only
  assuranceLevel: AssuranceLevel;
  role: PrivilegedGuardianRole;      // from governed entitlement — NEVER from the request body
  jurisdiction: string;              // permitted jurisdiction (authority) — NEVER from the request body
  accountState: AccountState;
  sessionId: string | null;          // jti / session marker
  tokenIssuedAt: number | null;
  tokenExpiresAt: number | null;
  isSynthetic: false;                // production-ready authenticated identity is never synthetic
}

export function buildAuthenticatedPrincipal(input: {
  claims: JwtClaims; mfaSatisfied: boolean; assuranceLevel: AssuranceLevel;
  role: PrivilegedGuardianRole; jurisdiction: string; accountState: AccountState;
}): AuthenticatedGuardianPrincipal {
  const c = input.claims;
  return {
    product: 'GUARDIAN', principalKind: 'HUMAN', subject: String(c.sub), identityProvider: String(c.iss ?? ''),
    authTime: typeof c.auth_time === 'number' ? c.auth_time : null, mfaSatisfied: input.mfaSatisfied,
    assuranceLevel: input.assuranceLevel, role: input.role, jurisdiction: input.jurisdiction,
    accountState: input.accountState, sessionId: typeof c.jti === 'string' ? c.jti : null,
    tokenIssuedAt: typeof c.iat === 'number' ? c.iat : null, tokenExpiresAt: typeof c.exp === 'number' ? c.exp : null,
    isSynthetic: false,
  };
}

export function isHuman(p: AuthenticatedGuardianPrincipal): boolean { return p.principalKind === 'HUMAN'; }
