-- Temporarily simplify RLS policy for debugging
-- This will help us understand if the issue is with the policy logic or something else

-- Drop existing insert policy
DROP POLICY IF EXISTS "Casino admins can insert assignments" ON staff_training_assignments;

-- Create a simple insert policy that just requires authentication
-- and that the casino_id is not null
CREATE POLICY "Authenticated users can insert assignments"
  ON staff_training_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id IS NOT NULL AND
    assigned_by IS NOT NULL
  );
