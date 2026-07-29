// ─── Platform security — verified principals (Phase 4.1) ─────────────────────
//
// Cross-cutting security infrastructure (NOT an enterprise platform): every
// edge-function surface derives WHO is calling from cryptographically
// verified material only — the Supabase-verified JWT (auth.getUser) plus
// the server-side users registry keyed by the verified auth.uid(). Nothing
// here ever trusts query parameters, headers beyond the bearer token, or
// client-supplied identity of any kind (Constitution 6.2).

export interface AuthenticatedPrincipal {
  userId: string;
  /** Application role from the users registry (user_role enum). */
  role: string;
  casinoId: string | null;
  jurisdiction: string | null;
  province: string | null;
  /** True when the caller presented the service-role key (internal jobs). */
  isServiceRole: boolean;
}

/** Minimal structural client surface (satisfied by supabase-js service client). */
export interface PrincipalClient {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string } | null } | null; error: unknown }> };
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

export function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1] : null;
}

/**
 * Verify the caller. Returns null when the token is missing, invalid,
 * anon, or belongs to no active registry user — callers MUST treat null
 * as 401/403. The service-role key authenticates internal platform jobs.
 */
export async function verifyPrincipal(
  client: PrincipalClient,
  authorizationHeader: string | null,
  serviceRoleKey?: string,
): Promise<AuthenticatedPrincipal | null> {
  const token = bearerToken(authorizationHeader);
  if (!token) return null;

  if (serviceRoleKey && token === serviceRoleKey) {
    return { userId: 'service-role', role: 'service_role', casinoId: null, jurisdiction: null, province: null, isServiceRole: true };
  }

  // Cryptographic verification: Supabase Auth validates signature + expiry.
  // The anon key and tampered tokens fail here.
  const { data, error } = await client.auth.getUser(token);
  const userId = data?.user?.id;
  if (error || !userId) return null;

  // Server-side context keyed by the VERIFIED subject — never by claims the
  // client could author.
  const { data: row, error: userError } = await client
    .from('users')
    .select('role, casino_id, jurisdiction, province, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (userError || !row || row.is_active === false) return null;

  return {
    userId,
    role: String(row.role),
    casinoId: (row.casino_id as string | null) ?? null,
    jurisdiction: (row.jurisdiction as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    isServiceRole: false,
  };
}

/**
 * May this principal act on this casino? Mirrors app_visible_casinos()
 * (the RLS predicate) so edge surfaces and the database enforce the SAME
 * tenant matrix.
 */
export function principalMayAccessCasino(
  principal: AuthenticatedPrincipal,
  casino: { id: string; jurisdiction: string; province: string | null },
): boolean {
  if (principal.isServiceRole || principal.role === 'super_admin') return true;
  if (principal.role === 'casino_admin' || principal.role === 'compliance_officer') {
    return principal.casinoId === casino.id;
  }
  if (principal.role === 'regulator' || principal.role === 'national_regulator') {
    return principal.jurisdiction !== null && casino.jurisdiction === principal.jurisdiction;
  }
  if (principal.role === 'provincial_regulator') {
    return principal.jurisdiction !== null && casino.jurisdiction === principal.jurisdiction
      && principal.province !== null && casino.province === principal.province;
  }
  return false;
}
