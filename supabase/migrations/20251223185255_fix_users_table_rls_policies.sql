/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing problematic policies that may cause circular dependencies
    - Create simplified policies that work reliably for all user types
    - Ensure regulator and all admin types can query their profiles

  2. Security
    - All authenticated users can read their own profile
    - All authenticated users can read all users (needed for dashboard functionality)
    - Only users can update their own profile
*/

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Allow all authenticated to read users" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can view relevant users" ON users;
DROP POLICY IF EXISTS "Allow authenticated to insert users" ON users;
DROP POLICY IF EXISTS "Users can update own profile only" ON users;

-- Create simple, working policies
-- Allow all authenticated users to read all users
CREATE POLICY "Authenticated users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update their own profile
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow system to insert users
CREATE POLICY "System can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
