-- SafeBet IQ — Risk schema
-- Stores computed risk scores and active interventions.

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE IF NOT EXISTS risk_scores (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id         UUID          NOT NULL,
  player_id         UUID          NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  score             NUMERIC(5,2)  NOT NULL CHECK (score BETWEEN 0 AND 100),
  level             risk_level    NOT NULL,
  computed_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  valid_until       TIMESTAMPTZ   NOT NULL DEFAULT NOW() + INTERVAL '1 hour',

  -- Score component breakdown (0-100 each, stored for auditability)
  component_velocity      NUMERIC(5,2) NOT NULL DEFAULT 0,
  component_loss_chasing  NUMERIC(5,2) NOT NULL DEFAULT 0,
  component_session_freq  NUMERIC(5,2) NOT NULL DEFAULT 0,
  component_deposit_spike NUMERIC(5,2) NOT NULL DEFAULT 0,
  component_late_night    NUMERIC(5,2) NOT NULL DEFAULT 0,

  trigger_session_id UUID REFERENCES sessions (id) ON DELETE SET NULL,
  notes              TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_player       ON risk_scores (casino_id, player_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level        ON risk_scores (casino_id, level, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_valid        ON risk_scores (casino_id, player_id, valid_until)
  WHERE valid_until > NOW();

-- Latest valid score per player (used by analytics and intervention)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_risk_current AS
  SELECT DISTINCT ON (casino_id, player_id)
    casino_id, player_id, score, level, computed_at, valid_until,
    component_velocity, component_loss_chasing, component_session_freq,
    component_deposit_spike, component_late_night
  FROM  risk_scores
  WHERE valid_until > NOW()
  ORDER BY casino_id, player_id, computed_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_risk_current_player
  ON mv_player_risk_current (casino_id, player_id);

-- Interventions triggered by risk scores
CREATE TYPE intervention_type AS ENUM (
  'reality_check',
  'deposit_limit_prompt',
  'cooldown_period',
  'self_exclusion_prompt',
  'account_review',
  'manual_review'
);

CREATE TYPE intervention_status AS ENUM ('pending', 'delivered', 'acknowledged', 'dismissed', 'escalated');

CREATE TABLE IF NOT EXISTS interventions (
  id                UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id         UUID                NOT NULL,
  player_id         UUID                NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  risk_score_id     UUID                REFERENCES risk_scores (id) ON DELETE SET NULL,
  type              intervention_type   NOT NULL,
  status            intervention_status NOT NULL DEFAULT 'pending',
  triggered_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  delivered_at      TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  triggered_by      TEXT                NOT NULL DEFAULT 'system',
  message           TEXT,
  metadata          JSONB               NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_casino_player  ON interventions (casino_id, player_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_status         ON interventions (casino_id, status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_interventions_pending        ON interventions (casino_id, player_id)
  WHERE status = 'pending';

DROP TRIGGER IF EXISTS trg_interventions_updated_at ON interventions;
CREATE TRIGGER trg_interventions_updated_at
  BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Compliance audit log — immutable, append-only
CREATE TABLE IF NOT EXISTS compliance_events (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id   UUID        NOT NULL,
  player_id   UUID        REFERENCES players (id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  actor       TEXT        NOT NULL,   -- 'system', 'staff:{id}', 'player'
  payload     JSONB       NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_casino_player ON compliance_events (casino_id, player_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_event_type    ON compliance_events (casino_id, event_type, occurred_at DESC);

ALTER TABLE risk_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events  ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE risk_scores   IS 'Computed risk scores per player. Expire after valid_until.';
COMMENT ON TABLE interventions IS 'Responsible gambling interventions triggered by risk scores.';
COMMENT ON TABLE compliance_events IS 'Immutable audit log for regulatory compliance. Never delete rows.';
