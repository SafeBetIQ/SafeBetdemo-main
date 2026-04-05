/*
  # Real-Time AI Risk Engine — Database Trigger

  ## What this does

  1. Creates `call_risk_engine()` — a PLPGSQL trigger function that fires an
     async HTTP POST (via pg_net) to the risk-engine Edge Function after every
     BET_PLACED insertion into live_events.  pg_net is fire-and-forget: it
     never blocks the INSERT, never raises an exception to the calling
     transaction.

  2. Attaches the trigger to live_events (AFTER INSERT, per-row, BET_PLACED only).

  ## Why BET_PLACED only
  Loss-chasing, rapid-betting, and session-duration signals are driven by bet
  events.  DEPOSIT events are picked up inside the Edge Function via its own
  lookback query.  Firing on every event type would triple call volume with no
  additional signal quality.

  ## Why values are inline
  Supabase's `postgres` role cannot execute ALTER DATABASE SET for custom GUCs.
  The anon key is public (same key in .env.local) and the project URL is not
  secret — inlining both is safe and avoids vault/GUC complexity.

  ## Performance
  pg_net queues requests asynchronously.  The trigger returns immediately —
  the HTTP round-trip never adds latency to the INSERT path.
*/

-- ── Trigger function ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION call_risk_engine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _url     constant text := 'https://uexdjngogzunjxkpxwll.supabase.co';
  _key     constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGRqbmdvZ3p1bmp4a3B4d2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4ODE4OTUsImV4cCI6MjA3OTQ1Nzg5NX0.-OSpm7VFAK8CM2_N80gqjCKRN_8d-5MwqnstYAPnpbo';
  _payload jsonb;
BEGIN
  _payload := jsonb_build_object(
    'player_id',         NEW.player_id,
    'casino_id',         NEW.casino_id::text,
    'event_id',          NEW.id::text,
    'bet_amount',        NEW.bet_amount,
    'win_amount',        NEW.win_amount,
    'duration_seconds',  NEW.duration_seconds,
    'event_type',        NEW.event_type,
    'session_id',        NEW.session_id,
    'game_type',         NEW.game_type,
    'created_at',        NEW.created_at
  );

  -- Fire async HTTP POST — never blocks, never throws into the INSERT path
  PERFORM net.http_post(
    url     := _url || '/functions/v1/risk-engine',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key,
      'apikey',        _key
    ),
    body    := _payload
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never let the trigger break a live_events INSERT under any circumstances
  RAISE WARNING '[risk-engine trigger] suppressed error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS risk_engine_on_bet ON live_events;

CREATE TRIGGER risk_engine_on_bet
  AFTER INSERT ON live_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'BET_PLACED')
  EXECUTE FUNCTION call_risk_engine();

-- ── 4. Grant execute to postgres role (service-level, not end-user) ───────────

REVOKE ALL ON FUNCTION call_risk_engine() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION call_risk_engine() TO postgres;
