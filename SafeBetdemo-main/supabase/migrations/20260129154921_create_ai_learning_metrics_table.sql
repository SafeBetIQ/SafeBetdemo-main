/*
  # Create AI Learning Metrics Table

  1. New Tables
    - `ai_learning_metrics`
      - Tracks AI system performance and accuracy improvements over time
      - Shows Nova IQ impact on predictions
      - Records intervention success rates
      - Measures false positive/negative rates
      - Supports casino-specific and global metrics

  2. Security
    - Enable RLS on `ai_learning_metrics` table
    - Super admins can view all metrics
    - Casino staff can view their own casino metrics
    - Regulators can view all metrics
*/

CREATE TABLE IF NOT EXISTS ai_learning_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_predictions integer NOT NULL DEFAULT 0,
  correct_predictions integer NOT NULL DEFAULT 0,
  accuracy_percent numeric(5,2) NOT NULL DEFAULT 0,
  accuracy_change_percent numeric(5,2) DEFAULT 0,
  baseline_accuracy_percent numeric(5,2) DEFAULT 0,
  nova_iq_enhanced_predictions integer DEFAULT 0,
  nova_iq_accuracy_lift_percent numeric(5,2) DEFAULT 0,
  total_interventions integer DEFAULT 0,
  successful_interventions integer DEFAULT 0,
  success_rate_percent numeric(5,2) DEFAULT 0,
  confidence_score_avg numeric(5,2) DEFAULT 0,
  false_positive_rate numeric(5,2) DEFAULT 0,
  false_negative_rate numeric(5,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_metrics_casino ON ai_learning_metrics(casino_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_metrics_period_start ON ai_learning_metrics(period_start DESC);

ALTER TABLE ai_learning_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all learning metrics" ON ai_learning_metrics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino staff view own learning metrics" ON ai_learning_metrics FOR SELECT TO authenticated
  USING (
    casino_id IS NULL OR
    EXISTS (SELECT 1 FROM staff WHERE staff.auth_user_id = auth.uid() AND staff.casino_id = ai_learning_metrics.casino_id)
  );

CREATE POLICY "Regulators view all learning metrics" ON ai_learning_metrics FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'regulator'));
