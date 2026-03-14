/*
  # Create compliance helper function

  Creates get_staff_casino_id() helper used by compliance RLS policies.
  Must exist before the compliance tables migration runs.
*/

CREATE OR REPLACE FUNCTION get_staff_casino_id(p_auth_uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT casino_id FROM staff WHERE auth_user_id = p_auth_uid LIMIT 1;
$$;

-- PII masking functions (privacy by design)
CREATE OR REPLACE FUNCTION mask_email(email text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE parts text[]; local_ text; domain text; BEGIN
  IF email IS NULL THEN RETURN NULL; END IF;
  parts := string_to_array(email, '@');
  IF array_length(parts, 1) < 2 THEN RETURN '***@***'; END IF;
  local_ := parts[1]; domain := parts[2];
  RETURN left(local_, 2) || '***@' || domain;
END; $$;

CREATE OR REPLACE FUNCTION mask_phone(phone text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE digits text; BEGIN
  IF phone IS NULL OR length(phone) < 4 THEN RETURN '****'; END IF;
  digits := regexp_replace(phone, '[^0-9]', '', 'g');
  RETURN '+**-****-' || right(digits, 4);
END; $$;
