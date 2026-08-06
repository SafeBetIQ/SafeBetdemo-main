-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — certified financial posture v2 (rollup-backed).
-- Answers shift/today/24h/MTD from complete hourly rollup buckets + a small live
-- tail (current incomplete hour, and the h24 rolling-boundary hour). Returns the
-- EXACT rowtype of projection_financial_posture so consumers are drop-in. Semantics,
-- boundaries, capability and disclosure are identical to the certified view; no
-- full-history scan. Part 2 of the financial-rollup milestone.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sbiq_certified_financial_posture_v2(
  p_casino uuid default null, p_as_of timestamptz default now()
) returns setof public.projection_financial_posture
language sql stable security definer set search_path to 'public' as $fn$
  with now_ref as (select p_as_of now_ts, date_trunc('hour', p_as_of) cur_hour),
  cfg as (
    select c.id casino_id,
      coalesce((select currency from financial_shift_policy where scope='casino' and casino_id=c.id limit 1),
               (select currency from financial_shift_policy where scope='platform' and casino_id is null limit 1),'ZAR') currency,
      coalesce((select timezone from financial_shift_policy where scope='casino' and casino_id=c.id limit 1),
               (select timezone from financial_shift_policy where scope='platform' and casino_id is null limit 1),'Africa/Johannesburg') tz,
      coalesce((select day_shift_start from financial_shift_policy where scope='casino' and casino_id=c.id limit 1),
               (select day_shift_start from financial_shift_policy where scope='platform' and casino_id is null limit 1),'06:00'::time) day_start,
      coalesce((select night_shift_start from financial_shift_policy where scope='casino' and casino_id=c.id limit 1),
               (select night_shift_start from financial_shift_policy where scope='platform' and casino_id is null limit 1),'18:00'::time) night_start
    from casinos c where p_casino is null or c.id = p_casino
  ),
  bounds as (
    select g.casino_id, g.currency, g.tz, n.now_ts, n.cur_hour,
      (date_trunc('day', n.now_ts at time zone g.tz) at time zone g.tz) today_start,
      (date_trunc('month', n.now_ts at time zone g.tz) at time zone g.tz) mtd_start,
      n.now_ts - interval '24 hours' h24_start,
      case when (n.now_ts at time zone g.tz)::time >= g.day_start and (n.now_ts at time zone g.tz)::time < g.night_start
             then (date_trunc('day', n.now_ts at time zone g.tz) + g.day_start::interval) at time zone g.tz
           when (n.now_ts at time zone g.tz)::time >= g.night_start
             then (date_trunc('day', n.now_ts at time zone g.tz) + g.night_start::interval) at time zone g.tz
           else (date_trunc('day', n.now_ts at time zone g.tz) - interval '1 day' + g.night_start::interval) at time zone g.tz
      end shift_start
    from cfg g cross join now_ref n
  ),
  buck as (   -- complete buckets (bucket_start < cur_hour)
    select b.casino_id,
      coalesce(sum(r.settled_stakes)  filter (where r.bucket_start >= b.shift_start),0) s_shift,
      coalesce(sum(r.player_winnings) filter (where r.bucket_start >= b.shift_start),0) w_shift,
      coalesce(sum(r.settled_stakes)  filter (where r.bucket_start >= b.today_start),0) s_today,
      coalesce(sum(r.player_winnings) filter (where r.bucket_start >= b.today_start),0) w_today,
      coalesce(sum(r.settled_stakes)  filter (where r.bucket_start >= b.mtd_start),0) s_mtd,
      coalesce(sum(r.player_winnings) filter (where r.bucket_start >= b.mtd_start),0) w_mtd,
      coalesce(sum(r.settled_stakes)  filter (where r.bucket_start >= date_trunc('hour',b.h24_start)+interval '1 hour'),0) s_h24,
      coalesce(sum(r.player_winnings) filter (where r.bucket_start >= date_trunc('hour',b.h24_start)+interval '1 hour'),0) w_h24,
      coalesce(sum(r.supported_bet_count) filter (where r.bucket_start >= b.today_start),0) cnt_today,
      coalesce(sum(r.supported_bet_count),0) cnt_total,
      coalesce(sum(r.synthetic_event_count),0) synth_total,
      coalesce(sum(r.non_synthetic_event_count),0) nonsynth_total
    from bounds b
    left join sbiq_financial_rollup_hourly r on r.casino_id=b.casino_id and r.bucket_start < b.cur_hour
    group by b.casino_id
  ),
  tail as (   -- current incomplete hour [cur_hour, now)
    select b.casino_id,
      coalesce(sum(x.stake),0) t_stake, coalesce(sum(x.win),0) t_win, count(x.*) t_cnt,
      count(x.*) filter (where x.is_synth) t_synth, count(x.*) filter (where not x.is_synth) t_nonsynth
    from bounds b left join lateral (
      select (e.payload->>'bet_amount')::numeric stake, coalesce((e.payload->>'win_amount')::numeric,0) win,
             coalesce((e.payload->>'is_simulated')::boolean,false) or coalesce((e.payload->>'synthetic')::boolean,false) is_synth
      from casino_event_log e
      where e.casino_id=b.casino_id and e.event_type in ('BET_PLACED','JACKPOT') and e.payload->>'bet_amount' is not null
        and e.occurred_at >= b.cur_hour and e.occurred_at < b.now_ts
    ) x on true group by b.casino_id
  ),
  h24b as (   -- h24 rolling-boundary partial hour [h24_start, boundary_hour+1h)
    select b.casino_id, coalesce(sum(x.stake),0) hs, coalesce(sum(x.win),0) hw
    from bounds b left join lateral (
      select (e.payload->>'bet_amount')::numeric stake, coalesce((e.payload->>'win_amount')::numeric,0) win
      from casino_event_log e
      where e.casino_id=b.casino_id and e.event_type in ('BET_PLACED','JACKPOT') and e.payload->>'bet_amount' is not null
        and e.occurred_at >= b.h24_start
        and e.occurred_at < date_trunc('hour',b.h24_start)+interval '1 hour'
        and e.occurred_at < b.cur_hour
    ) x on true group by b.casino_id
  )
  select
    b.casino_id, b.currency financial_currency, b.tz financial_timezone,
    b.shift_start, b.today_start, b.mtd_start,
    (bk.s_shift + t.t_stake) stakes_current_shift,
    (bk.w_shift + t.t_win) player_winnings_current_shift,
    ((bk.s_shift + t.t_stake) - (bk.w_shift + t.t_win)) ggr_current_shift,
    (bk.s_today + t.t_stake) stakes_today,
    (bk.w_today + t.t_win) player_winnings_today,
    ((bk.s_today + t.t_stake) - (bk.w_today + t.t_win)) ggr_today,
    (bk.s_h24 + h.hs + t.t_stake) stakes_last_24_hours,
    (bk.w_h24 + h.hw + t.t_win) player_winnings_last_24_hours,
    ((bk.s_h24 + h.hs + t.t_stake) - (bk.w_h24 + h.hw + t.t_win)) ggr_last_24_hours,
    (bk.s_mtd + t.t_stake) stakes_month_to_date,
    (bk.w_mtd + t.t_win) player_winnings_month_to_date,
    ((bk.s_mtd + t.t_stake) - (bk.w_mtd + t.t_win)) ggr_month_to_date,
    (bk.cnt_today + t.t_cnt) settled_bets_today,
    case when cap.voids_supported then 0::bigint else null::bigint end voided_bets_today,
    case when cap.reversals_supported then 0::bigint else null::bigint end reversed_transactions_today,
    case when cap.bonus_supported then 0::bigint else null::bigint end bonus_wagers_today,
    cap.voids_supported, cap.reversals_supported, cap.bonus_supported,
    cap.combined_wager_settlement, cap.separate_settlement, cap.capability_version,
    (bk.cnt_total + t.t_cnt) financial_events_total,
    (bk.synth_total + t.t_synth) synthetic_event_count,
    (bk.nonsynth_total + t.t_nonsynth) non_synthetic_event_count,
    ((bk.synth_total + t.t_synth) > 0) contains_synthetic_data,
    case when (bk.cnt_total + t.t_cnt) = 0 then 'unavailable'
         when (bk.nonsynth_total + t.t_nonsynth) = 0 then 'synthetic'
         when (bk.synth_total + t.t_synth) = 0 then 'live' else 'mixed' end financial_data_mode,
    case when (bk.cnt_total + t.t_cnt) = 0 then 'unavailable'
         when cap.voids_supported and cap.reversals_supported then 'healthy' else 'partial' end financial_data_status,
    0::numeric financial_projection_lag_seconds,
    b.now_ts financial_snapshot_at
  from bounds b
  join buck bk on bk.casino_id=b.casino_id
  join tail t on t.casino_id=b.casino_id
  join h24b h on h.casino_id=b.casino_id
  left join lateral sbiq_financial_capability(b.casino_id) cap on true;
$fn$;
revoke all on function public.sbiq_certified_financial_posture_v2(uuid,timestamptz) from anon, authenticated;
grant execute on function public.sbiq_certified_financial_posture_v2(uuid,timestamptz) to service_role;

-- Rollup watchdog: alert on late/failed rollup (reuses the sim alert table).
create or replace function public.sbiq_financial_rollup_watchdog()
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare last_ok timestamptz; last_fail timestamptz; lag_s numeric; late boolean;
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_FINANCIAL_ROLLUP') is distinct from 'true' then
    return jsonb_build_object('ok', true, 'skipped','disabled');
  end if;
  select last_success_at, last_failed_at into last_ok, last_fail from sbiq_financial_rollup_checkpoint where id=1;
  late := last_ok is null or last_ok < now() - interval '10 minutes';
  if late then
    perform sbiq_demo_raise_alert('FINANCIAL_ROLLUP_LATE','warning','financial_rollup',null,
      jsonb_build_object('last_success', last_ok));
  else
    update sbiq_demo_sim_alerts set resolved=true, resolved_at=now(), resolution_notes='rollup recovered'
      where category in ('FINANCIAL_ROLLUP_LATE','FINANCIAL_ROLLUP_FAILED') and not resolved;
  end if;
  if last_fail is not null and (last_ok is null or last_fail > last_ok) then
    perform sbiq_demo_raise_alert('FINANCIAL_ROLLUP_FAILED','critical','financial_rollup',null,
      jsonb_build_object('last_failed', last_fail));
  end if;
  return jsonb_build_object('ok', true, 'late', late, 'last_success', last_ok);
end; $fn$;
revoke all on function public.sbiq_financial_rollup_watchdog() from anon, authenticated;

-- Schedule the incremental rollup (every 2 min) + watchdog (every 5 min).
do $cron$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='sbiq-financial-rollup-refresh') then perform cron.unschedule('sbiq-financial-rollup-refresh'); end if;
    perform cron.schedule('sbiq-financial-rollup-refresh','*/2 * * * *',$$select public.sbiq_financial_rollup_refresh(500);$$);
    if exists(select 1 from cron.job where jobname='sbiq-financial-rollup-watchdog') then perform cron.unschedule('sbiq-financial-rollup-watchdog'); end if;
    perform cron.schedule('sbiq-financial-rollup-watchdog','*/5 * * * *',$$select public.sbiq_financial_rollup_watchdog();$$);
  end if;
end $cron$;

select 'financial_posture_v2_installed' status;
