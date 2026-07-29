/*
  # Certified Period-Scoped GGR & Financial Posture

  PREVIOUS "R 420": projection_casino_state.ggr = sum(total_wagered - total_won)
  over projection_player_state — a CUMULATIVE, all-time figure with no period,
  currency or timezone. It equals the stake of the only TWO BET_PLACED events in
  the entire certified log (300 + 120, wins 0, both Prestige, 2026-07-05 and
  2026-07-14). It is not period-scoped and is built from a near-empty financial
  stream.

  CERTIFIED GGR (this migration): GGR = settled stakes − settled player winnings,
  computed per period over the IMMUTABLE certified financial events in
  casino_event_log (event_type in ('BET_PLACED','JACKPOT'); stake=bet_amount,
  winnings=win_amount). Because the log is append-only and event_id is unique,
  the read model is deterministic and idempotent by construction — no double
  counting, replayable, tenant-scoped by casino_id.

  SUPPORTED financial events: BET_PLACED, JACKPOT (a settled stake with an
  optional win in one event). UNSUPPORTED by the current certified model (NOT
  fabricated): separate settlement, VOID, CANCEL, REVERSAL, BONUS/FREE-BET,
  REFUND, ADJUSTMENT. Voids/reversals are therefore 0 by absence and flagged in
  the data status, never invented.

  Time semantics: periods use occurred_at (certified business time). Casino-local
  time = the configured timezone (Africa/Johannesburg / SAST for these SA
  operators — casinos has no tz column, so it is configured here, not assumed
  silently). Currency = configured (ZAR). The legacy cumulative ggr field is
  retained unchanged for backward compatibility and labelled cumulative in the
  UI/contract; it is NOT silently redefined.

  No source events are deleted; no totals are forced. The player-risk, session
  and player/machine posture reconciliations are untouched (this reads the event
  log directly and adds no column to projection_casino_state).
*/

-- ── Shift / timezone / currency policy (configurable; RLS) ───────────────────
create table if not exists financial_shift_policy (
  scope            text not null check (scope in ('platform','casino')),
  casino_id        uuid references casinos(id) on delete cascade,
  timezone         text not null default 'Africa/Johannesburg',
  currency         text not null default 'ZAR',
  day_shift_start  time not null default '06:00',   -- day shift 06:00–18:00
  night_shift_start time not null default '18:00',  -- night shift 18:00–06:00 (overnight)
  effective_from   date not null default '2000-01-01',
  updated_at       timestamptz not null default now(),
  unique (scope, casino_id)
);
insert into financial_shift_policy (scope, casino_id) values ('platform', null)
on conflict (scope, casino_id) do nothing;

alter table financial_shift_policy enable row level security;
drop policy if exists fsp_read on financial_shift_policy;
create policy fsp_read on financial_shift_policy for select to authenticated using (true);

-- ── Certified period-scoped financial posture (one row per casino) ───────────
create or replace view projection_financial_posture as
with cfg as (
  select c.id as casino_id,
         coalesce(fp.timezone,  plat.timezone,  'Africa/Johannesburg') as tz,
         coalesce(fp.currency,  plat.currency,  'ZAR')                 as currency,
         coalesce(fp.day_shift_start,   plat.day_shift_start,   time '06:00') as day_start,
         coalesce(fp.night_shift_start, plat.night_shift_start, time '18:00') as night_start
  from casinos c
  left join financial_shift_policy fp on fp.scope='casino' and fp.casino_id = c.id
  left join lateral (select * from financial_shift_policy where scope='platform' and casino_id is null limit 1) plat on true
),
bounds as (
  select cfg.*,
    (date_trunc('day',   now() at time zone cfg.tz)) at time zone cfg.tz as today_start,
    (date_trunc('month', now() at time zone cfg.tz)) at time zone cfg.tz as mtd_start,
    now() - interval '24 hours' as h24_start,
    -- current shift start (UTC instant), overnight-aware
    case
      when (now() at time zone cfg.tz)::time >= cfg.day_start and (now() at time zone cfg.tz)::time < cfg.night_start
        then (date_trunc('day', now() at time zone cfg.tz) + cfg.day_start) at time zone cfg.tz
      when (now() at time zone cfg.tz)::time >= cfg.night_start
        then (date_trunc('day', now() at time zone cfg.tz) + cfg.night_start) at time zone cfg.tz
      else ((date_trunc('day', now() at time zone cfg.tz) - interval '1 day') + cfg.night_start) at time zone cfg.tz
    end as shift_start
  from cfg
)
select
  b.casino_id,
  b.currency as financial_currency,
  b.tz       as financial_timezone,
  b.shift_start, b.today_start, b.mtd_start,
  -- Current shift
  coalesce(sum(e.stake)              filter (where e.occurred_at >= b.shift_start), 0) as stakes_current_shift,
  coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.shift_start), 0) as player_winnings_current_shift,
  coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.shift_start), 0) as ggr_current_shift,
  -- Today (casino-local midnight → now)
  coalesce(sum(e.stake)              filter (where e.occurred_at >= b.today_start), 0) as stakes_today,
  coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.today_start), 0) as player_winnings_today,
  coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.today_start), 0) as ggr_today,
  -- Rolling last 24h
  coalesce(sum(e.stake)              filter (where e.occurred_at >= b.h24_start), 0) as stakes_last_24_hours,
  coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.h24_start), 0) as player_winnings_last_24_hours,
  coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.h24_start), 0) as ggr_last_24_hours,
  -- Month to date
  coalesce(sum(e.stake)              filter (where e.occurred_at >= b.mtd_start), 0) as stakes_month_to_date,
  coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.mtd_start), 0) as player_winnings_month_to_date,
  coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.mtd_start), 0) as ggr_month_to_date,
  count(e.event_id) filter (where e.occurred_at >= b.today_start) as settled_bets_today,
  0::bigint as voided_bets_today,          -- no VOID events in the certified model
  0::bigint as reversed_transactions_today, -- no REVERSAL events in the certified model
  count(e.event_id) as financial_events_total,
  case when count(e.event_id) = 0 then 'unavailable' else 'healthy' end as financial_data_status,
  0::numeric as financial_projection_lag_seconds, -- read directly from the immutable log
  now() as financial_snapshot_at
from bounds b
left join lateral (
  select cel.event_id, cel.occurred_at, cel.event_type,
         (cel.payload->>'bet_amount')::numeric               as stake,
         coalesce((cel.payload->>'win_amount')::numeric, 0)  as winnings
  from casino_event_log cel
  where cel.casino_id = b.casino_id
    and cel.event_type in ('BET_PLACED','JACKPOT')
    and (cel.payload->>'bet_amount') is not null
) e on true
group by b.casino_id, b.currency, b.tz, b.shift_start, b.today_start, b.mtd_start;

alter view projection_financial_posture set (security_invoker = true);

-- ── Phase 16: deterministic synthetic financial generator (demo only) ────────
-- Produces SETTLED BET_PLACED events (the certified contract) with realistic
-- synthetic stakes/wins across the current shift, today and this month, so the
-- period GGR can be exercised and tested. Clearly synthetic (producer tag +
-- is_simulated). Idempotent by deterministic event_id. Writes ONLY to the
-- append-only event log — it does not touch operational projections or force
-- any dashboard total.
create or replace function sbiq_seed_demo_financials(p_casino uuid, p_player text default 'SB-PLR-859D2993145EFF36E3FC3986')
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  spec record; n int := 0;
begin
  for spec in
    select * from (values
      -- (offset from now, stake, win, tag)
      ('10 minutes'::interval, 250::numeric, 0::numeric,   'shift-1'),
      ('35 minutes'::interval, 500::numeric, 180::numeric, 'shift-2'),
      ('90 minutes'::interval, 300::numeric, 300::numeric, 'today-1'),
      ('6 hours'::interval,    750::numeric, 200::numeric, 'today-2'),
      ('3 days'::interval,     400::numeric, 0::numeric,   'mtd-1'),
      ('12 days'::interval,    600::numeric, 950::numeric, 'mtd-2')
    ) as t(off_ago, stake, win, tag)
  loop
    insert into casino_event_log (event_id, correlation_id, trace_id, tenant_id, casino_id, jurisdiction,
      safebet_player_id, session_id, machine_id, producer, schema_version, event_type,
      occurred_at, received_at, processed_at, replay_number, dedupe_key, payload)
    values (
      md5('sbiq-fin-demo:'||p_casino::text||':'||spec.tag)::uuid,
      'fin-demo', '11111111-1111-4111-8111-111111111111', p_casino, p_casino, 'ZA',
      p_player, 'fin-demo-session', 'M-001', 'sbiq-demo-fin-sim', 1, 'BET_PLACED',
      now() - spec.off_ago, now(), now(), 0,
      'fin-demo:'||p_casino::text||':'||spec.tag,
      jsonb_build_object('bet_amount', spec.stake, 'win_amount', spec.win,
        'currency','ZAR','game_type','slots','is_simulated', true, 'synthetic', true)
    )
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
