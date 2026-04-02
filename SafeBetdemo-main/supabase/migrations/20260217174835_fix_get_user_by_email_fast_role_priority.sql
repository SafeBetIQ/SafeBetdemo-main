/*
  # Fix get_user_by_email_fast Role Priority

  1. Changes
    - Prioritize users table over staff table for role determination
    - Return correct role from users table when account exists there
    - Only fall back to staff table for pure staff accounts
  
  2. Security
    - Maintains existing security definer
    - No RLS changes needed
*/

-- Fix the function to check users table first for role priority
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
  -- Check users table first (for super_admin, casino_admin, regulator roles)
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

  -- Return immediately if found in users table
  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Otherwise check staff table (for pure staff accounts without users entry)
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

  RETURN result;
END;
$$;

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION get_user_by_email_fast(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_by_email_fast(text) TO anon;
