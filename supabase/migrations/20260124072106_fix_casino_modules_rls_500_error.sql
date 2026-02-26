/*
  # Fix Casino Modules RLS 500 Error

  1. Problem
    - RLS policies on casino_modules are causing 500 errors
    - EXISTS queries on users table may be causing recursion or performance issues

  2. Solution
    - Create helper function with SECURITY DEFINER to check user roles
    - Simplify RLS policies to use the helper function
    - Add proper indexes for performance

  3. Changes
    - Drop existing policies on casino_modules
    - Create get_current_user_role() helper function
    - Create simplified RLS policies using the helper
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Casino admins can view own modules" ON casino_modules;
DROP POLICY IF EXISTS "Regulators can view all casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Super admins can manage casino modules" ON casino_modules;

-- Create a secure function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT role INTO user_role_val
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role_val;
END;
$$;

-- Create simplified RLS policies
CREATE POLICY "Super admins can manage all casino modules"
  ON casino_modules
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');

CREATE POLICY "Regulators can view all casino modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'regulator');

CREATE POLICY "Casino admins can view own modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    casino_id = auth.uid() 
    OR 
    casino_id IN (
      SELECT casino_id 
      FROM staff 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_casino_modules_casino_id ON casino_modules(casino_id);
CREATE INDEX IF NOT EXISTS idx_casino_modules_module_id ON casino_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_casino_modules_lookup ON casino_modules(casino_id, module_id);