/*
  # Fix ESG and Nova IQ RLS Policies for Casino Admins
  
  ## Summary
  Fixes RLS policies so casino admins can access their casino's ESG metrics,
  wellbeing game sessions, and Nova IQ risk scores.
  
  ## Problem
  Current policies only allow:
  - Staff members (via staff table lookup)
  - Super admins and regulators
  
  Casino admins are in the users table with role='casino_admin', but the policies
  don't check for this role, resulting in NO data visibility for casino admins.
  
  ## Solution
  Update policies to explicitly allow casino_admin role from users table to access
  their own casino's data.
  
  ## Tables Updated
  - wellbeing_game_sessions
  - wellbeing_risk_scores
  - esg_metrics (already has correct policies)
  
  ## Security
  - Casino admins can only see data from their own casino
  - Super admins and regulators can see all data
  - Staff can see their casino's data
*/

-- ============================================================
-- WELLBEING GAME SESSIONS
-- ============================================================

DROP POLICY IF EXISTS "Casino staff can view own casino game sessions" ON wellbeing_game_sessions;

CREATE POLICY "Casino users can view own casino game sessions"
  ON wellbeing_game_sessions FOR SELECT
  TO authenticated
  USING (
    -- Casino admin can see their casino's sessions
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'casino_admin'
      AND users.casino_id = wellbeing_game_sessions.casino_id
    )
    OR
    -- Staff can see their casino's sessions
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = wellbeing_game_sessions.casino_id
    )
    OR
    -- Super admins and regulators can see all sessions
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

-- ============================================================
-- WELLBEING RISK SCORES
-- ============================================================

DROP POLICY IF EXISTS "Casino staff can view own casino risk scores" ON wellbeing_risk_scores;

CREATE POLICY "Casino users can view own casino risk scores"
  ON wellbeing_risk_scores FOR SELECT
  TO authenticated
  USING (
    -- Casino admin can see their casino's risk scores
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'casino_admin'
      AND users.casino_id = wellbeing_risk_scores.casino_id
    )
    OR
    -- Staff can see their casino's risk scores
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.casino_id = wellbeing_risk_scores.casino_id
    )
    OR
    -- Super admins and regulators can see all risk scores
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

-- ============================================================
-- OTHER ESG TABLES (for consistency)
-- ============================================================

-- responsible_gambling_contributions
DROP POLICY IF EXISTS "Casino users can view contributions" ON responsible_gambling_contributions;
CREATE POLICY "Casino users can view contributions"
  ON responsible_gambling_contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('super_admin', 'regulator')
        OR (users.role = 'casino_admin' AND users.casino_id = responsible_gambling_contributions.casino_id)
      )
    )
  );

-- self_exclusion_registry
DROP POLICY IF EXISTS "Casino users can view exclusions" ON self_exclusion_registry;
CREATE POLICY "Casino users can view exclusions"
  ON self_exclusion_registry FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('super_admin', 'regulator')
        OR (users.role = 'casino_admin' AND users.casino_id = self_exclusion_registry.casino_id)
      )
    )
  );

-- player_protection_interventions
DROP POLICY IF EXISTS "Casino users can view interventions" ON player_protection_interventions;
CREATE POLICY "Casino users can view interventions"
  ON player_protection_interventions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('super_admin', 'regulator')
        OR (users.role = 'casino_admin' AND users.casino_id = player_protection_interventions.casino_id)
      )
    )
  );

-- employee_rg_training
DROP POLICY IF EXISTS "Casino users can view training" ON employee_rg_training;
CREATE POLICY "Casino users can view training"
  ON employee_rg_training FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.role IN ('super_admin', 'regulator')
        OR (users.role = 'casino_admin' AND users.casino_id = employee_rg_training.casino_id)
      )
    )
  );
