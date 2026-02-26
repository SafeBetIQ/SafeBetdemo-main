/*
  # Create Missing Auth Identities for All Demo Accounts

  1. Purpose
    - Ensures all auth.users have corresponding auth.identities entries
    - Required for Supabase signInWithPassword to work correctly

  2. Affected Accounts
    - All admin, regulator, and staff accounts
    - Creates email provider identities where missing
*/

DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Create identities for all users that don't have one
  FOR user_record IN 
    SELECT 
      au.id,
      au.email,
      au.created_at,
      au.updated_at
    FROM auth.users au
    LEFT JOIN auth.identities ai ON au.id = ai.user_id
    WHERE ai.id IS NULL
      AND au.email IS NOT NULL
      AND (
        au.email LIKE '%@safebetiq.com' 
        OR au.email = 'regulator@ngb.gov.za'
      )
  LOOP
    -- Insert identity for email provider
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      user_record.id,
      jsonb_build_object(
        'sub', user_record.id::text,
        'email', user_record.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      user_record.id::text,
      user_record.created_at,
      user_record.created_at,
      user_record.updated_at
    );
    
    RAISE NOTICE 'Created identity for: %', user_record.email;
  END LOOP;
  
END $$;
