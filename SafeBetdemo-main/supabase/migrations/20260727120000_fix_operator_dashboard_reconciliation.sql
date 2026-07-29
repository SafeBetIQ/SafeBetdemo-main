/*
  # Operator Dashboard reconciliation fix (data-integrity audit)

  ROOT CAUSE (151 active players vs 152 risk-classified):
  In projection_casino_state the four risk bands counted the ENTIRE
  projection_player_state population, while active_players is filtered to
  status = 'active'. Because risk_score is NOT NULL and the four bands
  (>=80, [60,80), [40,60), <40) partition the whole numeric range, their sum
  equalled the TOTAL player rows (active + idle). Any idle player therefore
  inflated the risk-band sum above active_players — the observed 152 vs 151.

  FIX (no figures hand-adjusted — the aggregation is corrected):
    1. Every risk band is scoped to the SAME population as active_players
       (status = 'active'), so all cards share one population and one snapshot.
    2. A genuine `risk_unclassified` band is added for ACTIVE players with no
       established risk classification — never scored (risk_score = 0), never
       wagered (bet_count = 0) and no risk flags. These are NOT silently forced
       into 'low'. `low` now explicitly excludes them.

  The five bands PARTITION the active population, so by construction:
      active_players = risk_critical + risk_high + risk_medium
                       + risk_low + risk_unclassified

  This remains a pure read-model over the certified projection tables — no new
  source of truth, no computed state. `create or replace view` keeps every
  existing column name/type/position; `risk_unclassified` is appended.
*/

create or replace view projection_casino_state as
select
  p.casino_id,
  count(*) filter (where p.status = 'active')                as active_players,
  (select count(*) from projection_session_state s
    where s.casino_id = p.casino_id and s.status = 'active') as active_sessions,
  (select count(*) from projection_machine_state m
    where m.casino_id = p.casino_id and m.status = 'active') as active_machines,
  coalesce(sum(p.total_wagered), 0)                          as total_wagered,
  coalesce(sum(p.total_won), 0)                              as total_won,
  coalesce(sum(p.total_wagered - p.total_won), 0)            as ggr,
  -- Risk bands are now scoped to the ACTIVE population (matches active_players)
  count(*) filter (where p.status = 'active' and p.risk_score >= 80)                        as risk_critical,
  count(*) filter (where p.status = 'active' and p.risk_score >= 60 and p.risk_score < 80)  as risk_high,
  count(*) filter (where p.status = 'active' and p.risk_score >= 40 and p.risk_score < 60)  as risk_medium,
  -- 'low' = actively classified below 40, EXCLUDING never-classified players
  count(*) filter (
    where p.status = 'active' and p.risk_score < 40
      and not (p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb)
  )                                                          as risk_low,
  max(p.last_event_at)                                       as last_event_at,
  -- Unclassified: active but never risk-scored (no score, no wager, no flags)
  count(*) filter (
    where p.status = 'active'
      and p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb
  )                                                          as risk_unclassified
from projection_player_state p
group by p.casino_id;

-- Executive view mirrors the casino state (inherits risk_unclassified via *).
create or replace view projection_executive_state as
select * from projection_casino_state;

-- Regulator rollup — append risk_unclassified LAST (create-or-replace only
-- permits new columns at the end of the existing column list).
create or replace view projection_regulator_state as
select casino_id, active_players, active_sessions, active_machines,
       risk_critical, risk_high, risk_medium, risk_low, last_event_at, risk_unclassified
from projection_casino_state;

-- Re-assert tenant isolation (create-or-replace resets view options; Phase 4.1
-- requires these catalogue views to run as the INVOKER so RLS applies).
alter view projection_casino_state    set (security_invoker = true);
alter view projection_executive_state set (security_invoker = true);
alter view projection_regulator_state set (security_invoker = true);
