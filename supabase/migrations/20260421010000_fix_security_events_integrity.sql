-- ══════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX 2: security_events audit log integrity
--
-- Problems identified in regulator audit:
--   (a) No append-only enforcement — rows could be updated or deleted
--   (b) FORCE ROW LEVEL SECURITY not set — table owner (postgres) bypassed RLS
--   (c) No explicit INSERT policy for service_role — required after FORCE RLS
--       (api-ingest uses service_role client to write security events)
--
-- This migration:
--   1. Sets FORCE ROW LEVEL SECURITY
--   2. Adds service_role INSERT policy (so api-ingest can still write)
--   3. Installs an immutable trigger that raises an exception on any UPDATE
--      or DELETE — no exceptions, no resolution workflow bypass
-- ══════════════════════════════════════════════════════════════════════════════


-- ── 1. Force RLS on table owner ───────────────────────────────────────────────
-- Prevents the postgres role (used by migrations, pg_cron, Supabase internals)
-- from bypassing row-level policies. Only true superusers are exempt.
ALTER TABLE public.security_events FORCE ROW LEVEL SECURITY;


-- ── 2. Explicit INSERT policy for service_role ────────────────────────────────
-- Required after FORCE RLS. api-ingest and other Edge Functions use the
-- service_role Supabase client to write security events. Without this policy
-- those inserts would be rejected by the now-enforced RLS.
-- No WITH CHECK predicate — service_role is authoritative for inserts.
DROP POLICY IF EXISTS "security_events_insert_service" ON public.security_events;
CREATE POLICY "security_events_insert_service" ON public.security_events
  FOR INSERT TO service_role
  WITH CHECK (true);


-- ── 3. Append-only enforcement trigger ───────────────────────────────────────
-- Unconditionally raises an exception on any UPDATE or DELETE attempt.
-- Fires BEFORE the operation — no row is ever modified.
-- SECURITY DEFINER + search_path guard prevents privilege escalation.
-- This trigger cannot be bypassed by any application role including service_role.
CREATE OR REPLACE FUNCTION public.fn_security_events_immutable()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  RAISE EXCEPTION
    'security_events rows are immutable. '
    'This table is an append-only audit log. '
    'Attempted operation: % on row id=%', TG_OP, OLD.id;
END;
$$;

-- Restrict execute: no application role should call this directly
REVOKE EXECUTE ON FUNCTION public.fn_security_events_immutable() FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_security_events_immutable ON public.security_events;
CREATE TRIGGER trg_security_events_immutable
  BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_security_events_immutable();


-- ── 4. Post-apply verification ────────────────────────────────────────────────
DO $$
DECLARE
  _has_trigger     boolean;
  _has_force_rls   boolean;
  _has_insert_pol  boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table  = 'security_events'
      AND trigger_name        = 'trg_security_events_immutable'
  ) INTO _has_trigger;

  SELECT relforcerowsecurity
  FROM pg_class
  WHERE relname = 'security_events' AND relnamespace = 'public'::regnamespace
  INTO _has_force_rls;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'security_events'
      AND policyname = 'security_events_insert_service'
      AND cmd        = 'INSERT'
  ) INTO _has_insert_pol;

  IF NOT _has_trigger THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: trg_security_events_immutable not found';
  END IF;

  IF NOT _has_force_rls THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: FORCE ROW LEVEL SECURITY not set on security_events';
  END IF;

  IF NOT _has_insert_pol THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: service_role INSERT policy not found on security_events';
  END IF;

  RAISE NOTICE 'VERIFIED: security_events — append-only trigger active, FORCE RLS set, service_role INSERT policy present.';
END;
$$;
