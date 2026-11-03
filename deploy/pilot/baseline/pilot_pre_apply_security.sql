-- SafeBet IQ — Pilot pre-apply privilege hardening (M1B-P1F). REVIEW ARTIFACT.
--
-- Run ONCE against the NEW, EMPTY Pilot Supabase database, as `postgres`, immediately BEFORE
-- deploy/pilot/baseline/pilot_app_schema_baseline.sql (and after pilot_preflight.sql passed).
--
-- Why: a Supabase project's default privileges auto-grant every new table, sequence and function
-- that `postgres` creates in `public` to anon / authenticated / service_role, and PostgreSQL
-- itself grants EXECUTE on every new function to PUBLIC. The curated baseline is a pg_dump of
-- Demo: it records each object's FINAL grants, but pg_dump never emits REVOKEs for grants that a
-- target's default privileges add at CREATE time. Applied as-is, ~300 relations would gain anon
-- access and ~130 SECURITY DEFINER functions would become callable by anon.
--
-- This file removes those defaults for the duration of the apply, so every object the baseline
-- creates starts with owner-only privileges and ends with exactly the GRANTs the baseline states.
-- It changes NO object (the public schema is empty), contains NO data and NO secrets.
-- The baseline's own trailing ALTER DEFAULT PRIVILEGES statements later re-establish the
-- Demo-equivalent schema-level defaults for FUTURE objects; the global PUBLIC-EXECUTE revoke in
-- step 3 deliberately persists (fail-closed for future functions).

\set ON_ERROR_STOP on
begin;

-- 1. Guards: right role, empty application schema.
do $guard$
begin
  if current_user <> 'postgres' then
    raise exception 'pilot_pre_apply_security: must run as postgres (got %)', current_user;
  end if;
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace) then
    raise exception 'pilot_pre_apply_security: public schema is not empty — refusing (Pilot must be a fresh project)';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
             and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass
                             and d.objid = p.oid and d.deptype = 'e')) then
    raise exception 'pilot_pre_apply_security: public schema already contains non-extension functions — refusing';
  end if;
end
$guard$;

-- 2. Schema-level defaults in public for objects created by postgres (Supabase sets these).
--    Removes auto-grants of ALL on new tables/views/matviews, sequences and functions.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;

-- 3. Global defaults for objects created by postgres (any schema). Removes the built-in
--    "EXECUTE to PUBLIC" on new functions — anon/authenticated are members of PUBLIC, so this
--    is the path that would otherwise expose functions even with no direct grant — and any
--    database-wide auto-grants to the API roles. Global defaults cannot be scoped IN SCHEMA.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke all on tables    from anon, authenticated, service_role;
alter default privileges for role postgres revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres revoke all on functions from anon, authenticated, service_role;

-- 4. Prove the effective defaults are now owner-only: create probe objects inside a savepoint,
--    inspect their ACLs, then roll the probes back (nothing persists).
savepoint probe;
create table public.__sbiq_acl_probe (id int);
create sequence public.__sbiq_acl_probe_seq;
create function public.__sbiq_acl_probe_fn() returns int language sql as 'select 1';
do $probe$
declare bad text;
begin
  select string_agg(obj || ' -> ' || grantee || ':' || priv, '; ') into bad from (
    select 'table' obj, case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee, a.privilege_type priv
      from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     where c.oid = 'public.__sbiq_acl_probe'::regclass
    union all
    select 'sequence', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type
      from pg_class c, aclexplode(coalesce(c.relacl, acldefault('s', c.relowner))) a
     where c.oid = 'public.__sbiq_acl_probe_seq'::regclass
    union all
    select 'function', case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = 'public.__sbiq_acl_probe_fn()'::regprocedure
  ) x where grantee <> 'postgres';
  if bad is not null then
    raise exception 'pilot_pre_apply_security: new objects would still inherit grants: %', bad;
  end if;
  raise notice 'pilot_pre_apply_security: OK — new public objects are owner-only';
end
$probe$;
rollback to savepoint probe;

commit;
