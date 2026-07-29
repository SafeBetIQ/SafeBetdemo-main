/*
  # Certified Player & Machine Activity Posture

  ROOT CAUSE (players/machines active indefinitely):
  projection_player_state.status and projection_machine_state.status are
  persistent flags set 'active' by open events (SESSION_START / CARD_INSERT /
  MACHINE_ALLOCATED) and only ever reset by close/release events
  (SESSION_END / CARD_REMOVED / MACHINE_IDLE) — which the certified stream
  never produces. So 151/151 players and 71/71 machines read 'active' even
  though 100% have had NO activity in > 4 hours (freshest 287 min ago).

  FIX (additive, freshness-derived; reuses session_lifecycle_policy windows):
  We do NOT change active_players / active_machines (the player-risk and
  session reconciliations depend on them). Instead we ADD a certified live
  ACTIVITY POSTURE derived from last_event_at freshness, which PARTITIONS the
  active population:
      players_active_now + players_idle + players_stale = active_players
      machines_in_play  + machines_stale                = active_machines
  active_players / active_machines are retained as the OBSERVED active
  population (the risk-band population); the posture columns tell the honest
  live story (currently 0 fresh, all stale while the simulator is idle).

  Unsupported machine states (offline / faulted / disconnected) are NOT
  fabricated — the certified event model has no telemetry/fault/disconnect
  events, so only activity-freshness posture is derived. Account/eligibility
  state (blocked / self-excluded) lives outside these projections and is not
  conflated with live activity here.

  No source events are deleted; no totals are forced. Risk bands and session
  posture columns are unchanged. security_invoker preserved.
*/

create or replace view projection_casino_state as
select
  p.casino_id,
  count(*) filter (where p.status = 'active')                as active_players,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'active') as active_sessions,
  (select count(*) from projection_machine_state m
     where m.casino_id = p.casino_id and m.status = 'active') as active_machines,
  coalesce(sum(p.total_wagered), 0)                          as total_wagered,
  coalesce(sum(p.total_won), 0)                              as total_won,
  coalesce(sum(p.total_wagered - p.total_won), 0)            as ggr,
  count(*) filter (where p.status = 'active' and p.risk_score >= 80)                        as risk_critical,
  count(*) filter (where p.status = 'active' and p.risk_score >= 60 and p.risk_score < 80)  as risk_high,
  count(*) filter (where p.status = 'active' and p.risk_score >= 40 and p.risk_score < 60)  as risk_medium,
  count(*) filter (
    where p.status = 'active' and p.risk_score < 40
      and not (p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb)
  )                                                          as risk_low,
  max(p.last_event_at)                                       as last_event_at,
  count(*) filter (
    where p.status = 'active'
      and p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb
  )                                                          as risk_unclassified,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'idle')  as idle_sessions,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'stale') as stale_sessions,
  (select count(*) from projection_session_state s
     where s.casino_id = p.casino_id and s.status = 'active')   as open_sessions,
  -- ── Player activity posture (partitions active_players by freshness) ──
  count(*) filter (
    where p.status = 'active'
      and p.last_event_at >= now() - make_interval(mins => (select idle_after_minutes  from sbiq_session_policy(p.casino_id)))
  )                                                          as players_active_now,
  count(*) filter (
    where p.status = 'active'
      and p.last_event_at <  now() - make_interval(mins => (select idle_after_minutes  from sbiq_session_policy(p.casino_id)))
      and p.last_event_at >= now() - make_interval(mins => (select stale_after_minutes from sbiq_session_policy(p.casino_id)))
  )                                                          as players_idle,
  count(*) filter (
    where p.status = 'active'
      and (p.last_event_at is null
           or p.last_event_at < now() - make_interval(mins => (select stale_after_minutes from sbiq_session_policy(p.casino_id))))
  )                                                          as players_stale,
  -- ── Machine activity posture (partitions active_machines by freshness) ──
  (select count(*) from projection_machine_state m
     where m.casino_id = p.casino_id and m.status = 'active'
       and m.last_event_at >= now() - make_interval(mins => (select idle_after_minutes from sbiq_session_policy(p.casino_id)))) as machines_in_play,
  (select count(*) from projection_machine_state m
     where m.casino_id = p.casino_id and m.status = 'active'
       and (m.last_event_at is null
            or m.last_event_at < now() - make_interval(mins => (select idle_after_minutes from sbiq_session_policy(p.casino_id))))) as machines_stale,
  (select count(*) from projection_machine_state m
     where m.casino_id = p.casino_id) as registered_machines
from projection_player_state p
group by p.casino_id;

alter view projection_casino_state set (security_invoker = true);
