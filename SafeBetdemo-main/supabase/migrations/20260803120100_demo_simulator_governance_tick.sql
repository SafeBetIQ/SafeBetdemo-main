-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — governed simulator tick + health classification + crons.
-- Wraps the certified refresh with server-side volume limits, reduced/hardstop
-- modes, failure/late/zero alerts and a run log. Certified metric semantics and
-- freshness thresholds are UNCHANGED. Part 2 of the governance milestone.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sbiq_demo_live_tick(p_cron_minutes int default 5)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  prod constant text := 'safebet-demo-live-simulator-v2';
  win_min int := 30;                     -- active freshness window (idle_after) — NOT changed here
  now_ts timestamptz := now(); t0 timestamptz := clock_timestamp();
  rec record; showcase boolean; target int; observed int; current int; churn int; need int;
  v_players jsonb; v_ok boolean; total_refreshed int := 0; per jsonb := '{}'::jsonb;
  run_id bigint; events_today int; reduced boolean := false; tick_budget int;
  per_casino_cap int; max_now int := 0;
begin
  insert into sbiq_demo_sim_run_log(started_at, mode) values (now_ts,'starting') returning id into run_id;

  if (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR') is distinct from 'true' then
    update sbiq_demo_sim_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
      mode='disabled', outcome='disabled' where id=run_id;
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('sbiq_demo_live_tick')) then
    update sbiq_demo_sim_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
      mode='locked', outcome='locked' where id=run_id;
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;

  -- Housekeeping every tick: keep partitions ready, expire/resolve windows.
  perform public.sbiq_demo_partition_readiness(true);
  perform public.sbiq_demo_showcase_maintenance();

  -- ── Volume governance (server-side, authoritative producer count) ──────────
  events_today := (select count(*) from casino_event_log
    where producer=prod and occurred_at >= date_trunc('day', now_ts));

  if events_today >= sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP') then
    perform sbiq_demo_raise_alert('SIMULATOR_VOLUME_LIMIT_REACHED','critical','simulator',null,
      jsonb_build_object('events_today',events_today,'hardstop',sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP'),
        'next_reset', date_trunc('day', now_ts)+interval '1 day'));
    update sbiq_demo_sim_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
      mode='hardstop', outcome='ok', events_generated=0 where id=run_id;   -- cron stays alive; audit untouched
    return jsonb_build_object('ok', true, 'mode','hardstop', 'events_today', events_today);
  elsif events_today >= sbiq_demo_limit('SIM_EVENTS_PER_DAY_WARNING') then
    reduced := true;                                   -- baseline-only, no new showcase volume
    perform sbiq_demo_raise_alert('SIMULATOR_VOLUME_WARNING','warning','simulator',null,
      jsonb_build_object('events_today',events_today,'warning',sbiq_demo_limit('SIM_EVENTS_PER_DAY_WARNING')));
  end if;

  tick_budget := sbiq_demo_limit('MAX_SIM_EVENTS_PER_TICK')::int;
  per_casino_cap := sbiq_demo_limit('MAX_SIM_EVENTS_PER_CASINO_PER_TICK')::int;

  <<gen>> begin
  for rec in
    select c.id casino_id, cfg.baseline_active_target bt, cfg.showcase_active_target st, cfg.bet_min bmin, cfg.bet_max bmax
    from casinos c join sbiq_demo_sim_config cfg on cfg.casino_id=c.id order by c.name
  loop
    exit gen when tick_budget <= 0;
    showcase := (not reduced) and exists(select 1 from sbiq_demo_showcase_windows w
      where w.status='active' and w.expires_at>now_ts and (w.casino_id=rec.casino_id or w.scope='jurisdiction:ZA'));
    target := case when showcase then rec.st else rec.bt end;
    target := round(target * (0.85 + random()*0.30));
    observed := (select count(*) from projection_player_state p where p.casino_id=rec.casino_id and p.status='active');
    current := (select count(*) from projection_player_state p where p.casino_id=rec.casino_id
                and p.status='active' and p.last_event_at >= now_ts - make_interval(mins => win_min));
    max_now := greatest(max_now, current);
    if observed = 0 then continue; end if;
    target := least(target, round(observed * case when showcase then 0.40 else 0.20 end));
    target := greatest(target, least(10, observed));
    churn := greatest(2, round(target * 0.15));
    need := greatest(2, target - current + churn);
    need := least(need, per_casino_cap, tick_budget);       -- per-casino + remaining tick budget

    -- Showcase active but this casino is at zero active-now: surface it.
    if showcase and current = 0 then
      perform sbiq_demo_raise_alert('SIMULATOR_CASINO_ZERO_DURING_SHOWCASE','warning','casino:'||rec.casino_id,
        rec.casino_id, jsonb_build_object('observed',observed));
    end if;

    drop table if exists _tick_cohort;
    create temporary table _tick_cohort as
      select p.safebet_player_id spid, p.row_version rv, p.current_session_id csid, p.current_machine_id cmid,
             p.risk_score rs, p.risk_flags rf, p.total_wagered tw, p.total_won two, p.bet_count bc,
             p.session_count sc, p.intervention_count ic,
             round((rec.bmin + random()*(rec.bmax-rec.bmin))::numeric, 2) bet
      from projection_player_state p
      where p.casino_id=rec.casino_id and p.status='active'
      order by p.last_event_at asc nulls first limit need;

    insert into public.casino_event_log
      (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction, safebet_player_id, session_id, machine_id,
       producer, schema_version, event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
    select gen_random_uuid(), 'live-v2', gen_random_uuid(), rec.casino_id, rec.casino_id, 'ZA', spid, csid, cmid,
           prod, 1, 'BET_PLACED', now_ts, now_ts, now_ts, 0,
           'live-v2-'||spid||'-'||to_char(now_ts,'YYYYMMDD"T"HH24MISS'),
           jsonb_build_object('producer',prod,'is_simulated',true,'bet_amount',bet,
             'win_amount', round(bet * (0.60 + (abs(hashtext(spid)) % 7)::numeric * 0.04), 2))
    from _tick_cohort on conflict (casino_id, dedupe_key, occurred_at) do nothing;

    select jsonb_agg(jsonb_build_object(
      'casino_id', rec.casino_id, 'safebet_player_id', spid, 'status','active',
      'current_session_id', csid, 'current_machine_id', cmid, 'risk_score', rs, 'risk_flags', rf,
      'total_wagered', tw + bet, 'total_won', two + round(bet*0.72,2), 'bet_count', bc + 1,
      'session_count', sc, 'intervention_count', ic, 'last_event_at', now_ts,
      'projection_version', 1, 'updated_at', now_ts, 'row_version', rv))
    into v_players from _tick_cohort;
    select ok into v_ok from public.sbiq_write_projection_states(rec.casino_id, coalesce(v_players,'[]'::jsonb), '[]'::jsonb, '[]'::jsonb);
    drop table if exists _tick_cohort;

    total_refreshed := total_refreshed + need;
    tick_budget := tick_budget - need;
    per := per || jsonb_build_object(rec.casino_id::text, jsonb_build_object('showcase',showcase,'target',target,'refreshed',need,'applied',v_ok));
  end loop;
  exception when others then
    perform sbiq_demo_raise_alert('SIMULATOR_TICK_FAILED','critical','simulator',null,
      jsonb_build_object('error_category', sqlstate));
    update sbiq_demo_sim_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
      mode='error', outcome='error', error_category=sqlstate, events_generated=total_refreshed where id=run_id;
    return jsonb_build_object('ok', false, 'reason','error', 'error_category', sqlstate);
  end gen;

  update sbiq_demo_showcase_windows set last_cycle_at = now_ts where status='active';

  -- All-casinos-zero guard (post-tick): certified active-now must be non-zero somewhere.
  if (select coalesce(sum(players_active_now),0) from projection_casino_state) = 0 then
    perform sbiq_demo_raise_alert('SIMULATOR_ALL_CASINOS_ZERO','critical','simulator',null,
      jsonb_build_object('checked_at',now_ts));
  end if;

  update sbiq_demo_sim_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
    mode = case when reduced then 'reduced' else 'normal' end, outcome='ok',
    events_generated=total_refreshed, per_casino=per where id=run_id;
  return jsonb_build_object('ok', true, 'mode', case when reduced then 'reduced' else 'normal' end,
    'at', now_ts, 'refreshed_total', total_refreshed, 'events_today', events_today+total_refreshed, 'per_casino', per);
end; $fn$;
revoke all on function public.sbiq_demo_live_tick(int) from anon, authenticated;

-- ── Per-casino health (extended with target range + status). ─────────────────
drop view if exists public.sbiq_demo_sim_health_overall;
drop view if exists public.sbiq_demo_simulation_health;
create or replace view public.sbiq_demo_simulation_health as
select c.id casino_id, c.name casino_name,
  case when exists(select 1 from sbiq_demo_showcase_windows w where w.status='active' and w.expires_at>now()
                  and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) then 'showcase' else 'baseline' end as profile,
  cfg.baseline_active_target, cfg.showcase_active_target,
  (select count(*) from projection_player_state p where p.casino_id=c.id) registered,
  cs.active_players observed, cs.players_active_now active_now, cs.players_idle idle, cs.players_stale stale,
  cs.active_sessions,
  (select count(*) from casino_event_log e where e.casino_id=c.id and e.producer='safebet-demo-live-simulator-v2' and e.occurred_at>now()-interval '5 minutes') events_last_5m,
  (select max(e.occurred_at) from casino_event_log e where e.casino_id=c.id and e.producer='safebet-demo-live-simulator-v2') last_sim_tick,
  (select max(expires_at) from sbiq_demo_showcase_windows w where w.status='active' and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) showcase_expiry,
  (cs.active_players = cs.players_active_now + cs.players_idle + cs.players_stale) reconciles,
  case
    when cs.players_active_now = 0 then 'critical'
    when cs.active_players is distinct from (cs.players_active_now + cs.players_idle + cs.players_stale) then 'warning'
    else 'healthy' end as status
from casinos c
  left join sbiq_demo_sim_config cfg on cfg.casino_id=c.id
  left join projection_casino_state cs on cs.casino_id=c.id;
revoke all on public.sbiq_demo_simulation_health from anon;
grant select on public.sbiq_demo_simulation_health to authenticated, service_role;

-- ── Overall simulator health (single-row classification). ────────────────────
create or replace view public.sbiq_demo_sim_health_overall as
with lt as (select max(finished_at) last_ok, max(started_at) filter (where outcome<>'ok') last_fail from sbiq_demo_sim_run_log),
u as (select * from sbiq_demo_simulator_usage),
open_alerts as (select count(*) c, max(case severity when 'critical' then 3 when 'warning' then 2 else 1 end) sev
                from sbiq_demo_sim_alerts where not resolved),
recon as (select bool_and(reconciles) ok, min(status) worst from sbiq_demo_simulation_health)
select
  (select value='true' from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR') simulator_enabled,
  (select value='true' from sbiq_demo_sim_flags where key='ENABLE_DEMO_SHOWCASE_MODE') showcase_enabled,
  exists(select 1 from cron.job where jobname='sbiq-demo-live-tick' and active) cron_active,
  lt.last_ok last_successful_tick, lt.last_fail last_failed_tick,
  (lt.last_ok < now() - make_interval(mins => sbiq_demo_limit('LATE_TICK_MINUTES')::int)) tick_late,
  u.events_today, u.day_hardstop_limit, u.pct_of_daily_hardstop, u.events_month,
  (select count(*) from sbiq_demo_showcase_windows where status='active' and expires_at>now()) active_windows,
  (select count(*) from sbiq_demo_showcase_activations where decision in ('accepted','extended') and created_at>now()-interval '1 hour') activations_1h,
  (select ok from recon) reconciles_all,
  (select c from open_alerts) open_alerts,
  (select est_days_to_alloc from sbiq_demo_storage_status) storage_days_left,
  (select pct_of_internal_alloc from sbiq_demo_storage_status) storage_pct,
  case
    when (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR')<>'true' then 'Disabled'
    when lt.last_ok is null then 'Unknown'
    when (select sev from open_alerts)=3
      or not (select ok from recon)
      or lt.last_ok < now()-make_interval(mins => sbiq_demo_limit('LATE_TICK_MINUTES')::int)
      or u.pct_of_daily_hardstop >= 100 then 'Critical'
    when (select sev from open_alerts)=2
      or u.events_today >= u.day_warning_limit
      or (select pct_of_internal_alloc from sbiq_demo_storage_status) >= sbiq_demo_limit('STORAGE_WARN_PCT') then 'Warning'
    else 'Healthy' end as overall_health
from lt cross join u;
revoke all on public.sbiq_demo_sim_health_overall from anon;
grant select on public.sbiq_demo_sim_health_overall to authenticated, service_role;

-- ── Late-tick detector (scheduled; complements the post-tick guards). ────────
create or replace function public.sbiq_demo_tick_watchdog()
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare last_ok timestamptz; late boolean;
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR') is distinct from 'true' then
    return jsonb_build_object('ok', true, 'skipped','disabled');
  end if;
  select max(finished_at) into last_ok from sbiq_demo_sim_run_log where outcome='ok';
  late := last_ok is null or last_ok < now() - make_interval(mins => sbiq_demo_limit('LATE_TICK_MINUTES')::int);
  if late then
    perform sbiq_demo_raise_alert('SIMULATOR_TICK_LATE','critical','simulator',null,
      jsonb_build_object('last_successful_tick', last_ok, 'threshold_min', sbiq_demo_limit('LATE_TICK_MINUTES')));
  else
    update sbiq_demo_sim_alerts set resolved=true, resolved_at=now(), resolution_notes='tick recovered'
      where category in ('SIMULATOR_TICK_LATE','SIMULATOR_TICK_FAILED') and not resolved;
  end if;
  return jsonb_build_object('ok', true, 'late', late, 'last_successful_tick', last_ok);
end; $fn$;
revoke all on function public.sbiq_demo_tick_watchdog() from anon, authenticated;

-- ── Schedule watchdog + a daily partition-readiness safety run. ──────────────
do $cron$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='sbiq-demo-tick-watchdog') then perform cron.unschedule('sbiq-demo-tick-watchdog'); end if;
    perform cron.schedule('sbiq-demo-tick-watchdog','*/5 * * * *',$$select public.sbiq_demo_tick_watchdog();$$);
    if exists(select 1 from cron.job where jobname='sbiq-demo-partition-readiness') then perform cron.unschedule('sbiq-demo-partition-readiness'); end if;
    perform cron.schedule('sbiq-demo-partition-readiness','30 0 * * *',$$select public.sbiq_demo_partition_readiness(true);$$);
  end if;
end $cron$;

select 'demo_simulator_governance_part2_installed' status;
