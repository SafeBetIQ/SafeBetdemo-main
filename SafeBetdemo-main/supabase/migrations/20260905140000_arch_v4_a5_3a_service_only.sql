-- ─── ARCH-V4-A5.3a — narrow proven service_role-only privileged fns ──────────
-- Evidence-driven least-privilege (Authority §11.1). These 29 SECURITY DEFINER
-- functions are proven to have NO anon/authenticated runtime EXECUTE caller:
--   * 21 dormant (ZERO callers in app/edge/workers/tests/scripts/cron/triggers;
--     any internal callers are other SECURITY DEFINER fns that bypass EXECUTE).
--   * 8 server-service (called ONLY from API routes / the regulator-portal edge via
--     a SUPABASE_SERVICE_ROLE_KEY client — verified `createClient(url, service).rpc(...)`):
--     sbiq_admin_financial_section, sbiq_admin_overview_snapshot,
--     sbiq_admin_refresh_registered(_manual), sbiq_admin_registered_status,
--     sbiq_demo_activate_showcase, sbiq_demo_sim_health_snapshot,
--     sbiq_financial_rollup_status, sbiq_regulator_national.
-- => anon/PUBLIC/authenticated unnecessary; service_role retained. Admin/regulator
--    RPCs must NOT stay authenticated-executable merely because UI is behind an
--    admin/regulator page (Authority §9/§10) — the DB call is a service call.
-- NOTE: sbiq_may_access_chain_scope is DELIBERATELY EXCLUDED — it is an RLS policy
-- predicate (4 policies) evaluated as the querying role and must retain its grants.
-- Grants ONLY; reversible (grant execute ... to public — see runbook).

revoke execute on function check_player_self_exclusion(text,text,text) from public, anon, authenticated;
grant execute on function check_player_self_exclusion(text,text,text) to service_role;
revoke execute on function generate_alerts_for_grpi(uuid) from public, anon, authenticated;
grant execute on function generate_alerts_for_grpi(uuid) to service_role;
revoke execute on function get_alerts_by_pattern() from public, anon, authenticated;
grant execute on function get_alerts_by_pattern() to service_role;
revoke execute on function get_assessment_stats(uuid) from public, anon, authenticated;
grant execute on function get_assessment_stats(uuid) to service_role;
revoke execute on function get_bie_grpi_profiles(integer,integer) from public, anon, authenticated;
grant execute on function get_bie_grpi_profiles(integer,integer) to service_role;
revoke execute on function get_cross_operator_metrics() from public, anon, authenticated;
grant execute on function get_cross_operator_metrics() to service_role;
revoke execute on function get_grpi_compliance_queue(integer) from public, anon, authenticated;
grant execute on function get_grpi_compliance_queue(integer) to service_role;
revoke execute on function get_grpi_cross_casino_alerts(integer) from public, anon, authenticated;
grant execute on function get_grpi_cross_casino_alerts(integer) to service_role;
revoke execute on function get_grpi_dashboard_rows(integer,integer) from public, anon, authenticated;
grant execute on function get_grpi_dashboard_rows(integer,integer) to service_role;
revoke execute on function get_grpi_summary() from public, anon, authenticated;
grant execute on function get_grpi_summary() to service_role;
revoke execute on function get_player_audit_count(uuid,integer) from public, anon, authenticated;
grant execute on function get_player_audit_count(uuid,integer) to service_role;
revoke execute on function get_player_cross_casino_profile(uuid) from public, anon, authenticated;
grant execute on function get_player_cross_casino_profile(uuid) to service_role;
revoke execute on function get_player_recent_audit_events(uuid,integer) from public, anon, authenticated;
grant execute on function get_player_recent_audit_events(uuid,integer) to service_role;
revoke execute on function get_severity_distribution() from public, anon, authenticated;
grant execute on function get_severity_distribution() to service_role;
revoke execute on function hash_identity(text) from public, anon, authenticated;
grant execute on function hash_identity(text) to service_role;
revoke execute on function recalculate_grpi_risk_score(uuid) from public, anon, authenticated;
grant execute on function recalculate_grpi_risk_score(uuid) to service_role;
revoke execute on function sbiq_admin_financial_section(timestamp with time zone) from public, anon, authenticated;
grant execute on function sbiq_admin_financial_section(timestamp with time zone) to service_role;
revoke execute on function sbiq_admin_overview_snapshot(boolean) from public, anon, authenticated;
grant execute on function sbiq_admin_overview_snapshot(boolean) to service_role;
revoke execute on function sbiq_admin_refresh_registered() from public, anon, authenticated;
grant execute on function sbiq_admin_refresh_registered() to service_role;
revoke execute on function sbiq_admin_refresh_registered_manual(uuid,uuid) from public, anon, authenticated;
grant execute on function sbiq_admin_refresh_registered_manual(uuid,uuid) to service_role;
revoke execute on function sbiq_admin_registered_status() from public, anon, authenticated;
grant execute on function sbiq_admin_registered_status() to service_role;
revoke execute on function sbiq_demo_activate_showcase(text,uuid,text,integer,uuid,uuid) from public, anon, authenticated;
grant execute on function sbiq_demo_activate_showcase(text,uuid,text,integer,uuid,uuid) to service_role;
revoke execute on function sbiq_demo_partition_readiness(boolean) from public, anon, authenticated;
grant execute on function sbiq_demo_partition_readiness(boolean) to service_role;
revoke execute on function sbiq_demo_sim_health_snapshot() from public, anon, authenticated;
grant execute on function sbiq_demo_sim_health_snapshot() to service_role;
revoke execute on function sbiq_financial_rollup_backfill(integer) from public, anon, authenticated;
grant execute on function sbiq_financial_rollup_backfill(integer) to service_role;
revoke execute on function sbiq_financial_rollup_status() from public, anon, authenticated;
grant execute on function sbiq_financial_rollup_status() to service_role;
revoke execute on function sbiq_regulator_national(text) from public, anon, authenticated;
grant execute on function sbiq_regulator_national(text) to service_role;
revoke execute on function sbiq_regulator_operators(text) from public, anon, authenticated;
grant execute on function sbiq_regulator_operators(text) to service_role;
revoke execute on function sbiq_verify_audit_chain_range(text,bigint,bigint) from public, anon, authenticated;
grant execute on function sbiq_verify_audit_chain_range(text,bigint,bigint) to service_role;
