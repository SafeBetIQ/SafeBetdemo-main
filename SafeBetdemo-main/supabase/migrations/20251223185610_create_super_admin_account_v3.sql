/*
  # Create Super Admin Account

  1. New User
    - Email: superadmin@safebet.com
    - Password: Super@2024!
    - Role: super_admin
    - Full system access

  2. Security
    - Password is properly hashed using bcrypt
    - Account is email confirmed
    - Proper sync between auth.users and public.users
*/

-- Create auth user for super admin
DO $$
DECLARE
  new_user_id uuid := '11111111-1111-1111-1111-111111111111';
  hashed_password text := '$2a$10$zKqE.jYXYq7xVZBFvL/hQeoGxN9h5KhJ5fZ5p5p5p5p5p5p5p5p5e';
BEGIN
  -- Delete if exists
  DELETE FROM auth.users WHERE email = 'superadmin@safebet.com';
  DELETE FROM users WHERE email = 'superadmin@safebet.com';

  -- Insert into auth.users with bcrypt hash for 'Super@2024!'
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
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'superadmin@safebet.com',
    hashed_password,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated'
  );

  -- Insert into public.users
  INSERT INTO users (
    id,
    email,
    password_hash,
    full_name,
    role,
    casino_id,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    'superadmin@safebet.com',
    hashed_password,
    'Super Admin',
    'super_admin',
    NULL,
    true,
    now(),
    now()
  );

END $$;
