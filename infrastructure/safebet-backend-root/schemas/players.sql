-- SafeBet IQ — Players schema
-- Multi-tenant: every row is scoped by casino_id.
-- All queries MUST include a casino_id predicate.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS players (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  casino_id           UUID          NOT NULL,
  cognito_sub         TEXT          NOT NULL,       -- Cognito user pool sub (auth identity)
  email               TEXT          NOT NULL,
  full_name           TEXT          NOT NULL,
  date_of_birth       DATE          NOT NULL,
  country_code        CHAR(2)       NOT NULL,       -- ISO 3166-1 alpha-2
  currency_code       CHAR(3)       NOT NULL DEFAULT 'ZAR',  -- ISO 4217
  status              TEXT          NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'self_excluded', 'closed')),
  kyc_status          TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  deposit_limit_daily   NUMERIC(14,2),
  deposit_limit_weekly  NUMERIC(14,2),
  deposit_limit_monthly NUMERIC(14,2),
  reality_check_interval_minutes INT,               -- 0 = disabled
  self_exclusion_until  TIMESTAMPTZ,
  tags                TEXT[]        NOT NULL DEFAULT '{}',
  metadata            JSONB         NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_players_casino_cognito UNIQUE (casino_id, cognito_sub),
  CONSTRAINT uq_players_casino_email   UNIQUE (casino_id, email)
);

CREATE INDEX IF NOT EXISTS idx_players_casino_id      ON players (casino_id);
CREATE INDEX IF NOT EXISTS idx_players_casino_status  ON players (casino_id, status);
CREATE INDEX IF NOT EXISTS idx_players_casino_kyc     ON players (casino_id, kyc_status);
CREATE INDEX IF NOT EXISTS idx_players_cognito_sub    ON players (cognito_sub);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_updated_at ON players;
CREATE TRIGGER trg_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-level security (enable once Cognito sub is available in session vars)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  players              IS 'Multi-tenant player registry. Scoped to casino_id.';
COMMENT ON COLUMN players.casino_id    IS 'Tenant identifier — every query must include this.';
COMMENT ON COLUMN players.cognito_sub  IS 'Cognito User Pool sub — immutable auth identity.';
