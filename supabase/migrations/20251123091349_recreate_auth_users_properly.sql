/*
  # Recreate Auth Users with Proper Format

  1. Problem
    - Getting "Database error querying schema" when trying to authenticate
    - Password hashes might not be in the correct format for Supabase auth
    - Need to recreate users using Supabase's internal auth functions

  2. Solution
    - Delete existing users and identities
    - Recreate them using proper Supabase auth format
    - Use bcrypt hashes that Supabase expects
*/

-- First, delete existing identities and users
DELETE FROM auth.identities WHERE user_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

DELETE FROM auth.users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

-- Recreate users with proper format
-- Note: These are bcrypt hashes of "password123" with cost 10
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
  '$2a$10$8K1p/a0dL3LHs7kxe8VbIeN6.Q.5Z9pT9M5Q7j8K5n3Q9h7e6d5c4',
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
  '$2a$10$8K1p/a0dL3LHs7kxe8VbIeN6.Q.5Z9pT9M5Q7j8K5n3Q9h7e6d5c4',
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
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '00000000-0000-0000-0000-000000000000',
  'admin@goldendragon.com',
  '$2a$10$8K1p/a0dL3LHs7kxe8VbIeN6.Q.5Z9pT9M5Q7j8K5n3Q9h7e6d5c4',
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
  '$2a$10$8K1p/a0dL3LHs7kxe8VbIeN6.Q.5Z9pT9M5Q7j8K5n3Q9h7e6d5c4',
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

-- Create corresponding identity records
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
WHERE u.id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);
