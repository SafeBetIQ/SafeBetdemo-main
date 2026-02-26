/*
  # Seed Academy Demo Data

  Creates:
  - Demo staff members for different casinos
  - Staff auth accounts
  - Course enrollments
  - Progress tracking (completed and in-progress)
  - Training credits
*/

-- Get the first casino for demo
DO $$
DECLARE
  v_casino_id uuid;
  v_staff1_id uuid;
  v_staff2_id uuid;
  v_staff3_id uuid;
  v_staff4_id uuid;
  v_module1_id uuid;
  v_module2_id uuid;
  v_module3_id uuid;
  v_module4_id uuid;
  v_module5_id uuid;
  v_enrollment_id uuid;
BEGIN
  -- Get first casino
  SELECT id INTO v_casino_id FROM casinos LIMIT 1;

  IF v_casino_id IS NULL THEN
    RAISE NOTICE 'No casino found. Please create a casino first.';
    RETURN;
  END IF;

  -- Create Staff Member 1: Completed courses
  INSERT INTO staff (id, casino_id, first_name, last_name, email, role, status)
  VALUES (
    gen_random_uuid(),
    v_casino_id,
    'Sarah',
    'Johnson',
    'sarah.johnson@demo.casino',
    'frontline',
    'active'
  )
  RETURNING id INTO v_staff1_id;

  -- Create Staff Member 2: In progress
  INSERT INTO staff (id, casino_id, first_name, last_name, email, role, status)
  VALUES (
    gen_random_uuid(),
    v_casino_id,
    'Michael',
    'Chen',
    'michael.chen@demo.casino',
    'vip_host',
    'active'
  )
  RETURNING id INTO v_staff2_id;

  -- Create Staff Member 3: Just started
  INSERT INTO staff (id, casino_id, first_name, last_name, email, role, status)
  VALUES (
    gen_random_uuid(),
    v_casino_id,
    'Emily',
    'Rodriguez',
    'emily.rodriguez@demo.casino',
    'manager',
    'active'
  )
  RETURNING id INTO v_staff3_id;

  -- Create Staff Member 4: Multiple courses in progress
  INSERT INTO staff (id, casino_id, first_name, last_name, email, role, status)
  VALUES (
    gen_random_uuid(),
    v_casino_id,
    'David',
    'Williams',
    'david.williams@demo.casino',
    'compliance_officer',
    'active'
  )
  RETURNING id INTO v_staff4_id;

  -- Get some training modules
  SELECT id INTO v_module1_id FROM training_modules WHERE title = 'Understanding Problem Gambling' LIMIT 1;
  SELECT id INTO v_module2_id FROM training_modules WHERE title = 'Recognizing Early Warning Signs' LIMIT 1;
  SELECT id INTO v_module3_id FROM training_modules WHERE title = 'AML Basics for Casino Staff' LIMIT 1;
  SELECT id INTO v_module4_id FROM training_modules WHERE title = 'Dealing with Intoxicated Players' LIMIT 1;
  SELECT id INTO v_module5_id FROM training_modules WHERE title = 'VIP Relationship Management' LIMIT 1;

  -- Staff 1 Enrollments (2 completed, 1 in progress)
  -- Completed Course 1
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, completed_at, progress_percentage)
  VALUES (
    v_staff1_id,
    v_module1_id,
    'completed',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '8 days',
    100
  )
  RETURNING id INTO v_enrollment_id;

  -- Add lesson progress for completed course
  INSERT INTO training_lesson_progress (enrollment_id, lesson_id, completed, completed_at, time_spent_seconds)
  SELECT v_enrollment_id, id, true, NOW() - INTERVAL '8 days', 600
  FROM training_lessons
  WHERE module_id = v_module1_id
  LIMIT 3;

  -- Award credits
  INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
  SELECT v_staff1_id, v_module1_id, v_enrollment_id, credits_awarded
  FROM training_modules WHERE id = v_module1_id;

  -- Completed Course 2
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, completed_at, progress_percentage)
  VALUES (
    v_staff1_id,
    v_module2_id,
    'completed',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '5 days',
    100
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO training_lesson_progress (enrollment_id, lesson_id, completed, completed_at, time_spent_seconds)
  SELECT v_enrollment_id, id, true, NOW() - INTERVAL '5 days', 480
  FROM training_lessons
  WHERE module_id = v_module2_id
  LIMIT 3;

  INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
  SELECT v_staff1_id, v_module2_id, v_enrollment_id, credits_awarded
  FROM training_modules WHERE id = v_module2_id;

  -- In Progress Course
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff1_id,
    v_module3_id,
    'in_progress',
    NOW() - INTERVAL '2 days',
    60
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO training_lesson_progress (enrollment_id, lesson_id, completed, completed_at, time_spent_seconds)
  SELECT v_enrollment_id, id, true, NOW() - INTERVAL '1 day', 540
  FROM training_lessons
  WHERE module_id = v_module3_id
  LIMIT 2;

  -- Staff 2 Enrollments (1 completed, 2 in progress)
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, completed_at, progress_percentage)
  VALUES (
    v_staff2_id,
    v_module1_id,
    'completed',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '12 days',
    100
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO training_lesson_progress (enrollment_id, lesson_id, completed, completed_at, time_spent_seconds)
  SELECT v_enrollment_id, id, true, NOW() - INTERVAL '12 days', 600
  FROM training_lessons
  WHERE module_id = v_module1_id
  LIMIT 3;

  INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
  SELECT v_staff2_id, v_module1_id, v_enrollment_id, credits_awarded
  FROM training_modules WHERE id = v_module1_id;

  -- In progress courses for Staff 2
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff2_id,
    v_module4_id,
    'in_progress',
    NOW() - INTERVAL '3 days',
    40
  );

  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff2_id,
    v_module5_id,
    'in_progress',
    NOW() - INTERVAL '1 day',
    20
  );

  -- Staff 3 Enrollments (just started)
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff3_id,
    v_module1_id,
    'in_progress',
    NOW() - INTERVAL '1 day',
    15
  );

  -- Staff 4 Enrollments (compliance officer with multiple courses)
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, completed_at, progress_percentage)
  VALUES (
    v_staff4_id,
    v_module1_id,
    'completed',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '18 days',
    100
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
  SELECT v_staff4_id, v_module1_id, v_enrollment_id, credits_awarded
  FROM training_modules WHERE id = v_module1_id;

  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, completed_at, progress_percentage)
  VALUES (
    v_staff4_id,
    v_module3_id,
    'completed',
    NOW() - INTERVAL '16 days',
    NOW() - INTERVAL '14 days',
    100
  )
  RETURNING id INTO v_enrollment_id;

  INSERT INTO training_credits (staff_id, module_id, enrollment_id, credits_earned)
  SELECT v_staff4_id, v_module3_id, v_enrollment_id, credits_awarded
  FROM training_modules WHERE id = v_module3_id;

  -- Multiple in progress for Staff 4
  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff4_id,
    v_module2_id,
    'in_progress',
    NOW() - INTERVAL '5 days',
    75
  );

  INSERT INTO training_enrollments (staff_id, module_id, status, started_at, progress_percentage)
  VALUES (
    v_staff4_id,
    v_module4_id,
    'in_progress',
    NOW() - INTERVAL '2 days',
    30
  );

  RAISE NOTICE 'Demo staff and enrollments created successfully!';
  RAISE NOTICE 'Demo accounts: sarah.johnson@demo.casino, michael.chen@demo.casino, emily.rodriguez@demo.casino, david.williams@demo.casino';
END $$;
