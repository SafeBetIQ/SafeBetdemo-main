-- Migration: Idempotency key expiry strategy for ingest_requests
--
-- Design choices:
--   - expires_at is a plain column (not GENERATED) so future per-casino TTL
--     overrides are possible without a schema change.
--   - Default is always created_at + 24 hours at insert time.
--   - Expiry is enforced at the application layer (Edge Function) for fast
--     rejections without a full table scan.
--   - Two new indexes:
--       idx_ingest_requests_recent  — supports the common query pattern of
--                                     "recent requests for this casino"
--       idx_ingest_requests_expiry  — speeds up the purge function's WHERE clause

-- ─────────────────────────────────────────────────────────
-- COLUMN
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.ingest_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    NOT NULL DEFAULT (now() + INTERVAL '24 hours');

-- Back-fill existing rows that pre-date this migration.
-- Sets expires_at = created_at + 24h (most will already be expired,
-- which is correct — they are now permanently closed).
UPDATE public.ingest_requests
SET    expires_at = created_at + INTERVAL '24 hours'
WHERE  expires_at IS NULL
   OR  expires_at = (now() + INTERVAL '24 hours');  -- catch rows inserted in same txn before back-fill

COMMENT ON COLUMN public.ingest_requests.expires_at IS
  'Hard expiry for this idempotency key. After this timestamp the key is '
  'permanently rejected and the casino must generate a new X-Request-ID. '
  'Default: created_at + 24 hours. Can be set per-request for custom TTL.';

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

-- Primary lookup index: covers the common "recent requests for casino X" query
-- used by dashboards and the expiry lookback.
CREATE INDEX IF NOT EXISTS idx_ingest_requests_recent
  ON public.ingest_requests (casino_id, created_at DESC);

-- Expiry/cleanup index: used by purge_old_ingest_requests() and any
-- monitoring query that sweeps for expired rows.
CREATE INDEX IF NOT EXISTS idx_ingest_requests_expiry
  ON public.ingest_requests (expires_at)
  WHERE status IN ('completed', 'failed');

-- ─────────────────────────────────────────────────────────
-- UPDATE PURGE FUNCTION
-- Purge should respect expires_at rather than a hardcoded 30-day retention,
-- so the two TTL mechanisms stay consistent.
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
  WHERE (
    -- Honour explicit expires_at (key-level TTL)
    expires_at < NOW()
    OR
    -- Hard retention ceiling regardless of expires_at
    created_at < NOW() - (retention_days || ' days')::INTERVAL
  )
  AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
