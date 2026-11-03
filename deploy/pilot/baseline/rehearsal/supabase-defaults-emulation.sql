-- SafeBet IQ — Supabase default-privilege EMULATION (REHEARSAL / TEST HARNESS ONLY).
--
-- Applied ONLY to a disposable local Postgres 17 (after platform-prep.sql) to reproduce what a
-- fresh Supabase project does: objects created by postgres / supabase_admin in schema public are
-- auto-granted to anon, authenticated and service_role. Used by the M1B apply workflow's
-- disposable rehearsal job and by tests/pilotPrivilegeHardeningDb.test.mjs to prove that
-- pilot_pre_apply_security.sql neutralises these defaults. NEVER run against any real project.
--
-- M1B-P1F Correction 1/7: postgres is NOT made a member of supabase_admin (platform-prep.sql creates
-- supabase_admin as a plain nologin role). The supabase_admin defaults below are set using the local
-- superuser, purely to reproduce the platform's EXISTING state; the Pilot apply uses the generated
-- Supabase derivative, which never alters supabase_admin defaults, so the rehearsal proves the hardening
-- WITHOUT requiring postgres membership in supabase_admin.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
