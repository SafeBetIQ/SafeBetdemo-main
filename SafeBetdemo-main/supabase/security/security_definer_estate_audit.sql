-- ─── Reusable SECURITY DEFINER estate audit (SEC-SD-1) ───────────────────────
-- Read-only. Lists every user-defined SECURITY DEFINER function with its EFFECTIVE
-- EXECUTE privileges for PUBLIC / anon / authenticated / service_role, plus body
-- classification SIGNALS (computed here so function SOURCE is never exported).
--
-- Run against any project (Demo or Production) via the Supabase Management API
-- (POST /v1/projects/<ref>/database/query) or psql. Excludes Supabase/system
-- schemas. `rettype='trigger'` rows are NOT invokable via PostgREST /rpc — treat
-- them as hygiene-only, not internet-exposed.
--
-- Severity must be finalised by a human using WHO-CAN-CALL + WHAT-IT-DOES + body
-- review; the flags below only triage.
select n.nspname                                              as schema,
       p.proname                                              as name,
       format('%s.%s(%s)', n.nspname, p.proname,
              pg_get_function_identity_arguments(p.oid))      as signature,
       pg_get_userbyid(p.proowner)                            as owner,
       p.provolatile                                          as volatility,
       l.lanname                                              as language,
       p.prorettype::regtype::text                            as return_type,
       (p.proacl is null
        or exists (select 1 from aclexplode(p.proacl) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE'))
                                                              as public_execute,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_role_execute,
       (p.prorettype::regtype::text = 'trigger')             as is_trigger_only,
       (p.prosrc ~* '\y(insert|update|delete|truncate|drop|create|alter|grant|revoke|refresh materialized)\y')
                                                              as looks_mutating,
       (p.prosrc ~* '(auth\.uid|auth\.jwt|is_admin|is_super_admin|is_regulator|is_casino_admin|raise exception|current_setting\(.*(jwt|role))')
                                                              as has_internal_guard_signal,
       (p.prosrc ~* '(financ|ggr|rollup|posture|stake|winning|revenue|player|grpi|self_exclus|identity|audit|secret|token|credential|password)')
                                                              as touches_sensitive
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language  l on l.oid = p.prolang
where p.prosecdef = true
  and n.nspname not in ('pg_catalog','information_schema','auth','storage','realtime',
       'vault','pgsodium','pgsodium_masks','graphql','graphql_public','extensions',
       'supabase_functions','supabase_migrations','net','cron','pgbouncer',
       '_realtime','_analytics','_supavisor','pgtle')
order by anon_execute desc, looks_mutating desc, touches_sensitive desc, n.nspname, p.proname;
