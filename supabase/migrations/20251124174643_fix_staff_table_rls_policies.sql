/*
  # Fix Staff Table RLS Policies to Handle Non-Admin Users

  1. Problem
    - Old admin policies fail when staff (non-admins) query the table
    - EXISTS subqueries on users table fail for users not in that table
    - RLS treats any policy failure as permission denied
    
  2. Solution
    - Make admin policies return false gracefully instead of failing
    - Use LEFT JOIN or check if user exists first
    - Allow policies to evaluate without errors
    
  3. Impact
    - Staff can query their own records without triggering admin policy errors
    - Admins can still manage staff as before
    - No permission denied errors
*/

-- Drop and recreate the admin policies to handle non-admin users gracefully
DROP POLICY IF EXISTS "Casino admins can view their staff" ON staff;
DROP POLICY IF EXISTS "Casino admins can manage their staff" ON staff;

-- Recreated policy for viewing - returns false if user not in users table (not an error)
CREATE POLICY "Casino admins can view their staff"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = ANY (ARRAY['super_admin'::user_role, 'regulator'::user_role])
        OR (users.role = 'casino_admin'::user_role AND users.casino_id = staff.casino_id)
      )
    )
  );

-- Recreated policy for managing - returns false if user not in users table (not an error)
CREATE POLICY "Casino admins can manage their staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role = 'super_admin'::user_role
        OR (users.role = 'casino_admin'::user_role AND users.casino_id = staff.casino_id)
      )
    )
  );
