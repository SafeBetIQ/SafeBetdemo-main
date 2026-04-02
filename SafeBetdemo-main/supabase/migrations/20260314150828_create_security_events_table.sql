/*
  # Security Events Table
  Raw security event stream for the Cybersecurity Command Center
*/
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text,
  source_ip_hash text,
  source_country text,
  source_city_masked text,
  affected_system text,
  actor_hash text,
  actor_role text,
  resource_path text,
  http_method text,
  response_code int,
  raw_metadata jsonb DEFAULT '{}',
  is_automated boolean DEFAULT true,
  incident_id uuid,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sec_events_casino ON security_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_sec_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_sec_events_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_events_type ON security_events(event_type);

CREATE POLICY "Super admin full access to security events"
  ON security_events FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin sees own security events"
  ON security_events FOR SELECT TO authenticated
  USING (
    casino_id = (SELECT get_staff_casino_id(auth.uid()))
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Regulators read all security events"
  ON security_events FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator', 'provincial_regulator'));
