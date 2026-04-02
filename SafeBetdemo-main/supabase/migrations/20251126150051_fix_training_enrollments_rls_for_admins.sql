/*
  # Fix Training Enrollments RLS for Admins
  
  1. Changes
    - Drop existing overly complex policies
    - Add simple, clear policies for INSERT, UPDATE, DELETE, and SELECT
    - Allow super_admin full access
    - Allow casino_admin access to their casino's staff enrollments
    - Allow staff to view and update their own enrollments
  
  2. Security
    - Super admins can manage all enrollments
    - Casino admins can only manage enrollments for staff in their casino
    - Staff can view and update (but not delete) their own enrollments
*/

-- Drop all existing policies on training_enrollments
DROP POLICY IF EXISTS "Casino admins can manage enrollments" ON training_enrollments;
DROP POLICY IF EXISTS "Staff can manage enrollments" ON training_enrollments;
DROP POLICY IF EXISTS "Staff can self-enroll in courses" ON training_enrollments;
DROP POLICY IF EXISTS "Users can view enrollments" ON training_enrollments;

-- SELECT: Super admins, regulators, casino admins (their casino), and staff (their own)
CREATE POLICY "Allow viewing enrollments"
ON training_enrollments FOR SELECT
TO authenticated
USING (
  is_super_admin() OR 
  is_regulator() OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND (
      staff.casino_id = get_user_casino_id() OR
      staff.auth_user_id = auth.uid()
    )
  )
);

-- INSERT: Super admins can insert any, casino admins can insert for their staff, staff can self-enroll
CREATE POLICY "Allow inserting enrollments"
ON training_enrollments FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND staff.casino_id = get_user_casino_id()
  ) OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND staff.auth_user_id = auth.uid()
  )
);

-- UPDATE: Super admins, casino admins (their casino), and staff (their own)
CREATE POLICY "Allow updating enrollments"
ON training_enrollments FOR UPDATE
TO authenticated
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND (
      staff.casino_id = get_user_casino_id() OR
      staff.auth_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND (
      staff.casino_id = get_user_casino_id() OR
      staff.auth_user_id = auth.uid()
    )
  )
);

-- DELETE: Only super admins and casino admins (their casino) can delete
CREATE POLICY "Allow deleting enrollments"
ON training_enrollments FOR DELETE
TO authenticated
USING (
  is_super_admin() OR
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = training_enrollments.staff_id
    AND staff.casino_id = get_user_casino_id()
  )
);
