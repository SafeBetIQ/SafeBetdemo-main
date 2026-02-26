/*
  # Fix Regulator Login Password

  1. Updates
    - Regenerates the password hash for the regulator user using Supabase's crypt function
    - Password: password123
    - Uses proper bcrypt hashing with gen_salt('bf')

  2. Security
    - Ensures the regulator account can log in successfully
    - Uses Supabase's built-in password hashing for consistency
*/

-- Update regulator password with properly generated bcrypt hash
UPDATE auth.users
SET 
  encrypted_password = crypt('password123', gen_salt('bf')),
  updated_at = now()
WHERE email = 'regulator@gamblingboard.gov';
