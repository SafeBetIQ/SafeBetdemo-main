/*
  # Fix Staff Table RLS Infinite Recursion
  
  ## Summary
  Fixes infinite recursion error in staff table RLS policies
  
  ## Problem
  The existing "Users can view staff profiles" and "Users can view staff" policies
  reference the staff table within staff table policies, causing infinite recursion.
  
  ## Solution
  Simplify policies to avoid circular references:
  - Staff can view their own profile (using auth_user_id)
  - Super admins and regulators can view all staff (using users table only)
  - Casino admins can view staff from their casino (using users table only)
  - No staff-to-staff lookups to avoid recursion
  
  ## Security
  All policies remain restrictive:
  - Staff only see their own profile
  - Casino admins only see staff from their own casino  
  - Super admins and regulators see all staff
*/

-- Drop all existing staff SELECT policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view staff profiles" ON staff;
DROP POLICY IF EXISTS "Users can view staff" ON staff;
DROP POLICY IF EXISTS "Staff can read own profile" ON staff;

-- Create clean, non-recursive policies
CREATE POLICY "Staff can view own profile"
  ON staff FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Super admins and regulators can view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

CREATE POLICY "Casino admins can view their casino staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'casino_admin'
      AND users.casino_id = staff.casino_id
    )
  );

-- Keep the existing ALL policy for casino admins to manage their staff
-- This already exists and works correctly
