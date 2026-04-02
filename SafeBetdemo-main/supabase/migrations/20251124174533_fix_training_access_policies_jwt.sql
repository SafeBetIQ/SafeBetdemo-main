/*
  # Fix Training Access Policies Using JWT Claims

  1. Problem
    - Training policies use subqueries on auth.users
    - May cause "permission denied" errors
    - Need simpler approach without table references
    
  2. Solution
    - Use auth.jwt()->>'email' for all policies
    - Direct email comparison without subqueries
    - Avoids circular RLS dependencies
    
  3. Impact
    - Staff can access training data reliably
    - No permission denied errors
    - Cleaner, more efficient policies
*/

-- Drop old policies
DROP POLICY IF EXISTS "Staff can view own enrollments" ON training_enrollments;
DROP POLICY IF EXISTS "Staff can view own lesson progress" ON training_lesson_progress;
DROP POLICY IF EXISTS "Staff can update own lesson progress" ON training_lesson_progress;
DROP POLICY IF EXISTS "Staff can insert own lesson progress" ON training_lesson_progress;

-- Create new policies using JWT email
CREATE POLICY "Staff can view own enrollments"
  ON training_enrollments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.id = training_enrollments.staff_id
      AND staff.email = auth.jwt()->>'email'
    )
  );

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
      AND s.email = auth.jwt()->>'email'
    )
  );

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
      AND s.email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM training_enrollments te
      JOIN staff s ON s.id = te.staff_id
      WHERE te.id = training_lesson_progress.enrollment_id
      AND s.email = auth.jwt()->>'email'
    )
  );

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
      AND s.email = auth.jwt()->>'email'
    )
  );
