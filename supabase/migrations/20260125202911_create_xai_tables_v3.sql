/*
  # Create Nova IQ XAI Intelligence System Tables

  Creates tables for AI Reason Stacks, Intervention Recommendations, and Intervention Outcomes
  to power the explainable AI system combining Nova IQ behavioral data with live casino analytics.
*/

-- Create AI Reason Stacks table
CREATE TABLE IF NOT EXISTS ai_reason_stacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence_score integer NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  contributing_factors jsonb NOT NULL DEFAULT '[]',
  nova_iq_weight_percent integer NOT NULL DEFAULT 0,
  casino_data_weight_percent integer NOT NULL DEFAULT 0,
  explanation_summary text NOT NULL,
  triggers_24h jsonb DEFAULT '[]',
  triggers_7d jsonb DEFAULT '[]',
  triggers_30d jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_reason_stacks_player ON ai_reason_stacks(player_id);
CREATE INDEX IF NOT EXISTS idx_ai_reason_stacks_casino ON ai_reason_stacks(casino_id);
CREATE INDEX IF NOT EXISTS idx_ai_reason_stacks_risk_level ON ai_reason_stacks(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_reason_stacks_created_at ON ai_reason_stacks(created_at DESC);

ALTER TABLE ai_reason_stacks ENABLE ROW LEVEL SECURITY;

-- Create AI Intervention Recommendations table
CREATE TABLE IF NOT EXISTS ai_intervention_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason_stack_id uuid REFERENCES ai_reason_stacks(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  intervention_type text NOT NULL CHECK (intervention_type IN ('soft_message', 'cooling_off', 'limit', 'escalation', 'monitor')),
  recommended_timing text NOT NULL CHECK (recommended_timing IN ('immediate', 'delayed', 'scheduled')),
  success_probability integer NOT NULL CHECK (success_probability >= 0 AND success_probability <= 100),
  rationale text NOT NULL,
  alternative_options jsonb DEFAULT '[]',
  staff_decision text CHECK (staff_decision IN ('accepted', 'overridden', 'deferred', 'pending')),
  staff_decision_rationale text,
  decided_by uuid REFERENCES staff(id),
  decided_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_player ON ai_intervention_recommendations(player_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_casino ON ai_intervention_recommendations(casino_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_created_at ON ai_intervention_recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_staff_decision ON ai_intervention_recommendations(staff_decision);

ALTER TABLE ai_intervention_recommendations ENABLE ROW LEVEL SECURITY;

-- Create AI Intervention Outcomes table
CREATE TABLE IF NOT EXISTS ai_intervention_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES ai_intervention_recommendations(id) ON DELETE SET NULL,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  intervention_type text NOT NULL,
  applied_at timestamptz NOT NULL,
  nova_iq_influenced boolean DEFAULT false,
  pre_risk_score integer NOT NULL,
  pre_impulsivity_score integer,
  post_risk_score_7d integer,
  post_risk_score_14d integer,
  post_risk_score_30d integer,
  outcome text CHECK (outcome IN ('risk_reduced', 'risk_stable', 'risk_increased', 'pending')),
  effectiveness_score integer CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  time_to_impact_days integer,
  player_response text,
  player_engagement_level text CHECK (player_engagement_level IN ('high', 'medium', 'low', 'none')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_outcomes_player ON ai_intervention_outcomes(player_id);
CREATE INDEX IF NOT EXISTS idx_ai_outcomes_casino ON ai_intervention_outcomes(casino_id);
CREATE INDEX IF NOT EXISTS idx_ai_outcomes_outcome ON ai_intervention_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_ai_outcomes_applied_at ON ai_intervention_outcomes(applied_at DESC);

ALTER TABLE ai_intervention_outcomes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins access all reason stacks" ON ai_reason_stacks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino staff access own reason stacks" ON ai_reason_stacks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.casino_id = ai_reason_stacks.casino_id));

CREATE POLICY "Regulators access all reason stacks" ON ai_reason_stacks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'));

CREATE POLICY "Super admins manage all recommendations" ON ai_intervention_recommendations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino staff manage own recommendations" ON ai_intervention_recommendations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.casino_id = ai_intervention_recommendations.casino_id));

CREATE POLICY "Regulators view all recommendations" ON ai_intervention_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'));

CREATE POLICY "Super admins manage all outcomes" ON ai_intervention_outcomes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino staff view own outcomes" ON ai_intervention_outcomes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.casino_id = ai_intervention_outcomes.casino_id));

CREATE POLICY "Regulators view all outcomes" ON ai_intervention_outcomes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'));
