/*
  # Self-Exclusion Monitoring Network

  ## Overview
  A multi-operator network that allows casinos to submit self-exclusion events and receive
  protection intelligence distributed across the entire SafeBet IQ operator network.
  All player identities are pseudonymised before cross-operator distribution.

  ## Architecture
  1. Operators submit exclusion events via `sen_exclusion_events`
  2. SafeBet IQ processes and validates the event
  3. Protection intelligence is broadcast via `sen_protection_broadcasts`
  4. All participating operators are notified via `sen_operator_subscriptions`
  5. Breach detections are logged in `sen_breach_detections`
  6. Network health and stats are tracked in `sen_network_stats`

  ## New Tables

  ### sen_exclusion_events
  - Submitted by operators when a player self-excludes
  - Contains pseudonymised player token, exclusion type, duration, reason
  - Status: pending → validated → broadcast → expired

  ### sen_protection_broadcasts
  - Intelligence distributed by SafeBet IQ to all network operators
  - Each broadcast targets specific operators or the entire network
  - Includes protection action (block, flag, restrict) and confidence level
  - References the originating exclusion event

  ### sen_operator_subscriptions
  - Which operators are subscribed to receive cross-network protection alerts
  - Subscription types: full_network, province_only, mutual
  - Tracks acknowledgement of broadcasts

  ### sen_breach_detections
  - When a player covered by an active broadcast is detected at another operator
  - Links to the original broadcast and the detecting operator
  - Generates automatic cross_operator_alerts

  ### sen_network_stats (materialized view helper)
  - Aggregate counters updated by triggers for dashboard display

  ## Security
  - RLS: super_admin and casino_admin scoped access
  - Regulators get read-only access to aggregate stats and breaches
  - Pseudonym tokens ensure no raw player identities cross operator boundaries
*/

-- ─────────────────────────────────────────────
-- 1. sen_exclusion_events
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sen_exclusion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Submitting operator
  submitting_casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id),

  -- Player (internal only — never transmitted cross-operator)
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  pseudonym_token text NOT NULL,

  -- Exclusion details
  exclusion_type text NOT NULL CHECK (exclusion_type IN (
    'voluntary_self_exclusion',
    'operator_initiated',
    'regulatory_order',
    'family_requested',
    'national_register'
  )),
  exclusion_reason text DEFAULT '',
  duration_months integer NOT NULL DEFAULT 6 CHECK (duration_months BETWEEN 1 AND 120),
  exclusion_start_date date NOT NULL DEFAULT CURRENT_DATE,
  exclusion_end_date date NOT NULL,
  is_permanent boolean NOT NULL DEFAULT false,

  -- Player profile at time of exclusion (anonymised demographics for pattern intelligence)
  risk_score_at_exclusion integer DEFAULT 0 CHECK (risk_score_at_exclusion BETWEEN 0 AND 100),
  trigger_event text DEFAULT '',
  cross_operator_history boolean DEFAULT false,
  previous_exclusions integer DEFAULT 0,

  -- Network processing
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'validated', 'broadcast', 'expired', 'revoked'
  )),
  validated_at timestamptz,
  broadcast_at timestamptz,
  expires_at timestamptz,

  -- Regulatory
  reported_to_nrgp boolean DEFAULT false,
  nrgp_reference text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_see_casino_id    ON sen_exclusion_events(submitting_casino_id);
CREATE INDEX IF NOT EXISTS idx_see_player_id    ON sen_exclusion_events(player_id);
CREATE INDEX IF NOT EXISTS idx_see_pseudonym    ON sen_exclusion_events(pseudonym_token);
CREATE INDEX IF NOT EXISTS idx_see_status       ON sen_exclusion_events(status);
CREATE INDEX IF NOT EXISTS idx_see_created_at   ON sen_exclusion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_see_end_date     ON sen_exclusion_events(exclusion_end_date);

ALTER TABLE sen_exclusion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to exclusion events"
  ON sen_exclusion_events FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own casino exclusion events"
  ON sen_exclusion_events FOR SELECT
  TO authenticated
  USING (
    submitting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Casino admin submits exclusion events"
  ON sen_exclusion_events FOR INSERT
  TO authenticated
  WITH CHECK (
    submitting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Casino admin updates own exclusion events"
  ON sen_exclusion_events FOR UPDATE
  TO authenticated
  USING (
    submitting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  )
  WITH CHECK (
    submitting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Regulator read access to exclusion events"
  ON sen_exclusion_events FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );

-- ─────────────────────────────────────────────
-- 2. sen_operator_subscriptions
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sen_operator_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  subscription_type text NOT NULL DEFAULT 'full_network' CHECK (subscription_type IN (
    'full_network', 'province_only', 'mutual', 'national_register_only'
  )),
  is_active boolean NOT NULL DEFAULT true,
  receives_broadcasts boolean NOT NULL DEFAULT true,
  submits_events boolean NOT NULL DEFAULT true,
  notification_email text,
  webhook_url text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_broadcast_received_at timestamptz,
  total_events_submitted integer NOT NULL DEFAULT 0,
  total_broadcasts_received integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_casino_subscription UNIQUE (casino_id)
);

CREATE INDEX IF NOT EXISTS idx_sos_casino_id ON sen_operator_subscriptions(casino_id);
CREATE INDEX IF NOT EXISTS idx_sos_is_active ON sen_operator_subscriptions(is_active);

ALTER TABLE sen_operator_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to subscriptions"
  ON sen_operator_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own subscription"
  ON sen_operator_subscriptions FOR SELECT
  TO authenticated
  USING (
    casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Super admin manages subscriptions"
  ON sen_operator_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Super admin updates subscriptions"
  ON sen_operator_subscriptions FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin'
    OR casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin'
    OR casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Regulator read access to subscriptions"
  ON sen_operator_subscriptions FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );

-- ─────────────────────────────────────────────
-- 3. sen_protection_broadcasts
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sen_protection_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source event
  exclusion_event_id uuid NOT NULL REFERENCES sen_exclusion_events(id) ON DELETE CASCADE,
  originating_casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,

  -- Pseudonymised subject — this is the ONLY identifier shared with other operators
  pseudonym_token text NOT NULL,

  -- Broadcast scope
  broadcast_scope text NOT NULL DEFAULT 'full_network' CHECK (broadcast_scope IN (
    'full_network', 'province_only', 'national_register', 'bilateral'
  )),
  target_province text,
  target_casino_ids uuid[] DEFAULT '{}',

  -- Protection instruction
  protection_action text NOT NULL CHECK (protection_action IN (
    'block_access',
    'flag_for_review',
    'restrict_deposits',
    'mandatory_check',
    'alert_operator'
  )),
  protection_level text NOT NULL DEFAULT 'standard' CHECK (protection_level IN (
    'advisory', 'standard', 'mandatory', 'emergency'
  )),
  confidence_score integer NOT NULL DEFAULT 100 CHECK (confidence_score BETWEEN 0 AND 100),

  -- Broadcast content (no PII — only anonymised risk data)
  exclusion_type text NOT NULL,
  duration_months integer NOT NULL,
  is_permanent boolean DEFAULT false,
  risk_score_at_exclusion integer DEFAULT 0,
  cross_operator_pattern boolean DEFAULT false,
  previous_exclusions integer DEFAULT 0,

  -- Validity
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,

  -- Delivery
  operators_notified integer NOT NULL DEFAULT 0,
  acknowledgements_received integer NOT NULL DEFAULT 0,
  last_delivered_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spb_pseudonym      ON sen_protection_broadcasts(pseudonym_token);
CREATE INDEX IF NOT EXISTS idx_spb_event_id       ON sen_protection_broadcasts(exclusion_event_id);
CREATE INDEX IF NOT EXISTS idx_spb_casino_id      ON sen_protection_broadcasts(originating_casino_id);
CREATE INDEX IF NOT EXISTS idx_spb_is_active      ON sen_protection_broadcasts(is_active);
CREATE INDEX IF NOT EXISTS idx_spb_valid_until    ON sen_protection_broadcasts(valid_until);
CREATE INDEX IF NOT EXISTS idx_spb_created_at     ON sen_protection_broadcasts(created_at DESC);

ALTER TABLE sen_protection_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to broadcasts"
  ON sen_protection_broadcasts FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads broadcasts for own casino"
  ON sen_protection_broadcasts FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
    AND (
      originating_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
      OR broadcast_scope = 'full_network'
      OR (
        broadcast_scope = 'province_only'
        AND target_province = (
          SELECT c.province FROM casinos c
          WHERE c.id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Super admin inserts broadcasts"
  ON sen_protection_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('super_admin', 'casino_admin')
  );

CREATE POLICY "Super admin updates broadcasts"
  ON sen_protection_broadcasts FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin'
  );

CREATE POLICY "Regulator read access to broadcasts"
  ON sen_protection_broadcasts FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );

-- ─────────────────────────────────────────────
-- 4. sen_broadcast_acknowledgements
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sen_broadcast_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES sen_protection_broadcasts(id) ON DELETE CASCADE,
  receiving_casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  action_taken text CHECK (action_taken IN (
    'blocked', 'flagged', 'noted', 'already_excluded', 'player_not_found', 'no_action'
  )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_broadcast_casino_ack UNIQUE (broadcast_id, receiving_casino_id)
);

CREATE INDEX IF NOT EXISTS idx_sba_broadcast_id  ON sen_broadcast_acknowledgements(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_sba_casino_id     ON sen_broadcast_acknowledgements(receiving_casino_id);

ALTER TABLE sen_broadcast_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT
  TO authenticated
  USING (
    receiving_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
  );

CREATE POLICY "Casino admin submits acknowledgements"
  ON sen_broadcast_acknowledgements FOR INSERT
  TO authenticated
  WITH CHECK (
    receiving_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Regulator read access to acknowledgements"
  ON sen_broadcast_acknowledgements FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );

-- ─────────────────────────────────────────────
-- 5. sen_breach_detections
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sen_breach_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links back to the active broadcast that was violated
  broadcast_id uuid NOT NULL REFERENCES sen_protection_broadcasts(id) ON DELETE CASCADE,
  exclusion_event_id uuid NOT NULL REFERENCES sen_exclusion_events(id) ON DELETE CASCADE,

  -- Where and when the breach was detected
  detecting_casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  originating_casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,

  -- Player reference (internal — detection casino has local player record)
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  pseudonym_token text NOT NULL,

  -- Detection context
  detection_method text NOT NULL DEFAULT 'token_match' CHECK (detection_method IN (
    'token_match', 'manual_check', 'deposit_trigger', 'login_trigger', 'biometric'
  )),
  detection_context text NOT NULL DEFAULT 'login' CHECK (detection_context IN (
    'login', 'deposit', 'session_start', 'kyc_check', 'manual_review'
  )),

  -- Response
  response_action text CHECK (response_action IN (
    'account_suspended', 'deposit_blocked', 'session_terminated', 'flagged_for_review', 'reported_to_regulator', 'no_action'
  )),
  response_time_minutes integer,
  cross_operator_alert_id uuid REFERENCES cross_operator_alerts(id) ON DELETE SET NULL,

  -- Amounts involved before detection
  amount_deposited_before_detection numeric(12,2) DEFAULT 0,
  session_duration_before_detection integer DEFAULT 0,

  severity text NOT NULL DEFAULT 'critical' CHECK (severity IN ('high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'responded', 'reported', 'closed')),
  regulatory_report_filed boolean DEFAULT false,
  nrgp_notified boolean DEFAULT false,

  detected_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sbd_broadcast_id        ON sen_breach_detections(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_sbd_detecting_casino    ON sen_breach_detections(detecting_casino_id);
CREATE INDEX IF NOT EXISTS idx_sbd_originating_casino  ON sen_breach_detections(originating_casino_id);
CREATE INDEX IF NOT EXISTS idx_sbd_player_id           ON sen_breach_detections(player_id);
CREATE INDEX IF NOT EXISTS idx_sbd_pseudonym           ON sen_breach_detections(pseudonym_token);
CREATE INDEX IF NOT EXISTS idx_sbd_detected_at         ON sen_breach_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_sbd_status              ON sen_breach_detections(status);

ALTER TABLE sen_breach_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access to breach detections"
  ON sen_breach_detections FOR SELECT
  TO authenticated
  USING ((SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "Casino admin reads own breach detections"
  ON sen_breach_detections FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'casino_admin'
    AND (
      detecting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
      OR originating_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "Casino admin inserts breach detections"
  ON sen_breach_detections FOR INSERT
  TO authenticated
  WITH CHECK (
    detecting_casino_id = (SELECT (raw_app_meta_data->>'casino_id')::uuid FROM auth.users WHERE id = auth.uid())
    AND (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Casino admin updates own breach detections"
  ON sen_breach_detections FOR UPDATE
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  )
  WITH CHECK (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('casino_admin', 'super_admin')
  );

CREATE POLICY "Regulator read access to breach detections"
  ON sen_breach_detections FOR SELECT
  TO authenticated
  USING (
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      IN ('regulator', 'provincial_regulator')
  );
