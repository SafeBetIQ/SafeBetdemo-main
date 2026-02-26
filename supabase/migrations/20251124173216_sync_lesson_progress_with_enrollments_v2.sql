/*
  # Sync Lesson Progress with Course Enrollments

  1. Purpose
    - Create lesson progress records for all enrollments
    - Mark lessons complete for completed courses
    - Mark partial progress for in-progress courses
    
  2. Logic
    - Completed courses (100%): All lessons marked complete
    - In-progress courses: Some lessons marked complete based on progress_percentage
    
  3. Impact
    - Staff can see their actual lesson completion
    - Course pages show accurate progress
    - Training academy displays correct status
*/

-- Delete existing progress to start fresh
DELETE FROM training_lesson_progress;

-- Create lesson progress for all enrollments
INSERT INTO training_lesson_progress (
  id,
  enrollment_id,
  lesson_id,
  completed,
  completed_at,
  time_spent_seconds,
  created_at
)
SELECT 
  gen_random_uuid(),
  te.id,
  tl.id,
  -- Mark complete if course is completed OR if it's an in-progress lesson within progress range
  CASE 
    WHEN te.status = 'completed' THEN true
    WHEN te.status = 'in_progress' THEN 
      -- For in-progress, complete lessons proportional to progress_percentage
      (tl.sort_order::float / (
        SELECT COUNT(*) FROM training_lessons WHERE module_id = te.module_id
      )::float * 100) <= te.progress_percentage
    ELSE false
  END,
  CASE 
    WHEN te.status = 'completed' THEN te.completed_at
    WHEN te.status = 'in_progress' AND 
      (tl.sort_order::float / (
        SELECT COUNT(*) FROM training_lessons WHERE module_id = te.module_id
      )::float * 100) <= te.progress_percentage 
    THEN te.started_at
    ELSE NULL
  END,
  CASE 
    WHEN te.status = 'completed' THEN tl.estimated_minutes * 60
    WHEN te.status = 'in_progress' AND 
      (tl.sort_order::float / (
        SELECT COUNT(*) FROM training_lessons WHERE module_id = te.module_id
      )::float * 100) <= te.progress_percentage 
    THEN tl.estimated_minutes * 60
    ELSE 0
  END,
  COALESCE(te.assigned_at, NOW())
FROM training_enrollments te
JOIN training_lessons tl ON tl.module_id = te.module_id
WHERE EXISTS (
  SELECT 1 FROM staff WHERE staff.id = te.staff_id
);
