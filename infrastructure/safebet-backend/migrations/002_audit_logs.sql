-- ============================================================================
-- SafeBet IQ — Audit + Compliance Layer
-- ============================================================================
-- Append-only, hash-chained, tenant-isolated audit log.
-- Requires: 001_rls_tenant_isolation.sql (get_tenant_id, safebet_app role)
-- Requires: pgcrypto extension (digest function for SHA-256)
-- Idempotent — safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. pgcrypto — required for digest()
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Audit log table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  casino_id   TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,  -- Cognito sub of the actor

  action      TEXT        NOT NULL,  -- CREATE_PLAYER, UPDATE_RISK, TRIGGER_INTERVENTION …
  entity_type TEXT        NOT NULL,  -- player | bet | session | risk_score | intervention | compliance_event
  entity_id   TEXT,                  -- UUID of the affected row (NULL for bulk/system actions)

  -- Sanitised payload — no raw passwords, no PII beyond what regulators require
  metadata    JSONB,

  -- Hash chain — links each record to the previous, enabling tamper detection
  prev_hash   TEXT,                  -- hash of the immediately preceding row (NULL for first row per tenant)
  hash        TEXT        NOT NULL,  -- SHA-256(prev_hash || deterministic_payload)

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for regulator query patterns
CREATE INDEX IF NOT EXISTS audit_logs_casino_created
  ON audit_logs (casino_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity
  ON audit_logs (casino_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS audit_logs_user
  ON audit_logs (casino_id, user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security — tenant isolation
-- ---------------------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_audit" ON audit_logs;
CREATE POLICY "tenant_isolation_audit" ON audit_logs
  FOR ALL
  USING     (casino_id = get_tenant_id())
  WITH CHECK (casino_id = get_tenant_id());

GRANT SELECT, INSERT ON audit_logs TO safebet_app;
-- No UPDATE or DELETE granted — immutability enforced at both grant and trigger level.

-- ---------------------------------------------------------------------------
-- 3. Immutability — prevent UPDATE and DELETE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable — UPDATE and DELETE are not permitted (table: %, id: %)',
    TG_TABLE_NAME, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS no_update_audit ON audit_logs;
CREATE TRIGGER no_update_audit
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

DROP TRIGGER IF EXISTS no_delete_audit ON audit_logs;
CREATE TRIGGER no_delete_audit
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ---------------------------------------------------------------------------
-- 4. Hash chain — tamper detection
--
--    hash = SHA-256( prev_hash || '|' || casino_id || '|' || user_id ||
--                    '|' || action || '|' || entity_type ||
--                    '|' || COALESCE(entity_id,'') ||
--                    '|' || created_at::text )
--
--    The separator '|' prevents collision between concatenated fields.
--    prev_hash IS NULL for the first record per tenant (genesis record).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_audit_hash(
  prev_hash   TEXT,
  payload     TEXT
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(
    digest(COALESCE(prev_hash, '') || '|' || payload, 'sha256'),
    'hex'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION compute_audit_hash(TEXT, TEXT) TO safebet_app;

-- ---------------------------------------------------------------------------
-- 5. Insert trigger — auto-computes hash and prev_hash on every INSERT
--    so the application never has to manage this manually.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_audit_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  last_hash TEXT;
  payload   TEXT;
BEGIN
  -- Fetch the hash of the most recent row for this tenant.
  -- id DESC breaks created_at ties deterministically under concurrent inserts.
  SELECT hash INTO last_hash
  FROM   audit_logs
  WHERE  casino_id = NEW.casino_id
  ORDER BY created_at DESC, id DESC
  LIMIT  1;

  NEW.prev_hash := last_hash;  -- NULL if this is the first row for this tenant

  -- Deterministic payload — field order and separator are part of the spec.
  -- metadata::text is included so any post-insert metadata change is detectable.
  payload := NEW.casino_id
    || '|' || NEW.user_id
    || '|' || NEW.action
    || '|' || NEW.entity_type
    || '|' || COALESCE(NEW.entity_id, '')
    || '|' || NEW.created_at::text
    || '|' || COALESCE(NEW.metadata::text, '');

  NEW.hash := compute_audit_hash(last_hash, payload);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_hash_chain ON audit_logs;
CREATE TRIGGER audit_hash_chain
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION set_audit_hash();

-- ---------------------------------------------------------------------------
-- 6. Chain verification function
--    Regulators can call this to confirm no records were tampered with.
--    Returns rows where the stored hash does not match the recomputed hash.
--    An empty result set means the chain is intact.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION verify_audit_chain(p_casino_id TEXT)
RETURNS TABLE (
  id            UUID,
  created_at    TIMESTAMPTZ,
  action        TEXT,
  stored_hash   TEXT,
  expected_hash TEXT,
  tampered      BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    created_at,
    action,
    hash                                                   AS stored_hash,
    compute_audit_hash(
      prev_hash,
      casino_id || '|' || user_id || '|' || action
        || '|' || entity_type
        || '|' || COALESCE(entity_id, '')
        || '|' || created_at::text
        || '|' || COALESCE(metadata::text, '')
    )                                                      AS expected_hash,
    hash IS DISTINCT FROM compute_audit_hash(
      prev_hash,
      casino_id || '|' || user_id || '|' || action
        || '|' || entity_type
        || '|' || COALESCE(entity_id, '')
        || '|' || created_at::text
        || '|' || COALESCE(metadata::text, '')
    )                                                      AS tampered
  FROM  audit_logs
  WHERE casino_id = p_casino_id
  ORDER BY created_at ASC, id ASC;
$$;

GRANT EXECUTE ON FUNCTION verify_audit_chain(TEXT) TO safebet_app;

-- ---------------------------------------------------------------------------
-- 7. Validation queries (run manually after applying migration)
-- ---------------------------------------------------------------------------
-- 7a. Insert → success
--
--   SELECT set_config('app.casino_id', 'casino_001', false);
--   INSERT INTO audit_logs (casino_id, user_id, action, entity_type)
--   VALUES ('casino_001', 'sub-abc', 'CREATE_PLAYER', 'player');
--   -- hash and prev_hash auto-computed by trigger
--
-- 7b. Update → FAIL
--
--   UPDATE audit_logs SET action = 'TAMPERED' WHERE casino_id = 'casino_001';
--   -- ERROR: Audit logs are immutable
--
-- 7c. Delete → FAIL
--
--   DELETE FROM audit_logs WHERE casino_id = 'casino_001';
--   -- ERROR: Audit logs are immutable
--
-- 7d. Cross-tenant query → no data
--
--   SELECT set_config('app.casino_id', 'casino_002', false);
--   SELECT COUNT(*) FROM audit_logs;  -- 0 rows (casino_001 data not visible)
--
-- 7e. Chain verification
--
--   SELECT set_config('app.casino_id', 'casino_001', false);
--   SELECT * FROM verify_audit_chain('casino_001') WHERE tampered = true;
--   -- Empty result = chain intact
-- ---------------------------------------------------------------------------
