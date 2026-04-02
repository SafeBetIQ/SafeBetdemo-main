/*
  # Fix Casino Modules Insert/Delete Policies

  ## Problem
  Toggle buttons in casino software modules page are not working for super admins.
  
  ## Solution
  Ensure super admins have explicit INSERT and DELETE policies on casino_modules table
  in addition to the existing FOR ALL policy.

  ## Changes
  - Verify super admin FOR ALL policy exists
  - Add explicit INSERT policy for super admins (if needed)
  - Add explicit DELETE policy for super admins (if needed)
  - Add explicit UPDATE policy for super admins (if needed)
*/

-- Drop and recreate super admin policies to ensure they work correctly
DROP POLICY IF EXISTS "Super admins can manage all casino modules" ON casino_modules;

-- Create comprehensive policies for super admins
CREATE POLICY "Super admins can view all casino modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can insert casino modules"
  ON casino_modules
  FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can update casino modules"
  ON casino_modules
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');

CREATE POLICY "Super admins can delete casino modules"
  ON casino_modules
  FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'super_admin');
