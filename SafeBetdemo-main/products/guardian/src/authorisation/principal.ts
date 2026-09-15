// ─── SafeBet Guardian — synthetic authenticated principal binding (ARCH-V4-C9 §2/§49) ─
//
// Closes the C8 independent-review finding: an AUTHORISING_OFFICER role must NOT be trusted
// from the request body / a fixture / a default fallback. Instead the role + jurisdiction +
// assurance are BOUND to an authenticated Guardian principal id in this registry; the caller
// can only present a principal id (from authenticated context), never the role itself.
//
// Demo = SYNTHETIC authenticated principals only (authAssurance SYNTHETIC_TEST). Real
// privileged users remain blocked by the MFA hard gate; this is NOT production MFA.

export type GuardianBoundRole = 'INVESTIGATOR' | 'LEGAL_REVIEWER' | 'AUTHORISING_OFFICER' | 'SYSTEM_SERVICE';

export interface GuardianBoundPrincipal {
  principalId: string;
  role: GuardianBoundRole;       // bound by the registry — NEVER supplied by the caller
  jurisdiction: string;
  authAssurance: 'SYNTHETIC_TEST';
  isSynthetic: true;
}

/** Synthetic authenticated principal registry (Demo). A caller presents ONLY a principal id. */
const SYNTHETIC_PRINCIPALS: Record<string, GuardianBoundPrincipal> = {
  'syn-inv-zagp': { principalId: 'syn-inv-zagp', role: 'INVESTIGATOR', jurisdiction: 'ZA-GP', authAssurance: 'SYNTHETIC_TEST', isSynthetic: true },
  'syn-leg-zagp': { principalId: 'syn-leg-zagp', role: 'LEGAL_REVIEWER', jurisdiction: 'ZA-GP', authAssurance: 'SYNTHETIC_TEST', isSynthetic: true },
  'syn-auth-zagp': { principalId: 'syn-auth-zagp', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-GP', authAssurance: 'SYNTHETIC_TEST', isSynthetic: true },
  'syn-auth-zawc': { principalId: 'syn-auth-zawc', role: 'AUTHORISING_OFFICER', jurisdiction: 'ZA-WC', authAssurance: 'SYNTHETIC_TEST', isSynthetic: true },
  'syn-svc': { principalId: 'syn-svc', role: 'SYSTEM_SERVICE', jurisdiction: 'ZA-GP', authAssurance: 'SYNTHETIC_TEST', isSynthetic: true },
};

/** Resolve a bound principal from authenticated context. Unknown id → null (denied). The role
 *  is taken ONLY from the registry — a request-supplied role is never honoured. */
export function resolveGuardianPrincipal(principalId: string | null | undefined): GuardianBoundPrincipal | null {
  if (!principalId) return null;
  return SYNTHETIC_PRINCIPALS[principalId] ?? null;
}

/** True only if the resolved principal is genuinely bound to AUTHORISING_OFFICER (no self-assert). */
export function isBoundAuthorisingOfficer(p: GuardianBoundPrincipal | null): boolean {
  return !!p && p.role === 'AUTHORISING_OFFICER';
}
