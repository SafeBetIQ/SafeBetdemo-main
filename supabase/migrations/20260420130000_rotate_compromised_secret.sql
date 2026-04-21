-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY INCIDENT RESPONSE: Rotate HMAC secret exposed in session logs
-- Run this migration IMMEDIATELY before any other changes.
-- The old key (a052c12f...) must be considered compromised.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  _active_id   uuid;
  _active_val  text;
  _prev_id     uuid;
  _new_secret  text;
BEGIN
  -- Fetch current active secret
  SELECT s.id, d.decrypted_secret
    INTO _active_id, _active_val
  FROM vault.secrets s
  JOIN vault.decrypted_secrets d ON d.name = s.name
  WHERE s.name = 'risk_engine_hmac_secret'
  LIMIT 1;

  IF _active_val IS NULL THEN
    RAISE EXCEPTION 'Active HMAC secret not found — cannot rotate';
  END IF;

  -- Archive compromised key as previous (maintains rotation window compatibility)
  SELECT id INTO _prev_id FROM vault.secrets
  WHERE name = 'risk_engine_hmac_secret_prev' LIMIT 1;

  IF _prev_id IS NULL THEN
    PERFORM vault.create_secret(
      _active_val,
      'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — rotation window slot'
    );
  ELSE
    PERFORM vault.update_secret(
      _prev_id,
      _active_val,
      'risk_engine_hmac_secret_prev',
      'Previous HMAC secret — rotation window slot'
    );
  END IF;

  -- Generate new 256-bit secret — replaces the compromised one
  _new_secret := encode(gen_random_bytes(32), 'hex');

  PERFORM vault.update_secret(
    _active_id,
    _new_secret,
    'risk_engine_hmac_secret',
    'HMAC-SHA256 signing secret — rotated after session exposure ' || now()::date::text
  );

  -- Audit record
  INSERT INTO public.security_rotation_log (event_type, notes)
  VALUES (
    'emergency_rotation',
    'HMAC secret rotated: prior value exposed in MCP session console output. ' ||
    'All Edge Function secrets must be updated within 15 minutes. ' ||
    'Old key invalidated as soon as RISK_ENGINE_HMAC_SECRET_PREV is removed from Edge Function secrets.'
  );

  RAISE NOTICE '
══════════════════════════════════════════════════════════
SECURITY ACTION REQUIRED — complete within 15 minutes:

1. Retrieve new secret:
   SELECT public.rotate_risk_engine_secret_value();
   (run this function — defined in next migration)

2. Set in Edge Function secrets:
   Dashboard → Edge Functions → risk-engine → Secrets
   RISK_ENGINE_HMAC_SECRET = <new value>

3. After 15 min, remove:
   RISK_ENGINE_HMAC_SECRET_PREV

4. Verify: SELECT public.fn_vault_secret_exists(''risk_engine_hmac_secret'');
══════════════════════════════════════════════════════════';
END;
$$;
