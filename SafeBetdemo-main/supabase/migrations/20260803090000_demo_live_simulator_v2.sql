-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO uexdjngogzunjxkpxwll) — server-side live activity simulator v2.
-- Keeps every casino's certified players_active_now non-zero and fluctuating by
-- refreshing a ROTATING cohort's last_event_at through the certified pipeline
-- (casino_event_log BET_PLACED + sbiq_write_projection_states). It NEVER writes
-- players_active_now / aggregates directly (projection_casino_state is a live
-- view over projection_player_state freshness), never changes freshness
-- thresholds, uses no casino-name conditionals, and preserves every
-- reconciliation (observed = active_now + idle + stale is automatic).
-- Runs from pg_cron (browser-independent). Producer 'safebet-demo-live-simulator-v2'.
-- Demo-only; bounded; advisory-locked against overlap.
-- ─────────────────────────────────────────────────────────────────────────────

-- Feature flags (server-only, in-DB).
create table if not exists public.sbiq_demo_sim_flags (
  key text primary key, value text not null, updated_at timestamptz not null default now()
);
insert into public.sbiq_demo_sim_flags(key,value) values
  ('ENABLE_DEMO_LIVE_SIMULATOR','true'), ('ENABLE_DEMO_SHOWCASE_MODE','true')
on conflict (key) do nothing;

-- Per-casino differentiated activity profiles (data-driven; no name conditionals).
create table if not exists public.sbiq_demo_sim_config (
  casino_id uuid primary key references public.casinos(id),
  baseline_active_target int not null,   -- steady-state active-now (baseline)
  showcase_active_target int not null,   -- steady-state active-now (showcase)
  bet_min numeric not null default 40, bet_max numeric not null default 900,
  updated_at timestamptz not null default now()
);
insert into public.sbiq_demo_sim_config(casino_id, baseline_active_target, showcase_active_target, bet_min, bet_max) values
  ('cc000002-0000-0000-0000-000000000002', 60, 300, 60, 1200),  -- Hollywoodbets (highest)
  ('cc000003-0000-0000-0000-000000000003', 50, 250, 50, 1000),  -- Betway (high concurrency)
  ('a1b2c3d4-0000-0000-0000-000000000001', 40, 180, 50, 900),   -- Prestige (med-high balanced)
  ('cc000001-0000-0000-0000-000000000001', 28, 120, 30, 600),   -- SunBet (medium, lower stake)
  ('cc000004-0000-0000-0000-000000000004', 20, 90, 40, 800),    -- Gold Rush (lower players)
  ('cc000005-0000-0000-0000-000000000005', 14, 70, 40, 700)     -- Royal Palace (smallest, continuous)
on conflict (casino_id) do update set baseline_active_target=excluded.baseline_active_target,
  showcase_active_target=excluded.showcase_active_target, bet_min=excluded.bet_min, bet_max=excluded.bet_max, updated_at=now();

-- Showcase windows (created only by trusted server code / service-role).
create table if not exists public.sbiq_demo_showcase_windows (
  id bigint generated always as identity primary key,
  scope text not null,                 -- 'casino:<uuid>' or 'jurisdiction:ZA'
  casino_id uuid,                      -- null for a jurisdiction-wide window
  profile text not null default 'showcase',
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  correlation_id uuid, triggered_by uuid,
  status text not null default 'active',
  last_cycle_at timestamptz
);
create index if not exists sbiq_showcase_active_idx on public.sbiq_demo_showcase_windows(status, expires_at);

-- Trusted activation: create/extend a showcase window. Scope is resolved by the
-- caller (server route via service-role); the browser never supplies a tenant.
create or replace function public.sbiq_demo_activate_showcase(
  p_scope text, p_casino uuid, p_profile text default 'showcase',
  p_minutes int default 30, p_account uuid default null, p_correlation uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_id bigint; v_exp timestamptz := now() + make_interval(mins => greatest(1, least(p_minutes, 120)));
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_SHOWCASE_MODE') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'reason', 'showcase_disabled');
  end if;
  update sbiq_demo_showcase_windows set expires_at = greatest(expires_at, v_exp), last_cycle_at = last_cycle_at
    where status='active' and scope = p_scope returning id into v_id;
  if v_id is null then
    insert into sbiq_demo_showcase_windows(scope, casino_id, profile, expires_at, correlation_id, triggered_by)
    values (p_scope, p_casino, p_profile, v_exp, p_correlation, p_account) returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'window_id', v_id, 'scope', p_scope, 'expires_at', v_exp);
end; $fn$;
revoke all on function public.sbiq_demo_activate_showcase(text,uuid,text,int,uuid,uuid) from anon, authenticated;

-- ── The tick: refresh a rotating cohort per casino through the certified pipeline.
create or replace function public.sbiq_demo_live_tick(p_cron_minutes int default 5)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  prod constant text := 'safebet-demo-live-simulator-v2';
  win_min int := 30;                     -- active freshness window (idle_after) — NOT changed here
  now_ts timestamptz := now();
  rec record; showcase boolean; target int; observed int; current int; churn int; need int;
  v_players jsonb; v_ok boolean; total_refreshed int := 0; per jsonb := '{}'::jsonb;
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_LIVE_SIMULATOR') is distinct from 'true' then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('sbiq_demo_live_tick')) then
    return jsonb_build_object('ok', false, 'reason', 'locked');   -- prevent overlapping runs
  end if;
  perform public.sbiq_ensure_event_partition(now_ts);
  update sbiq_demo_showcase_windows set status='expired' where status='active' and expires_at < now_ts;

  for rec in
    select c.id casino_id, cfg.baseline_active_target bt, cfg.showcase_active_target st, cfg.bet_min bmin, cfg.bet_max bmax
    from casinos c join sbiq_demo_sim_config cfg on cfg.casino_id=c.id order by c.name
  loop
    showcase := exists(select 1 from sbiq_demo_showcase_windows w
      where w.status='active' and w.expires_at>now_ts and (w.casino_id=rec.casino_id or w.scope='jurisdiction:ZA'));
    target := case when showcase then rec.st else rec.bt end;
    target := round(target * (0.85 + random()*0.30));                      -- natural fluctuation ±15%
    observed := (select count(*) from projection_player_state p where p.casino_id=rec.casino_id and p.status='active');
    if observed = 0 then continue; end if;
    target := least(target, round(observed * case when showcase then 0.40 else 0.20 end));  -- cap vs observed
    target := greatest(target, least(10, observed));                        -- min 10 where possible
    current := (select count(*) from projection_player_state p where p.casino_id=rec.casino_id
                and p.status='active' and p.last_event_at >= now_ts - make_interval(mins => win_min));
    churn := greatest(2, round(target * 0.15));                             -- rotate ~15% each cycle
    need := greatest(2, target - current + churn);
    need := least(need, 250);                                              -- bounded per casino per cycle

    -- Cohort = stalest observed players (rotation). Refresh through certified pipeline.
    drop table if exists _tick_cohort;
    create temporary table _tick_cohort as
      select p.safebet_player_id spid, p.row_version rv, p.current_session_id csid, p.current_machine_id cmid,
             p.risk_score rs, p.risk_flags rf, p.total_wagered tw, p.total_won two, p.bet_count bc,
             p.session_count sc, p.intervention_count ic,
             round((rec.bmin + random()*(rec.bmax-rec.bmin))::numeric, 2) bet,
             row_number() over () rn
      from projection_player_state p
      where p.casino_id=rec.casino_id and p.status='active'
      order by p.last_event_at asc nulls first limit need;

    -- Certified event log: one BET_PLACED per refreshed player (drives GGR + avg bet).
    insert into public.casino_event_log
      (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction, safebet_player_id, session_id, machine_id,
       producer, schema_version, event_type, occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
    select gen_random_uuid(), 'live-v2', gen_random_uuid(), rec.casino_id, rec.casino_id, 'ZA', spid, csid, cmid,
           prod, 1, 'BET_PLACED', now_ts, now_ts, now_ts, 0,
           'live-v2-'||spid||'-'||to_char(now_ts,'YYYYMMDD"T"HH24MISS'),
           jsonb_build_object('producer',prod,'is_simulated',true,'bet_amount',bet,
             'win_amount', round(bet * (0.60 + (abs(hashtext(spid)) % 7)::numeric * 0.04), 2))
    from _tick_cohort on conflict (casino_id, dedupe_key, occurred_at) do nothing;

    -- Certified projection upsert: refresh last_event_at (=> active-now) + accrue wager.
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
    per := per || jsonb_build_object(rec.casino_id::text, jsonb_build_object('showcase',showcase,'target',target,'refreshed',need,'applied',v_ok));
  end loop;

  update sbiq_demo_showcase_windows set last_cycle_at = now_ts where status='active';
  return jsonb_build_object('ok', true, 'at', now_ts, 'refreshed_total', total_refreshed, 'per_casino', per);
end; $fn$;
revoke all on function public.sbiq_demo_live_tick(int) from anon, authenticated;

-- ── Demo simulation health (metadata only; admin/service).
create or replace view public.sbiq_demo_simulation_health as
select c.id casino_id, c.name casino_name,
  case when exists(select 1 from sbiq_demo_showcase_windows w where w.status='active' and w.expires_at>now()
                  and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) then 'showcase' else 'baseline' end as profile,
  (select count(*) from projection_player_state p where p.casino_id=c.id) registered,
  cs.active_players observed, cs.players_active_now active_now, cs.players_idle idle, cs.players_stale stale,
  cs.active_sessions,
  (select count(*) from casino_event_log e where e.casino_id=c.id and e.producer='safebet-demo-live-simulator-v2' and e.occurred_at>now()-interval '5 minutes') events_last_5m,
  (select max(e.occurred_at) from casino_event_log e where e.casino_id=c.id and e.producer='safebet-demo-live-simulator-v2') last_sim_tick,
  (select max(expires_at) from sbiq_demo_showcase_windows w where w.status='active' and (w.casino_id=c.id or w.scope='jurisdiction:ZA')) showcase_expiry,
  (cs.active_players = cs.players_active_now + cs.players_idle + cs.players_stale) reconciles
from casinos c left join projection_casino_state cs on cs.casino_id=c.id;
revoke all on public.sbiq_demo_simulation_health from anon;
grant select on public.sbiq_demo_simulation_health to authenticated, service_role;

select 'demo_live_simulator_v2_installed' status;
