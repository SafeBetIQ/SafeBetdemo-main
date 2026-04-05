-- Fix: Drop FK and UNIQUE constraints blocking the AI risk engine from inserting data.
--
-- Root cause: behavioral_risk_profiles had:
--   1. FK player_id → players(id)  — simulated/external player UUIDs don't exist in players table
--   2. UNIQUE(player_id, casino_id) — prevents append-only history (one row per analysis run)
--
-- intervention_history had:
--   1. FK player_id → players(id)  — same issue
--
-- These caused every INSERT from the risk-engine edge function to fail silently (caught by
-- EXCEPTION WHEN OTHERS in the trigger), so no new profiles were created after March 25.

ALTER TABLE behavioral_risk_profiles DROP CONSTRAINT IF EXISTS behavioral_risk_profiles_player_id_fkey;
ALTER TABLE behavioral_risk_profiles DROP CONSTRAINT IF EXISTS brp_player_casino_unique;
ALTER TABLE intervention_history     DROP CONSTRAINT IF EXISTS intervention_history_player_id_fkey;

-- Enable REPLICA IDENTITY FULL so Supabase Realtime column-level filters (casino_id=eq.X)
-- work correctly for all three live tables.
ALTER TABLE behavioral_risk_profiles REPLICA IDENTITY FULL;
ALTER TABLE intervention_history     REPLICA IDENTITY FULL;
ALTER TABLE live_events              REPLICA IDENTITY FULL;
