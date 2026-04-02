/*
  # Comprehensive Schema: Core Tables, Indexes, RLS, and Role Access Matrix

  ## Summary
  Creates the canonical production schema with:
  - sessions, transactions, behaviour_events, self_exclusions
  - operator_integrations, feature_modules, operator_feature_access
  - audit_logs enhancements
  - role_access_matrix for UI-layer permission enforcement
  - All tables pseudonymise players via player_token
  - RLS enforced on every table
  - Performance indexes on all foreign keys and time columns

  ## Security
  - No PII stored — player_token is pseudonymised
  - Casino admins isolated to their own operator
  - Regulators have national/provincial read access
  - Super admin has full access
*/

-- ============================================================
-- OPERATORS VIEW (canonical alias over casinos)
-- ============================================================
CREATE OR REPLACE VIEW operators AS
SELECT
  id,
  name,
  license_number,
  contact_email,
  contact_phone,
  address,
  province,
  country,
  is_active,
  simulation_mode,
  created_at
FROM casinos;

-- ============================================================
-- SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_token text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  game_type text,
  device_type text DEFAULT 'unknown',
  total_wagered numeric(14,2) DEFAULT 0,
  total_won numeric(14,2) DEFAULT 0,
  session_risk_score integer DEFAULT 0 CHECK (session_risk_score BETWEEN 0 AND 100),
  is_flagged boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sessions_casino_id ON sessions(casino_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player_token ON sessions(player_token);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_is_flagged ON sessions(is_flagged) WHERE is_flagged = true;

CREATE POLICY "Casino admins see own sessions"
  ON sessions FOR SELECT TO authenticated
  USING (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'national_regulator', 'regulator'))
  );

CREATE POLICY "Casino admins insert sessions"
  ON sessions FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Casino admins update own sessions"
  ON sessions FOR UPDATE TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_token text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit','withdrawal','wager','win','bonus','refund')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  game_type text,
  risk_flag boolean DEFAULT false,
  risk_reason text,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_casino_id ON transactions(casino_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session_id ON transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_player_token ON transactions(player_token);
CREATE INDEX IF NOT EXISTS idx_transactions_processed_at ON transactions(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_risk_flag ON transactions(risk_flag) WHERE risk_flag = true;
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

CREATE POLICY "Casino admins see own transactions"
  ON transactions FOR SELECT TO authenticated
  USING (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'national_regulator', 'regulator'))
  );

CREATE POLICY "Casino admins insert transactions"
  ON transactions FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- BEHAVIOUR_EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS behaviour_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_token text NOT NULL,
  event_type text NOT NULL,
  signal_score integer DEFAULT 0 CHECK (signal_score BETWEEN 0 AND 100),
  severity text DEFAULT 'low' CHECK (severity IN ('low','medium','high','critical')),
  event_data jsonb DEFAULT '{}',
  model_version text DEFAULT '1.0',
  flagged_for_review boolean DEFAULT false,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE behaviour_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_behaviour_events_casino_id ON behaviour_events(casino_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_player_id ON behaviour_events(player_id);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_player_token ON behaviour_events(player_token);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_event_type ON behaviour_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_severity ON behaviour_events(severity);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_recorded_at ON behaviour_events(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_behaviour_events_flagged ON behaviour_events(flagged_for_review) WHERE flagged_for_review = true;

CREATE POLICY "Casino admins see own behaviour events"
  ON behaviour_events FOR SELECT TO authenticated
  USING (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'national_regulator', 'regulator'))
  );

CREATE POLICY "Casino admins insert behaviour events"
  ON behaviour_events FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Reviewers update behaviour events"
  ON behaviour_events FOR UPDATE TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- SELF_EXCLUSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS self_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_token text NOT NULL,
  exclusion_type text NOT NULL DEFAULT 'self' CHECK (exclusion_type IN ('self','operator_initiated','regulator_mandated','network')),
  duration_type text NOT NULL DEFAULT 'indefinite' CHECK (duration_type IN ('temporary','indefinite','permanent')),
  duration_days integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','lifted','breached')),
  breach_count integer DEFAULT 0,
  reason text,
  notes text,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  nrgp_reported boolean DEFAULT false,
  nrgp_reported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE self_exclusions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_self_exclusions_casino_id ON self_exclusions(casino_id);
CREATE INDEX IF NOT EXISTS idx_self_exclusions_player_id ON self_exclusions(player_id);
CREATE INDEX IF NOT EXISTS idx_self_exclusions_player_token ON self_exclusions(player_token);
CREATE INDEX IF NOT EXISTS idx_self_exclusions_status ON self_exclusions(status);
CREATE INDEX IF NOT EXISTS idx_self_exclusions_starts_at ON self_exclusions(starts_at DESC);

CREATE POLICY "Casino admins see own exclusions"
  ON self_exclusions FOR SELECT TO authenticated
  USING (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin','national_regulator','regulator','provincial_regulator'))
  );

CREATE POLICY "Casino admins insert exclusions"
  ON self_exclusions FOR INSERT TO authenticated
  WITH CHECK (
    casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Casino admins update own exclusions"
  ON self_exclusions FOR UPDATE TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- OPERATOR_INTEGRATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS operator_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'casino_management' CHECK (provider_type IN (
    'casino_management','payment_gateway','kyc_aml','whatsapp','sms','email',
    'regulator_feed','data_warehouse','custom'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','error','disconnected')),
  api_endpoint text,
  webhook_url text,
  last_sync_at timestamptz,
  sync_frequency_minutes integer DEFAULT 60,
  records_synced_total integer DEFAULT 0,
  error_count integer DEFAULT 0,
  last_error text,
  config jsonb DEFAULT '{}',
  enabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(casino_id, provider_name)
);

ALTER TABLE operator_integrations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_operator_integrations_casino_id ON operator_integrations(casino_id);
CREATE INDEX IF NOT EXISTS idx_operator_integrations_status ON operator_integrations(status);

CREATE POLICY "Casino admins see own integrations"
  ON operator_integrations FOR SELECT TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Admins insert integrations"
  ON operator_integrations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
    OR casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
  );

CREATE POLICY "Casino admins update own integrations"
  ON operator_integrations FOR UPDATE TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- FEATURE_MODULES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'core',
  tier text NOT NULL DEFAULT 'standard' CHECK (tier IN ('standard','premium','enterprise')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  icon text DEFAULT 'shield',
  sort_order integer DEFAULT 0,
  permissions_required text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_modules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feature_modules_slug ON feature_modules(slug);
CREATE INDEX IF NOT EXISTS idx_feature_modules_is_active ON feature_modules(is_active);

CREATE POLICY "Authenticated users view feature modules"
  ON feature_modules FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins insert feature modules"
  ON feature_modules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins update feature modules"
  ON feature_modules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- OPERATOR_FEATURE_ACCESS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS operator_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  feature_module_id uuid NOT NULL REFERENCES feature_modules(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT true,
  enabled_at timestamptz DEFAULT now(),
  enabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(casino_id, feature_module_id)
);

ALTER TABLE operator_feature_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_operator_feature_access_casino_id ON operator_feature_access(casino_id);
CREATE INDEX IF NOT EXISTS idx_operator_feature_access_module_id ON operator_feature_access(feature_module_id);
CREATE INDEX IF NOT EXISTS idx_operator_feature_access_enabled ON operator_feature_access(is_enabled);

CREATE POLICY "Casino admins see own feature access"
  ON operator_feature_access FOR SELECT TO authenticated
  USING (casino_id = (SELECT casino_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins grant feature access"
  ON operator_feature_access FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins update feature access"
  ON operator_feature_access FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins delete feature access"
  ON operator_feature_access FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================
-- AUDIT_LOGS ENHANCEMENTS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN operator_id uuid REFERENCES casinos(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'role_at_time'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN role_at_time text;
    ALTER TABLE audit_logs ADD COLUMN ip_address text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator_id ON audit_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- ROLE_ACCESS_MATRIX TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS role_access_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  resource text NOT NULL,
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  scope text DEFAULT 'own' CHECK (scope IN ('own','province','national','all')),
  notes text,
  UNIQUE(role, resource)
);

ALTER TABLE role_access_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read access matrix"
  ON role_access_matrix FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins manage access matrix"
  ON role_access_matrix FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins update access matrix"
  ON role_access_matrix FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

-- Seed access matrix
INSERT INTO role_access_matrix (role, resource, can_read, can_write, can_delete, scope, notes) VALUES
  ('super_admin','operators',             true, true, true,  'all',      'Full operator management'),
  ('super_admin','players',               true, true, true,  'all',      'Full player management'),
  ('super_admin','sessions',              true, true, false, 'all',      'Session oversight'),
  ('super_admin','transactions',          true, true, false, 'all',      'Transaction oversight'),
  ('super_admin','behaviour_events',      true, true, false, 'all',      'Behaviour signal access'),
  ('super_admin','interventions',         true, true, true,  'all',      'Full intervention management'),
  ('super_admin','self_exclusions',       true, true, true,  'all',      'Full exclusion management'),
  ('super_admin','cross_operator_alerts', true, true, true,  'all',      'Cross-operator intelligence'),
  ('super_admin','feature_modules',       true, true, true,  'all',      'Module management'),
  ('super_admin','audit_logs',            true, false,false, 'all',      'Full audit trail'),
  ('super_admin','regulators',            true, true, true,  'all',      'Regulator management'),
  ('national_regulator','operators',      true, false,false, 'national', 'View all operators'),
  ('national_regulator','players',        true, false,false, 'national', 'Aggregate view only'),
  ('national_regulator','sessions',       true, false,false, 'national', 'Session analytics'),
  ('national_regulator','transactions',   true, false,false, 'national', 'Transaction analytics'),
  ('national_regulator','behaviour_events',true,false,false, 'national', 'BRI analytics'),
  ('national_regulator','interventions',  true, false,false, 'national', 'Intervention oversight'),
  ('national_regulator','self_exclusions',true, false,false, 'national', 'Exclusion oversight'),
  ('national_regulator','cross_operator_alerts',true,false,false,'national','Cross-op intelligence'),
  ('national_regulator','audit_logs',     true, false,false, 'national', 'Audit access'),
  ('provincial_regulator','operators',    true, false,false, 'province', 'Province operators only'),
  ('provincial_regulator','players',      true, false,false, 'province', 'Province players only'),
  ('provincial_regulator','sessions',     true, false,false, 'province', 'Province sessions'),
  ('provincial_regulator','interventions',true, false,false, 'province', 'Province interventions'),
  ('provincial_regulator','self_exclusions',true,false,false,'province', 'Province exclusions'),
  ('provincial_regulator','audit_logs',   true, false,false, 'province', 'Province audit trail'),
  ('casino_admin','operators',            true, true, false, 'own',      'Own operator data'),
  ('casino_admin','players',              true, true, false, 'own',      'Own players'),
  ('casino_admin','sessions',             true, true, false, 'own',      'Own sessions'),
  ('casino_admin','transactions',         true, true, false, 'own',      'Own transactions'),
  ('casino_admin','behaviour_events',     true, true, false, 'own',      'Own behaviour signals'),
  ('casino_admin','interventions',        true, true, false, 'own',      'Own interventions'),
  ('casino_admin','self_exclusions',      true, true, false, 'own',      'Own exclusion registry'),
  ('casino_admin','audit_logs',           true, false,false, 'own',      'Own audit trail'),
  ('compliance_officer','players',        true, false,false, 'own',      'Read own players'),
  ('compliance_officer','sessions',       true, false,false, 'own',      'Read own sessions'),
  ('compliance_officer','behaviour_events',true,false,false, 'own',      'Read BRI signals'),
  ('compliance_officer','interventions',  true, true, false, 'own',      'Manage interventions'),
  ('compliance_officer','self_exclusions',true, true, false, 'own',      'Manage exclusions'),
  ('compliance_officer','audit_logs',     true, false,false, 'own',      'Read audit trail')
ON CONFLICT (role, resource) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write,
  can_delete = EXCLUDED.can_delete,
  scope = EXCLUDED.scope,
  notes = EXCLUDED.notes;

-- ============================================================
-- SEED FEATURE_MODULES
-- ============================================================
INSERT INTO feature_modules (slug, name, description, category, tier, is_default, icon, sort_order)
VALUES
  ('behavioural-risk-intelligence',  'Behavioural Risk Intelligence',  'AI-powered player behaviour analysis with real-time risk scoring.', 'core','standard',true,'brain',1),
  ('responsible-gambling-alerts',    'Responsible Gambling Alerts',    'Automated intervention alerts and escalation workflows.',           'core','standard',true,'bell',2),
  ('compliance-reporting',           'Compliance Reporting',           'Automated regulatory compliance reports and audit trails.',        'core','standard',true,'file-check',3),
  ('cross-operator-monitoring',      'Cross Operator Monitoring',      'Intelligence sharing across operators for multi-venue patterns.',  'intelligence','premium',false,'network',4),
  ('self-exclusion-network',         'Self Exclusion Network',         'SARGF-compliant cross-venue exclusion register.',                  'compliance','premium',false,'user-x',5),
  ('ai-risk-forecasting',            'AI Risk Forecasting',            'Predictive AI models forecasting risk up to 30 days ahead.',      'ai','enterprise',false,'sparkles',6),
  ('regulator-intelligence',         'Regulator Intelligence',         'National and provincial gambling behaviour intelligence.',         'compliance','enterprise',false,'landmark',7)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tier = EXCLUDED.tier,
  is_default = EXCLUDED.is_default,
  icon = EXCLUDED.icon,
  updated_at = now();

-- Auto-grant default modules to all casinos
INSERT INTO operator_feature_access (casino_id, feature_module_id, is_enabled, enabled_at)
SELECT c.id, fm.id, true, now()
FROM casinos c
CROSS JOIN feature_modules fm
WHERE fm.is_default = true AND fm.is_active = true
ON CONFLICT (casino_id, feature_module_id) DO NOTHING;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_current_user_role_v2()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM users WHERE id = auth.uid() LIMIT 1),
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION player_belongs_to_casino(p_player_id uuid, p_casino_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND casino_id = p_casino_id
  );
$$;

-- RPC: get operator's enabled feature module slugs
CREATE OR REPLACE FUNCTION get_operator_feature_slugs(p_casino_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(fm.slug)
  FROM operator_feature_access ofa
  JOIN feature_modules fm ON fm.id = ofa.feature_module_id
  WHERE ofa.casino_id = p_casino_id
    AND ofa.is_enabled = true
    AND fm.is_active = true;
$$;
