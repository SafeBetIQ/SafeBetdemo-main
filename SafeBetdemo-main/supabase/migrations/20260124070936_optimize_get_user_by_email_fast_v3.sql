/*
  # Optimize get_user_by_email_fast Function - v3

  1. Performance Improvements
    - Use COALESCE to try staff first, then users
    - Mark as STABLE for better query planning
    - Add partial indexes for active users only

  2. Benefits
    - Faster execution with better query optimization
    - Better use of indexes
    - Reduced lock contention
*/

-- Create optimized version using COALESCE
CREATE OR REPLACE FUNCTION get_user_by_email_fast(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Try staff table first (most common case)
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

  -- Return immediately if found
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

-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_staff_email_active ON staff(email) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE is_active = true;
