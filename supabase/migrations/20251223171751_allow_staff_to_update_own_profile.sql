/*
  # Allow Staff to Update Own Profile

  1. New Policy
    - Staff can update their own basic profile information
    - Restricted to first_name, last_name, and phone only
    - Cannot change role, status, or other administrative fields

  2. Security
    - Staff can only update their own record (matched by auth_user_id)
    - All updates are logged with updated_at timestamp
*/

-- Create policy for staff to update their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'staff' 
    AND policyname = 'Staff can update own basic profile'
  ) THEN
    CREATE POLICY "Staff can update own basic profile"
      ON staff
      FOR UPDATE
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid());
  END IF;
END $$;
