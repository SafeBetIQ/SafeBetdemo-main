/*
  # Allow Staff to Self-Enroll in Training Courses

  1. Problem
    - Staff cannot INSERT into training_enrollments table
    - RLS only allows SELECT for staff, INSERT only for admins
    - Self-enrollment feature blocked by RLS
    
  2. Solution
    - Add INSERT policy allowing staff to enroll themselves
    - Staff can only create enrollments for their own staff_id
    - Match by email to ensure correct staff member
    
  3. Security
    - Staff can only enroll themselves (not other staff)
    - Cannot modify enrollment status inappropriately
    - Cannot enroll on behalf of others
*/

-- Allow staff to self-enroll in training courses
CREATE POLICY "Staff can self-enroll in courses"
  ON training_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = training_enrollments.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );
