/*
  # Fix Remaining Broken staff.id = auth.uid() Policies

  Several policies still use staff.id = auth.uid() which is incorrect.
  Staff records are linked to auth users via staff.auth_user_id, not staff.id.
  These broken subqueries cause PostgREST schema cache corruption,
  producing "Database error querying schema" for all logins.

  Tables fixed:
  - gaming_sessions: "Casino staff and admins view sessions"
  - players: "Casino staff and admins view players"
  - revenue_protection_events: "Casino staff and admins view events"
  - revenue_protection_monthly: "Casino staff and admins view monthly metrics"
*/

-- gaming_sessions
DROP POLICY IF EXISTS "Casino staff and admins view sessions" ON gaming_sessions;
CREATE POLICY "Casino staff and admins view sessions"
  ON gaming_sessions FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
    OR casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
  );

-- players
DROP POLICY IF EXISTS "Casino staff and admins view players" ON players;
CREATE POLICY "Casino staff and admins view players"
  ON players FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
    OR casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
  );

-- revenue_protection_events (drop the old broken duplicate)
DROP POLICY IF EXISTS "Casino staff and admins view events" ON revenue_protection_events;
CREATE POLICY "Casino staff and admins view events"
  ON revenue_protection_events FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
    OR casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
  );

-- revenue_protection_monthly
DROP POLICY IF EXISTS "Casino staff and admins view monthly metrics" ON revenue_protection_monthly;
CREATE POLICY "Casino staff and admins view monthly metrics"
  ON revenue_protection_monthly FOR SELECT TO authenticated
  USING (
    casino_id IN (SELECT u.casino_id FROM users u WHERE u.id = auth.uid())
    OR casino_id IN (SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid())
  );
