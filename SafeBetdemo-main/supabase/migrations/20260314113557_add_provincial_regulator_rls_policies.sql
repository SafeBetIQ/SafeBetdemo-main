/*
  # Provincial Regulator RLS Policies & Helper Functions

  ## Summary
  Adds helper functions and RLS policies for the new provincial_regulator role.
  Provincial regulators can ONLY see casinos, players, sessions, interventions,
  and staff that belong to casinos in their assigned province.

  ## New Functions
  - `get_user_province()` — returns the province of the logged-in provincial regulator
  - `is_provincial_regulator()` — returns true if current user has provincial_regulator role

  ## Updated RLS Policies
  All core tables updated to support the three-tier hierarchy:
  1. super_admin → all data
  2. regulator (national) → all data
  3. provincial_regulator → only their province's data
  4. casino_admin → only their casino's data
*/

-- 1. Helper function: get current user's province
CREATE OR REPLACE FUNCTION get_user_province()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.province
  FROM regulators r
  WHERE r.user_id = auth.uid()
  LIMIT 1;
$$;

-- 2. Helper function: check if user is a provincial regulator
CREATE OR REPLACE FUNCTION is_provincial_regulator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'provincial_regulator'
  );
$$;

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_province() TO authenticated;
GRANT EXECUTE ON FUNCTION is_provincial_regulator() TO authenticated;

-- 4. casinos: provincial regulators see their province only
DROP POLICY IF EXISTS "Provincial regulators see own province casinos" ON casinos;
CREATE POLICY "Provincial regulators see own province casinos"
  ON casinos FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR is_regulator()
    OR (is_provincial_regulator() AND province = get_user_province())
    OR id = get_user_casino_id()
  );

-- 5. players: provincial regulators see players in their province casinos
DROP POLICY IF EXISTS "Provincial regulators can view province players" ON players;
CREATE POLICY "Provincial regulators can view province players"
  ON players FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR is_regulator()
    OR (is_provincial_regulator() AND casino_id IN (
      SELECT id FROM casinos WHERE province = get_user_province()
    ))
    OR casino_id = get_user_casino_id()
  );

-- 6. gaming_sessions: provincial regulators see sessions in their province
DROP POLICY IF EXISTS "Provincial regulators can view province sessions" ON gaming_sessions;
CREATE POLICY "Provincial regulators can view province sessions"
  ON gaming_sessions FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR is_regulator()
    OR (is_provincial_regulator() AND casino_id IN (
      SELECT id FROM casinos WHERE province = get_user_province()
    ))
    OR casino_id = get_user_casino_id()
  );

-- 7. interventions: provincial regulators see interventions in their province
DROP POLICY IF EXISTS "Provincial regulators can view province interventions" ON interventions;
CREATE POLICY "Provincial regulators can view province interventions"
  ON interventions FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR is_regulator()
    OR (is_provincial_regulator() AND casino_id IN (
      SELECT id FROM casinos WHERE province = get_user_province()
    ))
    OR casino_id = get_user_casino_id()
  );

-- 8. staff: provincial regulators see staff in their province casinos
DROP POLICY IF EXISTS "Provincial regulators can view province staff" ON staff;
CREATE POLICY "Provincial regulators can view province staff"
  ON staff FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR is_regulator()
    OR (is_provincial_regulator() AND casino_id IN (
      SELECT id FROM casinos WHERE province = get_user_province()
    ))
    OR casino_id = get_user_casino_id()
    OR auth_user_id = auth.uid()
  );
