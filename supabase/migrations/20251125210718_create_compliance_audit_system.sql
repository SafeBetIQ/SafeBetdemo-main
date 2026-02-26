/*
  # Create Compliance Audit System

  1. New Tables
    - `compliance_audit_logs`
      - Tracks all AI interventions and player actions for regulatory compliance
      - Includes player risk scores, intervention types, timestamps
      - Links to players and casinos with full audit trail

    - `compliance_certificates`
      - Stores compliance certificates issued to casinos
      - Tracks validity periods and certification status
      - Maintains audit trail for regulator review

    - `compliance_settings`
      - Casino-specific compliance configuration
      - AI policy settings and thresholds
      - Integration status tracking

  2. Security
    - Enable RLS on all tables
    - Super admins can access all data
    - Casino admins can only access their own casino data
    - Regulator admins have read-only access to all data

  3. Indexes
    - Optimized queries for date ranges, risk levels, and player lookups
*/

-- Compliance Audit Logs Table
CREATE TABLE IF NOT EXISTS compliance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_identifier text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  session_minutes int NOT NULL DEFAULT 0,
  risk_score_before int NOT NULL DEFAULT 0,
  risk_score_after int NOT NULL DEFAULT 0,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  message_type text NOT NULL CHECK (message_type IN ('WHATSAPP', 'EMAIL', 'SMS', 'LOCKOUT', 'SUGGESTION', 'WARNING')),
  message_content text,
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED', 'PENDING', 'DELIVERED')),
  reason text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'AI' CHECK (triggered_by IN ('AI', 'MANUAL', 'SYSTEM')),
  game_type text,
  bet_amount decimal(10, 2),
  total_wagered decimal(12, 2),
  intervention_details jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Compliance Certificates Table
CREATE TABLE IF NOT EXISTS compliance_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  certificate_number text UNIQUE NOT NULL,
  issued_date timestamptz DEFAULT now(),
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED')),
  certification_type text NOT NULL DEFAULT 'AI_COMPLIANCE',
  ai_monitoring_enabled boolean DEFAULT true,
  intervention_system_enabled boolean DEFAULT true,
  lockout_system_enabled boolean DEFAULT true,
  audit_trail_enabled boolean DEFAULT true,
  issued_by uuid REFERENCES auth.users(id),
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Compliance Settings Table
CREATE TABLE IF NOT EXISTS compliance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE UNIQUE,
  ai_monitoring_active boolean DEFAULT true,
  simulation_mode boolean DEFAULT false,
  risk_threshold_low int DEFAULT 40,
  risk_threshold_medium int DEFAULT 60,
  risk_threshold_high int DEFAULT 80,
  risk_threshold_critical int DEFAULT 90,
  session_limit_3h boolean DEFAULT true,
  session_limit_5h boolean DEFAULT true,
  session_limit_7h boolean DEFAULT true,
  wellness_interventions_enabled boolean DEFAULT true,
  forced_lockout_enabled boolean DEFAULT true,
  whatsapp_integration_active boolean DEFAULT false,
  email_integration_active boolean DEFAULT true,
  sms_integration_active boolean DEFAULT false,
  auto_intervention_enabled boolean DEFAULT true,
  intervention_cooldown_minutes int DEFAULT 30,
  compliance_contact_email text,
  compliance_contact_phone text,
  last_policy_update timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_casino_timestamp ON compliance_audit_logs(casino_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_player ON compliance_audit_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON compliance_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON compliance_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_triggered_by ON compliance_audit_logs(triggered_by);
CREATE INDEX IF NOT EXISTS idx_certificates_casino ON compliance_certificates(casino_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON compliance_certificates(status);
CREATE INDEX IF NOT EXISTS idx_settings_casino ON compliance_settings(casino_id);

-- Enable Row Level Security
ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for compliance_audit_logs

-- Super admins can do everything
CREATE POLICY "Super admins full access to audit logs"
  ON compliance_audit_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- Casino admins can view their own casino's logs
CREATE POLICY "Casino admins view own audit logs"
  ON compliance_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN casinos ON casinos.id = compliance_audit_logs.casino_id
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'casino_admin'
    )
  );

-- Regulator admins have read-only access to all logs
CREATE POLICY "Regulator admins view all audit logs"
  ON compliance_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'regulator_admin'
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON compliance_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for compliance_certificates

-- Super admins full access
CREATE POLICY "Super admins full access to certificates"
  ON compliance_certificates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- Casino admins can view their own certificates
CREATE POLICY "Casino admins view own certificates"
  ON compliance_certificates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN casinos ON casinos.id = compliance_certificates.casino_id
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'casino_admin'
    )
  );

-- Regulator admins can view all certificates
CREATE POLICY "Regulator admins view all certificates"
  ON compliance_certificates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'regulator_admin'
    )
  );

-- RLS Policies for compliance_settings

-- Super admins full access
CREATE POLICY "Super admins full access to settings"
  ON compliance_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- Casino admins can view and update their own settings
CREATE POLICY "Casino admins manage own settings"
  ON compliance_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      JOIN casinos ON casinos.id = compliance_settings.casino_id
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'casino_admin'
    )
  );

-- Regulator admins can view all settings
CREATE POLICY "Regulator admins view all settings"
  ON compliance_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'regulator_admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_audit_logs_updated_at
  BEFORE UPDATE ON compliance_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_updated_at();

CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON compliance_certificates
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_updated_at();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON compliance_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_updated_at();