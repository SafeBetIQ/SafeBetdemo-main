/*
  # Enable Realtime on live_events and machine_activity

  live_events was never added to the supabase_realtime publication.
  This means every INSERT from the casino-simulator Edge Function was
  invisible to the frontend — Postgres Changes subscriptions never fired.

  machine_activity is also added so the Machine Monitor panel updates live.
*/

DO $$
BEGIN
  -- live_events
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_events;
  END IF;

  -- machine_activity
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'machine_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE machine_activity;
  END IF;
END $$;
