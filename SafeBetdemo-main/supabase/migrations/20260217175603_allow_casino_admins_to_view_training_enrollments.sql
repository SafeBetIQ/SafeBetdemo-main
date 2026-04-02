/*
  # Allow Casino Admins to View Training Enrollments

  1. Changes
    - Add RLS policy to allow casino admins to view training enrollments for staff in their casino
    - This enables the Training Academy tab in the casino dashboard to display data
  
  2. Security
    - Casino admins can only view enrollments for staff in their own casino
    - Maintains data isolation between casinos
*/

-- Allow casino admins to view training enrollments for their casino's staff
CREATE POLICY "Casino admins can view their casino enrollments"
  ON training_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      JOIN staff s ON s.id = training_enrollments.staff_id
      WHERE u.id = auth.uid()
        AND u.role = 'casino_admin'
        AND u.casino_id = s.casino_id
    )
  );

-- Allow super admins to view all enrollments
CREATE POLICY "Super admins can view all enrollments"
  ON training_enrollments
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
