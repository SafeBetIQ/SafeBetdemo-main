/*
  # Fix Revenue Protection RLS for Casino Admins

  ## Problem
  Casino admins in the users table cannot access revenue protection data because
  the RLS policies only check for staff records. Many casino admins don't have
  corresponding staff records.

  ## Solution
  Add additional RLS policies that allow users with role='casino_admin' to
  access their casino's revenue protection data directly through the users table.

  ## Security
  - Policies check both auth.uid() and casino_id match
  - Only allow SELECT operations for casino_admin role
  - Restrictive - only their own casino's data
*/

-- Add policy for casino admins to view their casino's protection events
CREATE POLICY "Casino admins view own casino protection events"
  ON revenue_protection_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'casino_admin'
        AND users.casino_id = revenue_protection_events.casino_id
    )
  );

-- Add policy for casino admins to view their casino's monthly metrics
CREATE POLICY "Casino admins view own casino monthly metrics"
  ON revenue_protection_monthly
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM users 
      WHERE users.id = auth.uid() 
        AND users.role = 'casino_admin'
        AND users.casino_id = revenue_protection_monthly.casino_id
    )
  );

-- Verify policies are created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies added successfully for casino_admin access to RPI data';
  RAISE NOTICE 'Casino admins can now view their own casino revenue protection metrics';
END $$;
