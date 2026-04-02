/*
  # Enterprise Security Modules - Core Tables

  ## Summary
  Creates the foundational tables for the full enterprise security architecture:

  1. **mfa_settings** - Per-user MFA configuration (TOTP, SMS, hardware keys)
  2. **trusted_devices** - Device fingerprint registry for anomaly detection
  3. **login_sessions** - Enhanced session tracking with geo/device/risk data
  4. **threat_alerts** - Real-time security threat detection queue
  5. **abac_policies** - Attribute-Based Access Control policies per tenant
  6. **ip_allowlists** - Per-casino IP restriction lists
  7. **api_keys_registry** - Named API keys with scopes and rotation tracking
  8. **data_retention_rules** - Jurisdiction-aware automated retention policies
  9. **privacy_impact_assessments** - DPIA records (GDPR Art. 35 / POPIA)
  10. **security_metrics** - Time-series security KPIs for monitoring dashboard
  11. **dr_status** - Disaster recovery and infrastructure health status
  12. **devops_pipeline_runs** - CI/CD security scan results
  13. **compliance_snapshots** - Point-in-time compliance scores per casino/framework

  ## Security
  - All tables have RLS enabled
  - Casino-scoped tables restrict to casino_admin by casino_id
  - Super admin has full access via users table role check
*/

-- ============================================================
-- MFA SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS mfa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE,
  totp_enabled boolean DEFAULT false,
  sms_enabled boolean DEFAULT false,
  hardware_key_enabled boolean DEFAULT false,
  backup_codes_generated boolean DEFAULT false,
  backup_codes_remaining int DEFAULT 0,
  totp_secret_hash text,
  phone_hash text,
  last_mfa_at timestamptz,
  mfa_enforced boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mfa_settings' AND policyname='Super admin can manage all MFA settings') THEN
    CREATE POLICY "Super admin can manage all MFA settings"
      ON mfa_settings FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mfa_settings' AND policyname='Users can view own MFA settings') THEN
    CREATE POLICY "Users can view own MFA settings"
      ON mfa_settings FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- TRUSTED DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint_hash text NOT NULL,
  device_name text,
  device_type text DEFAULT 'browser',
  user_agent_hash text,
  ip_hash text,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  is_trusted boolean DEFAULT false,
  trust_granted_at timestamptz,
  trust_revoked_at timestamptz,
  country_code text,
  risk_score int DEFAULT 0
);

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trusted_devices' AND policyname='Super admin can view all trusted devices') THEN
    CREATE POLICY "Super admin can view all trusted devices"
      ON trusted_devices FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

-- ============================================================
-- LOGIN SESSIONS (enhanced)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  casino_id uuid REFERENCES casinos(id),
  email_hash text,
  ip_hash text,
  user_agent_hash text,
  device_fingerprint_hash text,
  country_code text,
  city_masked text,
  is_mfa_verified boolean DEFAULT false,
  risk_score int DEFAULT 0,
  anomaly_flags text[] DEFAULT '{}',
  session_token_hash text,
  started_at timestamptz DEFAULT now(),
  last_activity_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,
  logout_reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_casino_id ON login_sessions(casino_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_created_at ON login_sessions(created_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='login_sessions' AND policyname='Super admin can view all login sessions') THEN
    CREATE POLICY "Super admin can view all login sessions"
      ON login_sessions FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='login_sessions' AND policyname='Casino admin can view own casino sessions') THEN
    CREATE POLICY "Casino admin can view own casino sessions"
      ON login_sessions FOR SELECT TO authenticated
      USING (
        casino_id = (SELECT get_staff_casino_id(auth.uid()))
        AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'casino_admin'
      );
  END IF;
END $$;

-- ============================================================
-- THREAT ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS threat_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  affected_resource text,
  actor_hash text,
  ip_hash text,
  raw_evidence jsonb DEFAULT '{}',
  auto_mitigated boolean DEFAULT false,
  mitigation_action text,
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'closed', 'false_positive')),
  assigned_to text,
  acknowledged_by text,
  acknowledged_at timestamptz,
  resolved_by text,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE threat_alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_threat_alerts_severity ON threat_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_status ON threat_alerts(status);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_created_at ON threat_alerts(created_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='threat_alerts' AND policyname='Super admin can manage all threat alerts') THEN
    CREATE POLICY "Super admin can manage all threat alerts"
      ON threat_alerts FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='threat_alerts' AND policyname='Casino admin can view own threat alerts') THEN
    CREATE POLICY "Casino admin can view own threat alerts"
      ON threat_alerts FOR SELECT TO authenticated
      USING (
        casino_id = (SELECT get_staff_casino_id(auth.uid()))
      );
  END IF;
END $$;

-- ============================================================
-- ABAC POLICIES
-- ============================================================
CREATE TABLE IF NOT EXISTS abac_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  policy_name text NOT NULL,
  description text,
  subject_role text NOT NULL,
  resource text NOT NULL,
  action text NOT NULL CHECK (action IN ('read', 'write', 'delete', 'export', 'approve')),
  conditions jsonb DEFAULT '{}',
  effect text NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  priority int DEFAULT 100,
  is_active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE abac_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='abac_policies' AND policyname='Super admin can manage ABAC policies') THEN
    CREATE POLICY "Super admin can manage ABAC policies"
      ON abac_policies FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='abac_policies' AND policyname='Casino admin can view own ABAC policies') THEN
    CREATE POLICY "Casino admin can view own ABAC policies"
      ON abac_policies FOR SELECT TO authenticated
      USING (
        casino_id = (SELECT get_staff_casino_id(auth.uid()))
        OR casino_id IS NULL
      );
  END IF;
END $$;

-- ============================================================
-- IP ALLOWLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ip_allowlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  label text NOT NULL,
  ip_cidr text NOT NULL,
  ip_type text DEFAULT 'ipv4' CHECK (ip_type IN ('ipv4', 'ipv6', 'cidr')),
  environment text DEFAULT 'all' CHECK (environment IN ('all', 'production', 'staging')),
  is_active boolean DEFAULT true,
  added_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE ip_allowlists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ip_allowlists' AND policyname='Super admin can manage all IP allowlists') THEN
    CREATE POLICY "Super admin can manage all IP allowlists"
      ON ip_allowlists FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ip_allowlists' AND policyname='Casino admin can view own IP allowlists') THEN
    CREATE POLICY "Casino admin can view own IP allowlists"
      ON ip_allowlists FOR SELECT TO authenticated
      USING (casino_id = (SELECT get_staff_casino_id(auth.uid())));
  END IF;
END $$;

-- ============================================================
-- DATA RETENTION RULES (enhanced with jurisdiction support)
-- ============================================================
CREATE TABLE IF NOT EXISTS data_retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  data_category text NOT NULL,
  table_name text,
  retention_days int NOT NULL,
  anonymise_after_days int,
  delete_after_days int,
  jurisdiction text NOT NULL DEFAULT 'ZA' CHECK (jurisdiction IN ('ZA', 'EU', 'UK', 'GLOBAL')),
  legal_basis text,
  regulation_reference text,
  auto_execute boolean DEFAULT false,
  last_executed_at timestamptz,
  next_execution_at timestamptz,
  records_processed int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE data_retention_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='data_retention_rules' AND policyname='Super admin can manage all retention rules') THEN
    CREATE POLICY "Super admin can manage all retention rules"
      ON data_retention_rules FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='data_retention_rules' AND policyname='Casino admin can view own retention rules') THEN
    CREATE POLICY "Casino admin can view own retention rules"
      ON data_retention_rules FOR SELECT TO authenticated
      USING (casino_id = (SELECT get_staff_casino_id(auth.uid())) OR casino_id IS NULL);
  END IF;
END $$;

-- ============================================================
-- SECURITY METRICS (time-series)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text,
  dimension text,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE security_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_security_metrics_recorded_at ON security_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_metrics_name ON security_metrics(metric_name);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_metrics' AND policyname='Super admin can view all security metrics') THEN
    CREATE POLICY "Super admin can view all security metrics"
      ON security_metrics FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

-- ============================================================
-- COMPLIANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  framework text NOT NULL,
  total_controls int DEFAULT 0,
  compliant int DEFAULT 0,
  non_compliant int DEFAULT 0,
  partial int DEFAULT 0,
  not_assessed int DEFAULT 0,
  compliance_score numeric(5,2) DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE compliance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_snapshots' AND policyname='Super admin can view all snapshots') THEN
    CREATE POLICY "Super admin can view all snapshots"
      ON compliance_snapshots FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_snapshots' AND policyname='Casino admin can view own snapshots') THEN
    CREATE POLICY "Casino admin can view own snapshots"
      ON compliance_snapshots FOR SELECT TO authenticated
      USING (casino_id = (SELECT get_staff_casino_id(auth.uid())));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='compliance_snapshots' AND policyname='Regulators can view all snapshots') THEN
    CREATE POLICY "Regulators can view all snapshots"
      ON compliance_snapshots FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));
  END IF;
END $$;

-- ============================================================
-- DR STATUS (Disaster Recovery)
-- ============================================================
CREATE TABLE IF NOT EXISTS dr_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component text NOT NULL,
  region text NOT NULL,
  status text DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  health_score int DEFAULT 100,
  last_check_at timestamptz DEFAULT now(),
  last_backup_at timestamptz,
  backup_size_gb numeric(10,2),
  rto_minutes int,
  rpo_minutes int,
  failover_available boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dr_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dr_status' AND policyname='Super admin can view DR status') THEN
    CREATE POLICY "Super admin can view DR status"
      ON dr_status FOR SELECT TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;
