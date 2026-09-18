// ─── SafeBet Guardian — production-ready request authentication (ARCH-V4-PR1 §5/§7/§29) ─
//
// The single production-ready entry point: validated JWT → MFA assurance → governed
// entitlement → MFA gate → authenticated HUMAN principal. There is NO synthetic
// fallback anywhere on this path: a missing/invalid token, or a body carrying a
// known synthetic principal id, can NEVER become a privileged principal.

import { validateJwt, JwtValidationError, type JwksProvider, type JwtValidationConfig, type JwtClaims } from './jwt.ts';
import { mfaSatisfied, assuranceLevel } from './assurance.ts';
import { evaluateEntitlement, roleRequiresMfa, type EntitlementRecord } from './entitlement.ts';
import { buildAuthenticatedPrincipal, type AuthenticatedGuardianPrincipal } from './principal.ts';

export type AuthDenyReason =
  | 'NO_BEARER_TOKEN' | 'SYNTHETIC_PRINCIPAL_NOT_ACCEPTED'
  | 'NO_ENTITLEMENT' | 'ACCOUNT_NOT_ACTIVE' | 'ENTITLEMENT_NOT_YET_EFFECTIVE'
  | 'ENTITLEMENT_EXPIRED' | 'UNKNOWN_ROLE' | 'NOT_HUMAN_IDENTITY' | 'MFA_REQUIRED';

export class GuardianAuthError extends Error {
  readonly status: number;
  readonly reasonCode: string;
  readonly auditEvent: string;
  constructor(reasonCode: string, status: number, auditEvent: string, message?: string) {
    super(message ?? reasonCode); this.name = 'GuardianAuthError';
    this.reasonCode = reasonCode; this.status = status; this.auditEvent = auditEvent;
  }
}

/** Extract a bearer token from an Authorization header value. Never throws on shape. */
export function extractBearer(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return m ? m[1].trim() : null;
}

export interface AuthenticateInput {
  authorizationHeader: string | null | undefined;
  jwks: JwksProvider;
  validation: JwtValidationConfig;
  /** Governed DB lookup of the entitlement for a trusted subject (bin supplies the impl). */
  lookupEntitlement: (subject: string) => Promise<EntitlementRecord | null>;
  /** Trusted server-side assertion that the token issuer enforces MFA (verified pool property). */
  issuerEnforcesMfa?: boolean;
  now?: Date;
}

export interface AuthSuccess {
  principal: AuthenticatedGuardianPrincipal;
  claims: JwtClaims;
  auditEvents: string[];   // e.g. AUTHENTICATION_SUCCEEDED, MFA_SUCCEEDED, PRIVILEGED_ACCESS_ALLOWED
}

/** Authenticate a Guardian request to a bounded HUMAN principal, or throw GuardianAuthError.
 *  Role + jurisdiction come from the governed entitlement; MFA from trusted claims. */
export async function authenticateGuardianRequest(inp: AuthenticateInput): Promise<AuthSuccess> {
  const now = inp.now ?? new Date();
  const token = extractBearer(inp.authorizationHeader);
  // §29: no token → denied. There is NO fallback to a header/body synthetic principal id.
  if (!token) throw new GuardianAuthError('NO_BEARER_TOKEN', 401, 'AUTHENTICATION_FAILED', 'missing bearer token');

  // 1) Cryptographic token validation (throws JwtValidationError → 401).
  let claims: JwtClaims;
  try { claims = await validateJwt(token, inp.jwks, inp.validation); }
  catch (e) {
    if (e instanceof JwtValidationError) throw new GuardianAuthError(e.reasonCode, 401, 'AUTHENTICATION_FAILED', e.message);
    throw e;
  }

  // 2) MFA assurance from trusted claims + verified issuer-enforcement config only.
  const mfa = mfaSatisfied(claims, { issuerEnforcesMfa: inp.issuerEnforcesMfa });
  const level = assuranceLevel(claims, { issuerEnforcesMfa: inp.issuerEnforcesMfa });

  // 3) Governed entitlement (role + jurisdiction + account state) — never from the request.
  const record = await inp.lookupEntitlement(String(claims.sub));
  const ent = evaluateEntitlement(record, now);
  if (!ent.ok || !ent.record) {
    const map: Record<string, [number, string]> = {
      NO_ENTITLEMENT: [403, 'ENTITLEMENT_DENIED'], ACCOUNT_NOT_ACTIVE: [403, 'ACCOUNT_DISABLED'],
      ENTITLEMENT_NOT_YET_EFFECTIVE: [403, 'ENTITLEMENT_DENIED'], ENTITLEMENT_EXPIRED: [403, 'ENTITLEMENT_DENIED'],
      UNKNOWN_ROLE: [403, 'ENTITLEMENT_DENIED'], NOT_HUMAN_IDENTITY: [403, 'ENTITLEMENT_DENIED'],
    };
    const [status, audit] = map[ent.reason ?? 'NO_ENTITLEMENT'] ?? [403, 'ENTITLEMENT_DENIED'];
    throw new GuardianAuthError(ent.reason ?? 'NO_ENTITLEMENT', status, audit);
  }

  // 4) MFA gate (§6/§7): privileged roles require a positive MFA assurance.
  if (roleRequiresMfa(ent.record.role) && !mfa) {
    throw new GuardianAuthError('MFA_REQUIRED', 403, 'MFA_REQUIRED', 'privileged role requires MFA assurance');
  }

  const principal = buildAuthenticatedPrincipal({
    claims, mfaSatisfied: mfa, assuranceLevel: level,
    role: ent.record.role, jurisdiction: ent.record.jurisdiction, accountState: ent.record.accountState,
  });
  const auditEvents = ['AUTHENTICATION_SUCCEEDED', ...(mfa ? ['MFA_SUCCEEDED'] : []), 'PRIVILEGED_ACCESS_ALLOWED'];
  return { principal, claims, auditEvents };
}
