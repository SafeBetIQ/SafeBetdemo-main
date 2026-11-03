-- SafeBet IQ — Pilot post-apply privilege hardening (M1B-P1F, revised). REVIEW ARTIFACT.
--
-- Run ONCE as `postgres`, in the same apply run, AFTER the structural fingerprint has been captured
-- and proven to equal 5f324b14… (so the fingerprint reflects the certified baseline schema, including
-- its table-grant state), and BEFORE pilot_privilege_verify.sql. This file applies the Pilot-specific
-- privilege TIGHTENING that the reviewed privilege manifest encodes. It creates no object, inserts no
-- data, and contains no secret.
--
-- Pilot privilege policy is EXPLICIT ALLOWLISTING (owner decisions, M1B-P1F):
--   • Correction 2 — PUBLIC function EXECUTE = NONE. The 14 functions that were PUBLIC-executable in
--     Demo only because PostgreSQL grants EXECUTE to PUBLIC by default are NOT re-granted: the required
--     API roles already hold direct grants, so no application access is lost. (This file no longer
--     contains any `GRANT … TO public`.)
--   • Decision 3 — three inherited Demo exposures are closed (details below).
--   • Correction 4 — future objects created by postgres in `public` are opt-in: the Demo-parity default
--     privileges the baseline re-installs at its end are revoked so new tables/sequences/functions do
--     NOT auto-grant to anon / authenticated / service_role, and PUBLIC does not auto-receive EXECUTE.
--
-- Supabase-internal roles are never touched (no supabase_admin membership or defaults are altered).

\set ON_ERROR_STOP on
begin;

do $guard$
begin
  if current_user <> 'postgres' then
    raise exception 'pilot_post_apply_grants: must run as postgres (got %)', current_user;
  end if;
end
$guard$;

-- ── Decision 3A — sbiq_financial_rollup_checkpoint (table, no RLS) ────────────────────────────────
-- Demo granted anon/authenticated/service_role ALL (incl. DELETE/TRUNCATE) via Supabase's default
-- privileges; the baseline records those explicit grants. The only readers/writers are SECURITY
-- DEFINER functions (sbiq_financial_rollup_refresh/_watchdog/_status), which run with owner rights and
-- need no table grant; no signed-in client reads this table directly (traced: no application/client
-- reference, only SQL migrations). Remove anon AND authenticated access. service_role (server-side) and
-- postgres (owner) are retained. anon can no longer reach the table, so it is not exposed to anon
-- without RLS.
revoke all on table public.sbiq_financial_rollup_checkpoint from anon;
revoke all on table public.sbiq_financial_rollup_checkpoint from authenticated;

-- ── Decision 3B — sbiq_may_access_chain_scope(p_scope text) (SECURITY DEFINER) ────────────────────
-- Used as the USING predicate of 4 `TO authenticated` RLS SELECT policies (audit_chain_head,
-- audit_verification_run, audit_chain_checkpoint, platform_integrity_alert) and by the governed audit-chain
-- verification path; authenticated and service_role require EXECUTE and are retained. Remove PUBLIC and
-- anon EXECUTE so an unauthenticated caller can no longer reach it. NOTE: the function's null-auth
-- behaviour (returns true when auth.uid() is null) lives in the IMMUTABLE certified baseline and is NOT
-- rewritten here; with anon/PUBLIC EXECUTE removed it is unreachable by an unauthenticated caller, and
-- the four policies are `TO authenticated` only. Reported separately in the review, not silently changed.
revoke execute on function public.sbiq_may_access_chain_scope(p_scope text) from anon;
revoke execute on function public.sbiq_may_access_chain_scope(p_scope text) from public;

-- ── Decision 3C — sbiq_audit_benchmark(p_n integer) ───────────────────────────────────────────────
-- Diagnostic/benchmark function; no application or client caller exists (traced). An unauthenticated
-- user must not execute it. Remove PUBLIC, anon AND authenticated EXECUTE. service_role (server-side
-- diagnostics) and postgres (owner) are retained as the only roles with a plausible operational need;
-- this can be reduced to postgres-only later without affecting the application.
revoke execute on function public.sbiq_audit_benchmark(p_n integer) from anon;
revoke execute on function public.sbiq_audit_benchmark(p_n integer) from authenticated;
revoke execute on function public.sbiq_audit_benchmark(p_n integer) from public;

-- ── Correction 4 — opt-in default privileges for FUTURE objects created by postgres in public ─────
-- The baseline re-installs Demo's schema-level default privileges at its end (auto-granting new
-- tables/sequences/functions to anon/authenticated/service_role). Revoke them so future SafeBet objects
-- are owner-only until an explicit grant is issued. Also re-assert the global revoke of PUBLIC EXECUTE
-- on new functions (fail-closed; PostgreSQL grants EXECUTE to PUBLIC by default). service_role is NOT
-- auto-granted (access must be explicit). Supabase-internal (supabase_admin) defaults are left untouched.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres revoke all on functions from anon, authenticated, service_role;

commit;
