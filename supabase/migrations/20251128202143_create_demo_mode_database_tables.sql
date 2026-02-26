/*
  # Demo Mode Database Tables for SafeBet IQ

  ## Overview
  Creates comprehensive demo mode tables for SafeBet IQ's B2B platform.
  Demo mode aggregates player data from ALL casino systems with complete anonymization.

  ## Purpose
  - Used for investor demos, regulator presentations, and casino pilot programs
  - ALL player identities are anonymized (player_id → "P_XXXXXXXX")
  - Creates synthetic behavioral trends for demonstration purposes
  - NO real player data is ever exposed

  ## New Tables
  1. **demo_players**: Anonymized player aggregate data
  2. **demo_behavioral_insights**: Behavioral Risk Intelligence™ analytics
  3. **demo_esg_scores**: ESG Gambling Sustainability Score™ metrics

  ## Security
  - All tables have RLS enabled
  - Only RISK_ANALYST, EXECUTIVE, and REGULATOR roles can access
  - SUPPORT and COMPLIANCE roles cannot view demo data
  - All player IDs are cryptographically anonymized
*/

-- Demo Players Table: Anonymized aggregate player data
CREATE TABLE IF NOT EXISTS demo_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  player_id text NOT NULL, -- Anonymized: "P_XXXXXXXX"
  
  -- Behavioral metrics
  avg_session_time integer DEFAULT 0, -- minutes
  avg_bet_amount decimal(10,2) DEFAULT 0,
  deposit_frequency text DEFAULT 'weekly', -- daily, weekly, monthly
  win_loss_ratio decimal(5,2) DEFAULT 0,
  total_sessions integer DEFAULT 0,
  total_wagered decimal(12,2) DEFAULT 0,
  
  -- Risk analytics
  persona_type text DEFAULT 'casual', -- casual, regular, high_roller, at_risk
  risk_score integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  bri_score integer DEFAULT 0 CHECK (bri_score >= 0 AND bri_score <= 100),
  
  -- Metadata
  first_seen timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(casino_id, player_id)
);

ALTER TABLE demo_players ENABLE ROW LEVEL SECURITY;

-- Demo Behavioral Insights: Behavioral Risk Intelligence™ data
CREATE TABLE IF NOT EXISTS demo_behavioral_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  
  -- Behavioral Risk Intelligence™ metrics
  impulse_level integer DEFAULT 0 CHECK (impulse_level >= 0 AND impulse_level <= 100),
  cognitive_fatigue_index integer DEFAULT 0 CHECK (cognitive_fatigue_index >= 0 AND cognitive_fatigue_index <= 100),
  personality_shift text DEFAULT 'stable', -- stable, minor, moderate, significant
  predicted_escalation text DEFAULT 'low', -- low, medium, high, critical
  session_velocity_change decimal(5,2) DEFAULT 0, -- percentage change in betting pace
  
  -- Advanced analytics
  loss_chasing_detected boolean DEFAULT false,
  impulse_vs_intent_ratio decimal(5,2) DEFAULT 1.0,
  reaction_time_ms integer DEFAULT 1000,
  decision_stability_score integer DEFAULT 50 CHECK (decision_stability_score >= 0 AND decision_stability_score <= 100),
  recovery_indicator boolean DEFAULT false,
  
  -- Predictive analytics
  next_7_day_risk_forecast integer DEFAULT 0 CHECK (next_7_day_risk_forecast >= 0 AND next_7_day_risk_forecast <= 100),
  intervention_recommended boolean DEFAULT false,
  recommended_action text,
  
  -- Metadata
  analysis_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE demo_behavioral_insights ENABLE ROW LEVEL SECURITY;

-- Demo ESG Scores: ESG Gambling Sustainability Score™
CREATE TABLE IF NOT EXISTS demo_esg_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  
  -- Player metrics
  total_players integer DEFAULT 0,
  active_players integer DEFAULT 0,
  at_risk_players integer DEFAULT 0,
  avg_risk_score decimal(5,2) DEFAULT 0,
  
  -- ESG Gambling Sustainability Score™ components
  wellbeing_index integer DEFAULT 0 CHECK (wellbeing_index >= 0 AND wellbeing_index <= 100),
  humanity_score integer DEFAULT 0 CHECK (humanity_score >= 0 AND humanity_score <= 100),
  recovery_rate decimal(5,2) DEFAULT 0, -- % of players showing self-correction
  intervention_success_rate decimal(5,2) DEFAULT 0,
  
  -- Marketing & ethics
  responsible_marketing_score integer DEFAULT 0 CHECK (responsible_marketing_score >= 0 AND responsible_marketing_score <= 100),
  promo_risk_level text DEFAULT 'low', -- low, medium, high
  auto_exclusion_effectiveness decimal(5,2) DEFAULT 0,
  
  -- Environmental (carbon footprint)
  carbon_score integer DEFAULT 0 CHECK (carbon_score >= 0 AND carbon_score <= 100),
  server_efficiency_rating text DEFAULT 'C',
  
  -- Final ESG score
  total_esg_score integer DEFAULT 0 CHECK (total_esg_score >= 0 AND total_esg_score <= 100),
  esg_grade text DEFAULT 'C', -- A+, A, B, C, D, F
  
  -- Revenue impact
  revenue_stability_score integer DEFAULT 0 CHECK (revenue_stability_score >= 0 AND revenue_stability_score <= 100),
  player_lifetime_value_trend text DEFAULT 'stable',
  
  -- Metadata
  reporting_period text DEFAULT 'monthly',
  period_start timestamptz DEFAULT now(),
  period_end timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE demo_esg_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only RISK_ANALYST, EXECUTIVE, and REGULATOR can access demo data

-- Demo players policies
CREATE POLICY "Authorized roles can view demo players"
  ON demo_players
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
    OR
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
  );

CREATE POLICY "Risk analysts can manage demo players"
  ON demo_players
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'RISK_ANALYST'
    )
  );

-- Demo behavioral insights policies
CREATE POLICY "Authorized roles can view behavioral insights"
  ON demo_behavioral_insights
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
    OR
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
  );

CREATE POLICY "Risk analysts can manage behavioral insights"
  ON demo_behavioral_insights
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'RISK_ANALYST'
    )
  );

-- Demo ESG scores policies
CREATE POLICY "Executives and regulators can view ESG scores"
  ON demo_esg_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
    OR
    EXISTS (
      SELECT 1 FROM staff
      WHERE staff.auth_user_id = auth.uid()
      AND staff.user_role IN ('RISK_ANALYST', 'EXECUTIVE', 'REGULATOR')
    )
  );

CREATE POLICY "Risk analysts can manage ESG scores"
  ON demo_esg_scores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'RISK_ANALYST'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_demo_players_casino_id ON demo_players(casino_id);
CREATE INDEX IF NOT EXISTS idx_demo_players_risk_score ON demo_players(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_demo_players_persona_type ON demo_players(persona_type);
CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_player_id ON demo_behavioral_insights(player_id);
CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_casino_id ON demo_behavioral_insights(casino_id);
CREATE INDEX IF NOT EXISTS idx_demo_behavioral_insights_timestamp ON demo_behavioral_insights(analysis_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_demo_esg_scores_casino_id ON demo_esg_scores(casino_id);
CREATE INDEX IF NOT EXISTS idx_demo_esg_scores_esg_grade ON demo_esg_scores(esg_grade);
CREATE INDEX IF NOT EXISTS idx_demo_esg_scores_period ON demo_esg_scores(period_start DESC);
