/*
  # Widen live_events event_type check constraint (Phase 3.1)

  The original constraint allowed only 11 legacy event types. The simulation
  engine and session lifecycle emit the full lifecycle vocabulary
  (CARD_INSERT → … → MACHINE_IDLE), so lifecycle inserts were failing with
  check-constraint violations. This aligns the constraint with the event
  vocabulary used by the casino-simulator and CasinoDataContext.
*/

alter table live_events drop constraint if exists live_events_event_type_check;

alter table live_events add constraint live_events_event_type_check
  check (event_type = any (array[
    -- legacy
    'BET_PLACED', 'BET_RESULT', 'SESSION_START', 'SESSION_END', 'GAME_SPIN',
    'HAND_PLAYED', 'DEPOSIT', 'WITHDRAWAL', 'TIME_SPENT_UPDATE',
    'MACHINE_ACTIVITY', 'RISK_FLAG',
    -- session lifecycle
    'CARD_INSERT', 'MACHINE_ALLOCATED', 'CASH_OUT', 'CARD_REMOVED', 'MACHINE_IDLE',
    -- risk & intervention
    'RISK_ALERT', 'INTERVENTION_TRIGGERED',
    -- specials
    'JACKPOT', 'MACHINE_FAULT', 'VIP_ACTIVITY', 'SELF_EXCLUSION', 'SECURITY_EVENT'
  ]));
