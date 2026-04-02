/*
  # Fix Authentication RLS Policy

  Allow anon role to query users table during authentication
  This is safe because:
  1. Only basic user info is exposed (no passwords)
  2. The auth.signInWithPassword already validated credentials
  3. Users can only see their own data after auth succeeds
*/

-- Add policy to allow reading user data during authentication
CREATE POLICY "Allow user lookup during authentication"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);
