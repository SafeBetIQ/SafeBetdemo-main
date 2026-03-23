
/*
  # Fix casino_modules "Casino admins view own" policy

  The existing policy incorrectly joins staff using staff.id = auth.uid()
  but staff records are linked via staff.auth_user_id. This causes a schema
  introspection error for casino admin users when PostgREST tries to execute
  the policy.

  Fix: Drop and recreate the policy using auth_user_id for staff lookup.
*/

DROP POLICY IF EXISTS "Casino admins view own" ON casino_modules;

CREATE POLICY "Casino admins view own"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id FROM users u WHERE u.id = auth.uid()
    )
    OR
    casino_id IN (
      SELECT s.casino_id FROM staff s WHERE s.auth_user_id = auth.uid()
    )
  );
