-- Migration: Add HMAC secret column to operator_integrations
--
-- Each casino integration can now hold a dedicated HMAC secret used to
-- sign inbound webhook requests to api-ingest (X-SafeBet-Signature header).
--
-- Design:
--   - Nullable — existing integrations continue to use API key auth until
--     they are migrated to HMAC. The Edge Function treats NULL as "HMAC not
--     configured" and falls back to API key auth for that casino.
--   - Plain text storage is intentional: the service role key (used by Edge
--     Functions) has access; client-side RLS blocks all reads. The secret
--     is never returned in any SELECT used by the frontend.
--   - A future migration can encrypt at rest using pgcrypto if required by
--     compliance scope. For now, Supabase transparent encryption covers it.

ALTER TABLE public.operator_integrations
  ADD COLUMN IF NOT EXISTS hmac_secret TEXT DEFAULT NULL;

COMMENT ON COLUMN public.operator_integrations.hmac_secret IS
  'Shared HMAC-SHA256 secret for api-ingest webhook signature verification. '
  'NULL = HMAC not configured; casino uses legacy API key auth. '
  'Must be at least 32 bytes of cryptographically random data. '
  'Rotate via the integrations dashboard — old secret is invalid immediately.';

-- Ensure the column is never readable via the client-side anon/authenticated roles.
-- (RLS on operator_integrations already restricts rows; this column-level
-- security adds defence-in-depth so the secret is never included in SELECT *.)
REVOKE SELECT (hmac_secret) ON public.operator_integrations FROM anon, authenticated;
