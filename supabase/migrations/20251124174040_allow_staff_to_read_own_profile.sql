/*
  # Allow Staff to Read Their Own Profile

  1. Problem
    - Staff members cannot read their own profile data
    - RLS policies only allow casino admins and super admins
    - Staff login works but profile fetch fails
    
  2. Solution
    - Add RLS policy for staff to read their own record
    - Match by email (since staff records are matched by email in auth)
    
  3. Security
    - Staff can only read their own data
    - Cannot modify or view other staff members
    - Read-only access
*/

-- Allow staff to read their own profile by matching email
CREATE POLICY "Staff can read own profile"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
