-- SafeBet IQ — Pilot privilege / security verification (M1B-P1F). REVIEW ARTIFACT.
--
-- COMPLEMENTS (does not replace) deploy/pilot/baseline/fingerprint.sql, whose approved hash
-- 5f324b14… stays the structural anchor. fingerprint.sql covers table grants only; it does not
-- see function EXECUTE grants, PUBLIC inheritance, sequence grants or default privileges.
--
-- Usage (read-only; run as postgres after the baseline + pilot_post_apply_grants.sql):
--   psql "$DB" -X -q -At -v ON_ERROR_STOP=1 -f pilot_privilege_verify.sql > privileges.txt
--   diff deploy/pilot/baseline/pilot_privilege_manifest.txt privileges.txt   # must be empty
--   sha256sum privileges.txt                                                 # == pilot_privilege_manifest.sha256
--
-- Part A raises an exception (non-zero exit) on any fail-closed invariant violation.
-- Part B prints one canonical line per privilege fact, ordered with COLLATE "C"
-- (deterministic across hosts/locales). Any unexpected or missing privilege shows up in the diff.

\set ON_ERROR_STOP on

-- ── Part A: fail-closed invariants ───────────────────────────────────────────
do $verify$
declare
  v text;
  -- Pilot policy is explicit allowlisting (M1B-P1F). These allowlists are now EMPTY:
  --   • PUBLIC function EXECUTE = NONE (Correction 2);
  --   • no SECURITY DEFINER function is executable by anon (Decision 3B closed the one prior exception,
  --     sbiq_may_access_chain_scope);
  --   • no anon-accessible table without RLS (Decision 3A closed sbiq_financial_rollup_checkpoint).
  secdef_public_or_anon_ok constant text[] := array[]::text[];
  public_exec_ok constant text[] := array[]::text[];
  anon_no_rls_ok constant text[] := array[]::text[];
begin
  if current_user <> 'postgres' then raise exception 'VERIFY: must run as postgres (got %)', current_user; end if;

  -- A1. No public relation (table/view/matview/sequence) grants anything to PUBLIC.
  select string_agg(c.relname, ', ' order by c.relname) into v
    from pg_class c, aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end, c.relowner))) a
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','S','f') and a.grantee = 0;
  if v is not null then raise exception 'VERIFY A1: relations granted to PUBLIC: %', v; end if;

  -- A2. PUBLIC EXECUTE must be NONE (Pilot policy = explicit allowlisting; no PUBLIC function EXECUTE).
  select string_agg(s.sig, ', ' order by s.sig) into v from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.pronamespace = 'public'::regnamespace and a.grantee = 0 and a.privilege_type = 'EXECUTE') s
   where not (s.sig = any (public_exec_ok));
  if v is not null then raise exception 'VERIFY A2: PUBLIC EXECUTE present (Pilot policy = none): %', v; end if;

  -- A3. No SECURITY DEFINER function is effectively executable by anon (direct OR via PUBLIC).
  select string_agg(s.sig, ', ' order by s.sig) into v from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and has_function_privilege('anon', p.oid, 'EXECUTE')) s
   where not (s.sig = any (secdef_public_or_anon_ok));
  if v is not null then raise exception 'VERIFY A3: SECURITY DEFINER functions callable by anon: %', v; end if;

  -- A4. Every SECURITY DEFINER function is owned by postgres and pins search_path.
  select string_agg(p.proname || ' owner=' || pg_get_userbyid(p.proowner), ', ' order by p.proname) into v
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
     and (pg_get_userbyid(p.proowner) <> 'postgres'
          or not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'));
  if v is not null then raise exception 'VERIFY A4: SECURITY DEFINER owner/search_path violation: %', v; end if;

  -- A5. anon may touch a table without RLS only where reviewed.
  select string_agg(c.relname, ', ' order by c.relname) into v
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and not c.relrowsecurity
     and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
     and not (c.relname = any (anon_no_rls_ok));
  if v is not null then raise exception 'VERIFY A5: anon-accessible tables without RLS: %', v; end if;

  -- A6. postgres must not have a global default that grants EXECUTE on new functions to PUBLIC
  --     (requires the explicit global revoke from pilot_pre_apply_security.sql).
  if not exists (select 1 from pg_default_acl d
                  where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0 and d.defaclobjtype = 'f'
                    and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)) then
    raise exception 'VERIFY A6: global default still grants EXECUTE on new functions to PUBLIC';
  end if;

  -- A7. Future-object defaults are opt-in (Correction 4): no postgres default privilege (global or in
  --     public) may auto-grant to anon, authenticated, service_role or PUBLIC. Only postgres (owner)
  --     may appear. Read-only assertion over pg_default_acl — deterministic regardless of whether a
  --     reverted row is physically present. supabase_admin defaults are NOT inspected (left untouched).
  select string_agg(format('%s/%s->%s', d.defaclobjtype,
                           case when d.defaclnamespace = 0 then 'GLOBAL' else d.defaclnamespace::regnamespace::text end,
                           case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end), '; ' order by 1) into v
    from pg_default_acl d, aclexplode(d.defaclacl) a
   where d.defaclrole = 'postgres'::regrole
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
     and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated','service_role'));
  if v is not null then raise exception 'VERIFY A7: postgres default privileges still auto-grant to non-owner roles: %', v; end if;
end
$verify$;

-- ── Part B: canonical privilege state (hash/diff target) ─────────────────────
with
rel as (
  select c.relkind::text kind, c.relname nm,
         case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee, a.privilege_type priv
    from pg_class c, aclexplode(coalesce(c.relacl, acldefault(case when c.relkind = 'S' then 's'::"char" else 'r'::"char" end, c.relowner))) a
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','S','f')),
fn as (
  select p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig,
         p.prosecdef, pg_get_userbyid(p.proowner) owner,
         exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') pinned,
         coalesce(p.proacl, acldefault('f', p.proowner)) acl
    from pg_proc p where p.pronamespace = 'public'::regnamespace),
lines as (
  select 'rel|' || kind || '|' || nm || '|' || grantee || '|' || string_agg(priv, ',' order by priv collate "C") line
    from rel group by kind, nm, grantee
  union all
  select 'fn|' || sig || '|secdef=' || prosecdef::text || '|owner=' || owner || '|search_path=' || case when pinned then 'set' else 'none' end
         || '|exec=' || coalesce((select string_agg(g, ',' order by g collate "C") from (
              select case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end g
                from aclexplode(acl) a where a.privilege_type = 'EXECUTE') x), '')
    from fn
  union all
  select 'eff|' || sig || '|anon=' || has_function_privilege('anon', oid, 'EXECUTE')::text
         || '|authenticated=' || has_function_privilege('authenticated', oid, 'EXECUTE')::text
         || '|service_role=' || has_function_privilege('service_role', oid, 'EXECUTE')::text
    from fn
  union all
  select 'defacl|postgres|' || case when d.defaclnamespace = 0 then 'GLOBAL' else d.defaclnamespace::regnamespace::text end
         || '|' || d.defaclobjtype::text || '|'
         || coalesce((select string_agg(g || '=' || ps, ';' order by g collate "C") from (
              select case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end g,
                     string_agg(a.privilege_type, ',' order by a.privilege_type collate "C") ps
                from aclexplode(d.defaclacl) a group by 1) x), '')
    from pg_default_acl d
   where d.defaclrole = 'postgres'::regrole and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
)
select line from lines order by line collate "C";
