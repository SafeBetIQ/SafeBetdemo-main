/*
  # Fix Remaining Function Search Paths

  ## Summary
  Secures the remaining 3 functions by setting explicit search_path to prevent SQL injection vulnerabilities

  ## Changes
    - get_recent_logins: Set immutable search_path
    - can_user_view_staff: Recreate with proper search_path (requires policy updates)
    - can_user_manage_staff: Recreate with proper search_path (requires policy updates)

  ## Security Impact
    - Prevents malicious schema manipulation attacks
    - Ensures functions only access intended database objects
*/

-- Fix get_recent_logins if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_recent_logins') THEN
    ALTER FUNCTION get_recent_logins(uuid, integer) SET search_path = public, pg_temp;
  END IF;
END $$;

-- Drop and recreate can_user_view_staff with dependencies
DROP POLICY IF EXISTS "Casino admins can view their staff" ON staff;
DROP POLICY IF EXISTS "Admins can view all certificates" ON training_certificates;

DROP FUNCTION IF EXISTS can_user_view_staff(uuid) CASCADE;

CREATE FUNCTION can_user_view_staff(staff_casino_id uuid) 
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  current_user_role text;
  current_casino_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  SELECT role, casino_id INTO current_user_role, current_casino_id
  FROM users
  WHERE id = current_user_id;
  
  IF current_user_role IN ('super_admin', 'regulator') THEN
    RETURN true;
  END IF;
  
  RETURN current_casino_id = staff_casino_id;
END;
$$;

-- Recreate dropped policies
CREATE POLICY "Casino admins can view their staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users
      WHERE id = (select auth.uid())
      AND role = 'casino_admin'
    ) OR
    can_user_view_staff(casino_id)
  );

CREATE POLICY "Admins can view all certificates"
  ON training_certificates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = (select auth.uid())
      AND (
        staff.role IN ('manager', 'compliance_officer') OR
        staff.user_role IN ('EXECUTIVE', 'COMPLIANCE')
      )
      AND can_user_view_staff(staff.casino_id)
    )
  );

-- Drop and recreate can_user_manage_staff
DROP FUNCTION IF EXISTS can_user_manage_staff(uuid) CASCADE;

CREATE FUNCTION can_user_manage_staff(staff_casino_id uuid) 
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid;
  current_user_role text;
  current_casino_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  SELECT role, casino_id INTO current_user_role, current_casino_id
  FROM users
  WHERE id = current_user_id;
  
  IF current_user_role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  IF current_user_role != 'casino_admin' THEN
    RETURN false;
  END IF;
  
  RETURN current_casino_id = staff_casino_id;
END;
$$;