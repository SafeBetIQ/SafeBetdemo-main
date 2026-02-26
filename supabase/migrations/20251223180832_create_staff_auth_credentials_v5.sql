/*
  # Create Staff Authentication Credentials (V5)

  1. Overview
    - Creates auth.users and public.users entries for all staff members without login credentials
    - Links staff table records to users via auth_user_id
    - Sets default password as 'Staff123!' for all staff members
    - Handles existing entries by linking instead of creating

  2. Changes
    - Creates public.users entries for staff authentication
    - Creates corresponding auth.users entries with proper identity records
    - Links staff.auth_user_id to public.users.id
    - Updates passwords to ensure consistency

  3. Security Notes
    - Password is hashed using bcrypt
    - Default password: Staff123!
    - Staff should change password on first login in production
    - Demo mode only - production should use individual secure passwords
*/

-- Create users and auth entries for all staff without auth_user_id
DO $$
DECLARE
  staff_record RECORD;
  new_user_id uuid;
  existing_auth_user_id uuid;
BEGIN
  FOR staff_record IN 
    SELECT id, email, first_name, last_name, casino_id, role
    FROM staff
    WHERE auth_user_id IS NULL
  LOOP
    -- Check if auth.users already exists with this email
    SELECT id INTO existing_auth_user_id
    FROM auth.users
    WHERE email = staff_record.email;

    IF existing_auth_user_id IS NULL THEN
      -- Create new auth.users entry first
      new_user_id := gen_random_uuid();
      
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        aud,
        role
      ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        staff_record.email,
        crypt('Staff123!', gen_salt('bf')),
        now(),
        jsonb_build_object('provider', 'email', 'providers', array['email']),
        jsonb_build_object(
          'first_name', staff_record.first_name,
          'last_name', staff_record.last_name,
          'staff_id', staff_record.id,
          'casino_id', staff_record.casino_id,
          'role', staff_record.role
        ),
        now(),
        now(),
        '',
        '',
        '',
        '',
        'authenticated',
        'authenticated'
      );

      -- Insert into auth.identities (email is generated column, don't insert it)
      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        new_user_id,
        new_user_id,
        new_user_id::text,
        jsonb_build_object(
          'sub', new_user_id::text,
          'email', staff_record.email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    ELSE
      -- Use existing auth user
      new_user_id := existing_auth_user_id;
      
      -- Update password to ensure consistency
      UPDATE auth.users
      SET encrypted_password = crypt('Staff123!', gen_salt('bf')),
          updated_at = now()
      WHERE id = existing_auth_user_id;
    END IF;

    -- Create or update public.users entry
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = new_user_id) THEN
      INSERT INTO users (
        id,
        email,
        password_hash,
        full_name,
        role,
        casino_id,
        is_active,
        created_at,
        updated_at,
        user_role
      ) VALUES (
        new_user_id,
        staff_record.email,
        'linked_to_auth_users',
        staff_record.first_name || ' ' || staff_record.last_name,
        'casino_admin',
        staff_record.casino_id,
        true,
        now(),
        now(),
        'SUPPORT'
      );
    END IF;

    -- Update staff record with auth_user_id
    UPDATE staff
    SET auth_user_id = new_user_id
    WHERE id = staff_record.id;

  END LOOP;
END $$;
