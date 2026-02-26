/*
  # Fix Training Modules Edit Permissions for Super Admin

  1. Changes
    - Add policy allowing super admins to INSERT/UPDATE/DELETE training modules
    - Super admins can manage all training modules (system-wide and casino-specific)
    
  2. Security
    - Maintains existing casino admin policies
    - Adds explicit super admin management policy
    - Ensures proper WITH CHECK clause for UPDATE/INSERT operations
*/

-- Add super admin management policy for training modules
CREATE POLICY "Super admins can manage all training modules"
  ON training_modules
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
