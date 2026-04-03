-- Migration: Idempotency table for api-ingest Edge Function
-- Prevents duplicate processing of retried/replayed casino webhook requests.
-- Design: INSERT ON CONFLICT DO NOTHING is the sole concurrency gate.
-- Status lifecycle: pending → completed | failed
--   pending  = claimed but still processing (crash-safe: retries allowed)
--   completed = successfully processed (replays return stored response)
--   failed    = processing error (retries allowed by caller)

-- ─────────────────────────────────────────────────────────
-- TABLE
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ingest_requests (
  id               UUID         NOT NULL DEFAULT gen_random_uuid(),
  casino_id        UUID         NOT NULL,
  request_id       TEXT         NOT NULL,
  status           TEXT         NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'completed', 'failed')),
  response_status  SMALLINT,           -- HTTP status stored on completion
  response_body    TEXT,               -- JSON body stored on completion
  endpoint         TEXT,               -- e.g. 'bets', 'deposits' — for observability
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,

  CONSTRAINT pk_ingest_requests PRIMARY KEY (id),

  -- The idempotency key: one request_id per casino
  CONSTRAINT uq_ingest_requests UNIQUE (casino_id, request_id),

  -- Tenant FK guard
  CONSTRAINT fk_ingest_requests_casino
    FOREIGN KEY (casino_id) REFERENCES public.casinos(id) ON DELETE CASCADE
);

COMMENT ON TABLE  public.ingest_requests IS
  'Idempotency log for api-ingest. Each (casino_id, request_id) pair is processed at most once.';
COMMENT ON COLUMN public.ingest_requests.status IS
  'pending=claimed, completed=success, failed=error (failed rows are retryable).';
COMMENT ON COLUMN public.ingest_requests.response_body IS
  'Stored response JSON. Returned verbatim for completed duplicate requests.';

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

-- Partial index: only non-completed rows need fast status lookups during
-- the pending-window (saves index bloat as most rows move to completed).
CREATE INDEX IF NOT EXISTS idx_ingest_requests_pending
  ON public.ingest_requests (casino_id, created_at)
  WHERE status = 'pending';

-- Cleanup index: db-maintenance prunes rows older than 30 days
CREATE INDEX IF NOT EXISTS idx_ingest_requests_cleanup
  ON public.ingest_requests (created_at);

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.ingest_requests ENABLE ROW LEVEL SECURITY;

-- The Edge Function runs with the service role key (bypasses RLS).
-- Dashboard/compliance users can view their own casino's requests.
CREATE POLICY "casino_isolation_ingest_requests"
  ON public.ingest_requests
  FOR SELECT
  USING (casino_id = fn_my_casino_id());

-- ─────────────────────────────────────────────────────────
-- CLEANUP FUNCTION (called by db-maintenance cron)
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_old_ingest_requests(
  retention_days INT DEFAULT 30
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.ingest_requests
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_old_ingest_requests IS
  'Removes completed/failed idempotency records older than retention_days (default 30). '
  'Pending rows are never purged to prevent phantom re-processing.';
