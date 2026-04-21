-- ══════════════════════════════════════════════════════════════════════════════
-- CRITICAL FIX 1: Remove hardcoded risk engine URL from call_risk_engine()
--
-- Problem: the function contained a CONSTANT URL pointing to the demo project
-- (uexdjngogzunjxkpxwll), causing production live_events inserts to call the
-- demo risk engine — cross-environment data contamination.
--
-- Fix: URL is now read from the database GUC app.risk_engine_url, which must
-- be set per-environment via ALTER DATABASE (see steps below).
-- The function fails safely (RAISE WARNING + RETURN NEW) if the GUC is unset.
-- There is no fallback to any hardcoded URL.
--
-- After applying this migration, run ONE of these in the target project:
--
--   DEMO:
--     ALTER DATABASE postgres
--       SET app.risk_engine_url =
--         'https://uexdjngogzunjxkpxwll.supabase.co/functions/v1/risk-engine';
--
--   PRODUCTION:
--     ALTER DATABASE postgres
--       SET app.risk_engine_url =
--         'https://ilibvipqbkugqkppzdmh.supabase.co/functions/v1/risk-engine';
--
-- The GUC is persisted in pg_db_role_setting and survives restarts.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.call_risk_engine()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  _url       text;
  _hmac_key  text;
  _payload   jsonb;
  _payload_t text;
  _ts        text;
  _sig       text;
BEGIN
  -- Resolve URL from per-database GUC — no hardcoded constant.
  -- Returns NULL if the GUC has never been set (missing = misconfiguration).
  _url := current_setting('app.risk_engine_url', true);

  IF _url IS NULL OR _url = '' THEN
    RAISE WARNING '[risk-engine] app.risk_engine_url not configured — trigger skipped. '
                  'Set via: ALTER DATABASE postgres SET app.risk_engine_url = ''<url>''';
    RETURN NEW;
  END IF;

  -- Access vault through SECURITY DEFINER wrapper — never directly
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

  -- Async POST — no API key, no anon key, HMAC signature only
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


-- ── Post-apply verification ───────────────────────────────────────────────────
-- Asserts that no Supabase project URL is hardcoded in the function body.
-- Migration will abort with an error if this check fails.
DO $$
DECLARE
  _src text;
BEGIN
  SELECT prosrc INTO _src FROM pg_proc WHERE proname = 'call_risk_engine';

  IF _src ILIKE '%supabase.co%' THEN
    RAISE EXCEPTION
      'MIGRATION SAFETY CHECK FAILED: call_risk_engine still contains a '
      'hardcoded Supabase URL. Do not proceed.';
  END IF;

  IF _src NOT ILIKE '%current_setting%' THEN
    RAISE EXCEPTION
      'MIGRATION SAFETY CHECK FAILED: call_risk_engine does not use '
      'current_setting(). Function may not have been updated.';
  END IF;

  RAISE NOTICE 'VERIFIED: call_risk_engine reads URL from app.risk_engine_url GUC — no hardcoded URLs present.';
END;
$$;
