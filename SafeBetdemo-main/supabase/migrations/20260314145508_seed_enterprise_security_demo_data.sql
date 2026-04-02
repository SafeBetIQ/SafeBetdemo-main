/*
  # Seed Enterprise Security Demo Data

  Populates all security module tables with realistic demo data for:
  - Threat alerts across all casino types
  - ABAC policies for role/resource matrix
  - IP allowlists per casino
  - Data retention rules per jurisdiction
  - DR status for all infrastructure components
  - Security metrics (30 days of KPIs)
  - Compliance snapshots (90 days trending)
*/

-- ============================================================
-- SEED THREAT ALERTS
-- ============================================================
DO $$
DECLARE
  v_casino record;
  i int;
  alert_types text[] := ARRAY['brute_force_attempt', 'api_key_abuse', 'unusual_login_location', 'rate_limit_violation', 'privilege_escalation', 'data_export_anomaly', 'session_hijack_attempt', 'sql_injection_probe', 'credential_stuffing', 'mass_data_access'];
  severities text[] := ARRAY['low', 'medium', 'high', 'critical', 'medium', 'high', 'low', 'critical', 'medium', 'high'];
  statuses text[] := ARRAY['open', 'investigating', 'mitigated', 'closed', 'false_positive', 'open', 'investigating', 'mitigated', 'closed', 'open'];
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LIMIT 10 LOOP
    FOR i IN 1..15 LOOP
      INSERT INTO threat_alerts (
        casino_id, alert_type, severity, title, description,
        affected_resource, actor_hash, ip_hash, status,
        auto_mitigated, created_at, updated_at
      ) VALUES (
        v_casino.id,
        alert_types[((i-1) % array_length(alert_types,1))+1],
        severities[((i-1) % array_length(severities,1))+1],
        CASE alert_types[((i-1) % array_length(alert_types,1))+1]
          WHEN 'brute_force_attempt' THEN 'Brute Force Login Attack Detected'
          WHEN 'api_key_abuse' THEN 'API Key Used Outside Allowlisted IP'
          WHEN 'unusual_login_location' THEN 'Login from Unusual Geographic Location'
          WHEN 'rate_limit_violation' THEN 'API Rate Limit Threshold Exceeded'
          WHEN 'privilege_escalation' THEN 'Privilege Escalation Attempt Blocked'
          WHEN 'data_export_anomaly' THEN 'Anomalous Data Export Volume Detected'
          WHEN 'session_hijack_attempt' THEN 'Session Token Replay Attack Detected'
          WHEN 'sql_injection_probe' THEN 'SQL Injection Probe in API Parameters'
          WHEN 'credential_stuffing' THEN 'Credential Stuffing Campaign Identified'
          WHEN 'mass_data_access' THEN 'Mass Data Access Pattern Detected'
          ELSE 'Security Alert'
        END,
        'Automated threat detection engine flagged anomalous activity requiring review.',
        CASE (i % 5)
          WHEN 0 THEN 'api/v1/sessions'
          WHEN 1 THEN 'auth/login'
          WHEN 2 THEN 'api/v1/players'
          WHEN 3 THEN 'admin/reports'
          ELSE 'api/v1/bets'
        END,
        encode(sha256(('actor-' || i || '-' || v_casino.id::text)::bytea), 'hex'),
        encode(sha256(('ip-' || i || '-' || v_casino.id::text)::bytea), 'hex'),
        statuses[((i-1) % array_length(statuses,1))+1],
        (i % 3 = 0),
        now() - (i * interval '4 hours'),
        now() - ((i-1) * interval '4 hours')
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- SEED ABAC POLICIES
-- ============================================================
INSERT INTO abac_policies (policy_name, description, subject_role, resource, action, conditions, effect, priority, is_active)
VALUES
  ('Super Admin Full Access', 'Super admins have unrestricted access to all resources', 'super_admin', '*', 'read', '{}', 'allow', 1, true),
  ('Super Admin Write All', 'Super admins can write to all resources', 'super_admin', '*', 'write', '{}', 'allow', 1, true),
  ('Super Admin Export All', 'Super admins can export all data', 'super_admin', '*', 'export', '{}', 'allow', 1, true),
  ('Regulator Read Operator Data', 'National regulators can read any operator data', 'national_regulator', 'casino_data', 'read', '{"scope":"national"}', 'allow', 10, true),
  ('Regulator Cannot Modify', 'Regulators cannot modify operator data', 'national_regulator', 'casino_data', 'write', '{}', 'deny', 5, true),
  ('Regulator Export Reports', 'Regulators can export compliance reports', 'national_regulator', 'compliance_reports', 'export', '{}', 'allow', 10, true),
  ('Provincial Regulator Province Scope', 'Provincial regulators limited to their province', 'provincial_regulator', 'casino_data', 'read', '{"scope":"province","match":"casino.province = subject.province"}', 'allow', 10, true),
  ('Casino Admin Own Data', 'Casino admins can read their own casino data', 'casino_admin', 'casino_data', 'read', '{"scope":"own"}', 'allow', 20, true),
  ('Casino Admin Manage Staff', 'Casino admins can manage their own staff', 'casino_admin', 'staff', 'write', '{"scope":"own_casino"}', 'allow', 20, true),
  ('Casino Admin Cannot Export PII', 'Casino admins cannot export raw player PII', 'casino_admin', 'player_pii', 'export', '{}', 'deny', 5, true),
  ('Compliance Officer Read Interventions', 'Compliance officers can read interventions', 'compliance_officer', 'interventions', 'read', '{"scope":"own_casino"}', 'allow', 30, true),
  ('Compliance Officer Approve Interventions', 'Compliance officers can approve interventions', 'compliance_officer', 'interventions', 'approve', '{"scope":"own_casino"}', 'allow', 30, true),
  ('Analyst Read Only', 'Analysts have read-only access to analytics', 'analyst', 'analytics', 'read', '{"scope":"own_casino"}', 'allow', 40, true),
  ('Analyst No Config Changes', 'Analysts cannot change system config', 'analyst', 'system_config', 'write', '{}', 'deny', 5, true),
  ('Staff Training Read', 'Staff can read training materials', 'staff', 'training', 'read', '{}', 'allow', 50, true),
  ('No Anonymous Access', 'Deny all unauthenticated access', 'anonymous', '*', 'read', '{}', 'deny', 1, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED IP ALLOWLISTS
-- ============================================================
DO $$
DECLARE
  v_casino record;
BEGIN
  FOR v_casino IN SELECT id, name FROM casinos WHERE is_active = true LIMIT 10 LOOP
    INSERT INTO ip_allowlists (casino_id, label, ip_cidr, ip_type, environment, is_active, notes)
    VALUES
      (v_casino.id, 'Primary Office', '196.25.' || (floor(random()*255))::int || '.0/24', 'cidr', 'all', true, 'Main corporate office IP range'),
      (v_casino.id, 'Backup Office', '41.13.' || (floor(random()*255))::int || '.0/24', 'cidr', 'production', true, 'Secondary office IP range'),
      (v_casino.id, 'VPN Gateway', '102.67.' || (floor(random()*255))::int || '.' || (floor(random()*255))::int, 'ipv4', 'all', true, 'Corporate VPN egress point'),
      (v_casino.id, 'Monitoring System', '10.0.' || (floor(random()*255))::int || '.0/24', 'cidr', 'production', true, 'Internal monitoring infrastructure')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- SEED DATA RETENTION RULES
-- ============================================================
INSERT INTO data_retention_rules (data_category, table_name, retention_days, anonymise_after_days, delete_after_days, jurisdiction, legal_basis, regulation_reference, auto_execute, is_active)
VALUES
  ('Behavioural Events', 'behaviour_events', 1825, 1095, 2190, 'ZA', 'Legitimate interest in responsible gambling compliance', 'POPIA s.11(1)(f), NGA s.27', true, true),
  ('Gaming Sessions', 'sessions', 1825, 1095, 2555, 'ZA', 'Legal obligation - FICA / NGA record keeping', 'FICA s.22, NGA s.27(2)', true, true),
  ('Financial Transactions', 'transactions', 2555, 1825, 3650, 'ZA', 'Legal obligation - FICA anti-money laundering', 'FICA s.22, SARS requirements', true, true),
  ('Player Profiles', 'players', 2555, 1825, 3650, 'ZA', 'Contractual necessity and legal obligation', 'POPIA s.11(1)(b), NGA s.15', true, true),
  ('Self Exclusions', 'self_exclusions', 3650, NULL, NULL, 'ZA', 'Legal obligation - must retain exclusion records', 'NGA s.14, POPIA s.11(1)(c)', false, true),
  ('Audit Logs', 'audit_logs', 2555, NULL, NULL, 'ZA', 'Legal obligation - regulatory audit trail', 'ISO 27001 A.12.4, SOC 2 CC7', false, true),
  ('Security Events', 'security_events', 1095, NULL, 1825, 'ZA', 'Legitimate interest in security monitoring', 'ISO 27001 A.16, POPIA s.11', true, true),
  ('Intervention Records', 'interventions', 1825, NULL, NULL, 'ZA', 'Legal obligation - responsible gambling mandate', 'NGA s.27, POPIA s.11(1)(c)', false, true),
  ('Player Data (EU)', 'players', 730, 365, 1095, 'EU', 'Legal obligation and data minimisation', 'GDPR Art.17, GDPR Art.5(1)(e)', true, true),
  ('Behavioural Events (EU)', 'behaviour_events', 730, 365, 1095, 'EU', 'Legitimate interest - public interest safeguarding', 'GDPR Art.6(1)(f), GDPR Rec.47', true, true),
  ('Login Sessions', 'login_sessions', 365, 180, 730, 'GLOBAL', 'Security monitoring and fraud prevention', 'ISO 27001 A.9.4, SOC 2 CC6', true, true),
  ('API Access Logs', 'audit_logs', 1095, NULL, 1825, 'GLOBAL', 'Security audit and legal liability', 'SOC 2 CC7, ISO 27001 A.12.4', false, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DR STATUS
-- ============================================================
INSERT INTO dr_status (component, region, status, health_score, last_check_at, last_backup_at, backup_size_gb, rto_minutes, rpo_minutes, failover_available, notes)
VALUES
  ('Primary Database', 'af-south-1', 'operational', 100, now() - interval '5 minutes', now() - interval '6 hours', 847.3, 15, 5, true, 'Supabase PostgreSQL primary - Cape Town region'),
  ('Read Replica', 'eu-west-1', 'operational', 100, now() - interval '5 minutes', now() - interval '6 hours', 847.3, 10, 1, true, 'Read replica - Ireland region for EU latency'),
  ('Read Replica', 'us-east-1', 'operational', 98, now() - interval '5 minutes', now() - interval '6 hours', 847.3, 10, 1, true, 'Read replica - N. Virginia region for Americas'),
  ('Application Layer', 'af-south-1', 'operational', 100, now() - interval '1 minute', NULL, NULL, 5, 0, true, 'AWS Amplify - primary hosting Cape Town'),
  ('Application Layer', 'eu-west-1', 'operational', 100, now() - interval '1 minute', NULL, NULL, 5, 0, true, 'AWS Amplify - EU failover Ireland'),
  ('API Gateway', 'af-south-1', 'operational', 100, now() - interval '2 minutes', NULL, NULL, 2, 0, true, 'Supabase Edge Functions + AWS API GW'),
  ('CDN / WAF', 'global', 'operational', 100, now() - interval '1 minute', NULL, NULL, 1, 0, true, 'AWS CloudFront + WAF - global PoPs'),
  ('DDoS Protection', 'global', 'operational', 100, now() - interval '1 minute', NULL, NULL, 0, 0, true, 'AWS Shield Advanced - always-on'),
  ('Key Management', 'af-south-1', 'operational', 100, now() - interval '10 minutes', NULL, NULL, 5, 0, true, 'AWS KMS - Cape Town + EU replication'),
  ('Monitoring', 'global', 'operational', 100, now() - interval '1 minute', NULL, NULL, 0, 0, true, 'AWS CloudWatch - global monitoring'),
  ('Backup Storage', 'af-south-1', 'operational', 100, now() - interval '30 minutes', now() - interval '6 hours', 2341.8, 60, 240, true, 'AWS S3 - encrypted daily backups'),
  ('Object Storage', 'af-south-1', 'operational', 100, now() - interval '5 minutes', now() - interval '24 hours', 156.2, 10, 60, true, 'AWS S3 - application asset storage'),
  ('Auth Service', 'af-south-1', 'operational', 100, now() - interval '1 minute', NULL, NULL, 5, 0, true, 'Supabase Auth - primary'),
  ('Email Delivery', 'global', 'operational', 99, now() - interval '15 minutes', NULL, NULL, 0, 0, false, 'Transactional email via SMTP relay'),
  ('WhatsApp Gateway', 'af-south-1', 'operational', 97, now() - interval '10 minutes', NULL, NULL, 30, 30, false, 'WhatsApp Business API integration')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED SECURITY METRICS (30 days)
-- ============================================================
DO $$
DECLARE
  i int;
  metric_date timestamptz;
BEGIN
  FOR i IN 0..29 LOOP
    metric_date := date_trunc('day', now()) - (i * interval '1 day');
    
    INSERT INTO security_metrics (metric_name, metric_value, metric_unit, dimension, recorded_at)
    VALUES
      ('login_success_rate', 94 + (random()*5)::int, 'percent', 'platform', metric_date),
      ('failed_login_attempts', 20 + (random()*80)::int, 'count', 'platform', metric_date),
      ('api_auth_failures', 5 + (random()*30)::int, 'count', 'platform', metric_date),
      ('threat_alerts_generated', 3 + (random()*12)::int, 'count', 'platform', metric_date),
      ('threat_alerts_resolved', 2 + (random()*10)::int, 'count', 'platform', metric_date),
      ('rate_limit_hits', 10 + (random()*50)::int, 'count', 'platform', metric_date),
      ('active_sessions', 45 + (random()*120)::int, 'count', 'platform', metric_date),
      ('mfa_verifications', 30 + (random()*80)::int, 'count', 'platform', metric_date),
      ('new_trusted_devices', (random()*5)::int, 'count', 'platform', metric_date),
      ('data_exports', (random()*8)::int, 'count', 'platform', metric_date),
      ('compliance_score_avg', 78 + (random()*15)::int, 'percent', 'platform', metric_date),
      ('uptime_percent', 99.9 + (random()*0.09)::numeric(4,2), 'percent', 'platform', metric_date);
  END LOOP;
END $$;

-- ============================================================
-- SEED COMPLIANCE SNAPSHOTS (90 days for all casinos)
-- ============================================================
DO $$
DECLARE
  v_casino record;
  i int;
  frameworks text[] := ARRAY['ISO27001', 'SOC2', 'GDPR', 'POPIA'];
  f text;
  base_score numeric;
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    FOR i IN 0..89 LOOP
      IF i % 7 = 0 THEN
        FOREACH f IN ARRAY frameworks LOOP
          base_score := CASE f
            WHEN 'ISO27001' THEN 72 + (random()*20)
            WHEN 'SOC2' THEN 68 + (random()*25)
            WHEN 'GDPR' THEN 65 + (random()*28)
            WHEN 'POPIA' THEN 70 + (random()*22)
          END;
          INSERT INTO compliance_snapshots (casino_id, framework, total_controls, compliant, non_compliant, partial, not_assessed, compliance_score, snapshot_date)
          VALUES (
            v_casino.id, f,
            CASE f WHEN 'ISO27001' THEN 24 WHEN 'SOC2' THEN 16 WHEN 'GDPR' THEN 12 ELSE 10 END,
            (base_score/100 * CASE f WHEN 'ISO27001' THEN 24 WHEN 'SOC2' THEN 16 WHEN 'GDPR' THEN 12 ELSE 10 END)::int,
            (random()*3)::int,
            (random()*2)::int,
            (random()*4)::int,
            base_score,
            CURRENT_DATE - (i * interval '1 day')
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;
