/*
  # Enhance Security Command Center — Complete Schema v2

  ## Summary
  Enhances the cybersecurity command center database with additional tables and columns
  required for all 12 dashboard modules. Adds data security monitoring, AWS infrastructure
  metrics, AI security insights, responsible gambling security overlay, and enriched
  incident management with full lifecycle tracking.

  ## Changes
  1. `security_incidents` — adds missing columns: detected_at, regulatory_notification_required,
     internal_notes, affected_casino_id (alias column support)
  2. `data_security_events` — new table for encryption/data integrity monitoring
  3. `ai_security_insights` — new table for AI-generated security alerts
  4. `aws_infrastructure_metrics` — new table for CloudWatch/WAF/GuardDuty metrics
  5. `rg_security_overlay` — new table for responsible gambling security integrity checks
  6. Additional seed data for all new tables

  ## Security
  All tables have RLS enabled with role-based access (super_admin, regulators)
*/

-- ─── Patch security_incidents with missing columns ────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='detected_at') THEN
    ALTER TABLE security_incidents ADD COLUMN detected_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='regulatory_notification_required') THEN
    ALTER TABLE security_incidents ADD COLUMN regulatory_notification_required boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='internal_notes') THEN
    ALTER TABLE security_incidents ADD COLUMN internal_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='contained_at') THEN
    ALTER TABLE security_incidents ADD COLUMN contained_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='affected_casino_id') THEN
    ALTER TABLE security_incidents ADD COLUMN affected_casino_id uuid REFERENCES casinos(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='reporter_name') THEN
    ALTER TABLE security_incidents ADD COLUMN reporter_name text;
  END IF;
END $$;

-- Add INSERT/UPDATE policies for super admin on security_incidents
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_incidents' AND policyname='Super admin can insert incidents') THEN
    CREATE POLICY "Super admin can insert incidents"
      ON security_incidents FOR INSERT TO authenticated
      WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_incidents' AND policyname='Super admin can update incidents') THEN
    CREATE POLICY "Super admin can update incidents"
      ON security_incidents FOR UPDATE TO authenticated
      USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin')
      WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');
  END IF;
END $$;

-- ─── Data Security Events ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  event_type text NOT NULL CHECK (event_type IN (
    'pii_access', 'mass_data_export', 'unauthorized_query', 'schema_change',
    'encryption_check_pass', 'encryption_check_fail', 'anomalous_query',
    'data_integrity_check', 'backup_verification', 'dlp_alert'
  )),
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  table_name text,
  query_hash text,
  rows_affected int,
  actor_hash text,
  actor_role text,
  is_encrypted boolean DEFAULT true,
  integrity_verified boolean DEFAULT true,
  dlp_triggered boolean DEFAULT false,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_data_sec_casino ON data_security_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_data_sec_type ON data_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_data_sec_created ON data_security_events(created_at DESC);

CREATE POLICY "Super admin reads all data security events"
  ON data_security_events FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators read data security events"
  ON data_security_events FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));

-- ─── AI Security Insights ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_security_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  insight_type text NOT NULL CHECK (insight_type IN (
    'anomaly_detected', 'pattern_change', 'threat_prediction',
    'compliance_risk', 'unusual_behaviour', 'integration_anomaly',
    'geographic_anomaly', 'volume_spike'
  )),
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  confidence_score numeric(4,2) DEFAULT 0.85,
  affected_entity text,
  recommended_action text,
  is_acknowledged boolean DEFAULT false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  auto_generated boolean DEFAULT true,
  model_version text DEFAULT 'v2.1',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_security_insights ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_insights_casino ON ai_security_insights(casino_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_severity ON ai_security_insights(severity);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON ai_security_insights(created_at DESC);

CREATE POLICY "Super admin reads all AI insights"
  ON ai_security_insights FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators read AI insights"
  ON ai_security_insights FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));

-- ─── AWS Infrastructure Metrics ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aws_infrastructure_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL CHECK (service IN ('cloudwatch', 'waf', 'shield', 'guardduty', 'amplify', 'rds', 'elasticache', 'cloudfront')),
  metric_name text NOT NULL,
  value numeric NOT NULL,
  unit text,
  region text DEFAULT 'af-south-1',
  status text DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'outage')),
  alarm_state text DEFAULT 'OK' CHECK (alarm_state IN ('OK', 'ALARM', 'INSUFFICIENT_DATA')),
  description text,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE aws_infrastructure_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_aws_metrics_service ON aws_infrastructure_metrics(service);
CREATE INDEX IF NOT EXISTS idx_aws_metrics_recorded ON aws_infrastructure_metrics(recorded_at DESC);

CREATE POLICY "Super admin reads all AWS metrics"
  ON aws_infrastructure_metrics FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators read AWS metrics"
  ON aws_infrastructure_metrics FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));

-- ─── Responsible Gambling Security Overlay ────────────────────────────────────
CREATE TABLE IF NOT EXISTS rg_security_overlay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  check_type text NOT NULL CHECK (check_type IN (
    'risk_score_integrity', 'player_data_consistency',
    'intervention_workflow_integrity', 'operator_data_manipulation',
    'self_exclusion_bypass', 'algorithm_tampering',
    'session_data_integrity', 'compliance_data_integrity'
  )),
  status text NOT NULL CHECK (status IN ('verified', 'warning', 'alert', 'monitoring')),
  integrity_score numeric(5,2) DEFAULT 100.0,
  anomalies_detected int DEFAULT 0,
  last_check_at timestamptz DEFAULT now(),
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rg_security_overlay ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rg_overlay_casino ON rg_security_overlay(casino_id);
CREATE INDEX IF NOT EXISTS idx_rg_overlay_type ON rg_security_overlay(check_type);

CREATE POLICY "Super admin reads all RG security overlay"
  ON rg_security_overlay FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators read RG overlay"
  ON rg_security_overlay FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));

-- ─── Seed Data Security Events ────────────────────────────────────────────────
DO $$
DECLARE
  v_casino record;
  i int;
  ev_types text[] := ARRAY['pii_access','pii_access','mass_data_export','unauthorized_query','encryption_check_pass','encryption_check_pass','data_integrity_check','data_integrity_check','anomalous_query','dlp_alert','backup_verification','schema_change'];
  sevs text[] := ARRAY['medium','low','high','critical','info','info','info','info','high','critical','info','medium'];
  tables_arr text[] := ARRAY['players','sessions','transactions','behaviour_events','interventions','audit_logs','compliance_controls','nova_iq_results'];
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    FOR i IN 1..40 LOOP
      INSERT INTO data_security_events (
        casino_id, event_type, severity, table_name, rows_affected,
        actor_hash, actor_role, is_encrypted, integrity_verified, dlp_triggered, description, created_at
      ) VALUES (
        v_casino.id,
        ev_types[((i-1) % array_length(ev_types,1))+1],
        sevs[((i-1) % array_length(sevs,1))+1],
        tables_arr[((i-1) % array_length(tables_arr,1))+1],
        (random()*500+1)::int,
        encode(sha256(('dse-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        CASE (i%3) WHEN 0 THEN 'casino_admin' WHEN 1 THEN 'api_integration' ELSE 'staff' END,
        true, (i%20 != 0), (i%12=0),
        CASE ev_types[((i-1) % array_length(ev_types,1))+1]
          WHEN 'pii_access' THEN 'Authorised PII field access recorded for compliance audit trail.'
          WHEN 'mass_data_export' THEN 'Large data export detected — DLP policy triggered for review.'
          WHEN 'unauthorized_query' THEN 'Query attempted on restricted table without required permissions.'
          WHEN 'encryption_check_pass' THEN 'AES-256 encryption verification completed successfully.'
          WHEN 'data_integrity_check' THEN 'Database row checksum verification passed.'
          WHEN 'anomalous_query' THEN 'Unusual query pattern detected — possible data harvesting attempt.'
          WHEN 'dlp_alert' THEN 'Data Loss Prevention policy triggered on export endpoint.'
          WHEN 'backup_verification' THEN 'Automated backup integrity check completed — no corruption detected.'
          WHEN 'schema_change' THEN 'Database schema modification recorded in change management log.'
          ELSE 'Data security event recorded by monitoring engine.'
        END,
        now()-(i*3*interval'1 hour')
      );
    END LOOP;
  END LOOP;
END $$;

-- ─── Seed AI Security Insights ────────────────────────────────────────────────
DO $$
DECLARE
  v_casino record;
  insight_idx int := 0;
  insight_data record;
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    insight_idx := insight_idx + 1;

    INSERT INTO ai_security_insights (casino_id, insight_type, severity, title, description, confidence_score, affected_entity, recommended_action, created_at) VALUES
    (v_casino.id, 'volume_spike', 'high',
     'Unusual API Traffic Spike Detected',
     'API request volume increased by 340% over baseline in the last 4 hours. Pattern consistent with automated scraping or a misconfigured integration client.',
     0.91, 'api/v1/players endpoint', 'Review API key usage logs and consider temporary rate limit reduction for the affected integration.',
     now()-(insight_idx*6*interval'1 hour')),

    (v_casino.id, 'pattern_change', 'medium',
     'Login Time Pattern Anomaly',
     'Staff login activity detected outside normal business hours (02:00–05:00 SAST) from 3 unique accounts. This deviates from the 90-day baseline.',
     0.78, 'Staff authentication system', 'Verify with account owners whether late-night access was authorised. Consider enforcing login time restrictions.',
     now()-(insight_idx*9*interval'1 hour')),

    (v_casino.id, 'geographic_anomaly', 'medium',
     'Authentication Requests from High-Risk Geographies',
     'Failed login attempts detected originating from IP ranges associated with CN, RU, and NG. Combined volume: 47 attempts in 2-hour window.',
     0.85, 'Auth service — login endpoint', 'Enable geo-blocking for high-risk jurisdictions not associated with any registered operators.',
     now()-(insight_idx*14*interval'1 hour'));

    IF insight_idx % 3 = 0 THEN
      INSERT INTO ai_security_insights (casino_id, insight_type, severity, title, description, confidence_score, affected_entity, recommended_action, created_at) VALUES
      (v_casino.id, 'compliance_risk', 'high',
       'POPIA Data Retention Violation Risk',
       'Player records identified that exceed the 5-year retention limit under POPIA s.14. Automated deletion was not triggered. Manual review required.',
       0.94, 'players table — records > 5 years', 'Initiate emergency data retention audit. Engage DPO for POPIA compliance sign-off before deletion.',
       now()-(insight_idx*22*interval'1 hour'));
    END IF;

    IF insight_idx % 2 = 0 THEN
      INSERT INTO ai_security_insights (casino_id, insight_type, severity, title, description, confidence_score, affected_entity, recommended_action, is_acknowledged, created_at) VALUES
      (v_casino.id, 'integration_anomaly', 'medium',
       'Integration Partner Sending Malformed Payloads',
       'SoftSwiss integration is sending JSON payloads with unexpected additional fields. Could indicate a SDK version mismatch or deliberate schema probing.',
       0.72, 'SoftSwiss integration — ingest endpoint', 'Review integration SDK version and validate against API contract. Flag for partner security review.',
       true, now()-(insight_idx*30*interval'1 hour'));
    END IF;
  END LOOP;
END $$;

-- ─── Seed AWS Infrastructure Metrics ─────────────────────────────────────────
DO $$
DECLARE i int;
BEGIN
  FOR i IN 0..71 LOOP
    INSERT INTO aws_infrastructure_metrics (service, metric_name, value, unit, region, status, alarm_state, description, recorded_at) VALUES
    ('waf', 'blocked_requests', (random()*25)::int, 'count', 'global', 'healthy', 'OK', 'AWS WAF blocked requests — OWASP rule set active', now()-(i*interval'1 hour')),
    ('waf', 'allowed_requests', 800+(random()*400)::int, 'count', 'global', 'healthy', 'OK', 'AWS WAF allowed legitimate traffic', now()-(i*interval'1 hour')),
    ('shield', 'ddos_events', (random()*3)::int, 'count', 'global', 'healthy', 'OK', 'AWS Shield Advanced — DDoS mitigation events', now()-(i*interval'1 hour')),
    ('shield', 'attack_bits_per_second', (random()*1000)::int, 'bps', 'global', 'healthy', 'OK', 'DDoS attack volume in bits per second', now()-(i*interval'1 hour')),
    ('guardduty', 'findings_high', (random()*2)::int, 'count', 'af-south-1', 'healthy', 'OK', 'GuardDuty high severity findings', now()-(i*interval'1 hour')),
    ('guardduty', 'findings_medium', (random()*5)::int, 'count', 'af-south-1', 'healthy', 'OK', 'GuardDuty medium severity findings', now()-(i*interval'1 hour')),
    ('cloudwatch', 'lambda_errors', (random()*3)::int, 'count', 'af-south-1', 'healthy', 'OK', 'Lambda function error rate', now()-(i*interval'1 hour')),
    ('cloudwatch', 'rds_cpu_percent', 12+(random()*35)::int, 'percent', 'af-south-1', 'healthy', 'OK', 'RDS instance CPU utilisation', now()-(i*interval'1 hour')),
    ('amplify', 'build_success_rate', 92+(random()*8)::int, 'percent', 'af-south-1', 'healthy', 'OK', 'Amplify deployment success rate', now()-(i*interval'1 hour')),
    ('cloudfront', 'cache_hit_ratio', 80+(random()*18)::int, 'percent', 'global', 'healthy', 'OK', 'CloudFront CDN cache hit ratio', now()-(i*interval'1 hour'));
  END LOOP;
END $$;

-- ─── Seed RG Security Overlay ─────────────────────────────────────────────────
DO $$
DECLARE
  v_casino record;
  check_types text[] := ARRAY[
    'risk_score_integrity','player_data_consistency','intervention_workflow_integrity',
    'operator_data_manipulation','self_exclusion_bypass','algorithm_tampering',
    'session_data_integrity','compliance_data_integrity'
  ];
  statuses text[] := ARRAY['verified','verified','verified','monitoring','verified','verified','verified','verified'];
  descriptions text[] := ARRAY[
    'Risk scoring algorithm output validated against expected distribution — no tampering detected.',
    'Player record checksums match stored hashes — no unauthorized mutations found.',
    'Intervention workflow trigger logs align with risk score thresholds — no manipulation detected.',
    'Continuous monitoring active — operator data write patterns within expected parameters.',
    'Self-exclusion enforcement verified — no bypass attempts confirmed in the last 24 hours.',
    'ML model weights and parameters match signed baseline version v2.1 — no tampering.',
    'Session duration and bet sequence data integrity verified via cryptographic checksums.',
    'Compliance reporting data validated against source — no discrepancies detected.'
  ];
  ct int;
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    FOR ct IN 1..array_length(check_types,1) LOOP
      INSERT INTO rg_security_overlay (
        casino_id, check_type, status, integrity_score,
        anomalies_detected, last_check_at, details, created_at
      ) VALUES (
        v_casino.id,
        check_types[ct],
        CASE WHEN statuses[ct] = 'monitoring' AND random() > 0.85 THEN 'warning' ELSE statuses[ct] END,
        95+(random()*5)::numeric(5,2),
        CASE WHEN statuses[ct] = 'monitoring' THEN (random()*3)::int ELSE 0 END,
        now()-((random()*2)::int)*interval'1 hour',
        descriptions[ct],
        now()
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
