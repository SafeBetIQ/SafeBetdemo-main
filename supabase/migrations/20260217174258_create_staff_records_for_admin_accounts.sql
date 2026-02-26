/*
  # Create Staff Records for Admin Accounts

  1. Changes
    - Creates staff records for admin accounts that don't have them
    - Links them to their respective casinos
    - Assigns appropriate roles
  
  2. Security
    - No RLS changes needed
*/

-- Create staff record for Golden Dragon admin
INSERT INTO staff (
  id,
  auth_user_id,
  casino_id,
  first_name,
  last_name,
  email,
  role,
  user_role,
  status,
  hire_date,
  created_at
)
SELECT 
  gen_random_uuid(),
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  c.id,
  'Admin',
  'Golden Dragon',
  'admin@goldendragon.safebetiq.com',
  'manager'::staff_role,
  'EXECUTIVE'::user_role_type,
  'active'::staff_status,
  '2024-01-01',
  now()
FROM casinos c
WHERE c.name = 'Golden Dragon Gaming'
AND NOT EXISTS (
  SELECT 1 FROM staff 
  WHERE auth_user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

-- Create staff record for Royal Palace admin
INSERT INTO staff (
  id,
  auth_user_id,
  casino_id,
  first_name,
  last_name,
  email,
  role,
  user_role,
  status,
  hire_date,
  created_at
)
SELECT 
  gen_random_uuid(),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  c.id,
  'Admin',
  'Royal Palace',
  'admin@royalpalace.safebetiq.com',
  'manager'::staff_role,
  'EXECUTIVE'::user_role_type,
  'active'::staff_status,
  '2024-01-01',
  now()
FROM casinos c
WHERE c.name = 'Royal Palace Casino'
AND NOT EXISTS (
  SELECT 1 FROM staff 
  WHERE auth_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

-- Create staff record for Silver Star admin
INSERT INTO staff (
  id,
  auth_user_id,
  casino_id,
  first_name,
  last_name,
  email,
  role,
  user_role,
  status,
  hire_date,
  created_at
)
SELECT 
  gen_random_uuid(),
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  c.id,
  'Admin',
  'Silver Star',
  'admin@silverstar.safebetiq.com',
  'manager'::staff_role,
  'EXECUTIVE'::user_role_type,
  'active'::staff_status,
  '2024-01-01',
  now()
FROM casinos c
WHERE c.name = 'Silver Star Resort'
AND NOT EXISTS (
  SELECT 1 FROM staff 
  WHERE auth_user_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
);

-- Create staff record for Super Admin (linked to first casino for now)
INSERT INTO staff (
  id,
  auth_user_id,
  casino_id,
  first_name,
  last_name,
  email,
  role,
  user_role,
  status,
  hire_date,
  created_at
)
SELECT 
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  c.id,
  'Super',
  'Admin',
  'superadmin@safebetiq.com',
  'manager'::staff_role,
  'EXECUTIVE'::user_role_type,
  'active'::staff_status,
  '2024-01-01',
  now()
FROM casinos c
WHERE c.name = 'Golden Dragon Gaming'
AND NOT EXISTS (
  SELECT 1 FROM staff 
  WHERE auth_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

-- Assign some sample training courses to these admin accounts
DO $$
DECLARE
  v_staff_id uuid;
  v_module_id uuid;
  v_enrollment_id uuid;
BEGIN
  -- For each new admin staff member
  FOR v_staff_id IN 
    SELECT id FROM staff 
    WHERE auth_user_id IN (
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    )
  LOOP
    -- Assign 3 completed courses
    FOR v_module_id IN 
      SELECT id FROM training_modules 
      ORDER BY RANDOM() 
      LIMIT 3
    LOOP
      v_enrollment_id := gen_random_uuid();
      
      INSERT INTO training_enrollments (
        id,
        staff_id,
        module_id,
        status,
        progress_percentage,
        assigned_at,
        started_at,
        completed_at
      ) VALUES (
        v_enrollment_id,
        v_staff_id,
        v_module_id,
        'completed',
        100,
        now() - interval '30 days',
        now() - interval '25 days',
        now() - interval '20 days'
      );
      
      -- Add credit record
      INSERT INTO training_credits (
        id,
        staff_id,
        module_id,
        enrollment_id,
        credits_earned,
        earned_at
      )
      SELECT 
        gen_random_uuid(),
        v_staff_id,
        v_module_id,
        v_enrollment_id,
        tm.credits_awarded,
        now() - interval '20 days'
      FROM training_modules tm
      WHERE tm.id = v_module_id;
    END LOOP;
  END LOOP;
END $$;
