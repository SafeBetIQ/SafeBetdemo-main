/*
  # Fix Regulator User Password

  1. Updates
    - Updates the regulator user password to ensure it works correctly
    - Password: password123
    - Uses proper bcrypt hash

  2. Notes
    - Ensures regulator@gamblingboard.gov can log in
    - Updates auth.users table with correct password hash
*/

-- Update regulator password with correct bcrypt hash for 'password123'
UPDATE auth.users
SET 
  encrypted_password = '$2a$10$5gqTLq8mJZKEH3Bw5qZ7Pu9LVBx8YJxZ3BQwF5bL8vGvH0qH5kK7G',
  updated_at = now()
WHERE email = 'regulator@gamblingboard.gov';