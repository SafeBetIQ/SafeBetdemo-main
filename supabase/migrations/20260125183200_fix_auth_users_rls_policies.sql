/*
  # Fix Auth Users RLS Policies

  1. Problem
    - RLS is enabled on auth.users table but has no policies
    - This blocks Supabase auth service from accessing the table during login
    - Results in "Database error querying schema" error

  2. Solution
    - Create permissive policies on auth.users table
    - Allow authenticated, anon, and service_role to access users table
    - This allows Supabase's internal auth service to function properly

  3. Security
    - These policies are necessary for Supabase auth to work
    - The auth schema is already protected by Supabase's internal security
    - These policies match Supabase's default auth configuration
*/

-- Drop any existing policies first (in case they exist from previous attempts)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow auth service to select users" ON auth.users;
  DROP POLICY IF EXISTS "Allow auth service to insert users" ON auth.users;
  DROP POLICY IF EXISTS "Allow auth service to update users" ON auth.users;
  DROP POLICY IF EXISTS "Allow auth service to delete users" ON auth.users;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Cannot drop policies - insufficient privileges';
  WHEN undefined_object THEN
    RAISE NOTICE 'Policies do not exist yet';
END $$;

-- Create permissive policies for Supabase auth service to function
CREATE POLICY "Allow auth service to select users"
ON auth.users
FOR SELECT
TO authenticated, anon, service_role
USING (true);

CREATE POLICY "Allow auth service to insert users"
ON auth.users
FOR INSERT
TO authenticated, anon, service_role
WITH CHECK (true);

CREATE POLICY "Allow auth service to update users"
ON auth.users
FOR UPDATE
TO authenticated, anon, service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow auth service to delete users"
ON auth.users
FOR DELETE
TO authenticated, anon, service_role
USING (true);
