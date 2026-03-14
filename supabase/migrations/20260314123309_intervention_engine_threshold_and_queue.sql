/*
  # Intervention Engine - Threshold Rules and Delivery Queue

  ## Summary
  - Adds dispatch tracking columns to intervention_history
  - Creates intervention_threshold_rules (configurable per-casino risk triggers)
  - Creates intervention_delivery_queue (per-channel dispatch tracking)
  - Seeds 5 default threshold rules for every casino
  - Seeds demo delivery queue entries
*/

-- ── Add new columns to intervention_history ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='auto_triggered') THEN
    ALTER TABLE intervention_history ADD COLUMN auto_triggered boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='triggered_by') THEN
    ALTER TABLE intervention_history ADD COLUMN triggered_by uuid REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='channels_attempted') THEN
    ALTER TABLE intervention_history ADD COLUMN channels_attempted text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='dispatch_status') THEN
    ALTER TABLE intervention_history ADD COLUMN dispatch_status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='twilio_sid') THEN
    ALTER TABLE intervention_history ADD COLUMN twilio_sid text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intervention_history' AND column_name='resolved_at') THEN
    ALTER TABLE intervention_history ADD COLUMN resolved_at timestamptz;
  END IF;
END $$;

-- ── intervention_threshold_rules ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intervention_threshold_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  risk_threshold integer NOT NULL CHECK (risk_threshold BETWEEN 1 AND 100),
  intervention_type text NOT NULL,
  delivery_methods text[] NOT NULL DEFAULT '{in_app}',
  cooldown_hours integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  message_template text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_int_rules_casino ON intervention_threshold_rules(casino_id);
CREATE INDEX IF NOT EXISTS idx_int_rules_active ON intervention_threshold_rules(casino_id, is_active);

ALTER TABLE intervention_threshold_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage all threshold rules"
  ON intervention_threshold_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino admins manage own threshold rules"
  ON intervention_threshold_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'casino_admin' AND users.casino_id = intervention_threshold_rules.casino_id))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'casino_admin' AND users.casino_id = intervention_threshold_rules.casino_id));

CREATE POLICY "Regulators view all threshold rules"
  ON intervention_threshold_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('regulator','provincial_regulator')));

-- ── intervention_delivery_queue ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intervention_delivery_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id uuid NOT NULL REFERENCES intervention_history(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app','whatsapp','sms','email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  recipient_address text,
  message_body text,
  provider_response jsonb,
  provider_message_id text,
  error_message text,
  attempts integer DEFAULT 0,
  scheduled_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_int_dq_intervention ON intervention_delivery_queue(intervention_id);
CREATE INDEX IF NOT EXISTS idx_int_dq_casino ON intervention_delivery_queue(casino_id);
CREATE INDEX IF NOT EXISTS idx_int_dq_status ON intervention_delivery_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_int_dq_player ON intervention_delivery_queue(player_id);

ALTER TABLE intervention_delivery_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all delivery queue"
  ON intervention_delivery_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'));

CREATE POLICY "Casino admins view own delivery queue"
  ON intervention_delivery_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'casino_admin' AND users.casino_id = intervention_delivery_queue.casino_id));

CREATE POLICY "Authenticated insert delivery queue"
  ON intervention_delivery_queue FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update delivery queue"
  ON intervention_delivery_queue FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Regulators view all delivery queue"
  ON intervention_delivery_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('regulator','provincial_regulator')));

-- ── Seed default threshold rules for all casinos ──────────────────────────────
INSERT INTO intervention_threshold_rules (
  casino_id, rule_name, risk_threshold, intervention_type,
  delivery_methods, cooldown_hours, is_active, auto_send, priority, message_template
)
SELECT
  c.id, r.rule_name, r.risk_threshold, r.intervention_type,
  r.delivery_methods, r.cooldown_hours, true, r.auto_send, r.priority, r.message_template
FROM casinos c
CROSS JOIN (
  VALUES
    ('Responsible Gambling Reminder', 40, 'break_suggestion',  ARRAY['in_app']::text[],                         48, false, 3, 'Hi {player_name}, we noticed you have been playing for a while. A short break helps keep gaming fun.'),
    ('Session Limit Advisory',        55, 'session_limit',     ARRAY['in_app','email']::text[],                  24, false, 2, 'Hi {player_name}, your session is longer than usual. Consider setting a session time limit.'),
    ('Cooling-Off Suggestion',        70, 'cooling_off',       ARRAY['in_app','whatsapp']::text[],               12, false, 2, 'Hi {player_name}, a cooling-off period may benefit you right now. Take a 24–72 hour break.'),
    ('High Risk Compliance Alert',    80, 'contact_support',   ARRAY['in_app','whatsapp','email']::text[],        6, true,  1, 'Hi {player_name}, our responsible gaming team would like to reach out. We are here to help.'),
    ('Critical – Manual Review',      90, 'manual_compliance', ARRAY['in_app','whatsapp','sms','email']::text[],  4, true,  1, 'Urgent notice for {player_name}. Our compliance team will contact you. Helpline: 0800 006 008.')
) AS r(rule_name, risk_threshold, intervention_type, delivery_methods, cooldown_hours, auto_send, priority, message_template)
ON CONFLICT DO NOTHING;

-- ── Seed demo delivery queue entries ─────────────────────────────────────────
INSERT INTO intervention_delivery_queue (
  intervention_id, casino_id, player_id, channel, status,
  message_body, attempts, sent_at, scheduled_at
)
SELECT
  ih.id,
  ih.casino_id,
  ih.player_id,
  ih.delivery_method,
  CASE WHEN random() > 0.12 THEN 'sent' ELSE 'failed' END,
  ih.message_sent,
  1,
  CASE WHEN random() > 0.12 THEN ih.triggered_at + interval '30 seconds' ELSE NULL END,
  ih.triggered_at
FROM intervention_history ih
WHERE ih.delivery_method IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM intervention_delivery_queue dq WHERE dq.intervention_id = ih.id
  )
LIMIT 200;
