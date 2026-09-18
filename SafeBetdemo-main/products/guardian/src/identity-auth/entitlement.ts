// ─── SafeBet Guardian — governed role/jurisdiction entitlement (ARCH-V4-PR1 §9–§13) ─
//
// The Guardian ROLE and permitted JURISDICTION originate ONLY from a governed,
// server-side, administratively-managed entitlement record keyed by the trusted
// token subject — NEVER from request.role / request.jurisdiction / email domain /
// organisation name. Account state + effective window gate access, enabling
// suspension/disablement/expiry to deny even when a valid token exists.

export type PrivilegedGuardianRole =
  | 'INVESTIGATOR' | 'LEGAL_REVIEWER' | 'AUTHORISING_OFFICER' | 'POLICY_ADMINISTRATOR' | 'GUARDIAN_ADMINISTRATOR';

export const PRIVILEGED_GUARDIAN_ROLES: readonly PrivilegedGuardianRole[] = [
  'INVESTIGATOR', 'LEGAL_REVIEWER', 'AUTHORISING_OFFICER', 'POLICY_ADMINISTRATOR', 'GUARDIAN_ADMINISTRATOR',
];

// §6 — roles that REQUIRE MFA. PR1 enforces MFA for all privileged human roles.
export const MFA_REQUIRED_ROLES: readonly PrivilegedGuardianRole[] = [
  'LEGAL_REVIEWER', 'AUTHORISING_OFFICER', 'POLICY_ADMINISTRATOR', 'GUARDIAN_ADMINISTRATOR', 'INVESTIGATOR',
];

export type AccountState = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'EXPIRED';

/** A governed entitlement record (mirrors guardian.identity_entitlement). */
export interface EntitlementRecord {
  subject: string;                 // trusted token subject (Cognito sub)
  role: PrivilegedGuardianRole;
  jurisdiction: string;            // permitted jurisdiction (authority), e.g. ZA-GP
  accountState: AccountState;
  effectiveFrom: string | null;    // ISO
  effectiveUntil: string | null;   // ISO (null = open-ended)
  isHuman: boolean;                // human vs service (service can never hold a human role here)
}

export type EntitlementDenyReason =
  | 'NO_ENTITLEMENT' | 'ACCOUNT_NOT_ACTIVE' | 'ENTITLEMENT_NOT_YET_EFFECTIVE'
  | 'ENTITLEMENT_EXPIRED' | 'UNKNOWN_ROLE' | 'NOT_HUMAN_IDENTITY';

export interface EntitlementResult {
  ok: boolean;
  reason?: EntitlementDenyReason;
  record?: EntitlementRecord;
}

/** Resolve + gate a governed entitlement. Pure: the DB lookup is performed by the caller
 *  (bin) and the record passed here; this encodes the authorisation rules deterministically. */
export function evaluateEntitlement(record: EntitlementRecord | null | undefined, now: Date = new Date()): EntitlementResult {
  if (!record) return { ok: false, reason: 'NO_ENTITLEMENT' };
  if (!PRIVILEGED_GUARDIAN_ROLES.includes(record.role)) return { ok: false, reason: 'UNKNOWN_ROLE' };
  if (!record.isHuman) return { ok: false, reason: 'NOT_HUMAN_IDENTITY' };   // §31/§32: human roles are human-only
  if (record.accountState !== 'ACTIVE') return { ok: false, reason: 'ACCOUNT_NOT_ACTIVE' };
  if (record.effectiveFrom && new Date(record.effectiveFrom) > now) return { ok: false, reason: 'ENTITLEMENT_NOT_YET_EFFECTIVE' };
  if (record.effectiveUntil && new Date(record.effectiveUntil) <= now) return { ok: false, reason: 'ENTITLEMENT_EXPIRED' };
  return { ok: true, record };
}

/** Does this role require MFA (§6)? */
export function roleRequiresMfa(role: PrivilegedGuardianRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}
