/*
  # Reset Regulator Password

  1. Updates
    - Generate fresh bcrypt hash for regulator account
    - Update both auth.users and users tables
    - Password: Regulator123!

  2. Security
    - Uses pgcrypto extension for secure password hashing
    - Updates timestamp to track the change
*/

DO $$
DECLARE
  new_password_hash text;
BEGIN
  -- Generate fresh bcrypt hash for password: Regulator123!
  new_password_hash := crypt('Regulator123!', gen_salt('bf', 8));

  -- Update auth.users table
  UPDATE auth.users 
  SET 
    encrypted_password = new_password_hash,
    updated_at = now()
  WHERE email = 'regulator@ngb.gov.za';

  -- Update users table
  UPDATE users 
  SET 
    password_hash = new_password_hash,
    updated_at = now()
  WHERE email = 'regulator@ngb.gov.za';

  RAISE NOTICE 'Regulator password has been reset successfully';
END $$;
