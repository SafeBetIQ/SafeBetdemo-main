-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 2: Remove all direct vault access patterns — add one-shot value retrieval
-- FIX 3: Distributed rate limiting — DB-backed, works across Edge Function
--        instances, prevents bypass via horizontal scaling
-- ══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Single-use secret retrieval for rotation workflows
-- Returns the new active secret value exactly ONCE after a rotation.
-- Stores a consumed flag so the value cannot be retrieved again via SQL.
-- This replaces the direct "SELECT decrypted_secret FROM vault..." pattern.
-- ─────────────────────────────────────────────────────────────────────────────

-- Track one-time retrieval tokens
CREATE TABLE IF NOT EXISTS public.secret_retrieval_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name  text NOT NULL,
  consumed     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  consumed_at  timestamptz
);

ALTER TABLE public.secret_retrieval_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_retrieval_tokens FORCE ROW LEVEL SECURITY;

-- Only postgres role (migration runner) and service_role can touch this table
CREATE POLICY "retrieval_tokens_service" ON public.secret_retrieval_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Append-only after creation — no updates except the consume flag via function
CREATE OR REPLACE FUNCTION public.fn_retrieval_tokens_immutable()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'secret_retrieval_tokens rows cannot be deleted';
  END IF;
  -- Allow only the consumed + consumed_at columns to be updated
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id           != NEW.id           OR
       OLD.secret_name  != NEW.secret_name  OR
       OLD.created_at   != NEW.created_at   OR
       OLD.expires_at   != NEW.expires_at   THEN
      RAISE EXCEPTION 'Only consumed/consumed_at may be updated on secret_retrieval_tokens';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_retrieval_tokens_immutable ON public.secret_retrieval_tokens;
CREATE TRIGGER trg_retrieval_tokens_immutable
  BEFORE UPDATE OR DELETE ON public.secret_retrieval_tokens
  FOR EACH ROW EXECUTE FUNCTION public.fn_retrieval_tokens_immutable();


-- issue_secret_retrieval_token()
-- Called immediately after rotate_risk_engine_secret().
-- Grants a 15-minute single-use token that consume_secret_retrieval_token()
-- exchanges for the actual secret value — only once.
CREATE OR REPLACE FUNCTION public.issue_secret_retrieval_token(p_secret_name text)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _token_id uuid;
BEGIN
  INSERT INTO public.secret_retrieval_tokens (secret_name)
  VALUES (p_secret_name)
  RETURNING id INTO _token_id;

  RETURN _token_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.issue_secret_retrieval_token(text) FROM PUBLIC, authenticated, anon;


-- consume_secret_retrieval_token()
-- Exchanges a token for the secret value ONCE.
-- Token is immediately marked consumed — subsequent calls return NULL.
-- Expired tokens always return NULL regardless of consumed state.
CREATE OR REPLACE FUNCTION public.consume_secret_retrieval_token(p_token_id uuid)
  RETURNS text LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _secret_name text;
  _secret_val  text;
BEGIN
  -- Atomically mark consumed and verify eligibility
  UPDATE public.secret_retrieval_tokens
  SET consumed = true, consumed_at = now()
  WHERE id          = p_token_id
    AND consumed    = false
    AND expires_at  > now()
  RETURNING secret_name INTO _secret_name;

  IF _secret_name IS NULL THEN
    -- Token invalid, expired, or already consumed — return NULL silently
    RETURN NULL;
  END IF;

  -- Retrieve the secret value via existing SECURITY DEFINER wrapper
  SELECT decrypted_secret INTO _secret_val
  FROM vault.decrypted_secrets
  WHERE name = _secret_name
  LIMIT 1;

  RETURN _secret_val;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_secret_retrieval_token(uuid) FROM PUBLIC, authenticated, anon;


-- Updated rotate_risk_engine_secret() — no longer returns plaintext directly.
-- Returns a one-time token ID instead. Exchange via consume_secret_retrieval_token().
CREATE OR REPLACE FUNCTION public.rotate_risk_engine_secret()
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _active_id  uuid;
  _active_val text;
  _prev_id    uuid;
  _new_secret text;
  _token_id   uuid;
BEGIN
  SELECT s.id, d.decrypted_secret
    INTO _active_id, _active_val
  FROM vault.secrets s
  JOIN vault.decrypted_secrets d ON d.name = s.name
  WHERE s.name = 'risk_engine_hmac_secret'
  LIMIT 1;

  IF _active_val IS NULL THEN
    RAISE EXCEPTION 'Active HMAC secret not found in vault';
  END IF;

  SELECT id INTO _prev_id FROM vault.secrets
  WHERE name = 'risk_engine_hmac_secret_prev' LIMIT 1;

  IF _prev_id IS NULL THEN
    PERFORM vault.create_secret(_active_val, 'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — rotation window slot');
  ELSE
    PERFORM vault.update_secret(_prev_id, _active_val, 'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — rotation window slot');
  END IF;

  _new_secret := encode(gen_random_bytes(32), 'hex');
  PERFORM vault.update_secret(_active_id, _new_secret, 'risk_engine_hmac_secret',
    'HMAC-SHA256 signing secret — active (rotated ' || now()::date::text || ')');

  -- Issue one-time retrieval token instead of returning plaintext
  _token_id := public.issue_secret_retrieval_token('risk_engine_hmac_secret');

  INSERT INTO public.security_rotation_log (event_type, notes)
  VALUES ('secret_rotation',
    'HMAC secret rotated. Token issued for single-use retrieval. ' ||
    'Token expires 15 minutes from: ' || now()::text);

  RAISE NOTICE 'Rotation complete. Retrieve new secret ONCE with: SELECT public.consume_secret_retrieval_token(''%'');', _token_id;

  RETURN _token_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rotate_risk_engine_secret() FROM PUBLIC, authenticated, anon, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Distributed rate limiting — atomic DB-backed sliding window
-- Works identically across any number of Edge Function instances.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.distributed_rate_limits (
  key          text PRIMARY KEY,
  hits         int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- Index for TTL cleanup job
CREATE INDEX IF NOT EXISTS idx_drl_expires ON public.distributed_rate_limits (expires_at);

ALTER TABLE public.distributed_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributed_rate_limits FORCE ROW LEVEL SECURITY;

-- Only service_role (Edge Functions) can read/write
CREATE POLICY "drl_service_only" ON public.distributed_rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Deny authenticated/anon entirely
CREATE POLICY "drl_deny_authenticated" ON public.distributed_rate_limits
  AS RESTRICTIVE FOR ALL TO authenticated USING (false);


-- check_distributed_rate_limit()
-- Atomic fixed-window counter: increment within window, reset on new window.
-- Returns { allowed, count } as JSONB.
-- "Fail open" semantics: if this function errors, the caller should allow
-- the request and log a warning — rate limit must never block legitimate traffic.
CREATE OR REPLACE FUNCTION public.check_distributed_rate_limit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _window_start timestamptz;
  _count        int;
BEGIN
  _window_start := now() - (p_window_seconds || ' seconds')::interval;

  INSERT INTO public.distributed_rate_limits (key, hits, window_start, expires_at)
  VALUES (
    p_key,
    1,
    now(),
    now() + (p_window_seconds || ' seconds')::interval
  )
  ON CONFLICT (key) DO UPDATE
    SET
      hits = CASE
        WHEN distributed_rate_limits.window_start <= _window_start
        THEN 1           -- Expired window: reset counter
        ELSE distributed_rate_limits.hits + 1
      END,
      window_start = CASE
        WHEN distributed_rate_limits.window_start <= _window_start
        THEN now()
        ELSE distributed_rate_limits.window_start
      END,
      expires_at = CASE
        WHEN distributed_rate_limits.window_start <= _window_start
        THEN now() + (p_window_seconds || ' seconds')::interval
        ELSE distributed_rate_limits.expires_at
      END
  RETURNING hits INTO _count;

  RETURN jsonb_build_object(
    'allowed', _count <= p_limit,
    'count',   _count,
    'limit',   p_limit
  );
END;
$$;

-- Edge Functions call this via service_role client
GRANT EXECUTE ON FUNCTION public.check_distributed_rate_limit(text, int, int) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_distributed_rate_limit(text, int, int) FROM authenticated, anon;


-- Cleanup function — run periodically (pg_cron or scheduled Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_entries()
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _deleted int;
BEGIN
  DELETE FROM public.distributed_rate_limits WHERE expires_at < now();
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_entries() TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_entries() FROM authenticated, anon;
