-- API Productisation: api_keys + api_usage_logs tables

-- ── api_keys ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT        NOT NULL UNIQUE,
  name          TEXT        NOT NULL,
  casino_id     UUID        REFERENCES casinos(id) ON DELETE CASCADE,
  owner_email   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key       ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_casino_id ON api_keys(casino_id);

-- RLS: only service role can read/write api_keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_service_only ON api_keys
  USING (false);

-- ── api_usage_logs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID        REFERENCES api_keys(id) ON DELETE SET NULL,
  api_key     TEXT,
  endpoint    TEXT        NOT NULL,
  user_id     UUID,
  request_ip  TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint   ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at DESC);

-- RLS: service role only
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_usage_logs_service_only ON api_usage_logs
  USING (false);
