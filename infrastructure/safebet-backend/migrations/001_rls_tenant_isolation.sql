-- ============================================================================
-- SafeBet IQ — Row-Level Security: Tenant Isolation
-- ============================================================================
-- Applies to the backend RDS PostgreSQL database (NOT the Supabase project).
-- Run once against the primary RDS instance after initial schema creation.
-- Idempotent — safe to re-run (all DDL uses CREATE OR REPLACE / DROP IF EXISTS).
--
-- Design:
--   • get_tenant_id() centralises tenant resolution.  It raises a hard error
--     if app.casino_id has not been set, so the system is fail-closed.
--   • app.casino_id is set per-connection by the Lambda before any query
--     (shared/db.ts: queryWithTenant / withTenantTransaction).
--   • FORCE ROW LEVEL SECURITY ensures the policy applies to the table owner,
--     not just non-privileged roles.
--   • The application role (safebet_app) must NOT be a superuser — superusers
--     bypass RLS unconditionally.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Application role — idempotent, must NOT be superuser
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'safebet_app') THEN
    CREATE ROLE safebet_app LOGIN;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE safebet TO safebet_app;
GRANT USAGE   ON SCHEMA public    TO safebet_app;

-- ---------------------------------------------------------------------------
-- 1. Centralised tenant resolver
--    All RLS policies call this function — one place to audit, one place
--    to change.  STABLE tells the planner it can cache the result within
--    a single query.  SECURITY INVOKER (default) so it runs as the caller,
--    not a privileged role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN current_setting('app.casino_id');
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Tenant context not set. Call set_config(''app.casino_id'', ...) before querying.';
END;
$$;

GRANT EXECUTE ON FUNCTION get_tenant_id() TO safebet_app;

-- ---------------------------------------------------------------------------
-- 2. players
-- ---------------------------------------------------------------------------
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE players FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON players;
CREATE POLICY "tenant_isolation" ON players
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT, UPDATE ON players TO safebet_app;

-- ---------------------------------------------------------------------------
-- 3. sessions
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON sessions;
CREATE POLICY "tenant_isolation" ON sessions
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT, UPDATE ON sessions TO safebet_app;

-- ---------------------------------------------------------------------------
-- 4. bets
-- ---------------------------------------------------------------------------
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON bets;
CREATE POLICY "tenant_isolation" ON bets
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT ON bets TO safebet_app;

-- ---------------------------------------------------------------------------
-- 5. risk_scores
-- ---------------------------------------------------------------------------
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON risk_scores;
CREATE POLICY "tenant_isolation" ON risk_scores
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT ON risk_scores TO safebet_app;

-- ---------------------------------------------------------------------------
-- 6. interventions
-- ---------------------------------------------------------------------------
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON interventions;
CREATE POLICY "tenant_isolation" ON interventions
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT, UPDATE ON interventions TO safebet_app;

-- ---------------------------------------------------------------------------
-- 7. compliance_events
-- ---------------------------------------------------------------------------
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON compliance_events;
CREATE POLICY "tenant_isolation" ON compliance_events
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT ON compliance_events TO safebet_app;

-- ---------------------------------------------------------------------------
-- 8. Materialized view: mv_player_risk_current
--    Materialized views do not support RLS.  Access is restricted by:
--      a) Revoking PUBLIC access.
--      b) Granting SELECT only to safebet_app.
--      c) The underlying tables (risk_scores, players) ARE RLS-protected,
--         so a refresh cannot mix tenant data.
--    REFRESH must be run by a superuser role (not safebet_app) on a schedule.
-- ---------------------------------------------------------------------------
REVOKE ALL    ON mv_player_risk_current FROM PUBLIC;
GRANT  SELECT ON mv_player_risk_current TO safebet_app;

-- ---------------------------------------------------------------------------
-- 9. Validation (run manually after applying migration)
-- ---------------------------------------------------------------------------
-- 9a. No tenant set → must raise error
--
--   RESET app.casino_id;
--   SELECT * FROM players;
--   -- Expected: ERROR:  Tenant context not set.
--
-- 9b. Correct tenant → scoped rows only
--
--   SELECT set_config('app.casino_id', 'casino_001', false);
--   SELECT COUNT(*) FROM players;   -- only casino_001 rows
--
--   SELECT set_config('app.casino_id', 'casino_002', false);
--   SELECT COUNT(*) FROM players;   -- only casino_002 rows, zero overlap
--
-- 9c. Cross-tenant insert → blocked by WITH CHECK
--
--   SELECT set_config('app.casino_id', 'casino_001', false);
--   INSERT INTO players (casino_id, cognito_sub, email)
--   VALUES ('casino_002', 'sub-x', 'x@x.com');
--   -- Expected: ERROR:  new row violates row-level security policy for table "players"
--
-- 9d. Confirm get_tenant_id() raises, not returns NULL
--
--   RESET app.casino_id;
--   SELECT get_tenant_id();
--   -- Expected: ERROR:  Tenant context not set.
-- ---------------------------------------------------------------------------
