/*
  # Use Security Definer Function for Staff Table Policies

  1. Problem
    - RLS policies on staff table check users table
    - When staff members query, policies try to check if they're admins
    - Even though query should return false, RLS evaluation may fail
    
  2. Solution
    - Create security definer function to check if user is admin
    - Function bypasses RLS on users table
    - Policies use function instead of direct subquery
    
  3. Security
    - Function only checks, doesn't modify data
    - Staff still can only see own profile
    - Admins still have full access
*/

-- Create function to check if current user is an admin who can view this staff member
CREATE OR REPLACE FUNCTION public.can_user_view_staff(staff_casino_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
    AND (
      users.role = ANY (ARRAY['super_admin'::user_role, 'regulator'::user_role])
      OR (users.role = 'casino_admin'::user_role AND users.casino_id = staff_casino_id)
    )
  );
$$;

-- Create function to check if current user is an admin who can manage this staff member
CREATE OR REPLACE FUNCTION public.can_user_manage_staff(staff_casino_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = auth.uid()
    AND (
      users.role = 'super_admin'::user_role
      OR (users.role = 'casino_admin'::user_role AND users.casino_id = staff_casino_id)
    )
  );
$$;

-- Drop and recreate policies using the security definer functions
DROP POLICY IF EXISTS "Casino admins can view their staff" ON staff;
DROP POLICY IF EXISTS "Casino admins can manage their staff" ON staff;

-- Policy for viewing staff
CREATE POLICY "Casino admins can view their staff"
  ON staff
  FOR SELECT
  TO authenticated
  USING (
    can_user_view_staff(casino_id)
  );

-- Policy for managing staff
CREATE POLICY "Casino admins can manage their staff"
  ON staff
  FOR ALL
  TO authenticated
  USING (
    can_user_manage_staff(casino_id)
  );
