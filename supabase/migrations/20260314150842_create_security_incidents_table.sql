/*
  # Security Incidents Table
  Managed incident lifecycle with investigation workflow
*/
CREATE TABLE IF NOT EXISTS security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid REFERENCES casinos(id),
  incident_number text UNIQUE,
  title text NOT NULL,
  description text,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'remediated', 'closed', 'false_positive')),
  assigned_to text,
  assigned_at timestamptz,
  escalated boolean DEFAULT false,
  escalated_at timestamptz,
  escalation_reason text,
  affected_systems text[] DEFAULT '{}',
  related_event_ids uuid[] DEFAULT '{}',
  containment_actions text,
  remediation_steps text,
  resolution_notes text,
  root_cause text,
  impact_assessment text,
  reporter text,
  acknowledged_at timestamptz,
  contained_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_target_hours int DEFAULT 4,
  breached_sla boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON security_incidents(created_at DESC);

CREATE POLICY "Super admin manages all incidents"
  ON security_incidents FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Super admin can insert incidents"
  ON security_incidents FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Super admin can update incidents"
  ON security_incidents FOR UPDATE TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Regulators can view all incidents"
  ON security_incidents FOR SELECT TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('national_regulator', 'regulator'));
