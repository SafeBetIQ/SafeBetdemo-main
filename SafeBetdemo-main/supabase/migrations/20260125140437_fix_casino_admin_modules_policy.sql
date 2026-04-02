/*
  # Fix Casino Admin Policy for Casino Modules

  1. Problem
    - "Casino admins view own" policy checks casino_id = auth.uid()
    - But casino admin user IDs don't equal casino IDs
    - Casino admins have a casino_id field that links to the casino

  2. Solution
    - Fix the policy to properly check the user's casino_id field
    - Use a subquery to get the user's casino_id from the users table

  3. Security
    - Casino admins can only access modules for their assigned casino
    - Maintains proper data isolation
*/

-- Drop the old incorrect policy
DROP POLICY IF EXISTS "Casino admins view own" ON casino_modules;

-- Create the correct policy
CREATE POLICY "Casino admins view own"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'casino_admin'::user_role
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.casino_id = casino_modules.casino_id
    )
  );
