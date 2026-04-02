/*
  # Create Demo Authentication Users - Fixed Version

  1. Creates 4 demo users in auth.users with passwords
  2. Creates corresponding records in public.users table with password hashes
  
  Demo accounts:
  - Super Admin: admin@safeplayai.com / password123
  - Casino Admin (Royal Palace): admin@royalpalace.com / password123
  - Casino Admin (Golden Dragon): admin@goldendragon.com / password123
  - Regulator: regulator@gamblingboard.gov / password123
*/

-- Insert Super Admin into auth.users
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
  is_super_admin,
  role,
  aud
)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'admin@safeplayai.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Super Admin"}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Insert Casino Admin (Royal Palace) into auth.users
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
  is_super_admin,
  role,
  aud
)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'admin@royalpalace.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Royal Palace Admin"}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Insert Casino Admin (Golden Dragon) into auth.users
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
  is_super_admin,
  role,
  aud
)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '00000000-0000-0000-0000-000000000000',
  'admin@goldendragon.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Golden Dragon Admin"}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Insert Regulator into auth.users
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
  is_super_admin,
  role,
  aud
)
VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'regulator@gamblingboard.gov',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Gaming Board Regulator"}',
  false,
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Now update the public.users table with matching IDs and password hashes
DELETE FROM users;

INSERT INTO users (id, email, password_hash, full_name, role, casino_id, is_active, created_at)
VALUES 
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'admin@safeplayai.com',
    crypt('password123', gen_salt('bf')),
    'Super Admin',
    'super_admin',
    NULL,
    true,
    now()
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'admin@royalpalace.com',
    crypt('password123', gen_salt('bf')),
    'Royal Palace Admin',
    'casino_admin',
    '11111111-1111-1111-1111-111111111111',
    true,
    now()
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'admin@goldendragon.com',
    crypt('password123', gen_salt('bf')),
    'Golden Dragon Admin',
    'casino_admin',
    '22222222-2222-2222-2222-222222222222',
    true,
    now()
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'regulator@gamblingboard.gov',
    crypt('password123', gen_salt('bf')),
    'Gaming Board Regulator',
    'regulator',
    NULL,
    true,
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  casino_id = EXCLUDED.casino_id;
