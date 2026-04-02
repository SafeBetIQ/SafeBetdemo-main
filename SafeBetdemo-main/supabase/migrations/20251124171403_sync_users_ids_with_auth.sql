/*
  # Sync Users Table IDs with Auth Users IDs

  1. Problem
    - users.id doesn't match auth.users.id
    - RLS policies use auth.uid() which returns auth.users.id
    - This causes permission denied when fetching data
    
  2. Solution
    - Update users table IDs to match auth.users IDs
    - Match by email address
    - This fixes RLS policies that check users.id = auth.uid()
    
  3. Note
    - Safe because we're matching on email (unique identifier)
    - Preserves all other user data
*/

-- Update super admin
UPDATE users 
SET id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
WHERE email = 'admin@safeplayai.com';

-- Update casino admin
UPDATE users 
SET id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE email = 'admin@royalpalace.com';

-- Update regulator
UPDATE users 
SET id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
WHERE email = 'regulator@gamblingboard.gov';
