-- Seed-scoped scale simulator (stage-independent cleanup + historical spread + per-stage producer).
-- Applied to demo uexdjngogzunjxkpxwll; supersedes the 6-arg simulator. Session/machine ids and a
-- risk_flags 'seed:<sv>' marker carry the seed so each stage is cleaned in isolation.
drop function if exists public.sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer);

-- Seed-scoped simulator: session/machine ids + player marker carry the seed so
-- each stage is independently cleanable. Adds p_producer for per-stage tagging.
create or replace function public.sbiq_demo_scale_seed_batch(
  p_casino uuid, p_seed_version text default 'v1', p_start integer default 0, p_count integer default 100,
  p_active_pct integer default 8, p_bets_per_active integer default 5,
  p_producer text default 'safebet-demo-scale-simulator-v1', p_history_days integer default 0
) returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  prod text := p_producer; sv text := p_seed_version; cfull text := replace(p_casino::text,'-','');
  now_ts timestamptz := now(); v_players jsonb; v_sessions jsonb; v_machines jsonb; v_ok boolean;
begin
  perform public.sbiq_ensure_event_partition(now_ts);
  drop table if exists _scale_batch;
  create temporary table _scale_batch as
  with base as (
    select g, 'SB-PLR-'||upper(substr(md5(sv||':'||p_casino::text||':'||g), 1, 24)) as spid,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':risk')) % 1000) as b,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':act'))  % 100)  as a,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':amt'))  % 250)  as amt,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':day'))  % greatest(p_history_days,1)) as dayoff
    from generate_series(p_start, p_start+p_count-1) g)
  select g, spid,
    case when b < 8 then 80 + (b % 20) when b < 70 then 60 + (b % 20)
         when b < 320 then 40 + (b % 20) else 1 + (b % 39) end as risk_score,
    (a < p_active_pct) as is_active,
    case when a < p_active_pct then now_ts - ((a) || ' minutes')::interval
         when a < 40 then now_ts - ((2 + a) || ' hours')::interval
         else now_ts - ((3 + (a % 20)) || ' days')::interval end as last_at,
    (50 + amt)::numeric as stake_unit,
    'SC-SES-'||sv||'-'||cfull||'-'||g as session_id, 'SC-MC-'||sv||'-'||cfull||'-'||g as machine_id,
    dayoff
  from base;
  insert into public.safebet_identity_map (casino_id, casino_ref_hash, safebet_player_id)
  select p_casino, 'scale-'||sv||'-'||g, spid from _scale_batch on conflict (casino_id, casino_ref_hash) do nothing;
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction, safebet_player_id, session_id, machine_id, producer, schema_version, event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA', spid, null, null, prod, 1, 'CARD_INSERT', last_at, last_at, last_at, 0, 'scale-'||sv||'-'||g||'-reg', jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv)
  from _scale_batch on conflict (casino_id, dedupe_key, occurred_at) do nothing;
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction, safebet_player_id, session_id, machine_id, producer, schema_version, event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA', spid, session_id, machine_id, prod, 1, ev.t, last_at, last_at, last_at, 0, 'scale-'||sv||'-'||g||'-'||ev.tag, jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv)
  from _scale_batch b cross join lateral (values ('SESSION_START','ses'),('MACHINE_ALLOCATED','mc')) ev(t,tag) where b.is_active on conflict (casino_id, dedupe_key, occurred_at) do nothing;
  -- BET_PLACED: active players bet "today"; when p_history_days>0 also spread historical bets across the window.
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction, safebet_player_id, session_id, machine_id, producer, schema_version, event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA', spid, session_id, machine_id, prod, 1, 'BET_PLACED',
         case when p_history_days>0 and n>p_bets_per_active
              then now_ts - ((1 + (dayoff + n) % p_history_days) || ' days')::interval - ((g % 600) || ' minutes')::interval
              else now_ts - (n || ' minutes')::interval end,
         now_ts, now_ts, 0, 'scale-'||sv||'-'||g||'-bet-'||n,
         jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv,'bet_amount', stake_unit, 'win_amount', round(stake_unit * (0.60 + ((g+n) % 7)::numeric * 0.04), 2))
  from _scale_batch b cross join generate_series(1, p_bets_per_active + case when p_history_days>0 then p_bets_per_active else 0 end) n
  where b.is_active on conflict (casino_id, dedupe_key, occurred_at) do nothing;
  select jsonb_agg(jsonb_build_object('casino_id', p_casino, 'safebet_player_id', spid, 'status', case when is_active then 'active' else 'idle' end,
    'current_session_id', case when is_active then session_id end, 'current_machine_id', case when is_active then machine_id end,
    'risk_score', risk_score, 'risk_flags', ('["synthetic-scale","seed:'||sv||'"]')::jsonb,
    'total_wagered', case when is_active then stake_unit * p_bets_per_active else 0 end, 'total_won', case when is_active then round(stake_unit * p_bets_per_active * 0.72, 2) else 0 end,
    'bet_count', case when is_active then p_bets_per_active else 0 end, 'session_count', case when is_active then 1 else 0 end,
    'intervention_count', 0, 'last_event_at', last_at, 'projection_version', 1, 'updated_at', now_ts, 'row_version', 0)) into v_players from _scale_batch;
  select jsonb_agg(jsonb_build_object('session_id', session_id, 'casino_id', p_casino, 'safebet_player_id', spid, 'machine_id', machine_id,
    'status', 'active', 'game_type', 'slots', 'started_at', last_at, 'total_wagered', stake_unit * p_bets_per_active, 'total_won', round(stake_unit * p_bets_per_active * 0.72, 2),
    'bet_count', p_bets_per_active, 'risk_score', risk_score, 'last_event_at', last_at, 'projection_version', 1, 'updated_at', now_ts, 'row_version', 0)) into v_sessions from _scale_batch where is_active;
  select jsonb_agg(jsonb_build_object('casino_id', p_casino, 'machine_id', machine_id, 'machine_type', 'slots', 'status', 'active', 'current_player_id', spid, 'current_session_id', session_id,
    'current_risk_score', risk_score, 'session_wagered', stake_unit * p_bets_per_active, 'last_event_at', last_at, 'projection_version', 1, 'updated_at', now_ts, 'row_version', 0)) into v_machines from _scale_batch where is_active;
  select ok into v_ok from public.sbiq_write_projection_states(p_casino, coalesce(v_players,'[]'::jsonb), coalesce(v_sessions,'[]'::jsonb), coalesce(v_machines,'[]'::jsonb));
  drop table if exists _scale_batch;
  return jsonb_build_object('casino',p_casino,'seed_version',sv,'range',jsonb_build_array(p_start,p_start+p_count-1),'players',p_count,'projection_applied',v_ok,'producer',prod);
end; $function$;

-- Seed-scoped cleanup (p_seed given) or nuclear (p_seed null).
create or replace function public.sbiq_demo_scale_cleanup(p_seed_version text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_events bigint; v_players bigint; v_sessions bigint; v_machines bigint; v_ids bigint;
begin
  if p_seed_version is null then
    delete from public.projection_session_state where session_id like 'SC-SES-%'; get diagnostics v_sessions = row_count;
    delete from public.projection_machine_state where machine_id like 'SC-MC-%'; get diagnostics v_machines = row_count;
    delete from public.projection_player_state where risk_flags @> '["synthetic-scale"]'::jsonb; get diagnostics v_players = row_count;
    alter table public.casino_event_log disable trigger trg_casino_event_log_immutable;
    delete from public.casino_event_log where producer like 'safebet-demo-scale-%'; get diagnostics v_events = row_count;
    alter table public.casino_event_log enable trigger trg_casino_event_log_immutable;
    delete from public.safebet_identity_map where casino_ref_hash like 'scale-%'; get diagnostics v_ids = row_count;
  else
    delete from public.projection_session_state where session_id like 'SC-SES-'||p_seed_version||'-%'; get diagnostics v_sessions = row_count;
    delete from public.projection_machine_state where machine_id like 'SC-MC-'||p_seed_version||'-%'; get diagnostics v_machines = row_count;
    delete from public.projection_player_state where risk_flags @> ('["seed:'||p_seed_version||'"]')::jsonb; get diagnostics v_players = row_count;
    alter table public.casino_event_log disable trigger trg_casino_event_log_immutable;
    delete from public.casino_event_log where payload->>'seed_version' = p_seed_version and producer like 'safebet-demo-scale-%'; get diagnostics v_events = row_count;
    alter table public.casino_event_log enable trigger trg_casino_event_log_immutable;
    delete from public.safebet_identity_map where casino_ref_hash like 'scale-'||p_seed_version||'-%'; get diagnostics v_ids = row_count;
  end if;
  return jsonb_build_object('seed',p_seed_version,'events_removed',v_events,'players_removed',v_players,'sessions_removed',v_sessions,'machines_removed',v_machines,'identities_removed',v_ids);
end; $function$;

revoke all on function public.sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer,text,integer) from anon, authenticated;
revoke all on function public.sbiq_demo_scale_cleanup(text) from anon, authenticated;
