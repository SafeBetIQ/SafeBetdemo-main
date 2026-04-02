/*
  # API Activity, System Health Metrics, and Tenant Security Status Tables
*/

-- API ACTIVITY
CREATE TABLE IF NOT EXISTS api_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  api_key_hash text,
  integration_name text,
  endpoint text NOT NULL,
  method text DEFAULT 'GET',
  status_code int,
  response_ms int,
  request_size_bytes int,
  response_size_bytes int,
  ip_hash text,
  country_code text,
  is_rate_limited boolean DEFAULT false,
  is_blocked boolean DEFAULT false,
  is_anomalous boolean DEFAULT false,
  anomaly_reason text,
  user_agent_hash text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_activity ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_activity_casino ON api_activity(casino_id);
CREATE INDEX IF NOT EXISTS idx_api_activity_created ON api_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_activity_blocked ON api_activity(is_blocked);

CREATE POLICY "Super admin reads all API activity"
  ON api_activity FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own API activity"
  ON api_activity FOR SELECT TO authenticated
  USING (casino_id = (SELECT get_staff_casino_id(auth.uid())));

-- SYSTEM HEALTH METRICS
CREATE TABLE IF NOT EXISTS system_health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  region text DEFAULT 'af-south-1',
  metric_type text NOT NULL,
  value numeric NOT NULL,
  unit text,
  status text DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
  threshold_warning numeric,
  threshold_critical numeric,
  recorded_at timestamptz DEFAULT now()
);

ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_health_service ON system_health_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_health_recorded ON system_health_metrics(recorded_at DESC);

CREATE POLICY "Super admin reads all health metrics"
  ON system_health_metrics FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators can read health metrics"
  ON system_health_metrics FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator'));

-- TENANT SECURITY STATUS
CREATE TABLE IF NOT EXISTS tenant_security_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) UNIQUE,
  security_score int DEFAULT 0 CHECK (security_score BETWEEN 0 AND 100),
  threat_level text DEFAULT 'low' CHECK (threat_level IN ('low', 'medium', 'high', 'critical')),
  open_incidents int DEFAULT 0,
  open_critical_events int DEFAULT 0,
  failed_logins_24h int DEFAULT 0,
  api_errors_24h int DEFAULT 0,
  mfa_adoption_pct numeric(5,2) DEFAULT 0,
  compliance_score numeric(5,2) DEFAULT 0,
  last_security_review timestamptz,
  last_incident_at timestamptz,
  ip_allowlist_active boolean DEFAULT false,
  rate_limiting_active boolean DEFAULT true,
  waf_active boolean DEFAULT true,
  notes text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_security_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads all tenant security status"
  ON tenant_security_status FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own tenant status"
  ON tenant_security_status FOR SELECT TO authenticated
  USING (casino_id = (SELECT get_staff_casino_id(auth.uid())));

CREATE POLICY "Regulators read all tenant status"
  ON tenant_security_status FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));
