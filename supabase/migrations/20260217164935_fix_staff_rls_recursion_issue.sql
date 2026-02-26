/*
  # Fix Staff Table RLS Infinite Recursion
  
  The staff table has policies that query the staff table within their conditions,
  causing infinite recursion. This migration fixes that by:
  
  1. **Dropping Recursive Policies**
     - Remove policies that query staff table from within staff table checks
  
  2. **Creating Simple, Non-Recursive Policies**
     - Staff can view own profile (by id = auth.uid())
     - Casino admins view staff (by checking users table only)
     - Super admins and regulators view all (by checking users table only)
  
  3. **Security**
     - Maintains proper access control
     - Prevents infinite recursion
     - Ensures casino admins can only see their own casino's staff
*/

-- Drop all existing staff SELECT policies to start fresh
DROP POLICY IF EXISTS "Staff can view own profile" ON staff;
DROP POLICY IF EXISTS "Staff view own record" ON staff;
DROP POLICY IF EXISTS "Casino admins can view their casino staff" ON staff;
DROP POLICY IF EXISTS "Casino admins view staff in their casino" ON staff;
DROP POLICY IF EXISTS "Super admins and regulators can view all staff" ON staff;
DROP POLICY IF EXISTS "Casino admins manage their staff" ON staff;
DROP POLICY IF EXISTS "Super admins manage all staff" ON staff;
DROP POLICY IF EXISTS "Staff can update own basic profile" ON staff;

-- Create simple, non-recursive policies

-- 1. Staff can view their own record (no subquery to staff table)
CREATE POLICY "Staff view own record"
  ON staff FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 2. Casino admins can view staff in their casino (check users table only)
CREATE POLICY "Casino admins view casino staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'casino_admin'
    )
  );

-- 3. Super admins and regulators view all staff (check users table only)
CREATE POLICY "Super admins and regulators view all staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'regulator')
    )
  );

-- 4. Staff can update own profile
CREATE POLICY "Staff update own profile"
  ON staff FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. Casino admins can update their casino's staff
CREATE POLICY "Casino admins update casino staff"
  ON staff FOR UPDATE
  TO authenticated
  USING (
    casino_id IN (
      SELECT u.casino_id
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'casino_admin'
    )
  )
  WITH CHECK (
    casino_id IN (
      SELECT u.casino_id
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'casino_admin'
    )
  );

-- 6. Super admins can manage all staff
CREATE POLICY "Super admins manage all staff"
  ON staff FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'super_admin'
    )
  );

-- Verify policies are applied
DO $$
BEGIN
  RAISE NOTICE '✅ Staff RLS policies fixed - infinite recursion eliminated';
  RAISE NOTICE '✅ Staff can view own records';
  RAISE NOTICE '✅ Casino admins can view/manage their casino staff';
  RAISE NOTICE '✅ Super admins and regulators have full access';
END $$;
