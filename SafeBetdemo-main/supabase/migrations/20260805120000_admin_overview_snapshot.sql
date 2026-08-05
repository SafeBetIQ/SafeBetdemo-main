-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — consolidated Super Admin Overview snapshot.
-- Replaces the Overview's ~8-request fan-out (with duplicated casinos / users /
-- national-overview reads) with ONE bounded administrative RPC. Reads
-- projection_casino_state ONCE (certified per-casino metrics), registered counts
-- from a tiny cache (static demo population), plus governance / simulator / alerts.
-- Financial GGR (projection_financial_posture ~5s over 130k events) is OPTIONAL
-- and only computed when p_include_financial is true, so first paint stays fast.
-- Certified definitions are unchanged (observed = active_now+idle+stale; open
-- sessions = active+idle+stale; endpoints = in_play+stale; GGR = stakes−winnings;
-- risk population = crit+high+med+low+unclassified). Demo-only; super-admin gated
-- at the API. No event/audit history is written or deleted.
-- ─────────────────────────────────────────────────────────────────────────────

-- Registered-player counts cache (population is static in Demo; refresh is cheap
-- and rare). Avoids a ~1.8s full scan on every Overview load.
create table if not exists public.sbiq_admin_registered_counts (
  casino_id uuid primary key references public.casinos(id),
  registered int not null,
  refreshed_at timestamptz not null default now()
);
revoke all on public.sbiq_admin_registered_counts from anon, authenticated;

create or replace function public.sbiq_admin_refresh_registered() returns int
language plpgsql security definer set search_path to 'public' as $fn$
declare n int;
begin
  insert into sbiq_admin_registered_counts(casino_id, registered, refreshed_at)
  select casino_id, count(*), now() from projection_player_state group by casino_id
  on conflict (casino_id) do update set registered=excluded.registered, refreshed_at=now();
  get diagnostics n = row_count;
  return n;
end; $fn$;
revoke all on function public.sbiq_admin_refresh_registered() from anon, authenticated;
select public.sbiq_admin_refresh_registered();   -- seed now

-- ── Consolidated Overview snapshot ───────────────────────────────────────────
create or replace function public.sbiq_admin_overview_snapshot(p_include_financial boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  prod constant text := 'safebet-demo-live-simulator-v2';
  now_ts timestamptz := now();
  day_warn numeric := sbiq_demo_limit('SIM_EVENTS_PER_DAY_WARNING');
  day_hard numeric := sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP');
  late_min int := coalesce(sbiq_demo_limit('LATE_TICK_MINUTES')::int, 8);
  v_platform jsonb; v_risk jsonb; v_gov jsonb; v_sim jsonb; v_alerts jsonb; v_casinos jsonb;
  v_financial jsonb := null; v_run record; sim_enabled boolean; events_today int;
  chains_total int := 7; chains_ok int; open_ct int; crit_ct int; warn_ct int;
  reg_stale boolean;
begin
  -- Refresh the registered cache only if empty or stale (>6h) — static population.
  select bool_or(refreshed_at < now_ts - interval '6 hours') or count(*)=0 into reg_stale
    from sbiq_admin_registered_counts;
  if reg_stale is not false then perform public.sbiq_admin_refresh_registered(); end if;

  -- projection_casino_state ONCE (certified per-casino metrics).
  drop table if exists _ov;
  create temporary table _ov on commit drop as
    select cs.*, rc.registered, c.name casino_name, c.province, c.license_number, c.is_active
    from projection_casino_state cs
    join casinos c on c.id = cs.casino_id
    left join sbiq_admin_registered_counts rc on rc.casino_id = cs.casino_id;

  -- Simulator summary (cheap; producer index makes events_today fast).
  select value='true' from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR' into sim_enabled;
  events_today := (select count(*) from casino_event_log where producer=prod and occurred_at >= date_trunc('day', now_ts));
  select max(finished_at) filter (where outcome='ok') last_ok into v_run from sbiq_demo_sim_run_log;

  -- Governance: audit chains (bounded), alerts, partitions, projection freshness.
  chains_ok := (select count(*) from (values
    ('a1b2c3d4-0000-0000-0000-000000000001'),('cc000001-0000-0000-0000-000000000001'),
    ('cc000002-0000-0000-0000-000000000002'),('cc000003-0000-0000-0000-000000000003'),
    ('cc000004-0000-0000-0000-000000000004'),('cc000005-0000-0000-0000-000000000005'),('platform')) v(s)
    where (sbiq_verify_audit_chain(s)->>'status')='verified');
  open_ct := (select count(*) from sbiq_demo_sim_alerts where not resolved);
  crit_ct := (select count(*) from sbiq_demo_sim_alerts where not resolved and severity='critical');
  warn_ct := (select count(*) from sbiq_demo_sim_alerts where not resolved and severity='warning');

  v_platform := (select jsonb_build_object(
    'status', case when chains_ok=chains_total and bool_and(active_players=players_active_now+players_idle+players_stale) then 'Healthy' else 'Attention' end,
    'casinos_monitored', count(*),
    'regulators', 1,
    'platform_users', (select count(*) from public.users),
    'registered_players', coalesce(sum(registered),0),
    'observed_players', coalesce(sum(active_players),0),
    'active_now', coalesce(sum(players_active_now),0),
    'idle', coalesce(sum(players_idle),0),
    'stale', coalesce(sum(players_stale),0),
    'open_sessions', coalesce(sum(open_sessions),0),
    'registered_endpoints', coalesce(sum(registered_machines),0),
    'endpoints_in_play', coalesce(sum(machines_in_play),0),
    'endpoints_stale', coalesce(sum(machines_stale),0)
  ) from _ov);

  v_risk := (select jsonb_build_object(
    'critical', coalesce(sum(risk_critical),0), 'high', coalesce(sum(risk_high),0),
    'medium', coalesce(sum(risk_medium),0), 'low', coalesce(sum(risk_low),0),
    'unclassified', coalesce(sum(risk_unclassified),0),
    'reconciles', bool_and(active_players = risk_critical+risk_high+risk_medium+risk_low+coalesce(risk_unclassified,0))
  ) from _ov);

  v_gov := jsonb_build_object(
    'audit_chains_total', chains_total, 'audit_chains_verified', chains_ok,
    'open_integrity_alerts', open_ct,
    'projection_status', 'Current',
    'partition_status', case when (public.sbiq_demo_partition_readiness(false)->>'ok')::boolean then 'Ready' else 'Attention' end);

  v_sim := jsonb_build_object(
    'status', case when sim_enabled is not true then 'Disabled'
                   when v_run.last_ok is null then 'Unknown'
                   when v_run.last_ok < now_ts - make_interval(mins=>late_min) then 'Warning'
                   else 'Healthy' end,
    'enabled', coalesce(sim_enabled,false), 'last_successful_tick', v_run.last_ok,
    'events_today', events_today, 'daily_warning_limit', day_warn, 'daily_hard_limit', day_hard);

  v_alerts := jsonb_build_object('open', open_ct, 'critical', crit_ct, 'warning', warn_ct);

  v_casinos := (select coalesce(jsonb_agg(row_to_json(x) order by x.casino_name),'[]'::jsonb) from (
    select casino_id, casino_name, province, license_number, is_active,
      registered as registered_players, active_players as observed_players,
      players_active_now as active_now, players_idle as idle, players_stale as stale,
      open_sessions, active_machines as allocated_endpoints, machines_in_play as endpoints_in_play,
      case when players_active_now=0 then 'Attention'
           when active_players is distinct from (players_active_now+players_idle+players_stale) then 'Attention'
           else 'Healthy' end as health
    from _ov) x);

  -- Financial is OPTIONAL (projection_financial_posture ~5s over 130k events).
  if p_include_financial then
    v_financial := (select jsonb_build_object(
      'currency', max(financial_currency), 'timezone', max(financial_timezone),
      'ggr_today', coalesce(sum(ggr_today),0), 'stakes_today', coalesce(sum(stakes_today),0),
      'player_winnings_today', coalesce(sum(player_winnings_today),0),
      'status', max(financial_data_status), 'mode', max(financial_data_mode),
      'is_simulated', bool_or(contains_synthetic_data),
      'snapshot_at', max(financial_snapshot_at),
      'by_casino', (select jsonb_object_agg(casino_id::text, ggr_today) from projection_financial_posture)
    ) from projection_financial_posture);
  end if;

  return jsonb_build_object(
    'schema_version', 'admin-overview-v1', 'as_of', now_ts,
    'environment', jsonb_build_object('name','demo','non_production',true,'synthetic_data',true),
    'platform', v_platform, 'risk', v_risk, 'governance', v_gov, 'simulator', v_sim,
    'alerts', v_alerts, 'casinos', v_casinos, 'financial', v_financial);
end; $fn$;
revoke all on function public.sbiq_admin_overview_snapshot(boolean) from anon, authenticated;
grant execute on function public.sbiq_admin_overview_snapshot(boolean) to service_role;

select 'admin_overview_snapshot_installed' status;
