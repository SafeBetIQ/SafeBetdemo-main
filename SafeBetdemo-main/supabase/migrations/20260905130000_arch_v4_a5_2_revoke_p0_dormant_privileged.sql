-- ─── ARCH-V4-A5.2 — revoke PUBLIC/anon/authenticated on proven-dormant P0 fns ──
-- Evidence-driven least-privilege (Authority §11.1). Batch A5.2 targets the P0
-- authentication / identity / player-risk-mutation / alert functions. Complete
-- caller proof (see docs/security/PRIVILEGED_FUNCTION_REGISTER.md §A5.2) shows NONE
-- of these has a runtime EXECUTE caller:
--   * ZERO callers in the application (frontend, server, API routes, .rpc(), edge
--     functions, workers, tests, scripts, contexts) — verified by full grep.
--   * ZERO cron jobs and ZERO triggers invoke them.
--   * The ONLY DB callers are other SECURITY DEFINER functions in the same dormant
--     GRPI/detection subsystem (link_player_to_grpi -> generate_grpi;
--     generate_alerts_for_grpi -> detect_*), which run as the definer (postgres) and
--     therefore BYPASS the client's EXECUTE check — revoking client roles cannot
--     break those internal calls.
--   * The app's real auth logging uses a direct audit_events insert via the service
--     client (writeAudit in demo-auth/login/route.ts), NOT log_auth_event.
-- => anon / PUBLIC / authenticated are all unnecessary. service_role is retained so
--    a future authorised worker/admin can wire these without re-granting. Grants
--    ONLY — no body / search_path / ownership / SECURITY DEFINER / arithmetic / RLS /
--    auth change. Reversible (grant execute ... to public — see runbook).

revoke execute on function clear_force_password_reset() from public, anon, authenticated;
grant execute on function clear_force_password_reset() to service_role;
revoke execute on function detect_binge_sessions(uuid) from public, anon, authenticated;
grant execute on function detect_binge_sessions(uuid) to service_role;
revoke execute on function detect_cross_casino_chasing(uuid) from public, anon, authenticated;
grant execute on function detect_cross_casino_chasing(uuid) to service_role;
revoke execute on function detect_late_night_activity(uuid) from public, anon, authenticated;
grant execute on function detect_late_night_activity(uuid) to service_role;
revoke execute on function detect_loss_chasing(uuid) from public, anon, authenticated;
grant execute on function detect_loss_chasing(uuid) to service_role;
revoke execute on function detect_rapid_deposits(uuid) from public, anon, authenticated;
grant execute on function detect_rapid_deposits(uuid) to service_role;
revoke execute on function generate_grpi(text,text,text) from public, anon, authenticated;
grant execute on function generate_grpi(text,text,text) to service_role;
revoke execute on function link_player_to_grpi(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function link_player_to_grpi(uuid,uuid,text,text,text) to service_role;
revoke execute on function log_auth_event(text,text,text,jsonb,uuid,text) from public, anon, authenticated;
grant execute on function log_auth_event(text,text,text,jsonb,uuid,text) to service_role;
revoke execute on function resolve_alert(uuid) from public, anon, authenticated;
grant execute on function resolve_alert(uuid) to service_role;
revoke execute on function run_full_detection_scan() from public, anon, authenticated;
grant execute on function run_full_detection_scan() to service_role;
revoke execute on function update_global_player_metrics(uuid,numeric,numeric,integer) from public, anon, authenticated;
grant execute on function update_global_player_metrics(uuid,numeric,numeric,integer) to service_role;
