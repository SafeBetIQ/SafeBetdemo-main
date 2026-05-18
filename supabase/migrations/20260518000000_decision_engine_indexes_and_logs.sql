-- Decision Engine: indexes + decision_logs table
-- Adds missing indexes for core Decision Engine query paths
-- and creates the decision_logs table for audit logging.

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_players_casino_id
  ON players(casino_id);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_player_id
  ON behaviour_events(player_id);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_casino_id
  ON behaviour_events(casino_id);

CREATE INDEX IF NOT EXISTS idx_self_exclusions_player_id
  ON self_exclusions(player_id);

-- Composite: covers the active-exclusion query (player_id + status + ends_at)
CREATE INDEX IF NOT EXISTS idx_self_exclusions_player_id_status
  ON self_exclusions(player_id, status)
  WHERE status = 'active';

-- decision_logs lookups
CREATE INDEX IF NOT EXISTS idx_decision_logs_player_id
  ON decision_logs(player_id);

CREATE INDEX IF NOT EXISTS idx_decision_logs_casino_id
  ON decision_logs(casino_id);

-- ── decision_logs table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     TEXT        NOT NULL,
  casino_id     TEXT,
  decision      TEXT        NOT NULL,
  reason        TEXT        NOT NULL,
  risk_score    NUMERIC,
  underage_risk NUMERIC,
  excluded      BOOLEAN,
  request_ip    TEXT,
  endpoint      TEXT,
  user_id       UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
