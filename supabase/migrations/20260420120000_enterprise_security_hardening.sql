-- ══════════════════════════════════════════════════════════════════════════════
-- Enterprise Security Hardening — Financial-Grade
-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 1: No secret exposure — vault only accessible through SECURITY DEFINER
-- FIX 2: Vault access control — REVOKE direct access from all non-postgres roles
-- FIX 3: Dual-secret rotation system
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Vault access control
-- Prevent any role from SELECT-ing vault.decrypted_secrets directly.
-- All secret access must flow through explicit SECURITY DEFINER functions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Revoke direct access to vault views from all application roles
REVOKE ALL ON ALL TABLES IN SCHEMA vault FROM authenticated, anon;
REVOKE USAGE ON SCHEMA vault FROM authenticated, anon;

-- Note: 'postgres' and 'service_role' retain access (required by Supabase internals).
-- If additional DB users exist, add explicit REVOKE statements for them here.


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Vault wrapper functions
-- Centralise all vault access. These are the ONLY code paths that touch secrets.
-- REVOKE EXECUTE from PUBLIC — only internal SECURITY DEFINER callers can invoke.
-- ─────────────────────────────────────────────────────────────────────────────

-- Active HMAC secret (used by call_risk_engine for signing)
CREATE OR REPLACE FUNCTION public.fn_get_active_hmac_secret()
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'risk_engine_hmac_secret'
  LIMIT 1;
  -- Returns NULL if secret is missing — callers must handle this case
  RETURN _secret;
END;
$$;

-- Previous HMAC secret (valid during rotation window — verified by Edge Function)
CREATE OR REPLACE FUNCTION public.fn_get_prev_hmac_secret()
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'risk_engine_hmac_secret_prev'
  LIMIT 1;
  RETURN _secret;
END;
$$;

-- Audit function: check secret EXISTENCE without exposing value
-- Safe to call from admin dashboards — returns boolean only
CREATE OR REPLACE FUNCTION public.fn_vault_secret_exists(p_name text)
  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE
  SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = p_name
  );
END;
$$;

-- Restrict: only postgres-owned SECURITY DEFINER functions can call these
REVOKE EXECUTE ON FUNCTION public.fn_get_active_hmac_secret() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.fn_get_prev_hmac_secret()   FROM PUBLIC, authenticated, anon;
-- fn_vault_secret_exists is audit-safe (boolean only) — allow authenticated admins
REVOKE EXECUTE ON FUNCTION public.fn_vault_secret_exists(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_vault_secret_exists(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Update call_risk_engine to use wrapper (no direct vault access)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.call_risk_engine()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _url       CONSTANT text := 'https://uexdjngogzunjxkpxwll.supabase.co/functions/v1/risk-engine';
  _hmac_key  text;
  _payload   jsonb;
  _payload_t text;
  _ts        text;
  _sig       text;
BEGIN
  -- Access vault through the SECURITY DEFINER wrapper — never directly
  _hmac_key := public.fn_get_active_hmac_secret();

  IF _hmac_key IS NULL THEN
    RAISE WARNING '[risk-engine] active HMAC secret unavailable — skipping';
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'player_id',        NEW.player_id,
    'casino_id',        NEW.casino_id::text,
    'event_id',         NEW.id::text,
    'bet_amount',       NEW.bet_amount,
    'win_amount',       NEW.win_amount,
    'duration_seconds', NEW.duration_seconds,
    'event_type',       NEW.event_type,
    'session_id',       NEW.session_id,
    'game_type',        NEW.game_type,
    'created_at',       NEW.created_at
  );
  _payload_t := _payload::text;
  _ts        := extract(epoch FROM clock_timestamp())::bigint::text;

  -- HMAC-SHA256: message = "<unix_ts>.<payload_json>"
  _sig := encode(hmac((_ts || '.' || _payload_t)::bytea, _hmac_key::bytea, 'sha256'), 'hex');

  -- Async POST — no API key, no anon key, signature only
  PERFORM net.http_post(
    url     := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Timestamp',  _ts,
      'X-Signature',  _sig
    ),
    body := _payload
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[risk-engine] trigger error suppressed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Secret rotation system — dual-key model
-- ─────────────────────────────────────────────────────────────────────────────

-- Initialise the previous-secret slot if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'risk_engine_hmac_secret_prev') THEN
    -- Seed with same value as active — harmless placeholder until first rotation
    PERFORM vault.create_secret(
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'risk_engine_hmac_secret' LIMIT 1),
      'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — valid during rotation window only'
    );
  END IF;
END;
$$;


-- rotate_risk_engine_secret()
-- ─────────────────────────────────────────────────────────────────────────────
-- Safe rotation procedure:
--   1. Copies current active → previous (stays valid during rotation window)
--   2. Generates new 256-bit active secret
--   3. Returns new secret AS PLAINTEXT — copy immediately to Edge Function secrets
--   4. Update RISK_ENGINE_HMAC_SECRET in Edge Function; set RISK_ENGINE_HMAC_SECRET_PREV
--      to the value returned by fn_get_prev_hmac_secret() (use audit path)
--
-- IMPORTANT: the returned value is the ONLY time the new secret is visible in
-- plaintext. Treat the output of this function like a private key.
--
-- Rotation window: the previous secret remains valid until you remove
-- RISK_ENGINE_HMAC_SECRET_PREV from Edge Function secrets (recommended: 15 min).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rotate_risk_engine_secret()
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _active_id   uuid;
  _active_val  text;
  _prev_id     uuid;
  _new_secret  text;
BEGIN
  -- Step 1: Read current active
  SELECT s.id, d.decrypted_secret
    INTO _active_id, _active_val
  FROM vault.secrets s
  JOIN vault.decrypted_secrets d ON d.name = s.name
  WHERE s.name = 'risk_engine_hmac_secret'
  LIMIT 1;

  IF _active_val IS NULL THEN
    RAISE EXCEPTION 'Active HMAC secret not found in vault. Run initial setup first.';
  END IF;

  -- Step 2: Archive active → previous (overwrite)
  SELECT id INTO _prev_id FROM vault.secrets WHERE name = 'risk_engine_hmac_secret_prev' LIMIT 1;

  IF _prev_id IS NULL THEN
    PERFORM vault.create_secret(
      _active_val,
      'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — valid during rotation window'
    );
  ELSE
    PERFORM vault.update_secret(
      _prev_id,
      _active_val,
      'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — valid during rotation window'
    );
  END IF;

  -- Step 3: Generate and store new active secret
  _new_secret := encode(gen_random_bytes(32), 'hex');
  PERFORM vault.update_secret(
    _active_id,
    _new_secret,
    'risk_engine_hmac_secret',
    'HMAC-SHA256 signing secret — active (rotated ' || now()::date::text || ')'
  );

  -- Step 4: Emit audit notice (no secret in notice — stored securely above)
  RAISE NOTICE '[security] HMAC secret rotated at %. Update Edge Function secrets within 15 minutes.', now();

  -- Return new secret ONCE — copy immediately to Edge Function secrets
  -- Do NOT log, store, or transmit this value beyond the rotation procedure
  RETURN _new_secret;
END;
$$;

-- Rotation is a privileged operation — restrict to postgres role (migration runner)
REVOKE EXECUTE ON FUNCTION public.rotate_risk_engine_secret() FROM PUBLIC, authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log table for security events (secret rotation, vault access failures)
-- Append-only — enforced by trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_rotation_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type   text NOT NULL,  -- 'secret_rotation', 'vault_access_failure', etc.
  performed_by text NOT NULL DEFAULT current_user,
  performed_at timestamptz NOT NULL DEFAULT now(),
  notes        text
);

ALTER TABLE public.security_rotation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rotation_log FORCE ROW LEVEL SECURITY;

-- Only super admins and service_role can read; no one can update/delete
CREATE POLICY "rotation_log_select" ON public.security_rotation_log
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "rotation_log_service" ON public.security_rotation_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only trigger
CREATE OR REPLACE FUNCTION public.fn_rotation_log_immutable()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  RAISE EXCEPTION 'security_rotation_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_rotation_log_immutable ON public.security_rotation_log;
CREATE TRIGGER trg_rotation_log_immutable
  BEFORE UPDATE OR DELETE ON public.security_rotation_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_rotation_log_immutable();
