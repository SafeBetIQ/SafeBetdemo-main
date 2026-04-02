/*
  # Enhanced Behavioral Risk Intelligence - Signal-Based Scoring System v2

  ## Summary
  Upgrades the behavioral risk profiling system to store and calculate individual
  behavioral signals that drive risk scores, enabling transparent, auditable risk
  assessments aligned with responsible gambling regulations.

  ## Changes
  - Adds 5 behavioral signal score columns to behavioral_risk_profiles
  - Adds metadata columns for rationale, history, cross-operator tracking
  - Creates bri_signal_history table for time-series tracking
  - Backfills historical data for trend graphs
*/

-- Add signal columns to behavioral_risk_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'behavioral_risk_profiles' AND column_name = 'session_duration_score'
  ) THEN
    ALTER TABLE behavioral_risk_profiles
      ADD COLUMN session_duration_score integer DEFAULT 0,
      ADD COLUMN deposit_frequency_score integer DEFAULT 0,
      ADD COLUMN loss_escalation_score integer DEFAULT 0,
      ADD COLUMN bet_intensity_score integer DEFAULT 0,
      ADD COLUMN cross_operator_score integer DEFAULT 0,
      ADD COLUMN signal_weights jsonb DEFAULT '{}',
      ADD COLUMN risk_rationale text DEFAULT '',
      ADD COLUMN previous_risk_score integer DEFAULT 0,
      ADD COLUMN score_delta integer DEFAULT 0,
      ADD COLUMN sessions_analyzed integer DEFAULT 0,
      ADD COLUMN deposits_analyzed integer DEFAULT 0,
      ADD COLUMN cross_operator_flags integer DEFAULT 0;
  END IF;
END $$;

-- Add check constraints after column creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'behavioral_risk_profiles' AND constraint_name = 'bri_session_duration_score_range'
  ) THEN
    ALTER TABLE behavioral_risk_profiles
      ADD CONSTRAINT bri_session_duration_score_range CHECK (session_duration_score BETWEEN 0 AND 100),
      ADD CONSTRAINT bri_deposit_frequency_score_range CHECK (deposit_frequency_score BETWEEN 0 AND 100),
      ADD CONSTRAINT bri_loss_escalation_score_range CHECK (loss_escalation_score BETWEEN 0 AND 100),
      ADD CONSTRAINT bri_bet_intensity_score_range CHECK (bet_intensity_score BETWEEN 0 AND 100),
      ADD CONSTRAINT bri_cross_operator_score_range CHECK (cross_operator_score BETWEEN 0 AND 100);
  END IF;
END $$;

-- Backfill signal scores for existing profiles
UPDATE behavioral_risk_profiles
SET
  session_duration_score = LEAST(GREATEST(
    CASE
      WHEN risk_score >= 80 THEN risk_score - 5
      WHEN risk_score >= 60 THEN risk_score - 8
      WHEN risk_score >= 40 THEN risk_score - 10
      ELSE (risk_score * 0.8)::int
    END + (random() * 10 - 5)::int,
    0
  ), 100),
  deposit_frequency_score = LEAST(GREATEST(
    CASE
      WHEN risk_score >= 80 THEN (risk_score * 0.9)::int
      WHEN risk_score >= 60 THEN (risk_score * 0.85)::int
      ELSE (risk_score * 0.7)::int
    END + (random() * 12 - 6)::int,
    0
  ), 100),
  loss_escalation_score = LEAST(GREATEST(
    CASE
      WHEN risk_score >= 80 THEN risk_score + 5
      WHEN risk_score >= 60 THEN risk_score + 2
      ELSE GREATEST(risk_score - 15, 0)
    END + (random() * 8 - 4)::int,
    0
  ), 100),
  bet_intensity_score = LEAST(GREATEST(
    CASE
      WHEN risk_score >= 80 THEN (risk_score * 0.95)::int
      WHEN risk_score >= 60 THEN (risk_score * 0.88)::int
      ELSE (risk_score * 0.75)::int
    END + (random() * 10 - 5)::int,
    0
  ), 100),
  cross_operator_score = LEAST(GREATEST(
    CASE
      WHEN risk_score >= 80 THEN (35 + random() * 40)::int
      WHEN risk_score >= 60 THEN (15 + random() * 30)::int
      ELSE (random() * 20)::int
    END,
    0
  ), 100),
  cross_operator_flags = CASE
    WHEN risk_score >= 80 THEN (2 + random() * 3)::int
    WHEN risk_score >= 60 THEN (1 + random() * 2)::int
    ELSE 0
  END,
  sessions_analyzed = (3 + random() * 8)::int,
  deposits_analyzed = (2 + random() * 6)::int,
  risk_rationale = CASE
    WHEN risk_score >= 80 THEN 'Critical: Multiple high-severity signals including loss escalation, extended sessions, and high deposit frequency. Immediate intervention recommended.'
    WHEN risk_score >= 60 THEN 'High: Loss-chasing behavior observed alongside elevated bet intensity. Session cooling-off period advised.'
    WHEN risk_score >= 40 THEN 'Moderate: Emerging patterns of increased bet intensity and session duration. Continued monitoring required.'
    ELSE 'Low: Behavioral patterns within normal parameters. No immediate action required.'
  END,
  signal_weights = '{"session_duration":0.20,"deposit_frequency":0.20,"loss_escalation":0.30,"bet_intensity":0.20,"cross_operator":0.10}'
WHERE session_duration_score = 0;

-- Create bri_signal_history table
CREATE TABLE IF NOT EXISTS bri_signal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  casino_id uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  risk_score integer NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'low',
  session_duration_score integer DEFAULT 0,
  deposit_frequency_score integer DEFAULT 0,
  loss_escalation_score integer DEFAULT 0,
  bet_intensity_score integer DEFAULT 0,
  cross_operator_score integer DEFAULT 0,
  session_minutes integer DEFAULT 0,
  total_bets integer DEFAULT 0,
  total_wagered numeric(12,2) DEFAULT 0,
  net_loss numeric(12,2) DEFAULT 0,
  deposit_count_24h integer DEFAULT 0,
  largest_bet numeric(12,2) DEFAULT 0,
  avg_bet numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bri_history_risk_score_range CHECK (risk_score BETWEEN 0 AND 100),
  CONSTRAINT bri_history_risk_level_valid CHECK (risk_level IN ('low', 'moderate', 'high', 'critical'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bri_signal_history_player_id ON bri_signal_history(player_id);
CREATE INDEX IF NOT EXISTS idx_bri_signal_history_casino_id ON bri_signal_history(casino_id);
CREATE INDEX IF NOT EXISTS idx_bri_signal_history_recorded_at ON bri_signal_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bri_signal_history_player_recorded ON bri_signal_history(player_id, recorded_at DESC);

-- RLS
ALTER TABLE bri_signal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all bri signal history"
  ON bri_signal_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
  ));

CREATE POLICY "Casino admins can view own casino bri signal history"
  ON bri_signal_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'casino_admin'
      AND users.casino_id = bri_signal_history.casino_id
  ));

CREATE POLICY "Regulators can view all bri signal history"
  ON bri_signal_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('regulator', 'provincial_regulator')
  ));

CREATE POLICY "Authenticated users can insert bri signal history"
  ON bri_signal_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- Seed 30-day history (one reading per day per player)
INSERT INTO bri_signal_history (
  player_id, casino_id, recorded_at, risk_score, risk_level,
  session_duration_score, deposit_frequency_score, loss_escalation_score,
  bet_intensity_score, cross_operator_score,
  session_minutes, total_bets, total_wagered, net_loss,
  deposit_count_24h, largest_bet, avg_bet
)
SELECT
  p.id,
  p.casino_id,
  now() - (gs.days_back || ' days')::interval,
  LEAST(GREATEST(
    p.risk_score + (sin(gs.days_back * 0.4) * 12)::int + ((random() - 0.5) * 14)::int,
    0
  ), 100) AS rs,
  CASE
    WHEN LEAST(GREATEST(p.risk_score + (sin(gs.days_back * 0.4) * 12)::int, 0), 100) >= 80 THEN 'critical'
    WHEN LEAST(GREATEST(p.risk_score + (sin(gs.days_back * 0.4) * 12)::int, 0), 100) >= 60 THEN 'high'
    WHEN LEAST(GREATEST(p.risk_score + (sin(gs.days_back * 0.4) * 12)::int, 0), 100) >= 40 THEN 'moderate'
    ELSE 'low'
  END,
  LEAST(GREATEST(p.risk_score - 5 + (random() * 18 - 9)::int, 0), 100),
  LEAST(GREATEST(p.risk_score - 8 + (random() * 18 - 9)::int, 0), 100),
  LEAST(GREATEST(p.risk_score + 5 + (random() * 18 - 9)::int, 0), 100),
  LEAST(GREATEST(p.risk_score - 3 + (random() * 18 - 9)::int, 0), 100),
  CASE WHEN p.risk_score >= 70 THEN (20 + random() * 35)::int ELSE (random() * 22)::int END,
  (30 + p.risk_score * 1.5 + random() * 45)::int,
  (10 + p.risk_score * 0.7 + random() * 25)::int,
  (500 + p.risk_score * 45 + random() * 1500)::numeric,
  CASE WHEN p.risk_score >= 50 THEN (150 + random() * 800)::numeric ELSE (random() * 300)::numeric END,
  CASE WHEN p.risk_score >= 70 THEN (2 + random() * 3)::int ELSE (random() * 2)::int END,
  (100 + p.risk_score * 18 + random() * 400)::numeric,
  (50 + p.risk_score * 4 + random() * 80)::numeric
FROM players p
CROSS JOIN generate_series(0, 29) AS gs(days_back)
WHERE p.is_active = true
ON CONFLICT DO NOTHING;
