/*
  # Enable Realtime on risk engine output tables

  Adds behavioral_risk_profiles and intervention_history to the
  supabase_realtime publication so the frontend can subscribe to
  INSERT events and show AI risk scores + triggered interventions live.

  Idempotent — safe to run multiple times.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'behavioral_risk_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE behavioral_risk_profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'intervention_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE intervention_history;
  END IF;
END $$;
