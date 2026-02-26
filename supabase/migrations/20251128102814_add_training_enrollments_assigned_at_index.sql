/*
  # Add index for faster ordering on training_enrollments
  
  1. Performance
    - Add index on `assigned_at` column for faster ORDER BY queries
    - This will speed up the staff academy page loading
*/

-- Add index for ordering by assigned_at
CREATE INDEX IF NOT EXISTS idx_training_enrollments_assigned_at 
  ON training_enrollments (assigned_at DESC);

-- Add composite index for common query pattern (staff_id + assigned_at)
CREATE INDEX IF NOT EXISTS idx_training_enrollments_staff_assigned 
  ON training_enrollments (staff_id, assigned_at DESC);
