-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO uexdjngogzunjxkpxwll) — production-scale synthetic simulator.
-- Deterministic, idempotent, batch-based, producer-tagged, reversible. Feeds ONLY
-- through the certified pipeline: safebet_identity_map (identity resolution) →
-- casino_event_log (append-only, secured partitions) → certified projection
-- upsert (sbiq_write_projection_states). It NEVER writes dashboard aggregate
-- views directly. Every row is tagged (producer='safebet-demo-scale-simulator-v1',
-- payload.is_simulated=true, projection risk_flags @> {synthetic-scale}, ids
-- prefixed SC-SES-/SC-MC-, identity casino_ref_hash 'scale-…') so it is fully
-- removable by sbiq_demo_scale_cleanup(). Demo-only; production untouched.
--
-- One batch = one casino × contiguous player-index range [p_start,p_start+p_count).
-- Resumable by advancing p_start; re-running a range is a no-op (ON CONFLICT DO
-- NOTHING + optimistic-concurrency projection upsert). Player status is the raw
-- domain (active|idle); the active-now/idle/stale POSTURE is derived downstream
-- from last_event_at freshness (last_event_at is spread to model that).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.sbiq_demo_scale_seed_batch(
  p_casino uuid,
  p_seed_version text default 'v1',
  p_start integer default 0,
  p_count integer default 100,
  p_active_pct integer default 8,      -- % of registered players fresh ("active now")
  p_bets_per_active integer default 5  -- BET_PLACED events per active player (today)
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  prod   constant text := 'safebet-demo-scale-simulator-v1';
  sv     text := p_seed_version;
  c4     text := upper(substr(replace(p_casino::text,'-',''),1,4));
  now_ts timestamptz := now();
  v_players jsonb; v_sessions jsonb; v_machines jsonb; v_ok boolean;
begin
  perform public.sbiq_ensure_event_partition(now_ts);  -- secure current-month partition

  -- Deterministic per-player attributes (stable for seed_version+index).
  drop table if exists _scale_batch;
  create temporary table _scale_batch as
  with base as (
    select g,
      'SB-PLR-'||upper(substr(md5(sv||':'||p_casino::text||':'||g), 1, 24)) as spid,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':risk')) % 1000) as b,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':act'))  % 100)  as a,
      (abs(hashtext(sv||':'||p_casino::text||':'||g||':amt'))  % 250)  as amt
    from generate_series(p_start, p_start+p_count-1) g
  )
  select g, spid,
    -- realistic band mix: ~0.8% critical, ~6% high, ~25% medium, rest low (all non-null)
    case when b < 8 then 80 + (b % 20)
         when b < 70 then 60 + (b % 20)
         when b < 320 then 40 + (b % 20)
         else 1 + (b % 39) end as risk_score,
    (a < p_active_pct) as is_active,
    -- freshness spread: active→now, idle→hours ago, stale→days ago (drives posture)
    case when a < p_active_pct then now_ts - ((a) || ' minutes')::interval
         when a < 40          then now_ts - ((2 + a) || ' hours')::interval
         else now_ts - ((3 + (a % 20)) || ' days')::interval end as last_at,
    (50 + amt)::numeric as stake_unit,
    'SC-SES-'||c4||'-'||g as session_id,
    'SC-MC-'||c4||'-'||g  as machine_id
  from base;

  -- 1) Identity resolution (idempotent).
  insert into public.safebet_identity_map (casino_id, casino_ref_hash, safebet_player_id)
  select p_casino, 'scale-'||sv||'-'||g, spid from _scale_batch
  on conflict (casino_id, casino_ref_hash) do nothing;

  -- 2) Certified event log (producer-tagged, deterministic dedupe).
  -- 2a) Registration for every player.
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction,
     safebet_player_id, session_id, machine_id, producer, schema_version,
     event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA',
         spid, null, null, prod, 1, 'CARD_INSERT', last_at, last_at, last_at, 0,
         'scale-'||sv||'-'||g||'-reg',
         jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv)
  from _scale_batch
  on conflict (casino_id, dedupe_key, occurred_at) do nothing;

  -- 2b) Active players: session + machine allocation.
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction,
     safebet_player_id, session_id, machine_id, producer, schema_version,
     event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA',
         spid, session_id, machine_id, prod, 1, ev.t, last_at, last_at, last_at, 0,
         'scale-'||sv||'-'||g||'-'||ev.tag,
         jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv)
  from _scale_batch b
  cross join lateral (values ('SESSION_START','ses'),('MACHINE_ALLOCATED','mc')) ev(t,tag)
  where b.is_active
  on conflict (casino_id, dedupe_key, occurred_at) do nothing;

  -- 2c) BET_PLACED (today) → certified financial GGR = bet_amount - win_amount.
  insert into public.casino_event_log
    (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction,
     safebet_player_id, session_id, machine_id, producer, schema_version,
     event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
  select gen_random_uuid(), 'scale-'||sv||'-'||g, gen_random_uuid(), p_casino, p_casino, 'ZA',
         spid, session_id, machine_id, prod, 1, 'BET_PLACED',
         now_ts - (n || ' minutes')::interval, now_ts - (n || ' minutes')::interval,
         now_ts - (n || ' minutes')::interval, 0, 'scale-'||sv||'-'||g||'-bet-'||n,
         jsonb_build_object('producer',prod,'is_simulated',true,'seed_version',sv,
                            'bet_amount', stake_unit,
                            -- payout in [0.60,0.84]·stake → positive house GGR with per-bet variation
                            'win_amount', round(stake_unit * (0.60 + ((g+n) % 7)::numeric * 0.04), 2))
  from _scale_batch b
  cross join generate_series(1, p_bets_per_active) n
  where b.is_active
  on conflict (casino_id, dedupe_key, occurred_at) do nothing;

  -- 3) Certified projection upsert (sanctioned path; never writes views).
  select jsonb_agg(jsonb_build_object(
           'casino_id', p_casino, 'safebet_player_id', spid,
           'status', case when is_active then 'active' else 'idle' end,
           'current_session_id', case when is_active then session_id end,
           'current_machine_id', case when is_active then machine_id end,
           'risk_score', risk_score, 'risk_flags', '["synthetic-scale"]'::jsonb,
           'total_wagered', case when is_active then stake_unit * p_bets_per_active else 0 end,
           'total_won', case when is_active then round(stake_unit * p_bets_per_active * 0.75, 2) else 0 end,
           'bet_count', case when is_active then p_bets_per_active else 0 end,
           'session_count', case when is_active then 1 else 0 end,
           'intervention_count', 0, 'last_event_at', last_at,
           'projection_version', 1, 'updated_at', now_ts, 'row_version', 0))
  into v_players from _scale_batch;

  select jsonb_agg(jsonb_build_object(
           'session_id', session_id, 'casino_id', p_casino, 'safebet_player_id', spid,
           'machine_id', machine_id, 'status', 'active', 'game_type', 'slots',
           'started_at', last_at, 'total_wagered', stake_unit * p_bets_per_active,
           'total_won', round(stake_unit * p_bets_per_active * 0.75, 2),
           'bet_count', p_bets_per_active, 'risk_score', risk_score,
           'last_event_at', last_at, 'projection_version', 1, 'updated_at', now_ts, 'row_version', 0))
  into v_sessions from _scale_batch where is_active;

  select jsonb_agg(jsonb_build_object(
           'casino_id', p_casino, 'machine_id', machine_id, 'machine_type', 'slots',
           'status', 'active', 'current_player_id', spid, 'current_session_id', session_id,
           'current_risk_score', risk_score, 'session_wagered', stake_unit * p_bets_per_active,
           'last_event_at', last_at, 'projection_version', 1, 'updated_at', now_ts, 'row_version', 0))
  into v_machines from _scale_batch where is_active;

  select ok into v_ok from public.sbiq_write_projection_states(
    p_casino, coalesce(v_players,'[]'::jsonb), coalesce(v_sessions,'[]'::jsonb), coalesce(v_machines,'[]'::jsonb));

  drop table if exists _scale_batch;
  return jsonb_build_object('casino',p_casino,'seed_version',sv,
    'range',jsonb_build_array(p_start,p_start+p_count-1),'players',p_count,
    'projection_applied',v_ok,'producer',prod);
end;
$function$;

-- Reversal: remove ALL simulator data (optionally one seed version).
create or replace function public.sbiq_demo_scale_cleanup(p_seed_version text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare
  prod constant text := 'safebet-demo-scale-simulator-v1';
  v_events bigint; v_players bigint; v_sessions bigint; v_machines bigint; v_ids bigint;
begin
  delete from public.projection_session_state where session_id like 'SC-SES-%';
  get diagnostics v_sessions = row_count;
  delete from public.projection_machine_state where machine_id like 'SC-MC-%';
  get diagnostics v_machines = row_count;
  delete from public.projection_player_state where risk_flags @> '["synthetic-scale"]'::jsonb;
  get diagnostics v_players = row_count;
  alter table public.casino_event_log disable trigger trg_casino_event_log_immutable;
  delete from public.casino_event_log
   where producer = prod and (p_seed_version is null or payload->>'seed_version' = p_seed_version);
  get diagnostics v_events = row_count;
  alter table public.casino_event_log enable trigger trg_casino_event_log_immutable;
  delete from public.safebet_identity_map where casino_ref_hash like 'scale-%';
  get diagnostics v_ids = row_count;
  return jsonb_build_object('events_removed',v_events,'players_removed',v_players,
    'sessions_removed',v_sessions,'machines_removed',v_machines,'identities_removed',v_ids);
end;
$function$;

revoke all on function public.sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer) from anon, authenticated;
revoke all on function public.sbiq_demo_scale_cleanup(text) from anon, authenticated;
