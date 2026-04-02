/*
  # Cleanup Duplicate Staff Policy

  1. Summary
    Removes duplicate RLS policy on staff table left over from previous migration

  2. Changes
    - Drop old "Users can view staff" policy
    - Keep the newer "Users can view staff profiles" policy which is more optimized
*/

DROP POLICY IF EXISTS "Users can view staff" ON staff;
