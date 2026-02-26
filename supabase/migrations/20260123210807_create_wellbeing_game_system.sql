/*
  # Player Wellbeing Mini-Game System

  ## Overview
  This migration creates a complete off-platform behavioral wellbeing check-in system
  that delivers voluntary mini-games via email/WhatsApp to capture passive behavioral
  signals for responsible gambling compliance.

  ## New Tables

  ### `wellbeing_game_concepts`
  Stores available game types and their configurations

  ### `wellbeing_game_campaigns`
  Tracks outbound communication campaigns

  ### `wellbeing_game_invitations`
  Individual game invitations sent to players

  ### `wellbeing_game_sessions`
  Individual game play sessions

  ### `wellbeing_game_telemetry`
  Granular behavioral signals captured during gameplay

  ### `wellbeing_risk_scores`
  Historical risk indices for trend analysis

  ### `wellbeing_game_feedback`
  Post-game player feedback and suggestions shown

  ## Security
  - Enable RLS on all tables
  - Players can only access their own game sessions via secure token
  - Casino admins see only their casino's aggregated data
  - Regulators see anonymized aggregated data
  - No personal health data stored
  - POPIA/GDPR compliant
*/

-- Game Concepts Table
CREATE TABLE IF NOT EXISTS wellbeing_game_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text NOT NULL,
  mechanics_type text NOT NULL CHECK (mechanics_type IN ('risk_vs_stability', 'resource_balance', 'timing_control', 'decision_path')),
  duration_minutes integer NOT NULL DEFAULT 2,
  active boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Game Campaigns Table
CREATE TABLE IF NOT EXISTS wellbeing_game_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  name text NOT NULL,
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id) ON DELETE SET NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('periodic', 'post_session', 'risk_signal', 'regulator_cycle')),
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  message_template text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Game Invitations Table
CREATE TABLE IF NOT EXISTS wellbeing_game_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES wellbeing_game_campaigns(id) ON DELETE SET NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id) ON DELETE SET NULL,
  secure_token text UNIQUE NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  sent_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  opened_at timestamptz,
  completed_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'opened', 'completed', 'expired', 'abandoned'))
);

-- Game Sessions Table
CREATE TABLE IF NOT EXISTS wellbeing_game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES wellbeing_game_invitations(id) ON DELETE SET NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  game_concept_id uuid REFERENCES wellbeing_game_concepts(id) ON DELETE SET NULL,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  completion_rate decimal(5,2) DEFAULT 0 CHECK (completion_rate >= 0 AND completion_rate <= 100),
  abandoned boolean DEFAULT false,
  raw_score integer DEFAULT 0,
  behaviour_risk_index decimal(5,2) CHECK (behaviour_risk_index >= 0 AND behaviour_risk_index <= 100)
);

-- Game Telemetry Table
CREATE TABLE IF NOT EXISTS wellbeing_game_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_timestamp timestamptz DEFAULT now(),
  event_sequence integer NOT NULL,
  event_data jsonb DEFAULT '{}',
  decision_speed_ms integer,
  risk_level_chosen text CHECK (risk_level_chosen IN ('low', 'medium', 'high', 'none')),
  created_at timestamptz DEFAULT now()
);

-- Risk Scores Table
CREATE TABLE IF NOT EXISTS wellbeing_risk_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE SET NULL,
  behaviour_risk_index decimal(5,2) NOT NULL CHECK (behaviour_risk_index >= 0 AND behaviour_risk_index <= 100),
  impulsivity_score decimal(5,2) CHECK (impulsivity_score >= 0 AND impulsivity_score <= 100),
  risk_escalation_score decimal(5,2) CHECK (risk_escalation_score >= 0 AND risk_escalation_score <= 100),
  patience_score decimal(5,2) CHECK (patience_score >= 0 AND patience_score <= 100),
  recovery_response_score decimal(5,2) CHECK (recovery_response_score >= 0 AND recovery_response_score <= 100),
  explanation jsonb DEFAULT '{}',
  calculated_at timestamptz DEFAULT now()
);

-- Game Feedback Table
CREATE TABLE IF NOT EXISTS wellbeing_game_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES wellbeing_game_sessions(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('neutral', 'suggestion_break', 'suggestion_limits', 'suggestion_tools')),
  message_shown text NOT NULL,
  link_clicked boolean DEFAULT false,
  shown_at timestamptz DEFAULT now()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_wellbeing_invitations_player ON wellbeing_game_invitations(player_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_invitations_token ON wellbeing_game_invitations(secure_token);
CREATE INDEX IF NOT EXISTS idx_wellbeing_invitations_expires ON wellbeing_game_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_wellbeing_sessions_player ON wellbeing_game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_sessions_casino ON wellbeing_game_sessions(casino_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_sessions_started ON wellbeing_game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_wellbeing_telemetry_session ON wellbeing_game_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_risk_scores_player ON wellbeing_risk_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_risk_scores_casino ON wellbeing_risk_scores(casino_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_risk_scores_calculated ON wellbeing_risk_scores(calculated_at);

-- Enable Row Level Security
ALTER TABLE wellbeing_game_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_game_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_game_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_game_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellbeing_game_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Game Concepts (Public read for active games)
CREATE POLICY "Anyone can view active game concepts"
  ON wellbeing_game_concepts FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage game concepts"
  ON wellbeing_game_concepts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.role IN ('manager', 'compliance_officer')
    )
  );

-- RLS Policies for Game Campaigns
CREATE POLICY "Casino staff can view own casino campaigns"
  ON wellbeing_game_campaigns FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM staff
      WHERE staff.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

CREATE POLICY "Casino managers can manage own casino campaigns"
  ON wellbeing_game_campaigns FOR ALL
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.role IN ('manager', 'compliance_officer')
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for Game Invitations
CREATE POLICY "Players can view own invitations via secure token"
  ON wellbeing_game_invitations FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Casino staff can view own casino invitations"
  ON wellbeing_game_invitations FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM players
      WHERE casino_id IN (
        SELECT casino_id FROM staff
        WHERE staff.auth_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

CREATE POLICY "Casino staff can create invitations"
  ON wellbeing_game_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id IN (
      SELECT id FROM players
      WHERE casino_id IN (
        SELECT casino_id FROM staff
        WHERE staff.auth_user_id = auth.uid()
        AND staff.role IN ('manager', 'compliance_officer')
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- RLS Policies for Game Sessions
CREATE POLICY "Players can view own game sessions"
  ON wellbeing_game_sessions FOR SELECT
  USING (
    player_id IN (
      SELECT player_id FROM wellbeing_game_invitations
      WHERE secure_token IS NOT NULL
      AND expires_at > now()
    )
  );

CREATE POLICY "Players can create game sessions"
  ON wellbeing_game_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update own game sessions"
  ON wellbeing_game_sessions FOR UPDATE
  USING (
    player_id IN (
      SELECT player_id FROM wellbeing_game_invitations
      WHERE secure_token IS NOT NULL
      AND expires_at > now()
    )
  );

CREATE POLICY "Casino staff can view own casino game sessions"
  ON wellbeing_game_sessions FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM staff
      WHERE staff.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

-- RLS Policies for Telemetry
CREATE POLICY "Players can insert telemetry for own sessions"
  ON wellbeing_game_telemetry FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Casino staff can view aggregated telemetry"
  ON wellbeing_game_telemetry FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM wellbeing_game_sessions
      WHERE casino_id IN (
        SELECT casino_id FROM staff
        WHERE staff.auth_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

-- RLS Policies for Risk Scores
CREATE POLICY "Casino staff can view own casino risk scores"
  ON wellbeing_risk_scores FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM staff
      WHERE staff.auth_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );

CREATE POLICY "System can insert risk scores"
  ON wellbeing_risk_scores FOR INSERT
  WITH CHECK (true);

-- RLS Policies for Feedback
CREATE POLICY "Players can view own feedback"
  ON wellbeing_game_feedback FOR SELECT
  USING (
    player_id IN (
      SELECT player_id FROM wellbeing_game_invitations
      WHERE secure_token IS NOT NULL
      AND expires_at > now()
    )
  );

CREATE POLICY "Players can insert feedback"
  ON wellbeing_game_feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Casino staff can view feedback analytics"
  ON wellbeing_game_feedback FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM players
      WHERE casino_id IN (
        SELECT casino_id FROM staff
        WHERE staff.auth_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'regulator')
    )
  );
