/*
  # Per-Casino Intervention Settings

  Stores configurable intervention parameters per casino.
  One row per casino (enforced by unique index).

  Columns
  -------
  intervention_threshold  — predicted-loss amount (R) that triggers an intervention
  enabled_channels        — text[] of active dispatch channels
  cooldown_minutes        — minimum minutes between re-triggering for same player
  message_template        — message body; supports {player}, {risk}, {amount} variables
*/

CREATE TABLE IF NOT EXISTS casino_settings (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id              uuid        NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,

  intervention_threshold integer     NOT NULL DEFAULT 5000
    CHECK (intervention_threshold > 0),

  enabled_channels       text[]      NOT NULL DEFAULT ARRAY['in_app'],

  cooldown_minutes       integer     NOT NULL DEFAULT 10
    CHECK (cooldown_minutes BETWEEN 1 AND 60),

  message_template       text        NOT NULL DEFAULT
    'We''ve noticed unusual betting activity on your account. Please consider taking a break.',

  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- One settings row per casino
CREATE UNIQUE INDEX IF NOT EXISTS casino_settings_casino_id_unique
  ON casino_settings(casino_id);

CREATE INDEX IF NOT EXISTS idx_casino_settings_casino ON casino_settings(casino_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE casino_settings ENABLE ROW LEVEL SECURITY;

-- Super admins: full access to all
CREATE POLICY "Super admins manage all casino settings"
  ON casino_settings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')
  );

-- Casino admins and compliance officers: read + write own casino only
CREATE POLICY "Casino staff manage own casino settings"
  ON casino_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('casino_admin', 'compliance_officer')
        AND users.casino_id = casino_settings.casino_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('casino_admin', 'compliance_officer')
        AND users.casino_id = casino_settings.casino_id
    )
  );

-- Regulators: read-only across all casinos
CREATE POLICY "Regulators read all casino settings"
  ON casino_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('regulator', 'national_regulator', 'provincial_regulator')
    )
  );

-- ── Seed defaults for all existing casinos ────────────────────────────────────

INSERT INTO casino_settings (
  casino_id,
  intervention_threshold,
  enabled_channels,
  cooldown_minutes,
  message_template
)
SELECT
  id,
  5000,
  ARRAY['in_app']::text[],
  10,
  'We''ve noticed unusual betting activity on your account. Please consider taking a break.'
FROM casinos
ON CONFLICT DO NOTHING;

-- ── Realtime — push settings changes to all connected clients ─────────────────

ALTER TABLE casino_settings REPLICA IDENTITY FULL;
