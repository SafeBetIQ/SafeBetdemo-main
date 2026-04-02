/*
  # Create King IV-Aligned ESG Framework
  
  ## Overview
  Implements a comprehensive ESG framework explicitly aligned with King IV principles
  for responsible gambling compliance, suitable for boards, regulators, and investors.
  
  ## King IV Principles (17 Principles)
  - Leadership, Ethics & Corporate Citizenship (Principles 1-3)
  - Strategy, Performance & Reporting (Principles 4-5)
  - Governing Structures & Delegation (Principles 6-7)
  - Governance Functional Areas (Principles 8-11)
  - Stakeholder Relationships (Principles 12-17)
  
  ## King IV Outcomes
  1. Ethical Culture
  2. Good Performance
  3. Effective Control
  4. Legitimacy
  
  ## ESG Weighting (Read-Only Overlay Model)
  - Environmental: 15% (Indirect impact, operational efficiency)
  - Social: 55% (Player protection, employee competency, community impact)
  - Governance: 30% (Audit, oversight, accountability, transparency)
  
  ## New Tables
  
  ### `king_iv_principles`
  Defines the 17 King IV principles and their mapping to ESG categories
  
  ### `king_iv_outcomes`
  Defines the 4 King IV outcomes and their measurement criteria
  
  ### `esg_king_iv_mapping`
  Maps ESG metrics to King IV principles and outcomes
  
  ### `esg_scores`
  Stores calculated ESG scores (E/S/G breakdown + composite score)
  
  ### `esg_evidence_trail`
  Audit trail of evidence supporting each ESG metric and score
  
  ### `king_iv_compliance_status`
  Tracks compliance status for each principle per casino
  
  ## Security
  - Enable RLS on all tables
  - Super admins and regulators can view all data
  - Casino admins can view their own ESG data
  - All data is read-only evidence (no system control)
*/

-- King IV Principles Master Table
CREATE TABLE IF NOT EXISTS king_iv_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principle_number integer NOT NULL UNIQUE CHECK (principle_number >= 1 AND principle_number <= 17),
  principle_title text NOT NULL,
  principle_description text NOT NULL,
  principle_category text NOT NULL CHECK (principle_category IN (
    'leadership_ethics_citizenship',
    'strategy_performance_reporting',
    'governing_structures',
    'governance_functional_areas',
    'stakeholder_relationships'
  )),
  esg_category text NOT NULL CHECK (esg_category IN ('environmental', 'social', 'governance')),
  esg_weighting decimal(5,2) NOT NULL CHECK (esg_weighting >= 0 AND esg_weighting <= 100),
  recommended_practices jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- King IV Outcomes Master Table
CREATE TABLE IF NOT EXISTS king_iv_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outcome_number integer NOT NULL UNIQUE CHECK (outcome_number >= 1 AND outcome_number <= 4),
  outcome_name text NOT NULL,
  outcome_description text NOT NULL,
  measurement_criteria jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- ESG to King IV Mapping Table
CREATE TABLE IF NOT EXISTS esg_king_iv_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esg_metric_name text NOT NULL,
  esg_metric_description text NOT NULL,
  esg_category text NOT NULL CHECK (esg_category IN ('environmental', 'social', 'governance')),
  king_iv_principle_id uuid REFERENCES king_iv_principles(id) NOT NULL,
  king_iv_outcome_ids uuid[] NOT NULL,
  measurement_method text NOT NULL,
  evidence_requirements jsonb NOT NULL DEFAULT '[]',
  calculation_formula text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ESG Scores Table (Calculated Scores)
CREATE TABLE IF NOT EXISTS esg_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  scoring_period_start date NOT NULL,
  scoring_period_end date NOT NULL,
  
  -- Overall King IV ESG Score (0-100)
  composite_score decimal(5,2) NOT NULL CHECK (composite_score >= 0 AND composite_score <= 100),
  
  -- Category Scores (0-100)
  environmental_score decimal(5,2) NOT NULL CHECK (environmental_score >= 0 AND environmental_score <= 100),
  social_score decimal(5,2) NOT NULL CHECK (social_score >= 0 AND social_score <= 100),
  governance_score decimal(5,2) NOT NULL CHECK (governance_score >= 0 AND governance_score <= 100),
  
  -- Weighted Category Contributions
  environmental_weighted decimal(5,2) NOT NULL, -- 15% of composite
  social_weighted decimal(5,2) NOT NULL,        -- 55% of composite
  governance_weighted decimal(5,2) NOT NULL,    -- 30% of composite
  
  -- King IV Outcome Scores
  ethical_culture_score decimal(5,2) CHECK (ethical_culture_score >= 0 AND ethical_culture_score <= 100),
  good_performance_score decimal(5,2) CHECK (good_performance_score >= 0 AND good_performance_score <= 100),
  effective_control_score decimal(5,2) CHECK (effective_control_score >= 0 AND effective_control_score <= 100),
  legitimacy_score decimal(5,2) CHECK (legitimacy_score >= 0 AND legitimacy_score <= 100),
  
  -- Trend Analysis
  previous_composite_score decimal(5,2),
  score_change decimal(5,2),
  trend_direction text CHECK (trend_direction IN ('improving', 'stable', 'declining', 'new')),
  
  -- Metadata
  calculation_method text DEFAULT 'automated',
  data_sources jsonb NOT NULL DEFAULT '[]',
  scoring_confidence text CHECK (scoring_confidence IN ('high', 'medium', 'low')) DEFAULT 'high',
  notes text,
  calculated_at timestamptz DEFAULT now(),
  calculated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ESG Evidence Trail Table
CREATE TABLE IF NOT EXISTS esg_evidence_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  esg_score_id uuid REFERENCES esg_scores(id),
  king_iv_principle_id uuid REFERENCES king_iv_principles(id),
  
  -- Evidence Details
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'intervention_log',
    'audit_record',
    'training_completion',
    'risk_identification',
    'regulatory_submission',
    'financial_contribution',
    'self_exclusion_record',
    'helpline_interaction',
    'system_log',
    'third_party_verification'
  )),
  evidence_source text NOT NULL,
  evidence_timestamp timestamptz NOT NULL,
  evidence_data jsonb NOT NULL DEFAULT '{}',
  evidence_hash text, -- For tamper detection
  
  -- Traceability
  metric_name text NOT NULL,
  metric_value decimal(15,4),
  contribution_to_score decimal(5,2),
  
  -- Verification
  verified boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  
  created_at timestamptz DEFAULT now()
);

-- King IV Compliance Status Table
CREATE TABLE IF NOT EXISTS king_iv_compliance_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) NOT NULL,
  king_iv_principle_id uuid REFERENCES king_iv_principles(id) NOT NULL,
  assessment_date date NOT NULL,
  
  -- Compliance Status
  compliance_level text NOT NULL CHECK (compliance_level IN ('applied', 'partially_applied', 'not_applied', 'not_applicable', 'under_review')),
  compliance_score decimal(5,2) CHECK (compliance_score >= 0 AND compliance_score <= 100),
  
  -- Explanation (King IV requires "apply or explain")
  explanation text NOT NULL,
  evidence_references uuid[] DEFAULT '{}',
  
  -- Actions & Improvements
  improvement_areas text[],
  recommended_actions text[],
  target_completion_date date,
  
  -- Review
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  next_review_date date,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(casino_id, king_iv_principle_id, assessment_date)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_king_iv_principles_category ON king_iv_principles(principle_category);
CREATE INDEX IF NOT EXISTS idx_king_iv_principles_esg ON king_iv_principles(esg_category);
CREATE INDEX IF NOT EXISTS idx_esg_mapping_category ON esg_king_iv_mapping(esg_category);
CREATE INDEX IF NOT EXISTS idx_esg_mapping_principle ON esg_king_iv_mapping(king_iv_principle_id);
CREATE INDEX IF NOT EXISTS idx_esg_scores_casino_period ON esg_scores(casino_id, scoring_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_esg_scores_composite ON esg_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_esg_evidence_casino ON esg_evidence_trail(casino_id, evidence_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_esg_evidence_principle ON esg_evidence_trail(king_iv_principle_id);
CREATE INDEX IF NOT EXISTS idx_esg_evidence_score ON esg_evidence_trail(esg_score_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status_casino ON king_iv_compliance_status(casino_id, assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_status_principle ON king_iv_compliance_status(king_iv_principle_id);

-- Enable RLS
ALTER TABLE king_iv_principles ENABLE ROW LEVEL SECURITY;
ALTER TABLE king_iv_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_king_iv_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE esg_evidence_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE king_iv_compliance_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies: King IV Principles (Public Reference Data)
CREATE POLICY "Everyone can view King IV principles"
  ON king_iv_principles FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: King IV Outcomes (Public Reference Data)
CREATE POLICY "Everyone can view King IV outcomes"
  ON king_iv_outcomes FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies: ESG Mapping (Public Reference Data)
CREATE POLICY "Everyone can view ESG mapping"
  ON esg_king_iv_mapping FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage ESG mapping"
  ON esg_king_iv_mapping FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

-- RLS Policies: ESG Scores
CREATE POLICY "Super admins can manage all ESG scores"
  ON esg_scores FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all ESG scores"
  ON esg_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can view their casino ESG scores"
  ON esg_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = esg_scores.casino_id
    )
  );

-- RLS Policies: ESG Evidence Trail
CREATE POLICY "Super admins can view all evidence"
  ON esg_evidence_trail FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all evidence"
  ON esg_evidence_trail FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can view their casino evidence"
  ON esg_evidence_trail FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = esg_evidence_trail.casino_id
    )
  );

-- RLS Policies: Compliance Status
CREATE POLICY "Super admins can manage all compliance status"
  ON king_iv_compliance_status FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

CREATE POLICY "Regulators can view all compliance status"
  ON king_iv_compliance_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator')
  );

CREATE POLICY "Casino admins can view their casino compliance status"
  ON king_iv_compliance_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'casino_admin' 
      AND users.casino_id = king_iv_compliance_status.casino_id
    )
  );
