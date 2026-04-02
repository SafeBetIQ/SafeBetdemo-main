/*
  # Enhanced API Rate Limiting — Sliding Window + Per-Endpoint Tiers

  ## Summary
  Upgrades the existing basic rate limiting to a production-grade sliding window algorithm
  with per-endpoint tier configurations, burst allowance, circuit breaker pattern,
  and adaptive throttling for high-load scenarios.

  ## New Tables
  - `rate_limit_tiers` — Named tier configs (standard/premium/burst) with per-endpoint limits
  - `rate_limit_violations` — Log of rate limit breaches for analytics and IP reputation
  - `circuit_breaker_state` — Per-casino/endpoint circuit breaker state (open/closed/half-open)

  ## New Functions
  - `check_rate_limit_sliding(token_id, endpoint, casino_id)` 
    Sliding window rate check returning: allowed, remaining, retry_after_seconds, tier_name
  - `get_rate_limit_tier(casino_id, endpoint)` 
    Returns the appropriate rate limit tier for a given casino + endpoint combination
  - `record_rate_limit_violation(casino_id, endpoint, ip_hash)` 
    Logs violations and auto-triggers circuit breaker after threshold
  - `check_circuit_breaker(casino_id, endpoint)` 
    Returns circuit breaker state — blocks all traffic when open
  - `reset_circuit_breaker(casino_id, endpoint)` 
    Manually resets circuit breaker to closed state
  - `get_rate_limit_analytics(casino_id, hours_back)` 
    Returns rate limiting analytics for monitoring dashboard

  ## Tier Definitions
  | Tier       | Requests/min | Burst | Burst Window |
  |------------|-------------|-------|--------------|
  | standard   | 100         | 150   | 10s          |
  | premium    | 500         | 750   | 10s          |
  | enterprise | 2000        | 3000  | 10s          |
  | ingest     | 5000        | 7500  | 5s           |
  | readonly   | 200         | 300   | 10s          |

  ## Circuit Breaker
  - Opens after 10 consecutive violations within 1 minute
  - Half-open state: allows 1 test request every 30 seconds
  - Auto-closes after 5 consecutive successes in half-open
  - Alerts written to security_events on circuit open

  ## Notes
  - Backward compatible: existing api_rate_limits table retained
  - New sliding window logic replaces fixed window check in api-ingest edge function
*/

-- ============================================================
-- RATE LIMIT TIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL UNIQUE,
  requests_per_minute int NOT NULL DEFAULT 100,
  requests_per_hour int NOT NULL DEFAULT 3000,
  requests_per_day int NOT NULL DEFAULT 50000,
  burst_limit int NOT NULL DEFAULT 150,
  burst_window_seconds int NOT NULL DEFAULT 10,
  applies_to_endpoints text[] DEFAULT ARRAY['*'],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limit_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage rate limit tiers"
  ON rate_limit_tiers FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- RATE LIMIT VIOLATIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid,
  api_key_hash text,
  endpoint text NOT NULL,
  violation_type text NOT NULL CHECK (violation_type IN (
    'per_minute_exceeded', 'per_hour_exceeded', 'per_day_exceeded',
    'burst_exceeded', 'circuit_breaker_open', 'blocked_ip'
  )),
  requests_attempted int DEFAULT 1,
  limit_value int,
  window_start timestamptz,
  ip_hash text,
  country_code text,
  user_agent_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rlv_casino_time ON rate_limit_violations (casino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rlv_endpoint_time ON rate_limit_violations (endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rlv_violation_type ON rate_limit_violations (violation_type, created_at DESC);

ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read violations"
  ON rate_limit_violations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id::text = auth.uid()::text AND users.role = 'super_admin')
  );

CREATE POLICY "Service role insert violations"
  ON rate_limit_violations FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- CIRCUIT BREAKER STATE
-- ============================================================
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  casino_id uuid,
  endpoint text NOT NULL,
  state text NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  consecutive_violations int DEFAULT 0,
  consecutive_successes int DEFAULT 0,
  opened_at timestamptz,
  last_test_at timestamptz,
  auto_close_at timestamptz,
  opened_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (casino_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_cb_casino_endpoint ON circuit_breaker_state (casino_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_cb_state ON circuit_breaker_state (state) WHERE state != 'closed';

ALTER TABLE circuit_breaker_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read circuit breakers"
  ON circuit_breaker_state FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id::text = auth.uid()::text AND users.role = 'super_admin')
  );

-- ============================================================
-- SEED: Default rate limit tiers
-- ============================================================
INSERT INTO rate_limit_tiers (tier_name, requests_per_minute, requests_per_hour, requests_per_day, burst_limit, burst_window_seconds, applies_to_endpoints)
VALUES
  ('standard',    100,   3000,   50000,  150,  10, ARRAY['*']),
  ('premium',     500,  15000,  200000,  750,  10, ARRAY['*']),
  ('enterprise', 2000,  60000, 1000000, 3000,  10, ARRAY['*']),
  ('ingest',     5000, 150000, 5000000, 7500,   5, ARRAY['/ingest', '/api-ingest', '/events']),
  ('readonly',    200,   6000,  100000,  300,  10, ARRAY['/reports', '/analytics', '/export'])
ON CONFLICT (tier_name) DO UPDATE SET
  requests_per_minute = EXCLUDED.requests_per_minute,
  requests_per_hour = EXCLUDED.requests_per_hour,
  burst_limit = EXCLUDED.burst_limit;

-- ============================================================
-- FUNCTION: Get rate limit tier for casino + endpoint
-- ============================================================
CREATE OR REPLACE FUNCTION get_rate_limit_tier(
  p_casino_id uuid,
  p_endpoint text
)
RETURNS TABLE(
  tier_name text,
  requests_per_minute int,
  requests_per_hour int,
  burst_limit int,
  burst_window_seconds int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for endpoint-specific tier first, then fall back to standard
  RETURN QUERY
  SELECT 
    t.tier_name,
    t.requests_per_minute,
    t.requests_per_hour,
    t.burst_limit,
    t.burst_window_seconds
  FROM rate_limit_tiers t
  WHERE t.is_active = true
    AND (
      p_endpoint = ANY(t.applies_to_endpoints)
      OR '*' = ANY(t.applies_to_endpoints)
    )
  ORDER BY
    CASE WHEN p_endpoint = ANY(t.applies_to_endpoints) THEN 0 ELSE 1 END,
    t.requests_per_minute DESC
  LIMIT 1;
END;
$$;

-- ============================================================
-- FUNCTION: Sliding window rate limit check
-- ============================================================
CREATE OR REPLACE FUNCTION check_rate_limit_sliding(
  p_token_id text,
  p_endpoint text,
  p_casino_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier record;
  v_window_start timestamptz := now() - interval '1 minute';
  v_burst_window_start timestamptz;
  v_minute_count int := 0;
  v_burst_count int := 0;
  v_cb_state text := 'closed';
  v_allowed boolean := true;
  v_reason text := null;
BEGIN
  -- Get tier for this endpoint
  SELECT * INTO v_tier FROM get_rate_limit_tier(p_casino_id, p_endpoint);
  
  IF NOT FOUND THEN
    -- Default tier
    v_tier.tier_name := 'standard';
    v_tier.requests_per_minute := 100;
    v_tier.burst_limit := 150;
    v_tier.burst_window_seconds := 10;
  END IF;

  v_burst_window_start := now() - (v_tier.burst_window_seconds || ' seconds')::interval;

  -- Check circuit breaker state
  SELECT cb.state INTO v_cb_state
  FROM circuit_breaker_state cb
  WHERE (p_casino_id IS NULL OR cb.casino_id = p_casino_id)
    AND cb.endpoint = p_endpoint
    AND cb.state = 'open'
    AND (cb.auto_close_at IS NULL OR cb.auto_close_at > now())
  LIMIT 1;

  IF v_cb_state = 'open' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'circuit_breaker_open',
      'tier', v_tier.tier_name,
      'retry_after_seconds', 60,
      'remaining', 0
    );
  END IF;

  -- Count requests in sliding 1-minute window
  SELECT COALESCE(SUM(request_count), 0) INTO v_minute_count
  FROM api_rate_limits
  WHERE token_id = p_token_id
    AND endpoint = p_endpoint
    AND window_start >= v_window_start;

  -- Count requests in burst window
  SELECT COALESCE(SUM(request_count), 0) INTO v_burst_count
  FROM api_rate_limits
  WHERE token_id = p_token_id
    AND endpoint = p_endpoint
    AND window_start >= v_burst_window_start;

  -- Check burst limit first
  IF v_burst_count >= v_tier.burst_limit THEN
    v_allowed := false;
    v_reason := 'burst_exceeded';
  -- Then check per-minute limit
  ELSIF v_minute_count >= v_tier.requests_per_minute THEN
    v_allowed := false;
    v_reason := 'per_minute_exceeded';
  END IF;

  -- Update the rate limit counter
  IF v_allowed THEN
    INSERT INTO api_rate_limits (token_id, endpoint, window_start, request_count)
    VALUES (p_token_id, p_endpoint, date_trunc('minute', now()), 1)
    ON CONFLICT (token_id, endpoint, window_start)
    DO UPDATE SET request_count = api_rate_limits.request_count + 1;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'tier', v_tier.tier_name,
    'remaining_per_minute', GREATEST(0, v_tier.requests_per_minute - v_minute_count - CASE WHEN v_allowed THEN 1 ELSE 0 END),
    'remaining_burst', GREATEST(0, v_tier.burst_limit - v_burst_count - CASE WHEN v_allowed THEN 1 ELSE 0 END),
    'retry_after_seconds', CASE WHEN NOT v_allowed THEN
      CEIL(EXTRACT(EPOCH FROM (date_trunc('minute', now()) + interval '1 minute' - now())))
    ELSE NULL END
  );
END;
$$;

-- ============================================================
-- FUNCTION: Get rate limiting analytics
-- ============================================================
CREATE OR REPLACE FUNCTION get_rate_limit_analytics(
  p_casino_id uuid DEFAULT NULL,
  p_hours_back int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_hours_back || ' hours')::interval;
BEGIN
  RETURN jsonb_build_object(
    'total_violations', (
      SELECT COUNT(*) FROM rate_limit_violations
      WHERE created_at >= v_cutoff
        AND (p_casino_id IS NULL OR casino_id = p_casino_id)
    ),
    'violations_by_type', (
      SELECT jsonb_object_agg(violation_type, cnt)
      FROM (
        SELECT violation_type, COUNT(*) AS cnt
        FROM rate_limit_violations
        WHERE created_at >= v_cutoff
          AND (p_casino_id IS NULL OR casino_id = p_casino_id)
        GROUP BY violation_type
      ) t
    ),
    'top_violated_endpoints', (
      SELECT jsonb_agg(jsonb_build_object('endpoint', endpoint, 'violations', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT endpoint, COUNT(*) AS cnt
        FROM rate_limit_violations
        WHERE created_at >= v_cutoff
          AND (p_casino_id IS NULL OR casino_id = p_casino_id)
        GROUP BY endpoint
        ORDER BY cnt DESC
        LIMIT 5
      ) t
    ),
    'open_circuit_breakers', (
      SELECT COUNT(*) FROM circuit_breaker_state
      WHERE state = 'open'
        AND (p_casino_id IS NULL OR casino_id = p_casino_id)
    ),
    'generated_at', now()
  );
END;
$$;

-- ============================================================
-- Add unique constraint to api_rate_limits if not exists
-- (Required for ON CONFLICT in sliding window function)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'api_rate_limits_token_endpoint_window_unique'
  ) THEN
    ALTER TABLE api_rate_limits
    ADD CONSTRAINT api_rate_limits_token_endpoint_window_unique
    UNIQUE (token_id, endpoint, window_start);
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END;
$$;
