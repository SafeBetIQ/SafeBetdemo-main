/*
  # Performance Indexes for High-Volume Tables

  ## Summary
  Adds missing composite, partial, and covering indexes to support millions of player
  records, high API ingestion traffic, and large behavioural datasets.

  ## New Indexes

  ### sessions / gaming_sessions
  - Composite: (casino_id, game_type, started_at DESC) — game type breakdowns per casino
  - Composite: (casino_id, device_type, started_at DESC) — device analytics
  - Composite: (player_id, is_flagged, started_at DESC) — flagged session lookups
  - Partial: WHERE ended_at IS NULL — active session queries

  ### transactions
  - Composite: (casino_id, transaction_type, processed_at DESC) — transaction type reports
  - Composite: (player_id, transaction_type, processed_at DESC) — per-player financials
  - Composite: (casino_id, risk_flag, processed_at DESC) — risk flagged transactions
  - Covering: (casino_id, processed_at DESC) INCLUDE (amount) — sum aggregations

  ### behaviour_events
  - Composite: (casino_id, severity, recorded_at DESC) — severity filtering per casino
  - Composite: (casino_id, event_type, recorded_at DESC) — event type analytics
  - Composite: (player_id, severity, recorded_at DESC) — per-player severity timeline
  - Partial: WHERE flagged_for_review = true — review queue

  ### players
  - Composite: (casino_id, risk_level, last_active DESC) — risk-sorted player lists
  - Composite: (casino_id, is_active, total_wagered DESC) — high-value player queries
  - Partial: WHERE is_active = true AND risk_level IN ('high','critical') — high-risk active

  ### intervention_delivery_queue
  - Composite: (status, scheduled_at ASC) — queue processing (critical for throughput)
  - Composite: (casino_id, status, scheduled_at ASC) — per-casino queue management

  ### behavioral_risk_profiles
  - Composite: (casino_id, risk_score DESC, analyzed_at DESC) — risk ranking queries
  - Composite: (player_id, analyzed_at DESC) — latest profile per player

  ### api_activity
  - Composite: (casino_id, created_at DESC) — per-casino API activity logs
  - Composite: (endpoint, created_at DESC) — endpoint traffic analysis
  - Partial: WHERE status_code >= 400 — error rate monitoring

  ### security_events
  - Composite: (casino_id, severity, created_at DESC) — severity-filtered event feed
  - Composite: (event_type, created_at DESC) — event type monitoring
  - Partial: WHERE is_resolved = false — open event queue

  ## Notes
  - All indexes use IF NOT EXISTS to prevent errors on re-run
  - CONCURRENTLY not used here (applied via migration runner which uses transactions)
  - Covering indexes (INCLUDE) reduce heap fetches for common aggregation queries
*/

-- ============================================================
-- SESSIONS TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_casino_game_type_time
  ON sessions (casino_id, game_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_casino_device_time
  ON sessions (casino_id, device_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_player_flagged_time
  ON sessions (player_id, is_flagged, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_active_only
  ON sessions (casino_id, started_at DESC)
  WHERE ended_at IS NULL;

-- ============================================================
-- TRANSACTIONS TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transactions_casino_type_time
  ON transactions (casino_id, transaction_type, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_player_type_time
  ON transactions (player_id, transaction_type, processed_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_casino_risk_time
  ON transactions (casino_id, risk_flag, processed_at DESC)
  WHERE risk_flag = true;

CREATE INDEX IF NOT EXISTS idx_transactions_casino_time_amount
  ON transactions (casino_id, processed_at DESC)
  INCLUDE (amount);

-- ============================================================
-- BEHAVIOUR_EVENTS TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_behaviour_events_casino_severity_time
  ON behaviour_events (casino_id, severity, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_casino_type_time
  ON behaviour_events (casino_id, event_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_player_severity_time
  ON behaviour_events (player_id, severity, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_behaviour_events_review_queue
  ON behaviour_events (casino_id, recorded_at DESC)
  WHERE flagged_for_review = true;

-- ============================================================
-- PLAYERS TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_players_casino_risk_active
  ON players (casino_id, risk_level, last_active DESC);

CREATE INDEX IF NOT EXISTS idx_players_casino_active_wagered
  ON players (casino_id, is_active, total_wagered DESC);

CREATE INDEX IF NOT EXISTS idx_players_high_risk_active
  ON players (casino_id, last_active DESC)
  WHERE is_active = true AND risk_level IN ('high', 'critical');

-- ============================================================
-- INTERVENTION_DELIVERY_QUEUE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_intervention_queue_status_scheduled
  ON intervention_delivery_queue (status, scheduled_at ASC);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_casino_status_scheduled
  ON intervention_delivery_queue (casino_id, status, scheduled_at ASC);

-- ============================================================
-- BEHAVIORAL_RISK_PROFILES INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_brp_casino_score_time
  ON behavioral_risk_profiles (casino_id, risk_score DESC, analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_brp_player_time
  ON behavioral_risk_profiles (player_id, analyzed_at DESC);

-- ============================================================
-- API_ACTIVITY TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_api_activity_casino_time
  ON api_activity (casino_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_activity_endpoint_time
  ON api_activity (endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_activity_errors
  ON api_activity (casino_id, created_at DESC)
  WHERE status_code >= 400;

-- ============================================================
-- SECURITY_EVENTS TABLE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_security_events_casino_severity_time
  ON security_events (casino_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time
  ON security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_open
  ON security_events (casino_id, created_at DESC)
  WHERE is_resolved = false;

-- ============================================================
-- API_RATE_LIMITS COVERING INDEX
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON api_rate_limits (token_id, endpoint, window_start DESC)
  INCLUDE (request_count);
