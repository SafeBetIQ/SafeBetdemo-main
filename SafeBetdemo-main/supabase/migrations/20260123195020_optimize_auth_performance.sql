/*
  # Optimize Authentication Performance

  1. New Functions
    - `get_user_by_email_fast` - Unified function to quickly look up users from either staff or users table
    - Returns user data in a standardized format with role information
    - Uses a single optimized query instead of multiple sequential queries

  2. Performance Improvements
    - Eliminates need for multiple sequential queries during login
    - Reduces round trips to the database
    - Uses indexes efficiently (email indexes already exist)
    - Returns all necessary data in one call

  3. Benefits
    - Faster login times (single query vs 2-3 sequential queries)
    - Reduced database load
    - Consistent user data structure
*/

-- Create a function to get user by email from either staff or users table in one call
CREATE OR REPLACE FUNCTION get_user_by_email_fast(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Try staff table first
  SELECT jsonb_build_object(
    'id', s.id,
    'email', s.email,
    'full_name', s.first_name || ' ' || s.last_name,
    'role', 'staff',
    'user_role', s.user_role,
    'casino_id', s.casino_id,
    'is_active', (s.status = 'active'),
    'created_at', s.created_at,
    'source', 'staff'
  ) INTO result
  FROM staff s
  WHERE s.email = user_email
  LIMIT 1;

  -- If found in staff, return immediately
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Otherwise check users table
  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'full_name', u.full_name,
    'role', u.role::text,
    'casino_id', u.casino_id,
    'is_active', u.is_active,
    'created_at', u.created_at,
    'source', 'users'
  ) INTO result
  FROM users u
  WHERE u.email = user_email
  LIMIT 1;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_by_email_fast(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_email_fast(text) TO anon;

-- Add a composite index for even faster lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_staff_email_status ON staff(email, status);
CREATE INDEX IF NOT EXISTS idx_users_email_role ON users(email, role);
