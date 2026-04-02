/*
  # Fix Casino Modules RLS Infinite Recursion

  1. Problem
    - The staff policy on casino_modules causes infinite recursion
    - When checking staff table, it triggers staff RLS which may call back

  2. Solution
    - Create a SECURITY DEFINER function to check if user is staff for a casino
    - This bypasses RLS on the staff table lookup
    - Update the policy to use this function

  3. Security
    - Function only returns boolean, no sensitive data exposed
    - Still maintains proper access control
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Staff view own casino modules" ON casino_modules;

-- Create a helper function that bypasses RLS for staff lookup
CREATE OR REPLACE FUNCTION is_staff_for_casino(p_casino_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff
    WHERE staff.auth_user_id = auth.uid()
    AND staff.casino_id = p_casino_id
  );
$$;

-- Recreate the policy using the helper function
CREATE POLICY "Staff view own casino modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (is_staff_for_casino(casino_id));
