-- Migration: Remove CHECK constraint on security_events.event_type
--
-- Problem:
--   Migration 20260314143742 created security_events with:
--     event_type TEXT NOT NULL CHECK (event_type IN ('failed_auth', ...16 values...))
--   Migration 20260314150828 attempted to recreate the table without the CHECK,
--   but used CREATE TABLE IF NOT EXISTS, which is a no-op when the table exists.
--   The original CHECK constraint therefore remained active and silently rejects
--   every INSERT from api-ingest:
--     replay_attack, replay_attack_escalated, circuit_breaker_open,
--     api_auth_failed, api_rate_limit, suspicious_activity
--   These are caught by try/catch blocks and logged only to the Edge Function
--   console — the entire security observability layer has been non-functional.
--
-- Fix:
--   Drop the CHECK constraint dynamically (safe regardless of auto-generated name).
--   The NOT NULL constraint on event_type is preserved — free-text is allowed
--   but the column can never be empty.
--   Both existing indexes on event_type are confirmed present; a composite index
--   with created_at is added to support time-range queries by event type.
--
-- This migration is fully idempotent and non-destructive. No data is modified.

-- ─────────────────────────────────────────────────────────
-- DROP THE CHECK CONSTRAINT (dynamic — handles any auto-generated name)
-- ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find any CHECK constraint on event_type for the security_events table.
  -- pg_constraint.consrc contains the constraint expression text.
  SELECT c.conname
  INTO   v_constraint_name
  FROM   pg_constraint c
  JOIN   pg_class      t ON t.oid = c.conrelid
  JOIN   pg_namespace  n ON n.oid = t.relnamespace
  WHERE  t.relname  = 'security_events'
    AND  n.nspname  = 'public'
    AND  c.contype  = 'c'                     -- CHECK constraint
    AND  c.consrc  LIKE '%event_type%'        -- targets event_type column
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.security_events DROP CONSTRAINT %I',
      v_constraint_name
    );
    RAISE NOTICE 'Dropped CHECK constraint: %', v_constraint_name;
  ELSE
    RAISE NOTICE 'No event_type CHECK constraint found — already removed or never applied.';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

-- Simple event_type index — already created by earlier migrations under two
-- different names. Ensure both exist (IF NOT EXISTS is idempotent).
CREATE INDEX IF NOT EXISTS idx_sec_type
  ON public.security_events (event_type);

CREATE INDEX IF NOT EXISTS idx_sec_events_type
  ON public.security_events (event_type);

-- Composite index: (event_type, created_at DESC)
-- Supports the pattern used by dashboards and the replay abuse counter:
--   WHERE event_type = $1 AND created_at > NOW() - INTERVAL '...'
-- This is more selective than scanning by event_type alone.
CREATE INDEX IF NOT EXISTS idx_sec_events_type_time
  ON public.security_events (event_type, created_at DESC);

-- ─────────────────────────────────────────────────────────
-- DOCUMENT THE OPEN EVENT_TYPE CONTRACT
-- ─────────────────────────────────────────────────────────

COMMENT ON COLUMN public.security_events.event_type IS
  'Free-text security event classifier. NOT NULL but unconstrained — '
  'new event types can be introduced without a schema migration. '
  'Known values: failed_auth, unauthorized_access, api_abuse, '
  'rate_limit_exceeded, suspicious_query, token_expired, role_escalation, '
  'data_export, pii_access, self_exclusion_bypass, mass_data_access, '
  'config_change, admin_action, anomalous_activity, brute_force, session_hijack, '
  'replay_attack, replay_attack_escalated, circuit_breaker_open, '
  'api_auth_failed, api_rate_limit, suspicious_activity, '
  'permission_denied, self_exclusion.';
