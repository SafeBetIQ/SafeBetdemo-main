-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — certified incremental FINANCIAL ROLLUP.
-- Removes the ~5-6s full-history scan behind certified financial posture by
-- pre-aggregating the SAME certified normalisation into hourly buckets, then
-- answering shift/today/24h/MTD from complete buckets + a small live tail for the
-- current (and h24-boundary) incomplete hour. Semantics are IDENTICAL to
-- projection_financial_posture: source = casino_event_log where
-- event_type in ('BET_PLACED','JACKPOT') and payload.bet_amount is not null;
-- stake = bet_amount; winnings = coalesce(win_amount,0); GGR = stake - winnings;
-- is_synthetic = is_simulated OR synthetic. Africa/Johannesburg (UTC+2) boundaries
-- are hour-aligned. Unsupported voids/reversals/bonuses remain unavailable (never 0).
-- Append-only source; nothing is deleted or re-hashed. Demo-only.
-- ─────────────────────────────────────────────────────────────────────────────

-- Hourly certified rollup (one row per casino+hour+currency+version).
create table if not exists public.sbiq_financial_rollup_hourly (
  casino_id uuid not null references public.casinos(id),
  bucket_start timestamptz not null,               -- date_trunc('hour', occurred_at) UTC
  currency text not null default 'ZAR',
  settled_stakes numeric not null default 0,
  player_winnings numeric not null default 0,
  ggr numeric not null default 0,
  supported_bet_count int not null default 0,
  synthetic_event_count int not null default 0,
  non_synthetic_event_count int not null default 0,
  source_event_count int not null default 0,
  source_max_occurred_at timestamptz,
  source_max_received_at timestamptz,
  reconciles boolean not null default true,        -- ggr = stakes - winnings (rounded)
  rollup_version int not null default 1,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (casino_id, bucket_start, currency, rollup_version)
);
create index if not exists sbiq_fin_rollup_casino_bucket_idx
  on public.sbiq_financial_rollup_hourly (casino_id, bucket_start);
revoke all on public.sbiq_financial_rollup_hourly from anon, authenticated;

-- Ingestion cursor (append order) + run log.
create table if not exists public.sbiq_financial_rollup_checkpoint (
  id int primary key default 1,
  last_received_at timestamptz, last_event_id uuid,
  last_success_at timestamptz, last_failed_at timestamptz,
  last_source_max_received_at timestamptz,
  rollup_version int not null default 1, error_category text,
  updated_at timestamptz not null default now()
);
insert into public.sbiq_financial_rollup_checkpoint(id) values (1) on conflict do nothing;

create table if not exists public.sbiq_financial_rollup_run_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(), finished_at timestamptz,
  duration_ms int, mode text, buckets_processed int not null default 0,
  events_processed int not null default 0, outcome text, error_category text
);
revoke all on public.sbiq_financial_rollup_run_log from anon, authenticated;

-- Feature flag (Demo-only fallback control).
insert into public.sbiq_demo_sim_flags(key,value) values ('ENABLE_FINANCIAL_ROLLUP','true')
on conflict (key) do nothing;

-- Resolve the (single) certified currency/timezone — same COALESCE as the view.
create or replace function public.sbiq_fin_currency(p_casino uuid) returns text
language sql stable set search_path to 'public' as $$
  select coalesce(
    (select currency from financial_shift_policy where scope='casino' and casino_id=p_casino limit 1),
    (select currency from financial_shift_policy where scope='platform' and casino_id is null limit 1),
    'ZAR')
$$;

-- Recompute a set of hourly buckets from the authoritative event log (idempotent
-- upsert). Buckets are chosen by the caller (dirty set or backfill range).
create or replace function public.sbiq_fin_rollup_upsert_range(p_from timestamptz, p_to timestamptz)
returns int language plpgsql security definer set search_path to 'public' as $fn$
declare n int;
begin
  insert into public.sbiq_financial_rollup_hourly as r
    (casino_id, bucket_start, currency, settled_stakes, player_winnings, ggr,
     supported_bet_count, synthetic_event_count, non_synthetic_event_count,
     source_event_count, source_max_occurred_at, source_max_received_at, reconciles,
     rollup_version, computed_at, updated_at)
  select e.casino_id, date_trunc('hour', e.occurred_at) bucket_start,
         public.sbiq_fin_currency(e.casino_id) currency,
         sum(e.stake), sum(e.winnings), sum(e.stake - e.winnings),
         count(*), count(*) filter (where e.is_synthetic), count(*) filter (where not e.is_synthetic),
         count(*), max(e.occurred_at), max(e.received_at),
         round(sum(e.stake - e.winnings), 2) = round(sum(e.stake) - sum(e.winnings), 2),
         1, now(), now()
  from (
    select casino_id, occurred_at, received_at,
           (payload->>'bet_amount')::numeric stake,
           coalesce((payload->>'win_amount')::numeric, 0) winnings,
           coalesce((payload->>'is_simulated')::boolean,false) or coalesce((payload->>'synthetic')::boolean,false) is_synthetic
    from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
      and occurred_at >= p_from and occurred_at < p_to
  ) e
  group by e.casino_id, date_trunc('hour', e.occurred_at)
  on conflict (casino_id, bucket_start, currency, rollup_version) do update set
    settled_stakes=excluded.settled_stakes, player_winnings=excluded.player_winnings, ggr=excluded.ggr,
    supported_bet_count=excluded.supported_bet_count, synthetic_event_count=excluded.synthetic_event_count,
    non_synthetic_event_count=excluded.non_synthetic_event_count, source_event_count=excluded.source_event_count,
    source_max_occurred_at=excluded.source_max_occurred_at, source_max_received_at=excluded.source_max_received_at,
    reconciles=excluded.reconciles, computed_at=now(), updated_at=now();
  get diagnostics n = row_count;
  return n;
end; $fn$;
revoke all on function public.sbiq_fin_rollup_upsert_range(timestamptz,timestamptz) from anon, authenticated;

-- ── Incremental refresh: dirty buckets from newly-appended events (by received_at
--    cursor) + a bounded current-hour repair. Handles late-arriving events (a late
--    event with an old occurred_at marks that old bucket dirty and rebuilds it).
create or replace function public.sbiq_financial_rollup_refresh(p_max_buckets int default 500)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  t0 timestamptz := clock_timestamp(); run_id bigint;
  cp_recv timestamptz; cp_id uuid; new_max_recv timestamptz; new_max_id uuid;
  v_buckets int := 0; v_events int := 0; cur_hour timestamptz := date_trunc('hour', now());
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_FINANCIAL_ROLLUP') is distinct from 'true' then
    return jsonb_build_object('ok', true, 'skipped', 'disabled');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('sbiq_financial_rollup_refresh')) then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  insert into sbiq_financial_rollup_run_log(mode) values ('incremental') returning id into run_id;
  select last_received_at, last_event_id into cp_recv, cp_id from sbiq_financial_rollup_checkpoint where id=1;

  -- Dirty buckets = distinct occurred_at hours of events appended since the cursor.
  create temporary table _dirty on commit drop as
    select distinct casino_id, date_trunc('hour', occurred_at) bucket_start
    from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
      and (cp_recv is null
           or received_at > cp_recv
           or (received_at = cp_recv and (cp_id is null or event_id > cp_id)))
    limit greatest(1, p_max_buckets);
  -- Always repair the current (incomplete) hour too.
  insert into _dirty select c.id, cur_hour from casinos c
    on conflict do nothing;

  -- Rebuild each dirty bucket from the authoritative log.
  perform public.sbiq_fin_rollup_upsert_range(min(bucket_start), max(bucket_start)+interval '1 hour') from _dirty
    where exists (select 1 from _dirty);
  -- (range upsert recomputes ALL hours in [min,max]; for a sparse dirty set this
  --  is still correct and bounded by p_max_buckets worth of span in normal operation.)
  select count(*) into v_buckets from _dirty;

  -- Advance the cursor to the newest appended event we have now covered.
  select received_at, event_id into new_max_recv, new_max_id
    from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
    order by received_at desc, event_id desc limit 1;
  select count(*) into v_events from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
      and (cp_recv is null or received_at > cp_recv or (received_at = cp_recv and (cp_id is null or event_id > cp_id)));

  update sbiq_financial_rollup_checkpoint set
    last_received_at = coalesce(new_max_recv, last_received_at),
    last_event_id = coalesce(new_max_id, last_event_id),
    last_success_at = now(), last_source_max_received_at = new_max_recv,
    error_category = null, updated_at = now() where id=1;
  update sbiq_financial_rollup_run_log set finished_at=now(),
    duration_ms=extract(ms from clock_timestamp()-t0)::int, buckets_processed=v_buckets,
    events_processed=v_events, outcome='ok' where id=run_id;
  return jsonb_build_object('ok', true, 'buckets', v_buckets, 'events', v_events);
exception when others then
  update sbiq_financial_rollup_checkpoint set last_failed_at=now(), error_category=sqlstate, updated_at=now() where id=1;
  update sbiq_financial_rollup_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
    outcome='error', error_category=sqlstate where id=run_id;
  return jsonb_build_object('ok', false, 'reason','error','error_category', sqlstate);
end; $fn$;
revoke all on function public.sbiq_financial_rollup_refresh(int) from anon, authenticated;

-- ── Resumable historical backfill (month batches). Idempotent.
create or replace function public.sbiq_financial_rollup_backfill(p_months int default 6)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare m timestamptz; first_ev timestamptz; total int := 0; b int;
begin
  select min(occurred_at) into first_ev from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null;
  if first_ev is null then return jsonb_build_object('ok', true, 'buckets', 0); end if;
  m := date_trunc('month', greatest(first_ev, now() - make_interval(months => p_months)));
  while m <= now() loop
    b := public.sbiq_fin_rollup_upsert_range(m, m + interval '1 month');
    total := total + b; m := m + interval '1 month';
  end loop;
  return jsonb_build_object('ok', true, 'buckets', total, 'from', date_trunc('month', greatest(first_ev, now()-make_interval(months=>p_months))));
end; $fn$;
revoke all on function public.sbiq_financial_rollup_backfill(int) from anon, authenticated;

select 'financial_rollup_part1_installed' status;
