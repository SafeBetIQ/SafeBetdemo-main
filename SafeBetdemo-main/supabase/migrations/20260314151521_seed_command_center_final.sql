/*
  # Seed Command Center Final — correct column types
  assigned_to and reported_by are uuid (nullable), incident_id is text unique key
*/

-- Add missing columns to security_incidents
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='incident_number') THEN ALTER TABLE security_incidents ADD COLUMN incident_number text UNIQUE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='escalated') THEN ALTER TABLE security_incidents ADD COLUMN escalated boolean DEFAULT false; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='escalation_reason') THEN ALTER TABLE security_incidents ADD COLUMN escalation_reason text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='impact_assessment') THEN ALTER TABLE security_incidents ADD COLUMN impact_assessment text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='reporter_name') THEN ALTER TABLE security_incidents ADD COLUMN reporter_name text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='affected_systems') THEN ALTER TABLE security_incidents ADD COLUMN affected_systems text[] DEFAULT '{}'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='sla_target_hours') THEN ALTER TABLE security_incidents ADD COLUMN sla_target_hours int DEFAULT 4; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='security_incidents' AND column_name='breached_sla') THEN ALTER TABLE security_incidents ADD COLUMN breached_sla boolean DEFAULT false; END IF; END $$;

-- SEED SECURITY EVENTS
DO $$
DECLARE
  v_casino record;
  i int;
  event_types text[] := ARRAY['failed_auth','failed_auth','failed_auth','failed_auth','brute_force','brute_force','api_abuse','api_abuse','rate_limit_exceeded','unauthorized_access','data_export','suspicious_query','session_hijack','role_escalation','anomalous_activity','failed_auth','failed_auth','pii_access','mass_data_access','admin_action','admin_action','token_expired','token_expired','config_change'];
  sevs text[] := ARRAY['medium','medium','low','info','high','critical','medium','low','medium','critical','high','critical','high','critical','medium','info','info','high','critical','info','info','low','low','medium'];
  countries text[] := ARRAY['ZA','ZA','ZA','ZA','ZA','NG','CN','RU','BR','IN','ZA','UK','US','DE','ZA'];
  systems text[] := ARRAY['auth/login','api/v1/players','api/v1/sessions','api/v1/bets','admin/reports','api/v1/interventions','auth/mfa','api/v1/export'];
  n int; ev_title text;
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    FOR i IN 1..80 LOOP
      n := ((i-1) % array_length(event_types,1))+1;
      ev_title := CASE event_types[n]
        WHEN 'failed_auth' THEN 'Authentication Failure'
        WHEN 'brute_force' THEN 'Brute Force Attack Detected'
        WHEN 'api_abuse' THEN 'API Key Abuse Detected'
        WHEN 'rate_limit_exceeded' THEN 'Rate Limit Threshold Breached'
        WHEN 'unauthorized_access' THEN 'Unauthorized Resource Access'
        WHEN 'data_export' THEN 'Data Export Event Logged'
        WHEN 'suspicious_query' THEN 'Suspicious Query Pattern'
        WHEN 'session_hijack' THEN 'Session Hijack Attempt Blocked'
        WHEN 'role_escalation' THEN 'Privilege Escalation Attempt'
        WHEN 'anomalous_activity' THEN 'Anomalous Behaviour Detected'
        WHEN 'pii_access' THEN 'Sensitive Data Access Logged'
        WHEN 'mass_data_access' THEN 'Mass Data Access Pattern'
        WHEN 'admin_action' THEN 'Administrative Action Recorded'
        WHEN 'token_expired' THEN 'Session Token Expired'
        WHEN 'config_change' THEN 'Configuration Change Detected'
        ELSE 'Security Event'
      END;
      INSERT INTO security_events (
        casino_id, event_type, severity, source, actor_email_hash, ip_hash, resource,
        title, description, source_ip_hash, source_country,
        affected_system, actor_hash, actor_role, resource_path, is_resolved, created_at
      ) VALUES (
        v_casino.id, event_types[n], sevs[n],
        systems[((i-1)%array_length(systems,1))+1],
        encode(sha256(('ae-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        encode(sha256(('ip-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        systems[((i-1)%array_length(systems,1))+1],
        ev_title, 'Automated detection engine recorded this event.',
        encode(sha256(('ip-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        countries[((i-1)%array_length(countries,1))+1],
        systems[((i-1)%array_length(systems,1))+1],
        encode(sha256(('ac-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        CASE (i%4) WHEN 0 THEN 'casino_admin' WHEN 1 THEN 'staff' WHEN 2 THEN 'api_integration' ELSE 'unknown' END,
        systems[((i-1)%array_length(systems,1))+1],
        (i%3=0), now()-((i*2)*interval'1 hour')
      );
    END LOOP;
  END LOOP;
END $$;

-- SEED SECURITY INCIDENTS
DO $$
DECLARE
  v_casino record;
  idx int := 0;
  inc_num int := 1;
  statuses text[] := ARRAY['open','investigating','contained','closed','false_positive'];
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LIMIT 8 LOOP
    INSERT INTO security_incidents (
      affected_casino_id, incident_number, title, severity, category, status,
      escalated, affected_systems, description, impact_assessment,
      reporter_name, detected_at, created_at, updated_at
    ) VALUES (
      v_casino.id, 'INC-2026-'||LPAD(inc_num::text,4,'0'),
      'Credential Stuffing Campaign Detected', 'high', 'authentication',
      statuses[(idx%array_length(statuses,1))+1],
      false, ARRAY['auth/login','api/v1/users'],
      'Multiple failed login attempts from distributed IPs. Pattern consistent with credential stuffing.',
      (20+idx*5)::text||' accounts targeted. No confirmed breach.',
      'automated_detection',
      now()-(idx*18*interval'1 hour'), now()-(idx*18*interval'1 hour'), now()-(idx*12*interval'1 hour')
    ) ON CONFLICT DO NOTHING;
    inc_num := inc_num+1;

    INSERT INTO security_incidents (
      affected_casino_id, incident_number, title, severity, category, status,
      escalated, affected_systems, description, impact_assessment,
      reporter_name, detected_at, created_at, updated_at
    ) VALUES (
      v_casino.id, 'INC-2026-'||LPAD(inc_num::text,4,'0'),
      'API Rate Limit Abuse — Integration Partner', 'medium', 'api_security',
      statuses[((idx+1)%array_length(statuses,1))+1],
      false, ARRAY['api/v1/players','api/v1/sessions'],
      'Integration partner exceeded API rate limits by 400%. Possible scraping or misconfigured client SDK.',
      'Service degradation risk. No data breach detected.',
      'api_gateway_alert',
      now()-((idx+1)*24*interval'1 hour'), now()-((idx+1)*24*interval'1 hour'), now()-(idx*6*interval'1 hour')
    ) ON CONFLICT DO NOTHING;
    inc_num := inc_num+1;
    idx := idx+1;
  END LOOP;

  INSERT INTO security_incidents (
    affected_casino_id, incident_number, title, severity, category, status,
    escalated, escalation_reason, affected_systems, description, impact_assessment,
    reporter_name, regulatory_notification_required, detected_at, created_at, updated_at
  )
  SELECT id, 'INC-2026-'||LPAD(inc_num::text,4,'0'),
    'Suspected Data Exfiltration Attempt', 'critical', 'data_security', 'investigating',
    true, 'Potential reportable incident under POPIA s.22',
    ARRAY['api/v1/export','database'],
    'Single API key downloaded 85,000 records in 4 minutes. Session terminated immediately.',
    'POPIA breach notification may be required within 72 hours. DPO notified.',
    'dlp_monitor', true,
    now()-interval'6 hours', now()-interval'6 hours', now()-interval'1 hour'
  FROM casinos WHERE is_active = true LIMIT 1
  ON CONFLICT DO NOTHING;
END $$;

-- SEED API ACTIVITY
DO $$
DECLARE
  v_casino record; i int;
  endpoints text[] := ARRAY['/api/v1/players','/api/v1/sessions','/api/v1/bets','/api/v1/risk-score','/api/v1/interventions','/api/v1/reports','/api/v1/self-exclusions','/api/v1/compliance','/auth/token'];
  integrations text[] := ARRAY['SoftSwiss','Altenar','Playtech','BetConstruct','Evolution','Internal'];
  codes int[] := ARRAY[200,200,200,200,200,200,201,204,400,401,403,429,500];
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    FOR i IN 1..120 LOOP
      INSERT INTO api_activity (casino_id,integration_name,endpoint,method,status_code,response_ms,ip_hash,country_code,is_rate_limited,is_blocked,is_anomalous,anomaly_reason,created_at)
      VALUES (v_casino.id,integrations[((i-1)%array_length(integrations,1))+1],endpoints[((i-1)%array_length(endpoints,1))+1],
        CASE (i%5) WHEN 0 THEN 'POST' WHEN 1 THEN 'PUT' ELSE 'GET' END,
        codes[((i-1)%array_length(codes,1))+1],20+(random()*480)::int,
        encode(sha256(('api-ip-'||i||'-'||v_casino.id::text)::bytea),'hex'),
        CASE (i%8) WHEN 0 THEN 'NG' WHEN 1 THEN 'CN' ELSE 'ZA' END,
        (i%15=0),(i%30=0),(i%25=0),
        CASE WHEN i%25=0 THEN 'Unusual request volume from this key' ELSE NULL END,
        now()-(i*24*interval'1 minute'));
    END LOOP;
  END LOOP;
END $$;

-- SEED SYSTEM HEALTH METRICS
DO $$
DECLARE i int;
BEGIN
  FOR i IN 0..47 LOOP
    INSERT INTO system_health_metrics (service_name,region,metric_type,value,unit,status,threshold_warning,threshold_critical,recorded_at) VALUES
      ('primary-database','af-south-1','cpu_percent',15+(random()*35)::int,'percent','normal',70,90,now()-(i*interval'30 minutes')),
      ('primary-database','af-south-1','memory_percent',40+(random()*30)::int,'percent','normal',80,95,now()-(i*interval'30 minutes')),
      ('primary-database','af-south-1','connections_active',20+(random()*80)::int,'count','normal',150,200,now()-(i*interval'30 minutes')),
      ('api-gateway','af-south-1','requests_per_second',80+(random()*200)::int,'rps','normal',800,1000,now()-(i*interval'30 minutes')),
      ('api-gateway','af-south-1','latency_p95_ms',45+(random()*60)::int,'ms','normal',300,500,now()-(i*interval'30 minutes')),
      ('api-gateway','af-south-1','error_rate_percent',(random()*3)::numeric(4,2),'percent','normal',5,10,now()-(i*interval'30 minutes')),
      ('auth-service','af-south-1','login_success_rate',92+(random()*7)::int,'percent','normal',80,60,now()-(i*interval'30 minutes')),
      ('auth-service','af-south-1','active_sessions',45+(random()*120)::int,'count','normal',500,1000,now()-(i*interval'30 minutes')),
      ('waf','global','requests_blocked',(random()*15)::int,'count','normal',100,500,now()-(i*interval'30 minutes')),
      ('cdn','global','cache_hit_rate',85+(random()*14)::int,'percent','normal',60,40,now()-(i*interval'30 minutes')),
      ('backup-service','af-south-1','last_backup_age_hours',1+(random()*5)::int,'hours','normal',12,24,now()-(i*interval'30 minutes'));
  END LOOP;
END $$;

-- SEED TENANT SECURITY STATUS
DO $$
DECLARE v_casino record; score int; threat text;
BEGIN
  FOR v_casino IN SELECT id FROM casinos WHERE is_active = true LOOP
    score := 55+(random()*40)::int;
    threat := CASE WHEN score>=85 THEN 'low' WHEN score>=70 THEN 'medium' WHEN score>=50 THEN 'high' ELSE 'critical' END;
    INSERT INTO tenant_security_status (casino_id,security_score,threat_level,open_incidents,open_critical_events,failed_logins_24h,api_errors_24h,mfa_adoption_pct,compliance_score,last_security_review,last_incident_at,ip_allowlist_active,rate_limiting_active,waf_active,updated_at)
    VALUES (v_casino.id,score,threat,(random()*4)::int,(random()*3)::int,(random()*50)::int,(random()*30)::int,
      60+(random()*38)::numeric(5,2),65+(random()*28)::numeric(5,2),
      now()-(random()*30)::int*interval'1 day',now()-(random()*7)::int*interval'1 day',
      (random()>0.3),true,true,now())
    ON CONFLICT (casino_id) DO UPDATE SET security_score=EXCLUDED.security_score,threat_level=EXCLUDED.threat_level,updated_at=now();
  END LOOP;
END $$;
