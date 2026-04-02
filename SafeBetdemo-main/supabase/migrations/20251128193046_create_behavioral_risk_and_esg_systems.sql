/*
  # Create Behavioral Risk Intelligence and ESG Compliance Systems
  
  1. New Tables
    - `behavioral_risk_profiles`
      - Real-time risk detection using AI and behavioral analytics
      - Tracks impulse vs intentional betting patterns
      - Cognitive fatigue and personality shift analysis
      - Risk scores per player (0-100)
    
    - `esg_compliance_scores`
      - World's first ESG scoring system for casinos
      - Player Wellbeing Index and Casino Humanity Score
      - Recovery Rate and Responsible Marketing Analysis
      - Carbon Energy Score and Total ESG Rating (A-F)
    
    - `intervention_history`
      - Track all AI-powered interventions
      - Record intervention success rates
      - Audit trail for compliance
  
  2. Security
    - Enable RLS on all new tables
    - Policies for casino admins to view their own data
    - Regulators can view all data
    - Staff can view their casino's data
*/

-- Create behavioral_risk_profiles table
CREATE TABLE IF NOT EXISTS behavioral_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  session_id uuid,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  
  -- Risk Scoring
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  
  -- Behavioral Metrics
  impulse_level decimal(5,2) DEFAULT 0.00 CHECK (impulse_level >= 0 AND impulse_level <= 100),
  betting_velocity decimal(10,2) DEFAULT 0.00,
  session_duration_minutes integer DEFAULT 0,
  reaction_time_ms integer DEFAULT 0,
  
  -- Cognitive Analysis
  fatigue_index decimal(5,2) DEFAULT 0.00 CHECK (fatigue_index >= 0 AND fatigue_index <= 100),
  personality_shift_score decimal(5,2) DEFAULT 0.00 CHECK (personality_shift_score >= 0 AND personality_shift_score <= 100),
  emotional_state text DEFAULT 'neutral',
  
  -- Actions
  advised_break boolean DEFAULT false,
  intervention_triggered boolean DEFAULT false,
  intervention_accepted boolean DEFAULT false,
  
  -- Metadata
  analyzed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create esg_compliance_scores table
CREATE TABLE IF NOT EXISTS esg_compliance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid,
  
  -- ESG Metrics
  wellbeing_index decimal(5,2) DEFAULT 0.00 CHECK (wellbeing_index >= 0 AND wellbeing_index <= 100),
  humanity_score decimal(5,2) DEFAULT 0.00 CHECK (humanity_score >= 0 AND humanity_score <= 100),
  recovery_rate decimal(5,2) DEFAULT 0.00 CHECK (recovery_rate >= 0 AND recovery_rate <= 100),
  promo_risk_level decimal(5,2) DEFAULT 0.00 CHECK (promo_risk_level >= 0 AND promo_risk_level <= 100),
  carbon_score decimal(5,2) DEFAULT 0.00 CHECK (carbon_score >= 0 AND carbon_score <= 100),
  
  -- Total ESG Score
  total_esg_score decimal(5,2) DEFAULT 0.00 CHECK (total_esg_score >= 0 AND total_esg_score <= 100),
  esg_grade text DEFAULT 'C' CHECK (esg_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F')),
  
  -- Compliance Metrics
  ethical_revenue_percentage decimal(5,2) DEFAULT 0.00,
  intervention_success_rate decimal(5,2) DEFAULT 0.00,
  self_correction_rate decimal(5,2) DEFAULT 0.00,
  
  -- Metadata
  reporting_period_start timestamptz,
  reporting_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create intervention_history table
CREATE TABLE IF NOT EXISTS intervention_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  risk_profile_id uuid REFERENCES behavioral_risk_profiles(id) ON DELETE SET NULL,
  
  -- Intervention Details
  intervention_type text NOT NULL CHECK (intervention_type IN ('break_suggestion', 'session_limit', 'cooling_off', 'self_exclusion', 'contact_support', 'educational_content')),
  trigger_reason text NOT NULL,
  risk_score_at_trigger integer NOT NULL,
  
  -- Communication
  delivery_method text CHECK (delivery_method IN ('in_app', 'whatsapp', 'sms', 'email')),
  message_sent text,
  
  -- Response
  player_response text CHECK (player_response IN ('accepted', 'declined', 'ignored', 'deferred')),
  action_taken text,
  intervention_successful boolean DEFAULT false,
  
  -- Metadata
  triggered_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_player ON behavioral_risk_profiles(player_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_casino ON behavioral_risk_profiles(casino_id);
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_score ON behavioral_risk_profiles(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_behavioral_risk_analyzed_at ON behavioral_risk_profiles(analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_esg_casino ON esg_compliance_scores(casino_id);
CREATE INDEX IF NOT EXISTS idx_esg_player ON esg_compliance_scores(player_id);
CREATE INDEX IF NOT EXISTS idx_esg_grade ON esg_compliance_scores(esg_grade);
CREATE INDEX IF NOT EXISTS idx_esg_created_at ON esg_compliance_scores(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intervention_player ON intervention_history(player_id);
CREATE INDEX IF NOT EXISTS idx_intervention_casino ON intervention_history(casino_id);
CREATE INDEX IF NOT EXISTS idx_intervention_triggered_at ON intervention_history(triggered_at DESC);

-- Enable Row Level Security
ALTER TABLE behavioral_risk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_compliance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for behavioral_risk_profiles
CREATE POLICY "Super admins can view all behavioral risk data"
  ON behavioral_risk_profiles FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Regulators can view all behavioral risk data"
  ON behavioral_risk_profiles FOR SELECT
  TO authenticated
  USING (is_regulator());

CREATE POLICY "Casino admins can view their casino's behavioral risk data"
  ON behavioral_risk_profiles FOR SELECT
  TO authenticated
  USING (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can insert behavioral risk data"
  ON behavioral_risk_profiles FOR INSERT
  TO authenticated
  WITH CHECK (casino_id = get_user_casino_id() OR is_super_admin());

CREATE POLICY "Casino admins can update their casino's behavioral risk data"
  ON behavioral_risk_profiles FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id() OR is_super_admin());

-- RLS Policies for esg_compliance_scores
CREATE POLICY "Super admins can view all ESG scores"
  ON esg_compliance_scores FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Regulators can view all ESG scores"
  ON esg_compliance_scores FOR SELECT
  TO authenticated
  USING (is_regulator());

CREATE POLICY "Casino admins can view their casino's ESG scores"
  ON esg_compliance_scores FOR SELECT
  TO authenticated
  USING (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can insert ESG scores"
  ON esg_compliance_scores FOR INSERT
  TO authenticated
  WITH CHECK (casino_id = get_user_casino_id() OR is_super_admin());

CREATE POLICY "Casino admins can update their casino's ESG scores"
  ON esg_compliance_scores FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id() OR is_super_admin());

-- RLS Policies for intervention_history
CREATE POLICY "Super admins can view all intervention history"
  ON intervention_history FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Regulators can view all intervention history"
  ON intervention_history FOR SELECT
  TO authenticated
  USING (is_regulator());

CREATE POLICY "Casino admins can view their casino's intervention history"
  ON intervention_history FOR SELECT
  TO authenticated
  USING (casino_id = get_user_casino_id());

CREATE POLICY "Casino admins can insert intervention history"
  ON intervention_history FOR INSERT
  TO authenticated
  WITH CHECK (casino_id = get_user_casino_id() OR is_super_admin());

CREATE POLICY "Casino admins can update their casino's intervention history"
  ON intervention_history FOR UPDATE
  TO authenticated
  USING (casino_id = get_user_casino_id() OR is_super_admin());
