/*
  # Materialized Views for Heavy Aggregation Queries

  ## Summary
  Creates pre-computed materialized views for the heaviest aggregation queries.
  Eliminates full table scans on ESG reporting, player risk summaries, casino dashboards,
  and compliance analytics — reducing query time from seconds to milliseconds at scale.

  ## Views
  - mv_casino_daily_stats — Daily session/revenue/risk stats per casino (90 days)
  - mv_player_risk_summary — Per-player risk snapshot with 30-day session aggregates
  - mv_casino_risk_distribution — Risk tier distribution per casino for dashboard widgets
  - mv_intervention_effectiveness — Intervention outcome rates per casino/type
  - mv_api_traffic_hourly — API traffic summary by hour (last 7 days)

  ## Refresh Functions
  - refresh_realtime_views() — Refreshes high-frequency views (risk distribution, API traffic)
  - refresh_all_materialized_views() — Full refresh of all views (daily maintenance)
  - get_performance_stats() — Returns DB stats for monitoring dashboard
*/

-- ============================================================
-- MV: Casino daily stats (last 90 days)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_casino_daily_stats AS
SELECT
  s.casino_id,
  c.name AS casino_name,
  date_trunc('day', s.started_at)::date AS stat_date,
  COUNT(DISTINCT s.id) AS total_sessions,
  COUNT(DISTINCT s.player_id) AS unique_players,
  COALESCE(SUM(s.total_wagered), 0) AS total_wagered,
  COALESCE(SUM(s.total_won), 0) AS total_won,
  COALESCE(SUM(s.total_wagered - s.total_won), 0) AS gross_gaming_revenue,
  COUNT(DISTINCT CASE WHEN s.is_flagged = true THEN s.id END) AS flagged_sessions,
  AVG(s.duration_seconds) AS avg_session_duration_secs,
  COUNT(DISTINCT CASE WHEN s.game_type = 'slots' THEN s.id END) AS slots_sessions,
  COUNT(DISTINCT CASE WHEN s.game_type = 'table' THEN s.id END) AS table_sessions,
  COUNT(DISTINCT CASE WHEN s.device_type = 'mobile' THEN s.id END) AS mobile_sessions
FROM sessions s
LEFT JOIN casinos c ON c.id = s.casino_id
WHERE s.started_at >= now() - interval '90 days'
GROUP BY s.casino_id, c.name, date_trunc('day', s.started_at)::date
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_casino_daily_stats_pk
  ON mv_casino_daily_stats (casino_id, stat_date);

CREATE INDEX IF NOT EXISTS idx_mv_casino_daily_stats_date
  ON mv_casino_daily_stats (stat_date DESC);

-- ============================================================
-- MV: Player risk summary
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_risk_summary AS
SELECT
  p.id AS player_id,
  p.casino_id,
  p.risk_level,
  p.total_wagered,
  p.is_active,
  p.last_active,
  COALESCE(p.risk_score, 0) AS risk_score,
  COUNT(DISTINCT s.id) AS total_sessions_30d,
  COALESCE(SUM(s.total_wagered), 0) AS wagered_30d,
  COALESCE(SUM(s.total_wagered - s.total_won), 0) AS net_loss_30d,
  COUNT(DISTINCT ih.id) AS interventions_received,
  MAX(ih.triggered_at) AS last_intervention_at
FROM players p
LEFT JOIN sessions s ON s.player_id = p.id
  AND s.started_at >= now() - interval '30 days'
LEFT JOIN intervention_history ih ON ih.player_id = p.id
GROUP BY p.id, p.casino_id, p.risk_level, p.total_wagered,
         p.is_active, p.last_active, p.risk_score
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_player_risk_summary_pk
  ON mv_player_risk_summary (player_id);

CREATE INDEX IF NOT EXISTS idx_mv_player_risk_summary_casino_risk
  ON mv_player_risk_summary (casino_id, risk_score DESC);

CREATE INDEX IF NOT EXISTS idx_mv_player_risk_summary_casino_level
  ON mv_player_risk_summary (casino_id, risk_level);

-- ============================================================
-- MV: Casino risk distribution
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_casino_risk_distribution AS
SELECT
  p.casino_id,
  c.name AS casino_name,
  COUNT(*) FILTER (WHERE p.risk_level = 'critical') AS critical_count,
  COUNT(*) FILTER (WHERE p.risk_level = 'high') AS high_count,
  COUNT(*) FILTER (WHERE p.risk_level = 'medium') AS medium_count,
  COUNT(*) FILTER (WHERE p.risk_level = 'low') AS low_count,
  COUNT(*) FILTER (WHERE p.is_active = true) AS active_players,
  COUNT(*) AS total_players,
  ROUND(
    COUNT(*) FILTER (WHERE p.risk_level IN ('critical', 'high'))::numeric
    / NULLIF(COUNT(*), 0) * 100, 2
  ) AS high_risk_percentage
FROM players p
LEFT JOIN casinos c ON c.id = p.casino_id
GROUP BY p.casino_id, c.name
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_casino_risk_dist_pk
  ON mv_casino_risk_distribution (casino_id);

-- ============================================================
-- MV: Intervention effectiveness
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_intervention_effectiveness AS
SELECT
  ih.casino_id,
  ih.intervention_type,
  COUNT(*) AS total_interventions,
  COUNT(*) FILTER (WHERE ih.intervention_successful = true) AS successful_count,
  COUNT(*) FILTER (WHERE ih.intervention_successful = false) AS unsuccessful_count,
  ROUND(
    COUNT(*) FILTER (WHERE ih.intervention_successful = true)::numeric
    / NULLIF(COUNT(*), 0) * 100, 2
  ) AS success_rate,
  MIN(ih.triggered_at) AS first_intervention,
  MAX(ih.triggered_at) AS last_intervention
FROM intervention_history ih
GROUP BY ih.casino_id, ih.intervention_type
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_intervention_eff_pk
  ON mv_intervention_effectiveness (casino_id, intervention_type);

-- ============================================================
-- MV: API traffic hourly (last 7 days)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_api_traffic_hourly AS
SELECT
  date_trunc('hour', aa.created_at) AS hour_bucket,
  aa.endpoint,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE aa.status_code >= 400) AS error_requests,
  COUNT(*) FILTER (WHERE aa.is_rate_limited = true) AS rate_limited_requests,
  COUNT(DISTINCT aa.casino_id) AS unique_casinos,
  AVG(aa.response_ms) AS avg_response_ms,
  MAX(aa.response_ms) AS max_response_ms,
  ROUND(
    COUNT(*) FILTER (WHERE aa.status_code >= 400)::numeric
    / NULLIF(COUNT(*), 0) * 100, 2
  ) AS error_rate
FROM api_activity aa
WHERE aa.created_at >= now() - interval '7 days'
GROUP BY date_trunc('hour', aa.created_at), aa.endpoint
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_api_traffic_pk
  ON mv_api_traffic_hourly (hour_bucket, endpoint);

CREATE INDEX IF NOT EXISTS idx_mv_api_traffic_hour
  ON mv_api_traffic_hourly (hour_bucket DESC);

-- ============================================================
-- REFRESH FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_realtime_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_casino_risk_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_traffic_hourly;

  RETURN jsonb_build_object(
    'refreshed', ARRAY['mv_casino_risk_distribution', 'mv_api_traffic_hourly'],
    'duration_ms', ROUND(EXTRACT(EPOCH FROM (now() - v_start)) * 1000),
    'refreshed_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_casino_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_player_risk_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_casino_risk_distribution;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_intervention_effectiveness;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_api_traffic_hourly;

  RETURN jsonb_build_object(
    'refreshed', ARRAY[
      'mv_casino_daily_stats',
      'mv_player_risk_summary',
      'mv_casino_risk_distribution',
      'mv_intervention_effectiveness',
      'mv_api_traffic_hourly'
    ],
    'duration_ms', ROUND(EXTRACT(EPOCH FROM (now() - v_start)) * 1000),
    'refreshed_at', now()
  );
END;
$$;

-- ============================================================
-- FUNCTION: Performance stats for monitoring dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_performance_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'index_count', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'),
    'partition_count', (
      SELECT COUNT(*) FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_namespace ns ON parent.relnamespace = ns.oid
      WHERE ns.nspname = 'public'
        AND parent.relname IN ('sessions_archive', 'transactions_archive', 'behaviour_events_archive')
    ),
    'materialized_view_count', (
      SELECT COUNT(*) FROM pg_matviews WHERE schemaname = 'public'
    ),
    'table_sizes', (
      SELECT jsonb_agg(jsonb_build_object(
        'table', tablename,
        'total_size', pg_size_pretty(pg_total_relation_size('public.' || tablename)),
        'total_bytes', pg_total_relation_size('public.' || tablename)
      ) ORDER BY pg_total_relation_size('public.' || tablename) DESC)
      FROM (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename IN (
            'sessions', 'transactions', 'behaviour_events', 'players',
            'behavioral_risk_profiles', 'interventions', 'intervention_history',
            'security_events', 'api_activity', 'audit_logs'
          )
      ) t
    ),
    'generated_at', now()
  );
END;
$$;

-- ============================================================
-- Initial population
-- ============================================================
REFRESH MATERIALIZED VIEW mv_casino_daily_stats;
REFRESH MATERIALIZED VIEW mv_player_risk_summary;
REFRESH MATERIALIZED VIEW mv_casino_risk_distribution;
REFRESH MATERIALIZED VIEW mv_intervention_effectiveness;
REFRESH MATERIALIZED VIEW mv_api_traffic_hourly;
