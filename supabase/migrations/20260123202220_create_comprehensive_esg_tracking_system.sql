/*
  # Create Comprehensive ESG Tracking System
  
  Aligned with Sun International ESG Report 2024 requirements:
  - R7M+ annual contribution to National Responsible Gambling Programme (NRGP)
  - Self-exclusion program tracking (6-month minimum periods)
  - Employee training metrics for responsible gambling
  - Player protection and intervention tracking
  - ESG reporting metrics for regulators and stakeholders
  - Social impact measurements
  - Governance and compliance monitoring

  1. New Tables
    - `esg_metrics` - Core ESG performance metrics by casino
    - `responsible_gambling_contributions` - Financial contributions to NRGP and programs
    - `self_exclusion_registry` - Self-exclusion program tracking
    - `player_protection_interventions` - AI-driven intervention tracking
    - `employee_rg_training` - Responsible gambling training completion
    - `esg_reports` - Generated ESG reports for stakeholders
    - `social_impact_metrics` - Community and social responsibility tracking
    - `helpline_interactions` - NRGP helpline interaction tracking

  2. Security
    - Enable RLS on all tables
    - Super admins can view/manage all ESG data
    - Regulators can view all ESG data (read-only)
    - Casino admins can view/manage their casino's ESG data
    - Staff have limited read access to training data

  3. Performance
    - Indexes on casino_id, reporting_period, created_at
    - Optimized queries for dashboard aggregations
*/

-- ESG Metrics Core Table
CREATE TABLE IF NOT EXISTS esg_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  reporting_period date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'annual')),
  
  -- Responsible Gambling Metrics
  nrgp_contribution_amount decimal(15,2) DEFAULT 0,
  total_players_screened integer DEFAULT 0,
  high_risk_players_identified integer DEFAULT 0,
  interventions_performed integer DEFAULT 0,
  successful_interventions integer DEFAULT 0,
  self_exclusions_active integer DEFAULT 0,
  self_exclusions_new integer DEFAULT 0,
  
  -- Training Metrics
  employees_trained integer DEFAULT 0,
  training_completion_rate decimal(5,2) DEFAULT 0,
  training_hours_delivered decimal(10,2) DEFAULT 0,
  
  -- Player Protection Metrics
  problem_gambling_referrals integer DEFAULT 0,
  helpline_contacts integer DEFAULT 0,
  counseling_sessions_funded integer DEFAULT 0,
  
  -- Social Impact Metrics
  community_investment_amount decimal(15,2) DEFAULT 0,
  local_jobs_created integer DEFAULT 0,
  
  -- Governance Metrics
  compliance_audits_passed integer DEFAULT 0,
  compliance_issues_resolved integer DEFAULT 0,
  regulatory_violations integer DEFAULT 0,
  
  -- Environmental Metrics (bonus for holistic ESG)
  renewable_energy_kwh decimal(15,2) DEFAULT 0,
  carbon_emissions_tons decimal(15,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- Responsible Gambling Contributions
CREATE TABLE IF NOT EXISTS responsible_gambling_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  contribution_date date NOT NULL,
  program_name text NOT NULL,
  contribution_amount decimal(15,2) NOT NULL,
  recipient_organization text NOT NULL,
  contribution_type text CHECK (contribution_type IN ('nrgp', 'sargf', 'treatment_program', 'research', 'education', 'other')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- Self-Exclusion Registry (GDPR/POPIA compliant)
CREATE TABLE IF NOT EXISTS self_exclusion_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  player_id uuid REFERENCES players(id) NOT NULL,
  exclusion_start_date date NOT NULL,
  exclusion_end_date date NOT NULL,
  minimum_period_months integer DEFAULT 6,
  exclusion_type text CHECK (exclusion_type IN ('self_requested', 'operator_initiated', 'regulatory_order')),
  treatment_required boolean DEFAULT true,
  counseling_sessions_completed integer DEFAULT 0,
  counseling_sessions_required integer DEFAULT 6,
  reinstatement_requested boolean DEFAULT false,
  reinstatement_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'breached', 'extended')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Player Protection Interventions
CREATE TABLE IF NOT EXISTS player_protection_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  player_id uuid REFERENCES players(id) NOT NULL,
  intervention_date timestamptz NOT NULL DEFAULT now(),
  intervention_type text CHECK (intervention_type IN ('ai_alert', 'manual_review', 'limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral')),
  risk_score integer CHECK (risk_score >= 0 AND risk_score <= 100),
  trigger_reason text NOT NULL,
  action_taken text NOT NULL,
  outcome text CHECK (outcome IN ('accepted', 'declined', 'pending', 'successful', 'unsuccessful')),
  follow_up_required boolean DEFAULT false,
  follow_up_date date,
  staff_id uuid REFERENCES staff(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Employee Responsible Gambling Training
CREATE TABLE IF NOT EXISTS employee_rg_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  staff_id uuid REFERENCES staff(id) NOT NULL,
  training_program text NOT NULL,
  training_provider text DEFAULT 'SARGF',
  training_date date NOT NULL,
  completion_status text DEFAULT 'pending' CHECK (completion_status IN ('pending', 'completed', 'failed', 'expired')),
  certificate_issued boolean DEFAULT false,
  certificate_number text,
  expiry_date date,
  hours_completed decimal(5,2) DEFAULT 0,
  score decimal(5,2),
  next_training_due date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ESG Reports
CREATE TABLE IF NOT EXISTS esg_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  report_type text CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'ad_hoc')),
  report_period_start date NOT NULL,
  report_period_end date NOT NULL,
  generated_date timestamptz DEFAULT now(),
  generated_by uuid REFERENCES users(id),
  report_format text DEFAULT 'pdf' CHECK (report_format IN ('pdf', 'excel', 'json')),
  report_url text,
  report_data jsonb,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'submitted_to_regulator')),
  submitted_to_regulator_date timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Social Impact Metrics
CREATE TABLE IF NOT EXISTS social_impact_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  metric_date date NOT NULL,
  
  -- Community Investment
  community_investment_amount decimal(15,2) DEFAULT 0,
  beneficiaries_reached integer DEFAULT 0,
  programs_supported integer DEFAULT 0,
  
  -- Employment Impact
  local_jobs_total integer DEFAULT 0,
  jobs_created_period integer DEFAULT 0,
  youth_employed integer DEFAULT 0,
  skills_development_investment decimal(15,2) DEFAULT 0,
  
  -- Responsible Gambling Outreach
  awareness_campaigns_conducted integer DEFAULT 0,
  people_reached integer DEFAULT 0,
  educational_materials_distributed integer DEFAULT 0,
  
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- Helpline Interactions Tracking
CREATE TABLE IF NOT EXISTS helpline_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  interaction_date timestamptz NOT NULL DEFAULT now(),
  caller_type text CHECK (caller_type IN ('player', 'family_member', 'concerned_party', 'anonymous')),
  issue_category text CHECK (issue_category IN ('problem_gambling', 'self_exclusion', 'information', 'treatment_referral', 'complaint', 'other')),
  outcome text CHECK (outcome IN ('referred_to_treatment', 'information_provided', 'self_exclusion_initiated', 'follow_up_scheduled', 'resolved')),
  follow_up_required boolean DEFAULT false,
  anonymized_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_esg_metrics_casino_period ON esg_metrics(casino_id, reporting_period DESC);
CREATE INDEX IF NOT EXISTS idx_esg_metrics_period_type ON esg_metrics(period_type, reporting_period DESC);
CREATE INDEX IF NOT EXISTS idx_rg_contributions_casino ON responsible_gambling_contributions(casino_id, contribution_date DESC);
CREATE INDEX IF NOT EXISTS idx_self_exclusion_casino_status ON self_exclusion_registry(casino_id, status, exclusion_end_date);
CREATE INDEX IF NOT EXISTS idx_self_exclusion_player ON self_exclusion_registry(player_id, status);
CREATE INDEX IF NOT EXISTS idx_interventions_casino_date ON player_protection_interventions(casino_id, intervention_date DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_player ON player_protection_interventions(player_id, intervention_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_training_casino ON employee_rg_training(casino_id, training_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_training_staff ON employee_rg_training(staff_id, completion_status);
CREATE INDEX IF NOT EXISTS idx_esg_reports_casino ON esg_reports(casino_id, report_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_social_impact_casino ON social_impact_metrics(casino_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_helpline_date ON helpline_interactions(interaction_date DESC);

-- Enable RLS on all tables
ALTER TABLE esg_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsible_gambling_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_exclusion_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_protection_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rg_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpline_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: ESG Metrics
CREATE POLICY "Super admins can manage all ESG metrics"
  ON esg_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all ESG metrics"
  ON esg_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino ESG metrics"
  ON esg_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = esg_metrics.casino_id
    )
  );

-- RLS Policies: Responsible Gambling Contributions
CREATE POLICY "Super admins can manage all RG contributions"
  ON responsible_gambling_contributions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all RG contributions"
  ON responsible_gambling_contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino RG contributions"
  ON responsible_gambling_contributions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = responsible_gambling_contributions.casino_id
    )
  );

-- RLS Policies: Self-Exclusion Registry (highly sensitive)
CREATE POLICY "Super admins can view all self-exclusions"
  ON self_exclusion_registry FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all self-exclusions"
  ON self_exclusion_registry FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino self-exclusions"
  ON self_exclusion_registry FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = self_exclusion_registry.casino_id
    )
  );

-- RLS Policies: Player Protection Interventions
CREATE POLICY "Super admins can view all interventions"
  ON player_protection_interventions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all interventions"
  ON player_protection_interventions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino interventions"
  ON player_protection_interventions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = player_protection_interventions.casino_id
    )
  );

-- RLS Policies: Employee Training
CREATE POLICY "Super admins can manage all training records"
  ON employee_rg_training FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all training records"
  ON employee_rg_training FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino training records"
  ON employee_rg_training FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = employee_rg_training.casino_id
    )
  );

CREATE POLICY "Staff can view own training records"
  ON employee_rg_training FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.id = employee_rg_training.staff_id)
  );

-- RLS Policies: ESG Reports
CREATE POLICY "Super admins can manage all ESG reports"
  ON esg_reports FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all ESG reports"
  ON esg_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino ESG reports"
  ON esg_reports FOR ALL
  TO authenticated
  USING (
    casino_id IS NULL OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = esg_reports.casino_id
    )
  );

-- RLS Policies: Social Impact Metrics
CREATE POLICY "Super admins can manage all social impact metrics"
  ON social_impact_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all social impact metrics"
  ON social_impact_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can manage their casino social impact metrics"
  ON social_impact_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = social_impact_metrics.casino_id
    )
  );

-- RLS Policies: Helpline Interactions
CREATE POLICY "Super admins can view all helpline interactions"
  ON helpline_interactions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all helpline interactions"
  ON helpline_interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can view their casino helpline interactions"
  ON helpline_interactions FOR SELECT
  TO authenticated
  USING (
    casino_id IS NULL OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = helpline_interactions.casino_id
    )
  );