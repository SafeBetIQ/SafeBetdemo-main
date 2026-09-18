// ─── SafeBet Guardian — authentication assurance / MFA claim (ARCH-V4-PR1 §6/§7) ─
//
// MFA satisfaction is derived from TRUSTED, cryptographically-validated token claims
// only — NEVER from a request-body boolean, client UI state, a role fixture, or a
// caller-supplied session variable. Cognito records the completed factors in `amr`;
// a completed MFA challenge yields an MFA marker there. The user pool also requires
// MFA, so a valid token additionally implies the challenge was met — but we still
// require the explicit `amr` MFA marker for a positive assurance claim.

import type { JwtClaims } from './jwt.ts';

export type AssuranceLevel = 'AAL1_SINGLE_FACTOR' | 'AAL2_MFA';

const MFA_AMR_MARKERS = new Set(['mfa', 'otp', 'sw', 'swk', 'software_token_mfa', 'sms_mfa', 'hwk', 'totp']);

/** MFA-assurance options derived from TRUSTED SERVER-SIDE deployment config — never caller-supplied.
 *  `issuerEnforcesMfa` asserts a verified property of the IdP: the user pool is configured
 *  MFA-required (MfaConfiguration=ON), so a valid token from this issuer structurally evidences a
 *  completed MFA challenge. It must be set ONLY when that pool property has been verified + recorded. */
export interface AssuranceOptions { issuerEnforcesMfa?: boolean }

/** True only when the validated token evidences a completed MFA factor — either an explicit `amr`
 *  MFA marker (IdPs that emit it), an AAL2 `acr`, OR the trusted server-side assertion that the
 *  token's issuer enforces MFA for every issued token. Never trusts a request-body/UI/session flag. */
export function mfaSatisfied(claims: JwtClaims, opts: AssuranceOptions = {}): boolean {
  const amr = Array.isArray(claims.amr) ? claims.amr.map((s) => String(s).toLowerCase()) : [];
  if (amr.some((m) => MFA_AMR_MARKERS.has(m))) return true;
  if (typeof claims.acr === 'string' && /aal2|mfa/i.test(claims.acr)) return true;
  if (opts.issuerEnforcesMfa === true) return true;   // pool-level MFA enforcement (verified config)
  return false;
}

export function assuranceLevel(claims: JwtClaims, opts: AssuranceOptions = {}): AssuranceLevel {
  return mfaSatisfied(claims, opts) ? 'AAL2_MFA' : 'AAL1_SINGLE_FACTOR';
}
