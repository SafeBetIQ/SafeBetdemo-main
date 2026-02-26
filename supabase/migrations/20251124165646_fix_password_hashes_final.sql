/*
  # Fix Password Hashes - Final Solution

  1. Problem
    - Password hashes not working for authentication
    - Using pre-generated hashes that don't match

  2. Solution
    - Delete and recreate with proper format
    - Use crypt() function to generate hashes correctly
    - Password: password123 for all users
    
  3. Note
    - This uses PostgreSQL's crypt() with bcrypt
    - Generates fresh hashes that will work with Supabase auth
*/

-- Delete existing users completely
DELETE FROM auth.identities;
DELETE FROM auth.users;

-- Insert users with properly generated password hashes
-- Using crypt() to generate bcrypt hashes for "password123"
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
  crypt('password123', gen_salt('bf', 10)),
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
  crypt('password123', gen_salt('bf', 10)),
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
  crypt('password123', gen_salt('bf', 10)),
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
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'sarah.johnson@demo.casino',
  crypt('demo123', gen_salt('bf', 10)),
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
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'michael.chen@demo.casino',
  crypt('demo123', gen_salt('bf', 10)),
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
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'emily.rodriguez@demo.casino',
  crypt('demo123', gen_salt('bf', 10)),
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
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'david.williams@demo.casino',
  crypt('demo123', gen_salt('bf', 10)),
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

-- Create identity records for all users
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
FROM auth.users u;
