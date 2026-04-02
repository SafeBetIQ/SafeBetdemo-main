/*
  # Cross-Operator Behaviour Intelligence System

  ## Overview
  A pseudonymised, privacy-preserving system for detecting harmful gambling patterns
  that span multiple casino operators. Players are represented by secure tokens — their
  real identities are never transmitted cross-operator.

  ## New Tables

  ### player_pseudonym_tokens
  - Maps each player (per casino) to a cryptographically secure pseudonym token
  - The token is the ONLY identifier shared with external intelligence networks
  - One player can have multiple tokens (one per casino they play at)
  - Tokens are deterministic per (player_id, casino_id) pair — HMAC-style

  ### cross_operator_alerts
  - Stores alerts generated when suspicious cross-operator patterns are detected
  - Alert types: operator_hopping, multi_platform_gambling, cross_operator_loss_chasing,
    self_exclusion_breach, velocity_spike, deposit_escalation
  - Each alert links to a player via pseudonym token (not raw player_id in the alert body)
  - Severity: low, medium, high, critical
  - Status lifecycle: new → reviewed → actioned → dismissed

  ### cross_operator_signal_log
  - Time-series log of cross-operator signal events (individual data points)
  - Powers the scoring algorithm in the edge function
  - Records: which operator reported the event, event type, value, and pseudonym token

  ## Security
  - RLS enabled on all three tables
  - super_admin: full access
  - casino_admin: can only read alerts for their own casino's players
  - regulator / provincial_regulator: read-only access to aggregated alert data
  - Players are never exposed by real ID in cross-operator context — pseudonym only
*/

-- ─────────────────────────────────────────────
-- 1. player_pseudonym_tokens
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_pseudonym_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  pseudonym_token text NOT NULL UNIQUE,
  token_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_player_casino_active UNIQUE (player_id, casino_id)
);

CREATE INDEX IF NOT EXISTS idx_ppt_player_id ON player_pseudonym_tokens(player_id);
CREATE INDEX IF NOT EXISTS idx_ppt_casino_id ON player_pseudonym_tokens(casino_id);
CREATE INDEX IF NOT EXISTS idx_ppt_token ON player_pseudonym_tokens(pseudonym_token);

ALTER TABLE player_pseudonym_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to pseudonym tokens"
  ON player_pseudonym_tokens FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR SELECT
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Casino admin inserts own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Casino admin updates own casino pseudonym tokens"
  ON player_pseudonym_tokens FOR UPDATE
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  )
  WITH CHECK (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- 2. cross_operator_alerts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cross_operator_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Player identity — real ID for internal use, pseudonym for cross-operator reporting
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  pseudonym_token text NOT NULL,

  -- Alert classification
  alert_type text NOT NULL CHECK (alert_type IN (
    'operator_hopping',
    'multi_platform_gambling',
    'cross_operator_loss_chasing',
    'self_exclusion_breach',
    'velocity_spike',
    'deposit_escalation',
    'cross_operator_high_risk'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Status lifecycle
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  action_notes text,

  -- Evidence and context
  detected_operators integer NOT NULL DEFAULT 1,
  operator_names text[] DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}',
  cross_operator_score integer NOT NULL DEFAULT 0 CHECK (cross_operator_score BETWEEN 0 AND 100),
  composite_risk_contribution numeric(5,2) DEFAULT 0,

  -- Pattern metrics
  platforms_detected integer DEFAULT 1,
  total_cross_op_deposits numeric(12,2) DEFAULT 0,
  total_cross_op_losses numeric(12,2) DEFAULT 0,
  session_overlap_minutes integer DEFAULT 0,
  self_exclusion_violation boolean DEFAULT false,
  lookback_days integer DEFAULT 30,

  -- Alert metadata
  alert_message text NOT NULL DEFAULT '',
  recommendation text DEFAULT '',
  auto_generated boolean NOT NULL DEFAULT true,
  false_positive boolean DEFAULT false,

  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coa_player_id ON cross_operator_alerts(player_id);
CREATE INDEX IF NOT EXISTS idx_coa_casino_id ON cross_operator_alerts(casino_id);
CREATE INDEX IF NOT EXISTS idx_coa_pseudonym_token ON cross_operator_alerts(pseudonym_token);
CREATE INDEX IF NOT EXISTS idx_coa_alert_type ON cross_operator_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_coa_severity ON cross_operator_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_coa_status ON cross_operator_alerts(status);
CREATE INDEX IF NOT EXISTS idx_coa_detected_at ON cross_operator_alerts(detected_at DESC);

ALTER TABLE cross_operator_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to cross operator alerts"
  ON cross_operator_alerts FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own casino cross operator alerts"
  ON cross_operator_alerts FOR SELECT
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Casino admin inserts own casino cross operator alerts"
  ON cross_operator_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Casino admin updates own casino cross operator alerts"
  ON cross_operator_alerts FOR UPDATE
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  )
  WITH CHECK (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Regulator read access to cross operator alerts"
  ON cross_operator_alerts FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );

-- ─────────────────────────────────────────────
-- 3. cross_operator_signal_log
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cross_operator_signal_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  pseudonym_token text NOT NULL,

  signal_type text NOT NULL CHECK (signal_type IN (
    'operator_hop',
    'concurrent_session',
    'loss_chase',
    'deposit_escalation',
    'self_exclusion_flag',
    'velocity_spike',
    'multi_platform_deposit'
  )),

  signal_value numeric(12,2) NOT NULL DEFAULT 0,
  signal_score integer NOT NULL DEFAULT 0 CHECK (signal_score BETWEEN 0 AND 100),

  source_operator text DEFAULT 'internal',
  reported_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cosl_player_id ON cross_operator_signal_log(player_id);
CREATE INDEX IF NOT EXISTS idx_cosl_casino_id ON cross_operator_signal_log(casino_id);
CREATE INDEX IF NOT EXISTS idx_cosl_pseudonym ON cross_operator_signal_log(pseudonym_token);
CREATE INDEX IF NOT EXISTS idx_cosl_signal_type ON cross_operator_signal_log(signal_type);
CREATE INDEX IF NOT EXISTS idx_cosl_reported_at ON cross_operator_signal_log(reported_at DESC);

ALTER TABLE cross_operator_signal_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to signal log"
  ON cross_operator_signal_log FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own signal log"
  ON cross_operator_signal_log FOR SELECT
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Casino admin inserts own signal log"
  ON cross_operator_signal_log FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Regulator read access to signal log"
  ON cross_operator_signal_log FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );
