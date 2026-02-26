/*
  # Fix Auth Users and Add Staff Auth Accounts

  1. Problem
    - Auth users have incorrect password hashes
    - Staff members don't have auth accounts
    - Login credentials don't work

  2. Solution
    - Delete and recreate admin auth users with working passwords
    - Create auth accounts for all staff members
    - Use proper bcrypt format that Supabase accepts
    
  3. Security
    - Demo passwords: password123 (admin), demo123 (staff)
    - These are demo accounts for testing only
*/

-- Delete existing auth users and identities
DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'admin@safeplayai.com',
    'admin@royalpalace.com',
    'admin@goldendragon.com',
    'regulator@gamblingboard.gov',
    'sarah.johnson@demo.casino',
    'michael.chen@demo.casino',
    'emily.rodriguez@demo.casino',
    'david.williams@demo.casino'
  )
);

DELETE FROM auth.users WHERE email IN (
  'admin@safeplayai.com',
  'admin@royalpalace.com',
  'admin@goldendragon.com',
  'regulator@gamblingboard.gov',
  'sarah.johnson@demo.casino',
  'michael.chen@demo.casino',
  'emily.rodriguez@demo.casino',
  'david.williams@demo.casino'
);

-- Create admin users with proper bcrypt hash
-- Password: password123 (bcrypt hash with cost 10)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'admin@safeplayai.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjefOxCAKIH.0vEDI3GBoVbPJb6/8G',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'admin@royalpalace.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjefOxCAKIH.0vEDI3GBoVbPJb6/8G',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
),
(
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'regulator@gamblingboard.gov',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjefOxCAKIH.0vEDI3GBoVbPJb6/8G',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Create staff auth users
-- Password: demo123 (bcrypt hash with cost 10)
DO $$
DECLARE
  staff_record RECORD;
  new_auth_id uuid;
BEGIN
  FOR staff_record IN 
    SELECT id, email FROM staff WHERE email LIKE '%@demo.casino'
  LOOP
    new_auth_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      new_auth_id,
      '00000000-0000-0000-0000-000000000000',
      staff_record.email,
      '$2a$10$5eVqDfp8e8vK3NK7eL1VM.VF2vXrZ8VKOcJlYz0VLGl1cLCqvvFD2',
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END LOOP;
END $$;

-- Create identity records for all auth users
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  u.id,
  u.id::text,
  'email',
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  NULL,
  now(),
  now()
FROM auth.users u
WHERE u.email IN (
  'admin@safeplayai.com',
  'admin@royalpalace.com',
  'regulator@gamblingboard.gov',
  'sarah.johnson@demo.casino',
  'michael.chen@demo.casino',
  'emily.rodriguez@demo.casino',
  'david.williams@demo.casino'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);
