/*
  # Fix Casino Admin Assignments
  
  1. Fixes
    - Correct admin@royalpalace.com to point to Royal Palace Casino (11111111...)
    - Create casino admins for Golden Dragon Gaming and Silver Star Resort
  
  2. Security
    - All users have RLS enabled
    - Password is set to: password123 (for demo purposes)
*/

-- Fix the existing admin@royalpalace.com to point to the correct casino
UPDATE users
SET casino_id = '11111111-1111-1111-1111-111111111111'
WHERE email = 'admin@royalpalace.com';

-- Create casino admin for Golden Dragon Gaming
DO $$
DECLARE
  golden_admin_id uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
BEGIN
  -- Insert into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@goldendragon.com') THEN
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
      golden_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@goldendragon.com',
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
    
    -- Create identity
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      golden_admin_id,
      golden_admin_id::text,
      'email',
      jsonb_build_object(
        'sub', golden_admin_id::text,
        'email', 'admin@goldendragon.com',
        'email_verified', true,
        'phone_verified', false
      ),
      NULL,
      now(),
      now()
    );
  END IF;
  
  -- Insert into public.users if not exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@goldendragon.com') THEN
    INSERT INTO users (id, email, password_hash, full_name, role, casino_id, is_active)
    VALUES (
      golden_admin_id,
      'admin@goldendragon.com',
      '$2a$10$5eVqDfp8e8vK3NK7eL1VM.VF2vXrZ8VKOcJlYz0VLGl1cLCqvvFD2',
      'Golden Dragon Admin',
      'casino_admin',
      '22222222-2222-2222-2222-222222222222',
      true
    );
  END IF;
END $$;

-- Create casino admin for Silver Star Resort
DO $$
DECLARE
  silver_admin_id uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
BEGIN
  -- Insert into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@silverstar.com') THEN
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
      silver_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@silverstar.com',
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
    
    -- Create identity
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      silver_admin_id,
      silver_admin_id::text,
      'email',
      jsonb_build_object(
        'sub', silver_admin_id::text,
        'email', 'admin@silverstar.com',
        'email_verified', true,
        'phone_verified', false
      ),
      NULL,
      now(),
      now()
    );
  END IF;
  
  -- Insert into public.users if not exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@silverstar.com') THEN
    INSERT INTO users (id, email, password_hash, full_name, role, casino_id, is_active)
    VALUES (
      silver_admin_id,
      'admin@silverstar.com',
      '$2a$10$5eVqDfp8e8vK3NK7eL1VM.VF2vXrZ8VKOcJlYz0VLGl1cLCqvvFD2',
      'Silver Star Admin',
      'casino_admin',
      '33333333-3333-3333-3333-333333333333',
      true
    );
  END IF;
END $$;
