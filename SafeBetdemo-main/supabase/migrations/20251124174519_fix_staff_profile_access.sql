/*
  # Fix Staff Profile Access Using JWT Claims

  1. Problem
    - Current policy references auth.users in subquery
    - RLS engine throws "permission denied for table users"
    - Need simpler policy that doesn't create circular dependencies
    
  2. Solution
    - Use auth.jwt() to get email from JWT token
    - Avoid subquery on auth.users table
    - Direct comparison with JWT claim
    
  3. Security
    - JWT email is cryptographically signed
    - Cannot be spoofed
    - Staff can only access own profile
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Staff can read own profile" ON staff;

-- Create new policy using JWT claims (no subquery needed)
CREATE POLICY "Staff can read own profile"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    email = auth.jwt()->>'email'
  );
