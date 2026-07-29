/*
  # Financial Semantic Integrity, Capability & Synthetic Disclosure

  PROVEN SEMANTICS (Phase 1):
  BET_PLACED is a LEGACY COMBINED wager-and-settlement record (Outcome C):
  it carries bet_amount (stake) + win_amount (winnings) in ONE event, with NO
  round_id / transaction_id / settlement_status, and the reducer treats it as
  immediately settled. There is NO separate settlement lifecycle and NO
  VOID / CANCEL / REVERSAL / REFUND / BONUS / JACKPOT events in the certified
  stream. Therefore voids/reversals/bonuses are UNOBSERVABLE (not "zero"), and
  the honest financial status is PARTIAL, not Healthy.

  This migration:
    1. Adds a per-source financial CAPABILITY profile (what the integration can
       actually prove) — versioned, tenant-aware, configurable.
    2. Corrects the financial posture view so unsupported categories return NULL
       (with support flags), the status is capability-aware (partial), and the
       synthetic contribution is disclosed (counts + mode).
  No source events are deleted; no totals are forced; GGR (stake − winnings over
  settled BET_PLACED/JACKPOT) is unchanged. Operational reconciliations untouched.
*/

-- ── Financial source capability profile ──────────────────────────────────────
create table if not exists financial_source_capability (
  scope            text not null check (scope in ('platform','casino')),
  casino_id        uuid references casinos(id) on delete cascade,
  capability_version integer not null default 1,
  combined_wager_settlement      boolean not null default true,   -- BET_PLACED = combined record
  separate_settlement            boolean not null default false,
  voids_supported                boolean not null default false,
  cancellations_supported        boolean not null default false,
  reversals_supported            boolean not null default false,
  refunds_supported              boolean not null default false,
  bonus_supported                boolean not null default false,
  jackpot_contribution_supported boolean not null default false,
  jackpot_payout_supported       boolean not null default false,
  round_ids_supported            boolean not null default false,
  transaction_ids_supported      boolean not null default false,
  multi_currency_supported       boolean not null default false,
  late_correction_supported      boolean not null default true,   -- append-only log + occurred_at
  updated_at timestamptz not null default now(),
  unique (scope, casino_id)
);
insert into financial_source_capability (scope, casino_id) values ('platform', null)
on conflict (scope, casino_id) do nothing;

alter table financial_source_capability enable row level security;
drop policy if exists fsc_read on financial_source_capability;
create policy fsc_read on financial_source_capability for select to authenticated using (true);

create or replace function sbiq_financial_capability(p_casino uuid)
returns financial_source_capability language sql stable security invoker set search_path to 'public' as $$
  select * from financial_source_capability
   where (scope='casino' and casino_id = p_casino) or (scope='platform' and casino_id is null)
   order by (scope='casino') desc limit 1;
$$;

-- ── Capability-aware, synthetic-disclosing financial posture ─────────────────
-- Recreated (columns are added/reordered); no SQL dependents (read via API only).
drop view if exists projection_financial_posture;
create view projection_financial_posture as
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
    case
      when (now() at time zone cfg.tz)::time >= cfg.day_start and (now() at time zone cfg.tz)::time < cfg.night_start
        then (date_trunc('day', now() at time zone cfg.tz) + cfg.day_start) at time zone cfg.tz
      when (now() at time zone cfg.tz)::time >= cfg.night_start
        then (date_trunc('day', now() at time zone cfg.tz) + cfg.night_start) at time zone cfg.tz
      else ((date_trunc('day', now() at time zone cfg.tz) - interval '1 day') + cfg.night_start) at time zone cfg.tz
    end as shift_start
  from cfg
),
agg as (
  select
    b.casino_id, b.currency, b.tz, b.shift_start, b.today_start, b.mtd_start,
    coalesce(sum(e.stake)              filter (where e.occurred_at >= b.shift_start), 0) as stakes_current_shift,
    coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.shift_start), 0) as player_winnings_current_shift,
    coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.shift_start), 0) as ggr_current_shift,
    coalesce(sum(e.stake)              filter (where e.occurred_at >= b.today_start), 0) as stakes_today,
    coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.today_start), 0) as player_winnings_today,
    coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.today_start), 0) as ggr_today,
    coalesce(sum(e.stake)              filter (where e.occurred_at >= b.h24_start), 0) as stakes_last_24_hours,
    coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.h24_start), 0) as player_winnings_last_24_hours,
    coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.h24_start), 0) as ggr_last_24_hours,
    coalesce(sum(e.stake)              filter (where e.occurred_at >= b.mtd_start), 0) as stakes_month_to_date,
    coalesce(sum(e.winnings)           filter (where e.occurred_at >= b.mtd_start), 0) as player_winnings_month_to_date,
    coalesce(sum(e.stake - e.winnings) filter (where e.occurred_at >= b.mtd_start), 0) as ggr_month_to_date,
    count(e.event_id) filter (where e.occurred_at >= b.today_start) as settled_bets_today,
    count(e.event_id) as financial_events_total,
    count(e.event_id) filter (where e.is_synthetic)     as synthetic_event_count,
    count(e.event_id) filter (where not e.is_synthetic) as non_synthetic_event_count
  from bounds b
  left join lateral (
    select cel.event_id, cel.occurred_at, cel.event_type,
           (cel.payload->>'bet_amount')::numeric               as stake,
           coalesce((cel.payload->>'win_amount')::numeric, 0)  as winnings,
           coalesce((cel.payload->>'is_simulated')::boolean,false)
             or coalesce((cel.payload->>'synthetic')::boolean,false) as is_synthetic
    from casino_event_log cel
    where cel.casino_id = b.casino_id
      and cel.event_type in ('BET_PLACED','JACKPOT')
      and (cel.payload->>'bet_amount') is not null
  ) e on true
  group by b.casino_id, b.currency, b.tz, b.shift_start, b.today_start, b.mtd_start
)
select
  agg.casino_id,
  agg.currency as financial_currency, agg.tz as financial_timezone,
  agg.shift_start, agg.today_start, agg.mtd_start,
  agg.stakes_current_shift, agg.player_winnings_current_shift, agg.ggr_current_shift,
  agg.stakes_today, agg.player_winnings_today, agg.ggr_today,
  agg.stakes_last_24_hours, agg.player_winnings_last_24_hours, agg.ggr_last_24_hours,
  agg.stakes_month_to_date, agg.player_winnings_month_to_date, agg.ggr_month_to_date,
  agg.settled_bets_today,
  -- Unsupported categories are NULL (not 0) with explicit support flags.
  case when cap.voids_supported     then 0::bigint else null::bigint end as voided_bets_today,
  case when cap.reversals_supported then 0::bigint else null::bigint end as reversed_transactions_today,
  case when cap.bonus_supported     then 0::bigint else null::bigint end as bonus_wagers_today,
  cap.voids_supported, cap.reversals_supported, cap.bonus_supported,
  cap.combined_wager_settlement, cap.separate_settlement, cap.capability_version,
  agg.financial_events_total, agg.synthetic_event_count, agg.non_synthetic_event_count,
  (agg.synthetic_event_count > 0) as contains_synthetic_data,
  case
    when agg.financial_events_total = 0 then 'unavailable'
    when agg.non_synthetic_event_count = 0 then 'synthetic'
    when agg.synthetic_event_count = 0 then 'live'
    else 'mixed'
  end as financial_data_mode,
  -- Capability-aware status: healthy ONLY if the source can observe voids AND
  -- reversals; otherwise partial (GGR derivable, but material events unobservable).
  case
    when agg.financial_events_total = 0 then 'unavailable'
    when cap.voids_supported and cap.reversals_supported then 'healthy'
    else 'partial'
  end as financial_data_status,
  0::numeric as financial_projection_lag_seconds,
  now() as financial_snapshot_at
from agg
left join lateral sbiq_financial_capability(agg.casino_id) cap on true;

alter view projection_financial_posture set (security_invoker = true);
