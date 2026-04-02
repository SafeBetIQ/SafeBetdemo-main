/*
  # Restrict Pricing Packages Access to Super Admin Only

  1. Security Changes
    - Remove public viewing access to pricing packages
    - Only super admins can view pricing packages
    - Casinos and regulators can no longer see pricing information

  2. Policy Updates
    - Drop the "Anyone can view active packages" policy
    - Replace with super admin only access for SELECT operations
*/

-- Drop the existing policy that allows anyone to view packages
DROP POLICY IF EXISTS "Anyone can view active packages" ON pricing_packages;

-- Create new policy: Only super admins can view pricing packages
CREATE POLICY "Only super admins can view pricing packages"
  ON pricing_packages FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'super_admin');

-- Verify package_modules policy also restricts access
DROP POLICY IF EXISTS "Anyone can view package modules" ON package_modules;

CREATE POLICY "Only super admins can view package modules"
  ON package_modules FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'super_admin');
