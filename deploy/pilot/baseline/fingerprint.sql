-- SafeBet IQ — deterministic application-schema structural fingerprint source.
-- Emits ONE canonical, ordered text blob over the public application schema, excluding
-- OIDs / database name / timestamps / row counts / physical storage / environment UUIDs.
-- Pipe the output to sha256sum to obtain the fingerprint. Identical schema ⇒ identical hash,
-- independent of environment. Used against both the Demo source and each fresh baseline DB.
\pset tuples_only on
\pset format unaligned
select string_agg(sig, E'\n' order by sig) from (
  select 't:'||c.relname||':'||a.attname||':'||pg_catalog.format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull::text||':'||coalesce(pg_get_expr(ad.adbin,ad.adrelid),'') as sig
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join pg_attribute a on a.attrelid=c.oid
    left join pg_attrdef ad on ad.adrelid=c.oid and ad.adnum=a.attnum
    where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped
  union all
  select 'con:'||conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid)
    from pg_constraint where connamespace='public'::regnamespace
  union all
  select 'idx:'||indexname||':'||indexdef from pg_indexes where schemaname='public'
  union all
  select 'fn:'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||pg_get_function_result(p.oid)||':secdef='||p.prosecdef::text||':cfg='||coalesce(array_to_string(p.proconfig,','),'')||':owner='||pg_get_userbyid(p.proowner)
    from pg_proc p where p.pronamespace='public'::regnamespace
  union all
  select 'trg:'||c.relname||':'||t.tgname||':'||pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.relnamespace='public'::regnamespace and not t.tgisinternal
  union all
  select 'pol:'||schemaname||'.'||tablename||'.'||policyname||':'||coalesce(permissive,'')||':'||coalesce(array_to_string(roles,','),'')||':'||coalesce(cmd,'')||':'||coalesce(qual,'')||':'||coalesce(with_check,'')
    from pg_policies where schemaname='public'
  union all
  select 'rls:'||c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text
    from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
  union all
  select 'view:'||viewname||':'||definition from pg_views where schemaname='public'
  union all
  select 'mv:'||matviewname||':'||definition from pg_matviews where schemaname='public'
  union all
  select 'grant:'||grantee||':'||table_name||':'||privilege_type
    from information_schema.role_table_grants where table_schema='public'
) s;
