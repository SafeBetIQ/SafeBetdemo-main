-- ─── ARCH-V4-A5.3b — revoke PUBLIC/anon; RETAIN authenticated (browser callers) ──
-- These 2 SECURITY DEFINER functions ARE called directly by logged-in users via the
-- browser Supabase client (proven), so `authenticated` is required — but anon/PUBLIC
-- are not:
--   * get_user_by_email_fast(text) — lib/auth.ts + login/page.tsx call it ONLY AFTER
--     signInWithPassword succeeds (session established → authenticated), never pre-auth.
--   * sbiq_verify_audit_chain(text) — app/admin/audit + regulator/audit-verification
--     pages call it as the logged-in (authenticated) admin/regulator.
-- => revoke PUBLIC/anon; grant authenticated + service_role. Grants ONLY; reversible.

revoke execute on function get_user_by_email_fast(text) from public, anon;
grant execute on function get_user_by_email_fast(text) to authenticated, service_role;
revoke execute on function sbiq_verify_audit_chain(text) from public, anon;
grant execute on function sbiq_verify_audit_chain(text) to authenticated, service_role;
