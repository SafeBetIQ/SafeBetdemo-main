-- SafeBet IQ — Sessions schema
-- A session represents one continuous gambling period for a player.
-- Used by the risk engine to detect harmful patterns.

CREATE TABLE IF NOT EXISTS sessions (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id         UUID          NOT NULL,
  player_id         UUID          NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INT           GENERATED ALWAYS AS (
                      EXTRACT(EPOCH FROM (ended_at - started_at))::INT
                    ) STORED,
  ip_address        INET,
  device_type       TEXT          CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  channel           TEXT          NOT NULL DEFAULT 'web'
                      CHECK (channel IN ('web', 'app', 'api')),

  -- Financial summary for the session (updated on session close)
  total_wagered     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_won         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deposited   NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_loss          NUMERIC(14,2) GENERATED ALWAYS AS (total_wagered - total_won) STORED,

  -- Risk markers detected during this session
  chasing_loss      BOOLEAN       NOT NULL DEFAULT FALSE,
  rapid_betting     BOOLEAN       NOT NULL DEFAULT FALSE,
  late_night        BOOLEAN       NOT NULL DEFAULT FALSE,  -- session active 00:00-05:00
  session_limit_hit BOOLEAN       NOT NULL DEFAULT FALSE,

  metadata          JSONB         NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_casino_player  ON sessions (casino_id, player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_casino_started ON sessions (casino_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_player_recent  ON sessions (player_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_open           ON sessions (casino_id, player_id)
  WHERE ended_at IS NULL;

-- Bets within a session
CREATE TABLE IF NOT EXISTS bets (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id         UUID          NOT NULL,
  session_id        UUID          NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  player_id         UUID          NOT NULL REFERENCES players  (id) ON DELETE CASCADE,
  placed_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  game_id           TEXT          NOT NULL,
  game_type         TEXT          NOT NULL CHECK (game_type IN ('slots', 'table', 'live', 'sports', 'other')),
  stake             NUMERIC(14,2) NOT NULL CHECK (stake > 0),
  outcome           TEXT          CHECK (outcome IN ('win', 'loss', 'push', 'void')),
  payout            NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_code     CHAR(3)       NOT NULL DEFAULT 'ZAR',
  metadata          JSONB         NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_bets_session    ON bets (session_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_player     ON bets (casino_id, player_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_casino_day ON bets (casino_id, placed_at DESC);

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON sessions;
CREATE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets     ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  sessions            IS 'One gambling session per row. Closed by ended_at.';
COMMENT ON COLUMN sessions.casino_id  IS 'Tenant identifier — every query must include this.';
COMMENT ON TABLE  bets                IS 'Individual wagers placed within a session.';
