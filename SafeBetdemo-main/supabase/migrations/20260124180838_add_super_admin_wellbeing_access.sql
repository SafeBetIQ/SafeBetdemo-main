/*
  # Add Super Admin Access to Wellbeing Game System

  ## Summary
  Grants super admins full visibility into the wellbeing game system for administrative
  oversight and system management.

  ## Changes
  
  ### Security Policies Added
  - Super admins can view all wellbeing game sessions
  - Super admins can view all telemetry events
  - Super admins can view all player badges
  - Super admins can view all AI insights
  - Super admins can view all wellbeing campaigns
  - Super admins can view all wellbeing invitations
  - Super admins can view all risk scores

  ### RLS Policies
  All policies check for `users.role = 'super_admin'` to grant SELECT access.
  This enables the super admin dashboard to display comprehensive wellbeing data.

  ## Notes
  - Super admins have read-only access to wellbeing data
  - No modification or deletion permissions granted
  - Audit trail maintained through existing logging
*/

-- Super admin can view all wellbeing game sessions
CREATE POLICY "Super admins can view all wellbeing sessions"
  ON wellbeing_game_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all telemetry events
CREATE POLICY "Super admins can view all telemetry"
  ON wellbeing_game_telemetry_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all player badges
CREATE POLICY "Super admins can view all player badges"
  ON wellbeing_player_badges FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all AI insights
CREATE POLICY "Super admins can view all insights"
  ON wellbeing_game_insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all campaigns
CREATE POLICY "Super admins can view all campaigns"
  ON wellbeing_game_campaigns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all invitations
CREATE POLICY "Super admins can view all invitations"
  ON wellbeing_game_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Super admin can view all risk scores
CREATE POLICY "Super admins can view all risk scores"
  ON wellbeing_risk_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );
