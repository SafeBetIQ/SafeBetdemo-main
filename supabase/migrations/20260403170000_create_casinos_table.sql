-- Migration: Create casinos table (with idempotency guard)
--
-- CONTEXT
-- The casinos table is the root of SafeBet IQ's multi-tenant architecture.
-- Every table in the system carries casino_id as a foreign key. However, no
-- migration has ever created this table — it was applied manually at project
-- inception. This migration makes the schema self-contained and reproducible
-- on any new Supabase project.
--
-- SAFETY CONTRACT
-- • CREATE TABLE IF NOT EXISTS — no-ops silently on live projects where the
--   table already exists. All existing data is preserved untouched.
-- • Every ALTER TABLE below uses ADD COLUMN IF NOT EXISTS — safe to run on
--   both a fresh database (creates all columns) and the live project (adds
--   only the columns that are genuinely new).
-- • No DROP, no type changes, no data modifications.
--
-- COLUMN PROVENANCE
-- Columns derived from the earliest INSERT INTO casinos statements
-- (migration 20260314113505) which pre-date this migration file:
--   id, name, license_number, contact_email, contact_phone,
--   address, province, country, is_active, simulation_mode, created_at
-- Columns added by 20260314113505 ALTER TABLE:
--   province, country  (already in base table below for fresh deployments)
-- New columns added here for completeness and future use:
--   updated_at, api_enabled, hmac_secret

-- ─────────────────────────────────────────────────────────
-- TABLE DEFINITION
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.casinos (
  -- Primary key
  id               UUID          NOT NULL DEFAULT gen_random_uuid(),

  -- Identity
  name             TEXT          NOT NULL,
  license_number   TEXT,

  -- Contact
  contact_email    TEXT,
  contact_phone    TEXT,
  address          TEXT,

  -- Geography (added via ALTER TABLE in 20260314113505 on existing DBs)
  province         TEXT,
  country          TEXT          NOT NULL DEFAULT 'South Africa',

  -- Operational flags
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  simulation_mode  BOOLEAN       NOT NULL DEFAULT false,
  api_enabled      BOOLEAN       NOT NULL DEFAULT false,

  -- HMAC webhook secret (per-casino, used by api-ingest Edge Function)
  -- Nullable: NULL means casino uses legacy API key auth
  hmac_secret      TEXT,

  -- Timestamps
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT pk_casinos PRIMARY KEY (id),
  CONSTRAINT uq_casinos_license UNIQUE (license_number)
);

-- ─────────────────────────────────────────────────────────
-- BACKFILL COLUMNS FOR LIVE PROJECTS
-- On a fresh DB all columns above are created in one pass.
-- On the live project the table already exists with the original
-- columns; these ADD COLUMN IF NOT EXISTS statements add only
-- the new ones safely.
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.casinos
  ADD COLUMN IF NOT EXISTS api_enabled   BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hmac_secret   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────

-- Active-casino filter — used on every dashboard and RLS policy
CREATE INDEX IF NOT EXISTS idx_casinos_active
  ON public.casinos (is_active)
  WHERE is_active = true;

-- Country filter — used by national regulator queries
CREATE INDEX IF NOT EXISTS idx_casinos_country
  ON public.casinos (country);

-- Province filter — used by provincial regulator RLS
CREATE INDEX IF NOT EXISTS idx_casinos_province
  ON public.casinos (province)
  WHERE province IS NOT NULL;

-- ─────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────────────────

-- Generic function reused across all tables; CREATE OR REPLACE is idempotent.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop before create is idempotent (IF EXISTS prevents error on fresh DB).
DROP TRIGGER IF EXISTS trg_casinos_updated_at ON public.casinos;
CREATE TRIGGER trg_casinos_updated_at
  BEFORE UPDATE ON public.casinos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────

ALTER TABLE public.casinos ENABLE ROW LEVEL SECURITY;

-- DROP before CREATE is fully idempotent (IF EXISTS prevents errors on fresh DBs).
-- PostgreSQL does not support CREATE POLICY IF NOT EXISTS.

DROP POLICY IF EXISTS "super_admin_read_all_casinos"              ON public.casinos;
DROP POLICY IF EXISTS "casino_admin_read_own_casino"              ON public.casinos;
DROP POLICY IF EXISTS "national_regulator_read_all_casinos"       ON public.casinos;
DROP POLICY IF EXISTS "provincial_regulator_read_province_casinos" ON public.casinos;

-- Super admin: full read access to all casinos
CREATE POLICY "super_admin_read_all_casinos"
  ON public.casinos
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1) = 'super_admin'
  );

-- Casino admin / compliance officer: read only their own casino
CREATE POLICY "casino_admin_read_own_casino"
  ON public.casinos
  FOR SELECT TO authenticated
  USING (
    id = (SELECT casino_id FROM public.users WHERE id = auth.uid() LIMIT 1)
    AND (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1)
        IN ('casino_admin', 'compliance_officer')
  );

-- National regulators: read all casinos
CREATE POLICY "national_regulator_read_all_casinos"
  ON public.casinos
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1)
    IN ('national_regulator', 'regulator')
  );

-- Provincial regulators: read casinos in their province
CREATE POLICY "provincial_regulator_read_province_casinos"
  ON public.casinos
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1)
    = 'provincial_regulator'
    AND province = (
      SELECT province FROM public.users WHERE id = auth.uid() LIMIT 1
    )
  );

-- hmac_secret must never be exposed to any client role
REVOKE SELECT (hmac_secret) ON public.casinos FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- DOCUMENTATION
-- ─────────────────────────────────────────────────────────

COMMENT ON TABLE public.casinos IS
  'Root tenant table. Every table in SafeBet IQ carries casino_id as a FK '
  'to this table. Multi-tenant isolation is enforced at three layers: '
  'RLS policies on this table, application-level JWT validation, and '
  'api-ingest Edge Function header enforcement.';

COMMENT ON COLUMN public.casinos.id IS
  'Tenant identifier. Used as casino_id FK across all tables. '
  'UUIDs for three known seed casinos are fixed '
  '(11111111-..., 22222222-..., 33333333-...) for deterministic seeds.';

COMMENT ON COLUMN public.casinos.hmac_secret IS
  'Shared HMAC-SHA256 secret for api-ingest webhook signature verification. '
  'NULL = casino uses legacy API key auth. Must be 32+ bytes of random data. '
  'REVOKED from anon and authenticated roles — service role only.';

COMMENT ON COLUMN public.casinos.simulation_mode IS
  'When true, the casino-simulator Edge Function injects synthetic events '
  'for this casino. Used for demo environments. '
  'Production casinos must have simulation_mode = false.';

COMMENT ON COLUMN public.casinos.api_enabled IS
  'Master switch for api-ingest webhook processing for this casino. '
  'Set to false to block all inbound webhook traffic without deleting tokens.';

COMMENT ON COLUMN public.casinos.updated_at IS
  'Automatically maintained by trg_casinos_updated_at trigger.';
