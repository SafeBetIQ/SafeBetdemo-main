/*
  # Allow Casino Admins to View Training Credits

  1. Changes
    - Add RLS policy to allow casino admins to view training credits for staff in their casino
  
  2. Security
    - Casino admins can only view credits for staff in their own casino
*/

-- Allow casino admins to view training credits for their casino's staff
CREATE POLICY "Casino admins can view their casino credits"
  ON training_credits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      JOIN staff s ON s.id = training_credits.staff_id
      WHERE u.id = auth.uid()
        AND u.role = 'casino_admin'
        AND u.casino_id = s.casino_id
    )
  );

-- Allow super admins to view all credits
CREATE POLICY "Super admins can view all training credits"
  ON training_credits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );
