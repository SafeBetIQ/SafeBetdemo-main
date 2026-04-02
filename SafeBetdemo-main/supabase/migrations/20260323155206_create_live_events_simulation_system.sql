/*
  # Live Events & Simulation System

  ## Overview
  Creates the real-time event ingestion infrastructure for SafeBet IQ's live casino data streaming.

  ## New Tables

  ### live_events
  - Core event stream table. Receives all casino events (BET_PLACED, BET_RESULT, SESSION_START, etc.)
  - Optimised for high-throughput inserts and fast reads by casino + timestamp
  - Enables Supabase Realtime subscriptions for sub-second dashboard updates

  ### machine_activity
  - Tracks individual gaming machine/terminal status in real-time
  - Records active player sessions, spins per minute, idle/active state

  ### simulation_config
  - Per-casino simulation settings (player count, time scaling, behaviour profiles)
  - Controls demo mode vs live mode toggle

  ### live_kpi_snapshots
  - Aggregated KPI snapshots per minute per casino for charting

  ## Security
  - RLS enabled on all tables
  - Casino admins can only read their own casino's data
  - Service role has full access for edge function ingestion
*/

-- ─────────────────────────────────────────────
-- LIVE EVENTS (unified event stream)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type       text NOT NULL CHECK (event_type IN (
    'BET_PLACED','BET_RESULT','SESSION_START','SESSION_END',
    'GAME_SPIN','HAND_PLAYED','DEPOSIT','WITHDRAWAL',
    'TIME_SPENT_UPDATE','MACHINE_ACTIVITY','RISK_FLAG'
  )),
  casino_id        uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  player_id        text NOT NULL,
  session_id       text,
  game_id          text,
  machine_id       text,
  bet_amount       numeric(12,2) DEFAULT 0,
  win_amount       numeric(12,2) DEFAULT 0,
  balance_after    numeric(14,2),
  duration_seconds integer DEFAULT 0,
  risk_score       integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_flags       jsonb DEFAULT '[]',
  outcome          text CHECK (outcome IN ('win','loss','push','active',NULL)),
  game_type        text,
  is_simulated     boolean DEFAULT true,
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino admins can view own live events"
  ON live_events FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','compliance_officer')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Service role can insert live events"
  ON live_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert live events"
  ON live_events FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','super_admin')
    )
  );

-- Indexes for high-performance reads
CREATE INDEX IF NOT EXISTS idx_live_events_casino_created ON live_events(casino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_events_event_type ON live_events(event_type);
CREATE INDEX IF NOT EXISTS idx_live_events_player ON live_events(player_id);
CREATE INDEX IF NOT EXISTS idx_live_events_created_at ON live_events(created_at DESC);

-- ─────────────────────────────────────────────
-- MACHINE ACTIVITY
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machine_activity (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id           uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  machine_id          text NOT NULL,
  machine_type        text DEFAULT 'slot' CHECK (machine_type IN ('slot','table','rng','live_dealer')),
  current_player_id   text,
  session_start       timestamptz,
  status              text DEFAULT 'idle' CHECK (status IN ('active','idle','offline','maintenance')),
  spins_per_minute    numeric(6,2) DEFAULT 0,
  current_risk_score  integer DEFAULT 0,
  total_wagered_session numeric(12,2) DEFAULT 0,
  is_simulated        boolean DEFAULT true,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  UNIQUE(casino_id, machine_id)
);

ALTER TABLE machine_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino admins can view own machine activity"
  ON machine_activity FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','compliance_officer')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Service role can manage machine activity"
  ON machine_activity FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_machine_activity_casino ON machine_activity(casino_id);
CREATE INDEX IF NOT EXISTS idx_machine_activity_status ON machine_activity(status);

-- ─────────────────────────────────────────────
-- SIMULATION CONFIG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulation_config (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id         uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  is_active         boolean DEFAULT false,
  mode              text DEFAULT 'demo' CHECK (mode IN ('demo','live','paused')),
  player_pool_size  integer DEFAULT 1000 CHECK (player_pool_size BETWEEN 100 AND 100000),
  events_per_minute integer DEFAULT 60 CHECK (events_per_minute BETWEEN 1 AND 10000),
  time_scale        numeric(6,2) DEFAULT 1.0,
  behaviour_mix     jsonb DEFAULT '{"casual": 0.6, "high_roller": 0.15, "at_risk": 0.2, "problem": 0.05}',
  machine_count     integer DEFAULT 50,
  enabled_event_types text[] DEFAULT ARRAY['BET_PLACED','BET_RESULT','SESSION_START','SESSION_END','GAME_SPIN'],
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(casino_id)
);

ALTER TABLE simulation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino admins can view own simulation config"
  ON simulation_config FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','compliance_officer')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Casino admins can upsert own simulation config"
  ON simulation_config FOR UPDATE
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','super_admin')
    )
  )
  WITH CHECK (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','super_admin')
    )
  );

CREATE POLICY "Casino admins can insert simulation config"
  ON simulation_config FOR INSERT
  TO authenticated
  WITH CHECK (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','super_admin')
    )
  );

CREATE POLICY "Service role can manage simulation config"
  ON simulation_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- LIVE KPI SNAPSHOTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_kpi_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id        uuid NOT NULL REFERENCES casinos(id) ON DELETE CASCADE,
  snapshot_at      timestamptz NOT NULL DEFAULT now(),
  active_players   integer DEFAULT 0,
  events_per_min   integer DEFAULT 0,
  total_wagered    numeric(14,2) DEFAULT 0,
  total_won        numeric(14,2) DEFAULT 0,
  ggr              numeric(14,2) DEFAULT 0,
  avg_bet_size     numeric(10,2) DEFAULT 0,
  risk_critical    integer DEFAULT 0,
  risk_high        integer DEFAULT 0,
  risk_medium      integer DEFAULT 0,
  risk_low         integer DEFAULT 0,
  active_machines  integer DEFAULT 0,
  is_simulated     boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE live_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Casino admins can view own kpi snapshots"
  ON live_kpi_snapshots FOR SELECT
  TO authenticated
  USING (
    casino_id IN (
      SELECT casino_id FROM users WHERE id = auth.uid() AND role IN ('casino_admin','compliance_officer')
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Service role can manage kpi snapshots"
  ON live_kpi_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_casino_time ON live_kpi_snapshots(casino_id, snapshot_at DESC);

-- ─────────────────────────────────────────────
-- Seed default simulation configs for all active casinos
-- ─────────────────────────────────────────────
INSERT INTO simulation_config (casino_id, is_active, mode, player_pool_size, events_per_minute, machine_count)
SELECT id, true, 'demo', 5000, 120, 80
FROM casinos
WHERE is_active = true
ON CONFLICT (casino_id) DO NOTHING;
