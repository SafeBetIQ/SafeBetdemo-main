-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — Pilot baseline CURATION (M1A-R2.2).
--
-- Excludes the Demo simulation / showcase / demo-admin subsystem from the Pilot baseline.
-- Applied to a disposable copy of the authoritative POST-DECOUPLING Demo public schema
-- (Demo 91161a0, i.e. after PR #133 financial-rollup ops decoupling); the curated disposable
-- DB is then re-dumped to produce the final pilot_app_schema_baseline.sql.
--
-- Every exclusion is EXPLICIT and uses DROP ... RESTRICT (never CASCADE). This is safe because,
-- after the B-COUPLE-1 decoupling, reverse-dependency analysis proved ZERO retained objects
-- (functions, views/matviews, triggers, FKs) depend on any object below. Owned sequences drop
-- with their tables. Order: views → functions → tables (no intra-demo FKs/triggers exist).
--
-- This does NOT run against IQ Demo. The Demo simulator subsystem remains intact on Demo.
-- ─────────────────────────────────────────────────────────────────────────────
set client_min_messages = warning;

-- ── Views (read the demo-sim tables) ──
drop view if exists public.sbiq_demo_sim_health_overall restrict;
drop view if exists public.sbiq_demo_simulation_health  restrict;
drop view if exists public.sbiq_demo_simulator_usage    restrict;
drop view if exists public.sbiq_demo_storage_status     restrict;

-- ── Functions: synthetic-data generators, demo showcase/admin overview, demo-sim ops ──
drop function if exists public.sbiq_admin_financial_section(timestamp with time zone) restrict;
drop function if exists public.sbiq_admin_overview_snapshot(boolean) restrict;
drop function if exists public.sbiq_admin_refresh_registered() restrict;
drop function if exists public.sbiq_admin_refresh_registered_manual(uuid, uuid) restrict;
drop function if exists public.sbiq_admin_registered_status() restrict;
drop function if exists public.sbiq_demo_activate_showcase(text, uuid, text, integer, uuid, uuid) restrict;
drop function if exists public.sbiq_demo_audit_cleanup(text) restrict;
drop function if exists public.sbiq_demo_audit_insert(uuid) restrict;
drop function if exists public.sbiq_demo_broken_chain() restrict;
drop function if exists public.sbiq_demo_limit(text) restrict;
drop function if exists public.sbiq_demo_live_tick(integer) restrict;
drop function if exists public.sbiq_demo_partition_readiness(boolean) restrict;
drop function if exists public.sbiq_demo_raise_alert(text, text, text, uuid, jsonb, uuid) restrict;
drop function if exists public.sbiq_demo_scale_cleanup(text) restrict;
drop function if exists public.sbiq_demo_scale_seed_batch(uuid, text, integer, integer, integer, integer, text, integer) restrict;
drop function if exists public.sbiq_demo_showcase_maintenance() restrict;
drop function if exists public.sbiq_demo_sim_health_snapshot() restrict;
drop function if exists public.sbiq_demo_tick_watchdog() restrict;
drop function if exists public.simulate_live_feed() restrict;

-- ── Tables (owned identity/serial sequences drop with the table) ──
drop table if exists public.sbiq_demo_sim_limits          restrict;
drop table if exists public.sbiq_demo_sim_alerts          restrict;
drop table if exists public.sbiq_demo_sim_run_log         restrict;
drop table if exists public.sbiq_demo_showcase_activations restrict;
drop table if exists public.sbiq_demo_sim_flags           restrict;
drop table if exists public.sbiq_demo_sim_config          restrict;
drop table if exists public.sbiq_demo_showcase_windows    restrict;
drop table if exists public.simulation_config             restrict;
drop table if exists public.sbiq_admin_registered_counts  restrict;
drop table if exists public.sbiq_admin_registered_refresh_log restrict;
