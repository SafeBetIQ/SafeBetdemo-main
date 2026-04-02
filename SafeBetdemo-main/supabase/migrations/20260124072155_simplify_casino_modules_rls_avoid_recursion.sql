/*
  # Simplify Casino Modules RLS to Avoid Recursion

  1. Problem
    - Casino modules policy queries staff table
    - Staff table has complex policies that query users table
    - This creates nested queries causing 500 errors

  2. Solution
    - Create a helper function with SECURITY DEFINER to get user's casino_id
    - Use this function in the RLS policy to avoid nested lookups

  3. Changes
    - Create get_user_casino_id() helper function
    - Simplify casino_modules RLS policy
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Casino admins can view own modules" ON casino_modules;

-- Create helper function to get user's casino_id (either as casino admin or staff)
CREATE OR REPLACE FUNCTION get_user_casino_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_casino_id uuid;
  v_role user_role;
BEGIN
  -- First check if user is a casino admin
  SELECT role INTO v_role
  FROM users
  WHERE id = auth.uid();
  
  IF v_role = 'casino_admin' THEN
    RETURN auth.uid();
  END IF;
  
  -- If not casino admin, check if they're staff
  SELECT casino_id INTO v_casino_id
  FROM staff
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  
  RETURN v_casino_id;
END;
$$;

-- Create simplified policy using the helper function
CREATE POLICY "Casino users can view own modules"
  ON casino_modules
  FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() IN ('super_admin', 'regulator')
    OR 
    casino_id = auth.uid()
    OR
    casino_id = get_user_casino_id()
  );