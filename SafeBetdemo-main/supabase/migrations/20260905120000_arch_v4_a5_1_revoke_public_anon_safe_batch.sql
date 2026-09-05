-- ─── ARCH-V4-A5.1 — revoke unjustified PUBLIC/anon EXECUTE (safe batch) ──────
-- Evidence-driven least-privilege. Targets ONLY the 18 SECURITY DEFINER functions
-- currently exposed via a PUBLIC grant that are provably NOT reachable by the anon
-- client:
--   * TRIGGER functions (4) — PostgreSQL fires triggers in the triggering
--     statement's context and does NOT check EXECUTE on the trigger function, so no
--     caller ever needs the grant. (fn_contact_submission_guard, sbiq_audit_chain_insert,
--     sbiq_audit_config_change, sbiq_supersede_prior_sessions.)
--   * cron/worker-only functions (14) — invoked by pg_cron (superuser, bypasses
--     grants) or the A2 rollup worker via service_role; never by the anon/authenticated
--     app path (verified: none appear in the application `.rpc()` caller set).
--
-- Because the exposure is a PUBLIC grant (which anon/authenticated inherit), the
-- fix removes PUBLIC (+ explicit anon) and re-grants only the roles that genuinely
-- call each function. service_role is retained (A2 worker + cron). Triggers keep
-- only service_role (defensive; they need none). NO function body, search_path,
-- ownership, SECURITY DEFINER status, GGR arithmetic, RLS, or auth is changed —
-- EXECUTE grants only. Reversible (see docs/runbooks/security-hardening-runbook.md:
-- `grant execute on function <sig> to public;`).

-- trigger functions (need no EXECUTE grant): revoke public/anon/authenticated
revoke execute on function fn_contact_submission_guard() from public, anon, authenticated;
grant execute on function fn_contact_submission_guard() to service_role;
revoke execute on function sbiq_audit_chain_insert() from public, anon, authenticated;
grant execute on function sbiq_audit_chain_insert() to service_role;
revoke execute on function sbiq_audit_config_change() from public, anon, authenticated;
grant execute on function sbiq_audit_config_change() to service_role;
revoke execute on function sbiq_supersede_prior_sessions() from public, anon, authenticated;
grant execute on function sbiq_supersede_prior_sessions() to service_role;

-- cron/worker-only functions: revoke public/anon; retain authenticated + service_role
revoke execute on function sbiq_financial_rollup_refresh(integer) from public, anon;
grant execute on function sbiq_financial_rollup_refresh(integer) to authenticated, service_role;
revoke execute on function sbiq_fin_rollup_upsert_range(timestamp with time zone,timestamp with time zone) from public, anon;
grant execute on function sbiq_fin_rollup_upsert_range(timestamp with time zone,timestamp with time zone) to authenticated, service_role;
revoke execute on function sbiq_financial_rollup_watchdog() from public, anon;
grant execute on function sbiq_financial_rollup_watchdog() to authenticated, service_role;
revoke execute on function sbiq_seed_demo_financials(uuid,text) from public, anon;
grant execute on function sbiq_seed_demo_financials(uuid,text) to authenticated, service_role;
revoke execute on function sbiq_demo_live_tick(integer) from public, anon;
grant execute on function sbiq_demo_live_tick(integer) to authenticated, service_role;
revoke execute on function sbiq_demo_tick_watchdog() from public, anon;
grant execute on function sbiq_demo_tick_watchdog() to authenticated, service_role;
revoke execute on function sbiq_demo_showcase_maintenance() from public, anon;
grant execute on function sbiq_demo_showcase_maintenance() to authenticated, service_role;
revoke execute on function sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer,text,integer) from public, anon;
grant execute on function sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer,text,integer) to authenticated, service_role;
revoke execute on function sbiq_demo_scale_cleanup(text) from public, anon;
grant execute on function sbiq_demo_scale_cleanup(text) to authenticated, service_role;
revoke execute on function sbiq_demo_audit_insert(uuid) from public, anon;
grant execute on function sbiq_demo_audit_insert(uuid) to authenticated, service_role;
revoke execute on function sbiq_demo_audit_cleanup(text) from public, anon;
grant execute on function sbiq_demo_audit_cleanup(text) to authenticated, service_role;
revoke execute on function sbiq_demo_raise_alert(text,text,text,uuid,jsonb,uuid) from public, anon;
grant execute on function sbiq_demo_raise_alert(text,text,text,uuid,jsonb,uuid) to authenticated, service_role;
revoke execute on function sbiq_audit_chain_backfill() from public, anon;
grant execute on function sbiq_audit_chain_backfill() to authenticated, service_role;
revoke execute on function sbiq_run_audit_verification(text) from public, anon;
grant execute on function sbiq_run_audit_verification(text) to authenticated, service_role;
