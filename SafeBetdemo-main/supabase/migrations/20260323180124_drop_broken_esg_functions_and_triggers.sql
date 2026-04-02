
/*
  # Drop Broken ESG Functions and Triggers

  The calculate_esg_scores(p_casino_id) function references the dropped
  esg_metrics table. PostgREST validates all functions during schema
  introspection — this invalid reference causes the entire schema cache reload
  to fail. Supabase Auth reports this as "Database error querying schema",
  blocking ALL user logins.

  This migration drops the broken function and any triggers referencing it.
*/

-- Drop the broken calculate_esg_scores that references esg_metrics (dropped table)
DROP FUNCTION IF EXISTS calculate_esg_scores(uuid);

-- Drop the trigger-based calculate_esg_scores (takes no args, used as trigger fn)
-- First find and drop any triggers using it
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND action_statement LIKE '%calculate_esg_scores%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.trigger_name, r.event_object_table);
  END LOOP;
END $$;

-- Now drop the trigger function version
DROP FUNCTION IF EXISTS calculate_esg_scores();
