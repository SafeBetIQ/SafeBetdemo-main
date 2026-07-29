/*
  # Enterprise Realtime distribution — final channel (Phase 3.7)

  Phase 3.2 defined the PRIMARY distribution channel as Supabase Realtime on
  casino_event_log itself ("persisting the envelope IS publishing it"). The
  transitional live_events adapter is retired in this phase, so the primary
  channel now needs to reach authenticated consumers:

  1. Authenticated read on casino_event_log — events carry NO PII (anonymous
     SB-PLR ids only); the append-only trigger still forbids UPDATE/DELETE,
     and no client INSERT policy exists (writes remain service-role only via
     the Enterprise Event Platform).
  2. Publication membership so postgres_changes fires for the event log and
     the machine read model (the Consumer Platform's live distribution).
*/

drop policy if exists casino_event_log_read on casino_event_log;
create policy casino_event_log_read on casino_event_log
  for select to authenticated using (true);

do $$
begin
  begin
    alter publication supabase_realtime add table casino_event_log;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table projection_machine_state;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table projection_player_state;
  exception when duplicate_object then null;
  end;
end $$;
