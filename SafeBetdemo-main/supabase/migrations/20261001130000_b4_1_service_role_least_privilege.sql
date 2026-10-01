-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B4.1 F1 least-privilege hardening for public.player_protection_alerts.
--
-- The base migration (20261001120000) granted service_role SELECT/INSERT/UPDATE, but the
-- Supabase platform DEFAULT PRIVILEGE pre-grants service_role ALL on every new public table,
-- so service_role retained DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN. This resets
-- service_role to EXACTLY the three approved operations for B4.1.
--
-- Scope: privileges ONLY. No change to table structure, indexes, functions, triggers, RLS,
-- audit logic, alert rows, source data, or the migration ledger. (F2 — trigger-function
-- EXECUTE defaults — is intentionally NOT touched here; it remains P3 informational.)
-- ─────────────────────────────────────────────────────────────────────────────

revoke all privileges on table public.player_protection_alerts from service_role;
grant select, insert, update on table public.player_protection_alerts to service_role;
