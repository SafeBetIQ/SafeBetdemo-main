/*
  # Update get_user_by_email_fast for provincial_regulator support

  Drop and recreate the function to support the new provincial_regulator role.
  The function signature is unchanged — it returns the role as text, which
  already handles any new enum values automatically.
*/

DROP FUNCTION IF EXISTS get_user_by_email_fast(text);

CREATE OR REPLACE FUNCTION get_user_by_email_fast(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role text,
  user_role text,
  casino_id uuid,
  is_active boolean,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Priority 1: users table (super_admin, casino_admin, regulator, provincial_regulator)
  SELECT u.id, u.email, u.full_name, u.role::text, u.user_role::text, u.casino_id, u.is_active
  INTO v_user
  FROM public.users u
  WHERE u.email = p_email
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_user.id,
      v_user.email,
      v_user.full_name,
      v_user.role,
      v_user.user_role,
      v_user.casino_id,
      v_user.is_active,
      'users'::text;
    RETURN;
  END IF;

  -- Priority 2: staff table fallback
  SELECT
    s.id,
    s.email,
    (s.first_name || ' ' || s.last_name) AS full_name,
    'staff'::text AS role,
    s.user_role::text,
    s.casino_id,
    (s.status = 'active') AS is_active
  INTO v_user
  FROM public.staff s
  WHERE s.email = p_email
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_user.id,
      v_user.email,
      v_user.full_name,
      v_user.role,
      v_user.user_role,
      v_user.casino_id,
      v_user.is_active,
      'staff'::text;
    RETURN;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_by_email_fast(text) TO authenticated, anon;
