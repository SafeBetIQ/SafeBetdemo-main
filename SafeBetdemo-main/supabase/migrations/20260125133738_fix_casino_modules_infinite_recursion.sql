/*
  # Fix Casino Modules Infinite Recursion

  ## Problem
  The casino_modules table has policies that query the staff table, which then
  triggers staff table policies that create infinite recursion.
  
  Error: "infinite recursion detected in policy for relation 'staff'"

  ## Solution
  - Drop all conflicting policies on casino_modules
  - Keep only the clean policies that use SECURITY DEFINER functions
  - These functions bypass RLS and prevent recursion

  ## Changes
  - Remove duplicate and problematic policies
  - Keep only super_admin, regulator, and casino_admin policies that don't recurse
*/

-- Drop ALL existing policies on casino_modules to start clean
DROP POLICY IF EXISTS "Super admins can delete casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Super admins can insert casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Super admins can update casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Super admins can view all casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Super admins manage casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Users can view casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Casino users can view own modules" ON casino_modules;
DROP POLICY IF EXISTS "Regulators can view all casino modules" ON casino_modules;
DROP POLICY IF EXISTS "Casino admins can view own modules" ON casino_modules;

-- Create clean policies using SECURITY DEFINER functions (no recursion)

-- Super admins have full access
CREATE POLICY "Super admins full access"
  ON casino_modules
  FOR ALL
  TO authenticated
  USING (get_current_user_role() = 'super_admin')
  WITH CHECK (get_current_user_role() = 'super_admin');

-- Regulators can view all
CREATE POLICY "Regulators view all"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'regulator');

-- Casino admins can view their own modules (simple check, no staff table query)
CREATE POLICY "Casino admins view own"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    casino_id = auth.uid() 
    AND get_current_user_role() = 'casino_admin'
  );
