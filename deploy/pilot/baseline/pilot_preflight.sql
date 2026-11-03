-- SafeBet IQ — Pilot empty-project preflight (M1B-P1F). REVIEW ARTIFACT. READ-ONLY.
--
-- Run against the NEW Pilot Supabase database, as postgres, BEFORE pilot_pre_apply_security.sql.
--   psql "$DB" -X -q -At -v ON_ERROR_STOP=1 -f pilot_preflight.sql > preflight.txt
-- Part A raises (non-zero exit) on any STOP condition. Part B prints an evidence snapshot
-- (no secrets: catalog metadata only). Nothing is created or changed.

\set ON_ERROR_STOP on
set default_transaction_read_only = on;

do $preflight$
declare v text;
begin
  -- A1. PostgreSQL 17 (baseline was dumped by pg_dump 17.11; uses transaction_timeout etc.).
  if current_setting('server_version_num')::int < 170000 or current_setting('server_version_num')::int >= 180000 then
    raise exception 'PREFLIGHT A1: PostgreSQL 17 required, got %', current_setting('server_version');
  end if;

  -- A2. Identity: must be the project's postgres role (owner of the baseline objects).
  if current_user <> 'postgres' then raise exception 'PREFLIGHT A2: must connect as postgres (got %)', current_user; end if;

  -- A3. Empty application schema: no relations, no non-extension functions, no non-extension types.
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace) then
    raise exception 'PREFLIGHT A3: public schema has relations — not an empty Pilot project';
  end if;
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
             and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')) then
    raise exception 'PREFLIGHT A3: public schema has non-extension functions — not an empty Pilot project';
  end if;
  if exists (select 1 from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype in ('e','c','d','r')
             and not exists (select 1 from pg_depend d where d.classid = 'pg_type'::regclass and d.objid = t.oid and d.deptype = 'e')) then
    raise exception 'PREFLIGHT A3: public schema has user-defined types — not an empty Pilot project';
  end if;

  -- A4. Platform roles the baseline grants to / owns against.
  select string_agg(r, ', ') into v from unnest(array['anon','authenticated','service_role','authenticator','supabase_admin']) r
   where not exists (select 1 from pg_roles where rolname = r);
  if v is not null then raise exception 'PREFLIGHT A4: missing platform roles: %', v; end if;

  -- A5. DDL-time dependencies of the baseline (auth.users, auth.uid(), auth.role()).
  if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.role()') is null then
    raise exception 'PREFLIGHT A5: Supabase auth schema objects missing (auth.users / auth.uid() / auth.role())';
  end if;

  -- A6. Application extensions (pgcrypto for digest(), uuid-ossp).
  select string_agg(e, ', ') into v from unnest(array['pgcrypto','uuid-ossp','plpgsql']) e
   where not exists (select 1 from pg_extension where extname = e);
  if v is not null then raise exception 'PREFLIGHT A6: required extensions not installed: %', v; end if;

  -- A7. supabase_admin default privileges — DETECT & REPORT only (M1B-P1F Correction 1).
  --     On hosted Supabase supabase_admin is an internal reserved role: postgres is NOT a member and
  --     CANNOT alter its default privileges. Membership is therefore NOT required and is NEVER
  --     requested here; Supabase-owned supabase_admin defaults are left untouched. The Pilot apply
  --     uses the generated Supabase derivative (generated/pilot_app_schema_supabase.sql), which omits
  --     the twelve default-privilege statements the canonical baseline carries for that role, so the
  --     apply runs cleanly under ON_ERROR_STOP without any supabase_admin change. This step only
  --     detects and reports the current supabase_admin default-ACL entries (see Part B 'defacl|'
  --     lines for the full detail) and NEVER fails on non-membership.
  select coalesce(string_agg(format('%s/%s', d.defaclobjtype,
             case when d.defaclnamespace = 0 then 'GLOBAL' else d.defaclnamespace::regnamespace::text end), ', '), '(none)')
    into v
    from pg_default_acl d where d.defaclrole = 'supabase_admin'::regrole
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace);
  raise notice 'PREFLIGHT A7 (informational): supabase_admin default-privilege entries = %; left untouched; postgres membership not required and not requested', v;

  -- A8. Reviewed default-privilege model: the pre-apply hardening only revokes from anon,
  --     authenticated, service_role and PUBLIC. Any postgres default (public or global) that grants
  --     to another role, or covers an object type we have not reviewed, must stop the run.
  select string_agg(format('%s/%s/%s->%s', 'postgres',
                           case when d.defaclnamespace = 0 then 'GLOBAL' else d.defaclnamespace::regnamespace::text end,
                           d.defaclobjtype, case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end), '; ') into v
    from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
     and (d.defaclobjtype not in ('r','S','f','T')
          or (case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end)
             not in ('postgres','anon','authenticated','service_role','PUBLIC'));
  if v is not null then raise exception 'PREFLIGHT A8: unreviewed default privileges: %', v; end if;
end
$preflight$;

-- ── Part B: evidence snapshot ────────────────────────────────────────────────
select line from (
  select 'server_version|' || current_setting('server_version') line
  union all select 'current_user|' || current_user
  union all select 'current_database|' || current_database()
  union all select 'is_superuser|' || current_setting('is_superuser')
  union all select 'ssl|' || coalesce((select ssl::text from pg_stat_ssl where pid = pg_backend_pid()), 'unknown')
  union all select 'public_owner|' || pg_get_userbyid(nspowner) from pg_namespace where nspname = 'public'
  union all select 'public_acl|' || coalesce(nspacl::text, '(default)') from pg_namespace where nspname = 'public'
  union all select 'role|' || rolname || '|super=' || rolsuper || '|bypassrls=' || rolbypassrls || '|login=' || rolcanlogin
              from pg_roles where rolname in ('postgres','anon','authenticated','service_role','authenticator','supabase_admin')
  union all select 'member_of_supabase_admin|' || pg_has_role(current_user, 'supabase_admin', 'MEMBER')::text
  union all select 'defacl|' || pg_get_userbyid(defaclrole) || '|' ||
                   case when defaclnamespace = 0 then 'GLOBAL' else defaclnamespace::regnamespace::text end || '|' ||
                   defaclobjtype::text || '|' || defaclacl::text
              from pg_default_acl
             where defaclrole in ('postgres'::regrole, 'supabase_admin'::regrole)
               and (defaclnamespace = 0 or defaclnamespace = 'public'::regnamespace)
  union all select 'new_function_public_execute_default|' ||
                   case when exists (select 1 from pg_default_acl d where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0
                                     and d.defaclobjtype = 'f' and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0))
                        then 'revoked' else 'granted(PostgreSQL default)' end
  union all select 'extension|' || extname || '|' || extversion || '|' || extnamespace::regnamespace::text
              from pg_extension where extname in ('pgcrypto','uuid-ossp','plpgsql','pg_cron','pg_net','supabase_vault','pg_stat_statements','pg_graphql')
  union all select 'optional_missing|' || e from unnest(array['pg_cron','pg_net','supabase_vault']) e
             where not exists (select 1 from pg_extension where extname = e)
  union all select 'public_relations|' || count(*) from pg_class where relnamespace = 'public'::regnamespace
) s order by line collate "C";
