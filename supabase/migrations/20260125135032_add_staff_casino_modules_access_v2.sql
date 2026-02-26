/*
  # Add Staff Access to Casino Modules

  1. Changes
    - Add RLS policy for staff users to view their casino's modules
    - Staff members are identified by existence in the staff table, not by role

  2. Security
    - Staff can only view modules for their assigned casino
    - Uses the staff table to determine casino ownership
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Staff view own casino modules" ON casino_modules;

-- Add policy for staff to view their casino's modules
CREATE POLICY "Staff view own casino modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM staff 
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = casino_modules.casino_id
    )
  );
