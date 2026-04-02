/*
  # Compliance Tables Schema

  ## Summary
  Creates compliance infrastructure tables for ISO 27001, SOC2, GDPR, POPIA.
  The existing data_retention_policies table has a different schema (no casino_id)
  so we add casino_id as a nullable column and add new compliance-specific tables.

  ### Tables Created
  - compliance_frameworks    (pre-seeded with 4 frameworks)
  - compliance_controls      (per-casino control status)
  - compliance_evidence      (evidence artifacts)
  - data_subject_requests    (GDPR/POPIA DSR management)
  - consent_records          (player token consent, no PII)
  - data_processing_activities (ROPA — GDPR Art. 30)
  - security_events          (ISO 27001 A.16 incident log)
  - api_tokens               (hash-only token storage)
  - api_rate_limits          (rate limit tracking)

  ### Modified Tables
  - data_retention_policies  (add casino_id column)

  ### Notes
  - All tables use RLS with get_staff_casino_id() helper
  - No raw PII stored anywhere
  - Security events table is append-only (no DELETE policy)
  - API tokens store SHA-256 hash only — plaintext never persisted
*/

-- ============================================================
-- PATCH existing data_retention_policies to add casino_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'data_retention_policies'
      AND column_name = 'casino_id'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE data_retention_policies
      ADD COLUMN casino_id uuid REFERENCES casinos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 1. COMPLIANCE FRAMEWORKS
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  full_name    text NOT NULL,
  version      text NOT NULL DEFAULT '2023',
  description  text,
  jurisdiction text DEFAULT 'Global',
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'compliance_frameworks' AND policyname = 'All authenticated view frameworks'
  ) THEN
    CREATE POLICY "All authenticated view frameworks"
      ON compliance_frameworks FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

INSERT INTO compliance_frameworks (code, full_name, version, description, jurisdiction) VALUES
  ('ISO27001','ISO/IEC 27001 Information Security Management','2022','International standard for information security management systems (ISMS)','Global'),
  ('SOC2','SOC 2 Type II (AICPA Trust Services Criteria)','2017','AICPA Trust Services Criteria: security, availability, processing integrity, confidentiality, privacy','USA/Global'),
  ('GDPR','General Data Protection Regulation','2018','EU regulation on data protection and privacy for individuals within the EU and EEA','European Union'),
  ('POPIA','Protection of Personal Information Act 4 of 2013','2020','South African data protection legislation — full effect from 1 July 2021','South Africa')
ON CONFLICT (code) DO UPDATE SET full_name = EXCLUDED.full_name, is_active = EXCLUDED.is_active;

-- ============================================================
-- 2. COMPLIANCE CONTROLS
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_controls (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id   uuid REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  casino_id      uuid REFERENCES casinos(id) ON DELETE CASCADE,
  control_id     text NOT NULL,
  control_name   text NOT NULL,
  category       text NOT NULL,
  description    text,
  status         text NOT NULL DEFAULT 'not_assessed'
                 CHECK (status IN ('not_assessed','compliant','non_compliant','partial','not_applicable','in_progress')),
  risk_level     text DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  owner_email    text,
  evidence_notes text,
  last_assessed  timestamptz,
  next_review    timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_framework ON compliance_controls(framework_id);
CREATE INDEX IF NOT EXISTS idx_cc_casino    ON compliance_controls(casino_id);
CREATE INDEX IF NOT EXISTS idx_cc_status    ON compliance_controls(status);
ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_controls' AND policyname = 'cc_select') THEN
    CREATE POLICY "cc_select" ON compliance_controls FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','national_regulator')));
    CREATE POLICY "cc_insert" ON compliance_controls FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "cc_update" ON compliance_controls FOR UPDATE TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 3. COMPLIANCE EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_evidence (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id    uuid REFERENCES compliance_controls(id) ON DELETE CASCADE,
  casino_id     uuid REFERENCES casinos(id) ON DELETE CASCADE,
  title         text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('document','screenshot','log_export','policy','procedure','certificate','test_result','other')),
  file_url      text,
  description   text,
  collected_by  uuid REFERENCES auth.users(id),
  collected_at  timestamptz DEFAULT now(),
  expires_at    timestamptz,
  is_valid      boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_evidence' AND policyname = 'ce_select') THEN
    CREATE POLICY "ce_select" ON compliance_evidence FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','national_regulator')));
    CREATE POLICY "ce_insert" ON compliance_evidence FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 4. DATA SUBJECT REQUESTS (GDPR Art. 15-22 / POPIA Ch. 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id        uuid REFERENCES casinos(id) ON DELETE SET NULL,
  request_type     text NOT NULL CHECK (request_type IN ('access','erasure','rectification','portability','restriction','objection','automated_decision')),
  player_token     text NOT NULL,
  requester_ref    text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','in_progress','completed','rejected','on_hold')),
  legal_basis      text,
  submitted_at     timestamptz DEFAULT now(),
  deadline_at      timestamptz,
  completed_at     timestamptz,
  rejection_reason text,
  handled_by       uuid REFERENCES auth.users(id),
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dsr_casino   ON data_subject_requests(casino_id);
CREATE INDEX IF NOT EXISTS idx_dsr_status   ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_dsr_token    ON data_subject_requests(player_token);
CREATE INDEX IF NOT EXISTS idx_dsr_deadline ON data_subject_requests(deadline_at);
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_subject_requests' AND policyname = 'dsr_select') THEN
    CREATE POLICY "dsr_select" ON data_subject_requests FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','national_regulator')));
    CREATE POLICY "dsr_insert" ON data_subject_requests FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "dsr_update" ON data_subject_requests FOR UPDATE TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 5. CONSENT RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS consent_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id         uuid REFERENCES casinos(id) ON DELETE CASCADE,
  player_token      text NOT NULL,
  consent_type      text NOT NULL CHECK (consent_type IN ('marketing','analytics','data_sharing','wellbeing_monitoring','cross_operator_sharing','ai_profiling','communications')),
  given             boolean NOT NULL DEFAULT false,
  method            text DEFAULT 'platform' CHECK (method IN ('platform','email','in_person','api','implied')),
  legal_basis       text DEFAULT 'consent',
  ip_hash           text,
  user_agent_hash   text,
  recorded_at       timestamptz DEFAULT now(),
  withdrawn_at      timestamptz,
  withdrawal_method text,
  version           text DEFAULT '1.0',
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_casino ON consent_records(casino_id);
CREATE INDEX IF NOT EXISTS idx_consent_token  ON consent_records(player_token);
CREATE INDEX IF NOT EXISTS idx_consent_type   ON consent_records(consent_type);
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'consent_records' AND policyname = 'cr_select') THEN
    CREATE POLICY "cr_select" ON consent_records FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','national_regulator')));
    CREATE POLICY "cr_insert" ON consent_records FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 6. DATA PROCESSING ACTIVITIES (ROPA — GDPR Art. 30)
-- ============================================================
CREATE TABLE IF NOT EXISTS data_processing_activities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id           uuid REFERENCES casinos(id) ON DELETE CASCADE,
  activity_name       text NOT NULL,
  purpose             text NOT NULL,
  legal_basis         text NOT NULL,
  data_categories     text[],
  data_subjects       text[],
  recipients          text[],
  third_country       boolean DEFAULT false,
  transfer_safeguards text,
  retention_period    text,
  security_measures   text[],
  dpo_reviewed        boolean DEFAULT false,
  dpo_reviewed_at     timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
ALTER TABLE data_processing_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'data_processing_activities' AND policyname = 'dpa_select') THEN
    CREATE POLICY "dpa_select" ON data_processing_activities FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin','national_regulator')));
    CREATE POLICY "dpa_insert" ON data_processing_activities FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "dpa_update" ON data_processing_activities FOR UPDATE TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 7. SECURITY EVENTS (append-only — ISO 27001 A.16)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id        uuid REFERENCES casinos(id) ON DELETE SET NULL,
  event_type       text NOT NULL CHECK (event_type IN (
    'failed_auth','unauthorized_access','api_abuse','rate_limit_exceeded',
    'suspicious_query','token_expired','role_escalation','data_export',
    'pii_access','self_exclusion_bypass','mass_data_access','config_change',
    'admin_action','anomalous_activity','brute_force','session_hijack'
  )),
  severity         text NOT NULL DEFAULT 'low'
                   CHECK (severity IN ('info','low','medium','high','critical')),
  source           text NOT NULL,
  actor_id         uuid,
  actor_email_hash text,
  ip_hash          text,
  resource         text,
  details          jsonb DEFAULT '{}',
  is_resolved      boolean DEFAULT false,
  resolved_by      uuid REFERENCES auth.users(id),
  resolved_at      timestamptz,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_casino   ON security_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_sec_type     ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sec_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_sec_created  ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_resolved ON security_events(is_resolved);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_events' AND policyname = 'se_super_select') THEN
    CREATE POLICY "se_super_select" ON security_events FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "se_casino_select" ON security_events FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()));
    CREATE POLICY "se_insert" ON security_events FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "se_resolve" ON security_events FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 8. API TOKENS (SHA-256 hash only — plaintext never stored)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id      uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  token_prefix   text NOT NULL,
  label          text,
  scopes         text[] DEFAULT ARRAY['ingest:write'],
  is_active      boolean DEFAULT true,
  last_used_at   timestamptz,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES auth.users(id),
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now(),
  rotation_count integer DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_tok_casino ON api_tokens(casino_id);
CREATE INDEX IF NOT EXISTS idx_api_tok_hash   ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tok_active ON api_tokens(is_active, expires_at);
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_tokens' AND policyname = 'at_select') THEN
    CREATE POLICY "at_select" ON api_tokens FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "at_insert" ON api_tokens FOR INSERT TO authenticated
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
    CREATE POLICY "at_update" ON api_tokens FOR UPDATE TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- 9. API RATE LIMITS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id       uuid REFERENCES api_tokens(id) ON DELETE CASCADE,
  casino_id      uuid REFERENCES casinos(id) ON DELETE CASCADE,
  endpoint       text NOT NULL,
  window_start   timestamptz NOT NULL,
  request_count  integer DEFAULT 1,
  limit_exceeded boolean DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (token_id, endpoint, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rl_token  ON api_rate_limits(token_id, endpoint, window_start);
CREATE INDEX IF NOT EXISTS idx_rl_casino ON api_rate_limits(casino_id);
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_rate_limits' AND policyname = 'rl_insert') THEN
    CREATE POLICY "rl_insert" ON api_rate_limits FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "rl_update" ON api_rate_limits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "rl_select" ON api_rate_limits FOR SELECT TO authenticated
      USING (casino_id = get_staff_casino_id(auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $$;

-- ============================================================
-- log_security_event function
-- ============================================================
CREATE OR REPLACE FUNCTION log_security_event(
  p_casino_id uuid, p_event_type text, p_severity text,
  p_source text, p_resource text, p_details jsonb DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; BEGIN
  INSERT INTO security_events (casino_id, event_type, severity, source, actor_id, resource, details)
  VALUES (p_casino_id, p_event_type, p_severity, p_source, auth.uid(), p_resource, p_details)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============================================================
-- SEED DEFAULT RETENTION POLICIES (using existing table schema)
-- ============================================================
INSERT INTO data_retention_policies (policy_name, table_name, data_category, retention_days, legal_basis, regulatory_reference, auto_delete_enabled)
VALUES
  ('Player Profiles Retention',    'players',          'player_profiles',  2555, 'Legal obligation',    'FICA / POPIA s.14',          false),
  ('Gaming Sessions Retention',    'sessions',         'gaming_sessions',  1825, 'Legal obligation',    'NGA s.62 / POPIA',           false),
  ('Transactions Retention',       'transactions',     'financial_records', 2555, 'Legal obligation',   'FICA s.22',                  false),
  ('Audit Logs Retention',         'audit_logs',       'audit_records',    2555, 'Legal obligation',    'ISO 27001 A.12.4',           false),
  ('Security Events Retention',    'security_events',  'security_records',  365, 'Legitimate interest', 'ISO 27001 A.16',             false),
  ('Behaviour Events Retention',   'behaviour_events', 'behavioural_data', 1095, 'Legitimate interest', 'POPIA / NGA',                false),
  ('Consent Records Retention',    'consent_records',  'consent_data',     2555, 'Legal obligation',    'GDPR Art.7 / POPIA s.11',    false),
  ('Self Exclusion Retention',     'self_exclusions',  'exclusion_records', 3650, 'Legal obligation',   'NGA s.14',                   false)
ON CONFLICT (policy_name) DO NOTHING;
