
/*
  # Enable Realtime on gaming_sessions and players tables

  Adds both tables to the Supabase Realtime publication so that
  frontends subscribed via supabase-js receive live push updates
  on every INSERT, UPDATE, and DELETE — no polling required.

  ## Tables enabled for Realtime
  - gaming_sessions: fires on every session start, bet update, and session end
  - players: fires when risk_score, risk_level, or last_active changes
*/

ALTER PUBLICATION supabase_realtime ADD TABLE gaming_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
