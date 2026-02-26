/*
  # Allow Staff to Access Their Own Training Data

  1. Problem
    - Staff cannot view their own enrollments
    - Staff cannot view their own lesson progress
    - RLS policies only check users table (admins)
    - Staff auth users need access to training data
    
  2. Solution
    - Add policies for staff to read their own enrollments
    - Add policies for staff to read/update their own lesson progress
    - Match by email to link auth.users with staff records
    
  3. Security
    - Staff can only access their own training data
    - Cannot view other staff members' data
    - Staff can update their own progress (mark lessons complete)
*/

-- Allow staff to view their own enrollments
CREATE POLICY "Staff can view own enrollments"
  ON training_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = training_enrollments.staff_id
      AND staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow staff to view their own lesson progress
CREATE POLICY "Staff can view own lesson progress"
  ON training_lesson_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM training_enrollments te
      JOIN staff s ON s.id = te.staff_id
      WHERE te.id = training_lesson_progress.enrollment_id
      AND s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow staff to update their own lesson progress (mark lessons complete)
CREATE POLICY "Staff can update own lesson progress"
  ON training_lesson_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM training_enrollments te
      JOIN staff s ON s.id = te.staff_id
      WHERE te.id = training_lesson_progress.enrollment_id
      AND s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM training_enrollments te
      JOIN staff s ON s.id = te.staff_id
      WHERE te.id = training_lesson_progress.enrollment_id
      AND s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Allow staff to insert their own lesson progress
CREATE POLICY "Staff can insert own lesson progress"
  ON training_lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM training_enrollments te
      JOIN staff s ON s.id = te.staff_id
      WHERE te.id = training_lesson_progress.enrollment_id
      AND s.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
