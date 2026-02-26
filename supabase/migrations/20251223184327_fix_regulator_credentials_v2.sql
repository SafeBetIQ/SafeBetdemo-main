/*
  # Fix Regulator Login Credentials

  1. Updates
    - Creates the correct regulator account matching documentation: regulator@ngb.gov.za
    - Sets password to Regulator123! (as per DEMO_CREDENTIALS.md)
    - Removes old regulator@gamblingboard.gov account
    - Ensures proper role assignment in public.users table

  2. Security
    - Email is confirmed automatically for demo purposes
    - Uses proper bcrypt password hashing
    - Role-based access configured correctly
*/

-- First, check if the new regulator account already exists in auth.users
DO $$
BEGIN
  -- Delete old regulator account from auth.users if it exists
  DELETE FROM auth.users WHERE email = 'regulator@gamblingboard.gov';
  
  -- Delete old regulator from public.users if it exists
  DELETE FROM public.users WHERE email = 'regulator@gamblingboard.gov';
  
  -- Delete the new one if it exists (to avoid conflicts)
  DELETE FROM auth.users WHERE email = 'regulator@ngb.gov.za';
  DELETE FROM public.users WHERE email = 'regulator@ngb.gov.za';
END $$;

-- Create the new regulator account in auth.users
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  confirmation_token
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'regulator@ngb.gov.za',
  crypt('Regulator123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated',
  ''
);

-- Create the regulator account in public.users with password_hash
INSERT INTO public.users (
  id,
  email,
  password_hash,
  full_name,
  role,
  is_active,
  created_at,
  updated_at,
  user_role
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'regulator@ngb.gov.za',
  crypt('Regulator123!', gen_salt('bf')),
  'Gaming Board Regulator',
  'regulator',
  true,
  now(),
  now(),
  'SUPPORT'
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = true,
  updated_at = now();
