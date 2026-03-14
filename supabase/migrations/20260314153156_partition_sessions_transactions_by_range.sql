/*
  # Table Partitioning Strategy for Sessions and Transactions

  ## Summary
  Implements declarative range partitioning by month on the highest-volume archive tables
  (sessions_archive, transactions_archive, behaviour_events_archive) to support millions of
  records while maintaining query performance. Uses a shadow-table + partitioned approach
  compatible with existing RLS and foreign keys.

  ## New Objects

  ### Tables
  - `sessions_archive` — Partitioned by RANGE(started_at), monthly child partitions
  - `transactions_archive` — Partitioned by RANGE(processed_at), monthly child partitions
  - `behaviour_events_archive` — Partitioned by RANGE(recorded_at), monthly child partitions

  ### Functions
  - `create_monthly_partition(table_name, year, month)` — Creates a monthly child partition
  - `ensure_future_partitions(months_ahead)` — Ensures N months of future partitions exist
  - `archive_old_records(months_old)` — Moves records older than N months to archive tables
  - `get_performance_stats()` — Returns comprehensive stats for monitoring dashboard

  ### Views
  - `v_table_size_stats` — Live view of table sizes and estimated row counts
  - `v_partition_info` — Lists all partitions and their sizes

  ## Security
  - RLS enabled on all archive tables
  - Super admin read-only access via is_super_admin() helper
*/

-- ============================================================
-- PARTITIONED ARCHIVE TABLE: sessions_archive
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions_archive (
  id uuid NOT NULL,
  casino_id uuid,
  player_id uuid,
  player_token text,
  game_type text,
  device_type text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  duration_seconds int,
  total_wagered numeric(12,2),
  total_won numeric(12,2),
  net_result numeric(12,2),
  is_flagged boolean DEFAULT false,
  flag_reason text,
  ip_hash text,
  country_code text,
  created_at timestamptz DEFAULT now()
) PARTITION BY RANGE (started_at);

-- ============================================================
-- PARTITIONED ARCHIVE TABLE: transactions_archive
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions_archive (
  id uuid NOT NULL,
  casino_id uuid,
  session_id uuid,
  player_id uuid,
  player_token text,
  transaction_type text,
  amount numeric(12,2),
  balance_before numeric(12,2),
  balance_after numeric(12,2),
  currency text DEFAULT 'ZAR',
  processed_at timestamptz NOT NULL,
  risk_flag boolean DEFAULT false,
  risk_reason text,
  reference_id text,
  created_at timestamptz DEFAULT now()
) PARTITION BY RANGE (processed_at);

-- ============================================================
-- PARTITIONED ARCHIVE TABLE: behaviour_events_archive
-- ============================================================
CREATE TABLE IF NOT EXISTS behaviour_events_archive (
  id uuid NOT NULL,
  casino_id uuid,
  player_id uuid,
  player_token text,
  event_type text,
  severity text,
  event_data jsonb,
  recorded_at timestamptz NOT NULL,
  flagged_for_review boolean DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
) PARTITION BY RANGE (recorded_at);

-- ============================================================
-- FUNCTION: Create a monthly partition for an archive table
-- ============================================================
CREATE OR REPLACE FUNCTION create_monthly_partition(
  p_table_name text,
  p_year int,
  p_month int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partition_name text;
  v_start_date date;
  v_end_date date;
  v_sql text;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + interval '1 month';
  v_partition_name := p_table_name || '_' || to_char(v_start_date, 'YYYY_MM');

  v_sql := format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    v_partition_name,
    p_table_name,
    v_start_date,
    v_end_date
  );

  EXECUTE v_sql;

  CASE p_table_name
    WHEN 'sessions_archive' THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (casino_id, started_at DESC)', 
        'idx_' || v_partition_name || '_casino', v_partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (player_id, started_at DESC)', 
        'idx_' || v_partition_name || '_player', v_partition_name);
    WHEN 'transactions_archive' THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (casino_id, processed_at DESC)', 
        'idx_' || v_partition_name || '_casino', v_partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (player_id, processed_at DESC)', 
        'idx_' || v_partition_name || '_player', v_partition_name);
    WHEN 'behaviour_events_archive' THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (casino_id, recorded_at DESC)', 
        'idx_' || v_partition_name || '_casino', v_partition_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (player_id, recorded_at DESC)', 
        'idx_' || v_partition_name || '_player', v_partition_name);
    ELSE NULL;
  END CASE;

EXCEPTION WHEN duplicate_table THEN
  NULL;
END;
$$;

-- Create monthly partitions for 2024-01 through 2026-12
DO $$
DECLARE
  v_year int;
  v_month int;
BEGIN
  FOR v_year IN 2024..2026 LOOP
    FOR v_month IN 1..12 LOOP
      PERFORM create_monthly_partition('sessions_archive', v_year, v_month);
      PERFORM create_monthly_partition('transactions_archive', v_year, v_month);
      PERFORM create_monthly_partition('behaviour_events_archive', v_year, v_month);
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: Ensure future partitions exist
-- ============================================================
CREATE OR REPLACE FUNCTION ensure_future_partitions(p_months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date date := date_trunc('month', now())::date;
  v_target_date date;
  i int;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_target_date := v_current_date + (i || ' months')::interval;
    PERFORM create_monthly_partition('sessions_archive', 
      EXTRACT(year FROM v_target_date)::int,
      EXTRACT(month FROM v_target_date)::int);
    PERFORM create_monthly_partition('transactions_archive', 
      EXTRACT(year FROM v_target_date)::int,
      EXTRACT(month FROM v_target_date)::int);
    PERFORM create_monthly_partition('behaviour_events_archive', 
      EXTRACT(year FROM v_target_date)::int,
      EXTRACT(month FROM v_target_date)::int);
  END LOOP;
END;
$$;

-- ============================================================
-- FUNCTION: Archive old records (move to partitioned tables)
-- ============================================================
CREATE OR REPLACE FUNCTION archive_old_records(p_months_old int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - (p_months_old || ' months')::interval;
  v_sessions_moved bigint := 0;
  v_transactions_moved bigint := 0;
  v_events_moved bigint := 0;
BEGIN
  WITH moved AS (
    DELETE FROM sessions
    WHERE started_at < v_cutoff
    RETURNING id, casino_id, player_id, player_token, game_type, device_type,
              started_at, ended_at, duration_seconds, total_wagered, total_won,
              net_result, is_flagged, flag_reason, ip_hash, country_code, created_at
  )
  INSERT INTO sessions_archive
  SELECT * FROM moved;
  GET DIAGNOSTICS v_sessions_moved = ROW_COUNT;

  WITH moved AS (
    DELETE FROM transactions
    WHERE processed_at < v_cutoff
    RETURNING id, casino_id, session_id, player_id, player_token,
              transaction_type, amount, balance_before, balance_after,
              currency, processed_at, risk_flag, risk_reason, reference_id, created_at
  )
  INSERT INTO transactions_archive
  SELECT * FROM moved;
  GET DIAGNOSTICS v_transactions_moved = ROW_COUNT;

  WITH moved AS (
    DELETE FROM behaviour_events
    WHERE recorded_at < v_cutoff
    RETURNING id, casino_id, player_id, player_token, event_type, severity,
              event_data, recorded_at, flagged_for_review, reviewed_by,
              reviewed_at, created_at
  )
  INSERT INTO behaviour_events_archive
  SELECT * FROM moved;
  GET DIAGNOSTICS v_events_moved = ROW_COUNT;

  RETURN jsonb_build_object(
    'cutoff_date', v_cutoff,
    'sessions_archived', v_sessions_moved,
    'transactions_archived', v_transactions_moved,
    'behaviour_events_archived', v_events_moved,
    'archived_at', now()
  );
END;
$$;

-- ============================================================
-- VIEW: Table size statistics for monitoring dashboard
-- ============================================================
CREATE OR REPLACE VIEW v_table_size_stats AS
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.' || tablename)) AS table_size,
  pg_size_pretty(pg_indexes_size('public.' || tablename)) AS indexes_size,
  pg_total_relation_size('public.' || tablename) AS total_bytes,
  (SELECT reltuples::bigint FROM pg_class WHERE relname = tablename AND relnamespace = 'public'::regnamespace) AS estimated_rows
FROM (VALUES
  ('sessions'), ('transactions'), ('behaviour_events'), ('players'),
  ('behavioral_risk_profiles'), ('interventions'), ('intervention_history'),
  ('intervention_delivery_queue'), ('security_events'), ('api_activity'),
  ('api_rate_limits'), ('sessions_archive'), ('transactions_archive'),
  ('behaviour_events_archive')
) AS t(tablename)
ORDER BY total_bytes DESC;

-- ============================================================
-- VIEW: Partition info
-- ============================================================
CREATE OR REPLACE VIEW v_partition_info AS
SELECT
  parent.relname AS parent_table,
  child.relname AS partition_name,
  pg_get_expr(child.relpartbound, child.oid) AS partition_range,
  pg_size_pretty(pg_total_relation_size(child.oid)) AS total_size,
  pg_total_relation_size(child.oid) AS total_bytes,
  (SELECT reltuples::bigint FROM pg_class WHERE oid = child.oid) AS estimated_rows
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
JOIN pg_namespace ns ON parent.relnamespace = ns.oid
WHERE ns.nspname = 'public'
  AND parent.relname IN ('sessions_archive', 'transactions_archive', 'behaviour_events_archive')
ORDER BY parent.relname, child.relname;

-- ============================================================
-- FUNCTION: Comprehensive performance stats for dashboard
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
    'partition_count', (SELECT COUNT(*) FROM v_partition_info),
    'largest_tables', (
      SELECT jsonb_agg(jsonb_build_object(
        'table', tablename,
        'total_size', total_size,
        'rows', estimated_rows
      ))
      FROM (SELECT * FROM v_table_size_stats LIMIT 10) t
    ),
    'generated_at', now()
  );
END;
$$;

-- ============================================================
-- RLS on archive tables
-- ============================================================
ALTER TABLE sessions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviour_events_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read sessions archive"
  ON sessions_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id::text = auth.uid()::text AND users.role = 'super_admin')
  );

CREATE POLICY "Super admins read transactions archive"
  ON transactions_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id::text = auth.uid()::text AND users.role = 'super_admin')
  );

CREATE POLICY "Super admins read behaviour archive"
  ON behaviour_events_archive FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id::text = auth.uid()::text AND users.role = 'super_admin')
  );
