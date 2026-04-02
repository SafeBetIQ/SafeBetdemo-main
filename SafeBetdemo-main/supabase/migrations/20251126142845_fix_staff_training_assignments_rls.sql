-- Fix RLS policies for staff_training_assignments table
-- The FOR ALL policy is causing issues with inserts

-- Drop the existing broad policy
DROP POLICY IF EXISTS "Casino admins can manage assignments" ON staff_training_assignments;

-- Create separate policies for each operation
CREATE POLICY "Casino admins can insert assignments"
  ON staff_training_assignments FOR INSERT
  TO authenticated
  WITH CHECK (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can update assignments"
  ON staff_training_assignments FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can delete assignments"
  ON staff_training_assignments FOR DELETE
  TO authenticated
  USING (casino_id = get_user_casino_id());

-- Update training_assignment_templates policies
DROP POLICY IF EXISTS "Casino admins can manage templates" ON training_assignment_templates;

CREATE POLICY "Casino admins can insert templates"
  ON training_assignment_templates FOR INSERT
  TO authenticated
  WITH CHECK (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can update templates"
  ON training_assignment_templates FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id())
  WITH CHECK (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can delete templates"
  ON training_assignment_templates FOR DELETE
  TO authenticated
  USING (casino_id = get_user_casino_id());

-- Update staff_training_preferences policies  
DROP POLICY IF EXISTS "Staff can update own preferences" ON staff_training_preferences;

CREATE POLICY "Staff can insert own preferences"
  ON staff_training_preferences FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can update own preferences"
  ON staff_training_preferences FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can delete own preferences"
  ON staff_training_preferences FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.id = staff_training_preferences.staff_id 
      AND staff.auth_user_id = auth.uid()
    )
  );
