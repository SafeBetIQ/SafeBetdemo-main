/*
  # Fix Casino Admin Training Modules Policy WITH CHECK Clause

  1. Changes
    - Update the "Casino admins can manage training modules" policy to include WITH CHECK clause
    - Ensures proper permission checking for UPDATE and INSERT operations
    
  2. Security
    - Maintains existing data isolation between casinos
    - Ensures casino admins can only manage their casino's modules or system-wide modules
*/

-- Drop and recreate the policy with explicit WITH CHECK clause
DROP POLICY IF EXISTS "Casino admins can manage training modules" ON training_modules;

CREATE POLICY "Casino admins can manage training modules"
  ON training_modules
  FOR ALL
  TO authenticated
  USING (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  )
  WITH CHECK (
    (casino_id = get_user_casino_id() OR casino_id IS NULL) AND
    NOT is_regulator()
  );
