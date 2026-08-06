-- Financial-rollup operational status for Platform Health (cheap; small tables).
create or replace function public.sbiq_financial_rollup_status() returns jsonb
language sql stable security definer set search_path to 'public' as $fn$
  select jsonb_build_object(
    'enabled', (select value='true' from sbiq_demo_sim_flags where key='ENABLE_FINANCIAL_ROLLUP'),
    'cron_active', exists(select 1 from cron.job where jobname='sbiq-financial-rollup-refresh' and active),
    'last_success', cp.last_success_at, 'last_failed', cp.last_failed_at,
    'lag_seconds', round(extract(epoch from now()-coalesce(cp.last_success_at, now())))::int,
    'rollup_version', cp.rollup_version,
    'buckets', (select count(*) from sbiq_financial_rollup_hourly),
    'buckets_reconcile', (select bool_and(reconciles) from sbiq_financial_rollup_hourly),
    'last_run_buckets', (select buckets_processed from sbiq_financial_rollup_run_log order by started_at desc limit 1),
    'source_max_occurred_at', (select max(source_max_occurred_at) from sbiq_financial_rollup_hourly),
    'freshness', case when cp.last_success_at is null then 'Unknown'
                      when cp.last_success_at < now()-interval '15 minutes' then 'Stale'
                      when cp.last_success_at < now()-interval '5 minutes' then 'Delayed' else 'Current' end,
    'open_rollup_alerts', (select count(*) from sbiq_demo_sim_alerts where not resolved and category like 'FINANCIAL_ROLLUP%'))
  from sbiq_financial_rollup_checkpoint cp where cp.id=1;
$fn$;
revoke all on function public.sbiq_financial_rollup_status() from anon, authenticated;
grant execute on function public.sbiq_financial_rollup_status() to service_role;
select 'financial_rollup_status_installed' status;
