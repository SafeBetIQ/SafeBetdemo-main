-- SafeBet IQ — Pilot baseline DISPOSABLE-TEST PLATFORM PREP (TEST HARNESS ONLY).
--
-- Supplies the Supabase-managed roles/schemas/extensions/stubs that a bare PostgreSQL 17
-- disposable database lacks, so the application `public` baseline can be applied for
-- verification. On the real Pilot (a Supabase project) these are provided by the platform.
-- NOTHING here belongs in pilot_app_schema_baseline.sql or the Pilot production schema.
-- Only DDL-time dependencies are stubbed; function bodies referencing vault/cron/net resolve
-- lazily (pg_dump sets check_function_bodies=false), so those schemas are created but empty.

-- Platform roles (Supabase provides these; the baseline only GRANTs to / owns against them).
do $$
declare r text;
begin
  foreach r in array array[
    'anon','authenticated','service_role',
    'supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_functions_admin',
    'supabase_read_only_user','supabase_replication_admin','dashboard_user','pgbouncer'
  ] loop
    if not exists (select 1 from pg_roles where rolname=r) then execute format('create role %I nologin noinherit', r); end if;
  end loop;
  if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login password 'disposable'; end if;
  execute 'grant anon, authenticated, service_role to authenticator';
  -- service_role bypasses RLS on the real platform.
  execute 'alter role service_role bypassrls';
end $$;

-- Platform-managed schemas.
create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists vault;
create schema if not exists cron;
create schema if not exists net;
grant usage on schema auth, extensions to anon, authenticated, service_role;

-- Extensions actually used by the application (digest for the B-series fingerprints, etc.).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- auth stubs: FK target + the policy helpers referenced by RLS expressions.
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid()  returns uuid  language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text  language sql stable as $$ select null::text $$;
create or replace function auth.jwt()  returns jsonb language sql stable as $$ select '{}'::jsonb $$;

-- vault/cron/net stubs exist only so that, if any object references them structurally, apply
-- does not abort. Function bodies that call them are not validated at creation time.
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text, secret text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;

-- pg_cron relations (a public view/object selects from these). Columns mirror pg_cron.
create table if not exists cron.job (
  jobid bigint primary key, schedule text, command text, nodename text, nodeport integer,
  database text, username text, active boolean, jobname text);
create table if not exists cron.job_run_details (
  jobid bigint, runid bigint, job_pid integer, database text, username text, command text,
  status text, return_message text, start_time timestamptz, end_time timestamptz);

-- pg_net stub (referenced only inside SECURITY DEFINER function bodies; create for safety).
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
  returns bigint language sql as $$ select 0::bigint $$;
