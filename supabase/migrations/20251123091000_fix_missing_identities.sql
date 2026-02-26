/*
  # Fix Missing Identity Records

  1. Problem
    - Users exist in auth.users but have no corresponding auth.identities records
    - This causes "Database error querying schema" during login
    - Supabase requires identity records for email/password authentication

  2. Solution
    - Create identity records for all existing users
    - Link them to the email provider
    - Populate identity_data with email information
*/

-- Create identity records for all users that don't have them
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
  u.last_sign_in_at,
  u.created_at,
  u.updated_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);
