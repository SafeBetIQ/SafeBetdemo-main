-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — fast consolidated Platform Health snapshot.
-- Root cause of the 10-20s Super Admin Platform Health load (measured):
--   * projection_casino_state (~1.7s over 101,982 rows) was evaluated 3-4x by
--     sbiq_demo_sim_health_overall (recon + all-zero + per-casino health),
--   * sbiq_demo_storage_status (~735ms full-table rows_1d count) was evaluated 2x,
--   * per-casino unbounded max(occurred_at) scans + 6 un-indexed producer counts.
--   => sbiq_demo_sim_health_overall alone = ~10.4s; the API is dominated by it.
-- Fix: ONE RPC that reads projection_casino_state ONCE and the event log ONCE
-- (single grouped scan, month-bounded), storage from the catalog, plus two missing
-- indexes. No certified metric, threshold, or simulator behaviour changes.
-- Returns the exact shape the /api/admin/simulation-health route already emits.
-- ─────────────────────────────────────────────────────────────────────────────

-- Missing indexes (additive; results unchanged). Producer+time for the event-log
-- counts; freshness composite for projection_casino_state's status aggregation.
create index if not exists casino_event_log_producer_occurred_idx
  on public.casino_event_log (producer, occurred_at);
create index if not exists projection_player_state_freshness_idx
  on public.projection_player_state (casino_id, status, last_event_at);

create or replace function public.sbiq_demo_sim_health_snapshot()
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  prod constant text := 'safebet-demo-live-simulator-v2';
  win_min int := 30;
  now_ts timestamptz := now();
  v_overall jsonb; v_usage jsonb; v_storage jsonb; v_casinos jsonb; v_readiness jsonb;
  v_alerts jsonb; v_flags record; v_run record; v_glob record; v_win record;
  day_warn numeric := sbiq_demo_limit('SIM_EVENTS_PER_DAY_WARNING');
  day_hard numeric := sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP');
  alloc_mb numeric := sbiq_demo_limit('STORAGE_INTERNAL_ALLOC_MB');
  late_min int := sbiq_demo_limit('LATE_TICK_MINUTES')::int;
  db_bytes bigint; ev_bytes bigint; audit_bytes bigint; growth_mb numeric;
  storage_pct numeric; days_left numeric; open_ct int; max_sev int; recon_ok boolean;
begin
  -- Per-casino player freshness ONCE — aggregate only the status='active' cohort
  -- (~10k rows) using each casino's certified session policy (idle/stale minutes),
  -- exactly as projection_casino_state does, but without scanning all 102k players.
  drop table if exists _pcs; drop table if exists _ev;
  create temporary table _pcs on commit drop as
  with pol as (
    select c.id casino_id, sp.idle_after_minutes ia, sp.stale_after_minutes sa
    from casinos c, lateral sbiq_session_policy(c.id) sp)
  select p.casino_id,
    count(*) active_players,
    count(*) filter (where p.last_event_at >= now_ts - make_interval(mins => pol.ia)) players_active_now,
    count(*) filter (where p.last_event_at <  now_ts - make_interval(mins => pol.ia)
                       and p.last_event_at >= now_ts - make_interval(mins => pol.sa)) players_idle,
    count(*) filter (where p.last_event_at is null
                       or  p.last_event_at <  now_ts - make_interval(mins => pol.sa)) players_stale
  from projection_player_state p join pol on pol.casino_id = p.casino_id
  where p.status = 'active'
  group by p.casino_id;
  -- simulator events ONCE (month-bounded, grouped by casino)
  create temporary table _ev on commit drop as
    select casino_id,
      count(*) m_month,
      count(*) filter (where occurred_at >= date_trunc('day', now_ts)) m_today,
      count(*) filter (where occurred_at >= now_ts - interval '1 hour') m_1h,
      count(*) filter (where occurred_at >= now_ts - interval '15 minutes') m_15m,
      count(*) filter (where occurred_at >= now_ts - interval '5 minutes') m_5m,
      max(occurred_at) last_tick
    from casino_event_log
    where producer = prod and occurred_at >= date_trunc('month', now_ts)
    group by casino_id;

  select coalesce(sum(m_month),0) mo, coalesce(sum(m_today),0) td,
         coalesce(sum(m_1h),0) h1, coalesce(sum(m_15m),0) m15
    into v_glob from _ev;

  select round(avg(events_generated) filter (where outcome='ok' and started_at>now_ts-interval '6 hours')) avg_tick,
         max(events_generated) filter (where started_at>now_ts-interval '24 hours') peak_tick,
         count(*) filter (where outcome<>'ok' and started_at>now_ts-interval '24 hours') failures,
         max(finished_at) filter (where outcome='ok') last_ok,
         max(started_at) filter (where outcome<>'ok') last_fail,
         round(coalesce(sum(events_generated) filter (where started_at>now_ts-interval '24 hours'),0)) events_24h
    into v_run from sbiq_demo_sim_run_log;

  select (select value='true' from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR') simulator_enabled,
         (select value='true' from sbiq_demo_sim_flags where key='ENABLE_DEMO_SHOWCASE_MODE') showcase_enabled
    into v_flags;

  select (select count(*) from sbiq_demo_showcase_windows where status='active' and expires_at>now_ts) active_windows,
         (select count(*) from sbiq_demo_showcase_activations where decision in ('accepted','extended') and created_at>now_ts-interval '1 hour') activations_1h
    into v_win;

  -- storage from catalog (fast); daily growth from run log (no event-log scan)
  db_bytes := pg_database_size(current_database());
  select coalesce(sum(pg_total_relation_size(c.oid)),0) into ev_bytes
    from pg_inherits i join pg_class c on c.oid=i.inhrelid join pg_class p on p.oid=i.inhparent
    where p.relname='casino_event_log';
  audit_bytes := pg_total_relation_size('audit_events');
  growth_mb := round((coalesce(v_run.events_24h,0) * 180.0 / 1048576.0)::numeric, 1);
  storage_pct := round((100.0 * db_bytes/1048576.0 / nullif(alloc_mb,0))::numeric, 1);
  days_left := case when growth_mb > 0 then round(((alloc_mb - db_bytes/1048576.0) / nullif(growth_mb,0))::numeric) end;

  open_ct := (select count(*) from sbiq_demo_sim_alerts where not resolved);
  max_sev := coalesce((select max(case severity when 'critical' then 3 when 'warning' then 2 else 1 end)
                       from sbiq_demo_sim_alerts where not resolved), 0);
  recon_ok := (select bool_and(active_players = players_active_now + players_idle + players_stale) from _pcs);
  v_readiness := public.sbiq_demo_partition_readiness(false);

  -- ── usage ──
  v_usage := jsonb_build_object(
    'events_15m', v_glob.m15, 'events_1h', v_glob.h1, 'events_today', v_glob.td, 'events_month', v_glob.mo,
    'events_by_casino_1h', (select jsonb_object_agg(casino_id::text, m_1h) from _ev where m_1h>0),
    'avg_events_per_tick', v_run.avg_tick, 'peak_events_per_tick', v_run.peak_tick,
    'est_daily_events', v_glob.h1 * 24, 'day_warning_limit', day_warn, 'day_hardstop_limit', day_hard,
    'pct_of_daily_hardstop', round((100.0*v_glob.td/nullif(day_hard,0))::numeric,1),
    'failures_24h', v_run.failures, 'last_successful_tick', v_run.last_ok, 'last_failed_tick', v_run.last_fail);

  -- ── storage ──
  v_storage := jsonb_build_object(
    'db_size', pg_size_pretty(db_bytes), 'db_bytes', db_bytes,
    'event_log_size', pg_size_pretty(ev_bytes), 'audit_size', pg_size_pretty(audit_bytes),
    'est_daily_growth_mb', growth_mb, 'est_monthly_growth_mb', round(growth_mb*30,1),
    'internal_alloc_mb', alloc_mb, 'pct_of_internal_alloc', storage_pct, 'est_days_to_alloc', days_left);

  -- ── overall (classification identical to sbiq_demo_sim_health_overall) ──
  v_overall := jsonb_build_object(
    'simulator_enabled', v_flags.simulator_enabled, 'showcase_enabled', v_flags.showcase_enabled,
    'cron_active', exists(select 1 from cron.job where jobname='sbiq-demo-live-tick' and active),
    'last_successful_tick', v_run.last_ok, 'last_failed_tick', v_run.last_fail,
    'tick_late', (v_run.last_ok < now_ts - make_interval(mins => late_min)),
    'events_today', v_glob.td, 'day_hardstop_limit', day_hard, 'day_warning_limit', day_warn,
    'pct_of_daily_hardstop', round((100.0*v_glob.td/nullif(day_hard,0))::numeric,1), 'events_month', v_glob.mo,
    'active_windows', v_win.active_windows, 'activations_1h', v_win.activations_1h,
    'reconciles_all', recon_ok, 'open_alerts', open_ct,
    'storage_days_left', days_left, 'storage_pct', storage_pct,
    'overall_health', case
      when v_flags.simulator_enabled is not true then 'Disabled'
      when v_run.last_ok is null then 'Unknown'
      when max_sev=3 or not recon_ok or v_run.last_ok < now_ts-make_interval(mins=>late_min)
        or round((100.0*v_glob.td/nullif(day_hard,0))::numeric,1) >= 100 then 'Critical'
      when max_sev=2 or v_glob.td >= day_warn or storage_pct >= sbiq_demo_limit('STORAGE_WARN_PCT') then 'Warning'
      else 'Healthy' end);

  -- ── per-casino (uses _pcs + _ev; showcase from windows) ──
  select coalesce(jsonb_agg(row_to_json(x) order by x.casino_name), '[]'::jsonb) into v_casinos from (
    select c.id casino_id, c.name casino_name,
      case when exists(select 1 from sbiq_demo_showcase_windows w where w.status='active' and w.expires_at>now_ts
                       and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) then 'showcase' else 'baseline' end profile,
      cfg.baseline_active_target, cfg.showcase_active_target,
      p.active_players observed, p.players_active_now active_now, p.players_idle idle, p.players_stale stale,
      coalesce(e.m_5m,0) events_last_5m, e.last_tick last_sim_tick,
      (select max(expires_at) from sbiq_demo_showcase_windows w where w.status='active' and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) showcase_expiry,
      (p.active_players = p.players_active_now + p.players_idle + p.players_stale) reconciles,
      case when p.players_active_now = 0 then 'critical'
           when p.active_players is distinct from (p.players_active_now+p.players_idle+p.players_stale) then 'warning'
           else 'healthy' end status
    from casinos c
      left join sbiq_demo_sim_config cfg on cfg.casino_id=c.id
      left join _pcs p on p.casino_id=c.id
      left join _ev e on e.casino_id=c.id
  ) x;

  v_alerts := (select coalesce(jsonb_agg(jsonb_build_object(
      'category',category,'severity',severity,'scope',scope,'details',details,'created_at',created_at)
      order by created_at desc), '[]'::jsonb)
    from (select * from sbiq_demo_sim_alerts where not resolved order by created_at desc limit 50) a);

  return jsonb_build_object(
    'overall', v_overall, 'usage', v_usage, 'storage', v_storage, 'casinos', v_casinos,
    'readiness', v_readiness, 'alerts', v_alerts,
    'emergency', jsonb_build_object('simulator_enabled', v_flags.simulator_enabled, 'showcase_enabled', v_flags.showcase_enabled),
    'as_of', now_ts);
end; $fn$;
revoke all on function public.sbiq_demo_sim_health_snapshot() from anon, authenticated;
grant execute on function public.sbiq_demo_sim_health_snapshot() to service_role;

select 'demo_sim_health_snapshot_fast_installed' status;
