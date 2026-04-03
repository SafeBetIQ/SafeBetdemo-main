-- Migration: Replay abuse detection infrastructure
--
-- Adds:
--   1. Composite index on security_events for efficient 5-minute window COUNT
--      used by the abuse escalation logic in api-ingest.
--   2. Partial index on circuit_breaker_state for fast api-ingest circuit checks
--      (the only new per-request DB call added to the happy path).
--
-- No new tables — the existing security_events and circuit_breaker_state tables
-- are sufficient. Keeping the schema minimal reduces operational surface area.

-- ─────────────────────────────────────────────────────────
-- INDEX: replay_attack window count
-- ─────────────────────────────────────────────────────────
-- Supports the query:
--   SELECT COUNT(*) FROM security_events
--   WHERE casino_id = $1
--     AND event_type = 'replay_attack'
--     AND created_at > NOW() - INTERVAL '5 minutes'
--
-- Without this index Postgres would scan all security_events for the casino.
-- With it the planner does an index range scan: O(log n + k) where k = matches.

CREATE INDEX IF NOT EXISTS idx_sec_events_replay_window
  ON public.security_events (casino_id, event_type, created_at DESC)
  WHERE event_type = 'replay_attack';

-- ─────────────────────────────────────────────────────────
-- INDEX: api-ingest circuit breaker fast-path check
-- ─────────────────────────────────────────────────────────
-- The main handler checks this on every authenticated request.
-- The existing UNIQUE(casino_id, endpoint) constraint covers equality
-- lookups, but a partial index on the non-closed state lets Postgres
-- skip the scan entirely for the common case (circuit closed = no row
-- in this index).

CREATE INDEX IF NOT EXISTS idx_cb_api_ingest_open
  ON public.circuit_breaker_state (casino_id)
  WHERE endpoint = 'api-ingest' AND state = 'open';

-- ─────────────────────────────────────────────────────────
-- COMMENT: document the replay_attack event_type contract
-- ─────────────────────────────────────────────────────────
COMMENT ON TABLE public.security_events IS
  'Security event stream. replay_attack events are written by api-ingest '
  'whenever an expired X-Request-ID is resubmitted. Escalation thresholds: '
  '>10 attempts/5min → high severity; >25 attempts/5min → circuit open on api-ingest.';
