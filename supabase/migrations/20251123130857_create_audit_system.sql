/*
  # SafePlay Auditor AI System

  1. New Tables
    - `audit_logs` - Stores all compliance and intervention logs
    - `audit_chat_history` - Stores chatbot conversation history
    - `audit_queries` - Pre-defined helpful audit queries
    - `player_sessions` - Detailed player session data
    - `intervention_logs` - All intervention attempts and responses
    - `risk_scores_history` - Historical risk score tracking
    - `compliance_actions` - Actions taken for compliance
    
  2. Security
    - Enable RLS on all tables
    - Regulators get read-only access
    - Casino admins can only see their own data
    - Super admins have full access
*/

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type text NOT NULL CHECK (log_type IN ('intervention', 'risk_alert', 'compliance_action', 'session', 'violation')),
  player_id uuid REFERENCES players(id),
  casino_id uuid,
  timestamp timestamptz DEFAULT now(),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  action_taken text,
  details jsonb NOT NULL,
  operator_response text,
  resolution_status text CHECK (resolution_status IN ('pending', 'resolved', 'escalated', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'regulator'
    )
  );

CREATE POLICY "Casino admins can view their own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('casino_admin', 'super_admin')
    )
  );

-- Intervention Logs Table
CREATE TABLE IF NOT EXISTS intervention_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  intervention_type text NOT NULL CHECK (intervention_type IN ('whatsapp', 'sms', 'email', 'in_app')),
  message_content text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  delivered boolean DEFAULT false,
  delivered_at timestamptz,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  player_response text,
  risk_score_before integer,
  risk_score_after integer,
  intervention_reason text,
  automated boolean DEFAULT true,
  sent_by uuid REFERENCES users(id),
  metadata jsonb
);

ALTER TABLE intervention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can view all interventions"
  ON intervention_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('regulator', 'super_admin')
    )
  );

-- Player Sessions Table
CREATE TABLE IF NOT EXISTS player_sessions_detailed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  session_start timestamptz NOT NULL,
  session_end timestamptz,
  duration_minutes integer,
  total_bets integer DEFAULT 0,
  total_wagered decimal(12,2) DEFAULT 0,
  total_winnings decimal(12,2) DEFAULT 0,
  net_loss decimal(12,2) DEFAULT 0,
  highest_bet decimal(10,2),
  lowest_bet decimal(10,2),
  games_played text[],
  risk_score_at_start integer,
  risk_score_at_end integer,
  violations jsonb,
  self_excluded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE player_sessions_detailed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can view all player sessions"
  ON player_sessions_detailed FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('regulator', 'super_admin')
    )
  );

-- Risk Scores History
CREATE TABLE IF NOT EXISTS risk_scores_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  risk_score integer NOT NULL,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  calculated_at timestamptz DEFAULT now(),
  factors jsonb NOT NULL,
  ai_confidence decimal(5,4),
  triggered_alerts boolean DEFAULT false,
  notes text
);

ALTER TABLE risk_scores_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can view risk score history"
  ON risk_scores_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('regulator', 'super_admin')
    )
  );

-- Compliance Actions Table
CREATE TABLE IF NOT EXISTS compliance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id),
  action_type text NOT NULL CHECK (action_type IN ('warning', 'limit_set', 'cooling_off', 'self_exclusion', 'account_suspension', 'intervention_sent')),
  action_reason text NOT NULL,
  taken_by uuid REFERENCES users(id),
  taken_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  status text CHECK (status IN ('active', 'expired', 'lifted', 'violated')),
  details jsonb,
  effectiveness_rating integer CHECK (effectiveness_rating BETWEEN 1 AND 5),
  follow_up_required boolean DEFAULT false
);

ALTER TABLE compliance_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can view all compliance actions"
  ON compliance_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('regulator', 'super_admin')
    )
  );

-- Audit Chat History
CREATE TABLE IF NOT EXISTS audit_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  query text NOT NULL,
  response text NOT NULL,
  context_used jsonb,
  sources jsonb,
  confidence_score decimal(5,4),
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own chat history"
  ON audit_chat_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chat messages"
  ON audit_chat_history FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Helpful Audit Queries
CREATE TABLE IF NOT EXISTS audit_query_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  query_text text NOT NULL,
  description text,
  example_response text,
  difficulty text CHECK (difficulty IN ('basic', 'intermediate', 'advanced')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_query_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view query templates"
  ON audit_query_templates FOR SELECT
  TO authenticated
  USING (true);

-- Insert Sample Audit Query Templates
INSERT INTO audit_query_templates (category, query_text, description, difficulty) VALUES
('Player Verification', 'Did Player {player_id} receive a WhatsApp warning before exceeding their time limit?', 'Verify intervention was sent before violation', 'basic'),
('Compliance Check', 'Show all interventions sent to high-risk players in the last 7 days', 'Review recent compliance activity', 'basic'),
('Violation Detection', 'Which players exceeded their deposit limits without receiving warnings?', 'Detect policy violations', 'intermediate'),
('Effectiveness Analysis', 'What percentage of players reduced their risk score after receiving interventions?', 'Measure intervention effectiveness', 'advanced'),
('Timeline Reconstruction', 'Show the complete timeline for Player {player_id} from first alert to resolution', 'Detailed player history', 'intermediate'),
('Casino Performance', 'Which casino has the highest compliance rate for intervention delivery?', 'Compare operators', 'advanced');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_player_id ON audit_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_intervention_logs_player_id ON intervention_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_intervention_logs_sent_at ON intervention_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_player_sessions_player_id ON player_sessions_detailed(player_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_player_id ON risk_scores_history(player_id);
CREATE INDEX IF NOT EXISTS idx_compliance_actions_player_id ON compliance_actions(player_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON audit_chat_history(user_id);
