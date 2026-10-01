// ─── SafeBet IQ — B4.1 governed server access (own-casino protection alerts) ────
//
// Server-only. The SINGLE authorisation path for every B4.1 route, mirroring the
// B1/B2 fail-closed posture:
//
//   Bearer → verifyPrincipal (verified JWT subject + users registry)
//          → operator-role gate (casino_admin | compliance_officer | super_admin; no
//            regulator, no service-role caller)
//          → governed casino scope via the EXISTING resolveRpScope (operators pinned;
//            super_admin must name a casino; cross-casino refused)
//          → principalMayAccessCasino against the casinos registry (final authority)
//          → only then is a service_role DB handle returned.
//
// No new scope resolver is invented; no caller-controlled cross-casino widening is
// possible. service_role BYPASSRLS, so this API/gateway path is the PRIMARY tenant
// boundary; the table's forced RLS is defence-in-depth against ordinary roles.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyPrincipal, principalMayAccessCasino, type AuthenticatedPrincipal, type PrincipalClient } from '../security/principal.ts';
import { resolveRpScope } from './metrics.ts';
import { isAlertOperatorRole, alertScopeProfile } from './alerts.ts';

export interface AlertAccessOk {
  ok: true;
  admin: SupabaseClient;
  scopeCasino: string;
  principal: AuthenticatedPrincipal;
}
export interface AlertAccessDeny { ok: false; status: number }
export type AlertAccess = AlertAccessOk | AlertAccessDeny;

/**
 * Resolve the governed B4.1 request scope, or a deny status.
 * @param requestedCasinoId optional caller-named casino (super_admin selection only;
 *        for pinned operators it is refused if it differs from their own casino).
 */
export async function resolveAlertAccess(req: Request, requestedCasinoId?: string): Promise<AlertAccess> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { ok: false, status: 503 };

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const principal = await verifyPrincipal(admin as unknown as PrincipalClient, req.headers.get('authorization'), service);
  if (!principal) return { ok: false, status: 401 };

  // Operator-role gate: B4.1 is operator-local. No regulator visibility; a service-role
  // CALLER is refused (the route uses service_role internally only AFTER this check).
  if (principal.isServiceRole || !isAlertOperatorRole(principal.role)) return { ok: false, status: 403 };

  const profile = alertScopeProfile(principal.role);
  const scope = resolveRpScope(profile, principal.casinoId ?? undefined, requestedCasinoId);
  if ('deny' in scope) return { ok: false, status: scope.deny };
  const scopeCasino = scope.scopeCasino;

  // Final authority: principalMayAccessCasino against the casinos registry (same
  // predicate the consumer gateway enforces server-side).
  const { data: casino, error } = await admin
    .from('casinos').select('id, jurisdiction, province').eq('id', scopeCasino).maybeSingle();
  if (error) return { ok: false, status: 503 };
  if (!casino) return { ok: false, status: 404 };
  if (!principalMayAccessCasino(principal, casino as { id: string; jurisdiction: string; province: string | null })) {
    return { ok: false, status: 403 };
  }

  return { ok: true, admin, scopeCasino, principal };
}
