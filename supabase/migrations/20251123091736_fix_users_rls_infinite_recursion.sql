/*
  # Fix Infinite Recursion in Users RLS Policies

  1. Problem
    - RLS policies on users table are querying the users table within the policy
    - This creates infinite recursion when trying to read user data
    - Error: "infinite recursion detected in policy for relation users"

  2. Solution
    - Drop all existing policies on users table
    - Create simple, non-recursive policies
    - Use auth.uid() directly instead of querying users table
    - Store role information in auth.jwt() if needed for complex checks

  3. Security
    - Authenticated users can read their own profile
    - All authenticated users can read all users (needed for the app to function)
    - Users can update their own profile
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Allow user lookup during authentication" ON users;
DROP POLICY IF EXISTS "Super admins can create users" ON users;
DROP POLICY IF EXISTS "Super admins can update users" ON users;
DROP POLICY IF EXISTS "Super admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view their own profile" ON users;

-- Create new simple policies

-- Allow anonymous and authenticated users to read users table
-- This is needed for login flow to work
CREATE POLICY "Allow all authenticated to read users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow authenticated users to insert (for signup flows)
CREATE POLICY "Allow authenticated to insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
