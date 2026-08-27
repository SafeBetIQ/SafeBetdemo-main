-- ─── SEC-RPC-1 — close PUBLIC EXECUTE exposure on the certified financial RPC ──
--
-- FINDING: public.sbiq_certified_financial_posture_v2(uuid, timestamptz) is a
-- SECURITY DEFINER function (owner postgres) that returns any casino's certified
-- financial posture. Its creating migration (20260806100100_financial_posture_v2)
-- did:
--     revoke all on function ...posture_v2(uuid,timestamptz) from anon, authenticated;
--     grant execute on function ...posture_v2(uuid,timestamptz) to service_role;
-- but it never revoked the DEFAULT grant to PUBLIC. Because PostgreSQL implicitly
-- grants EXECUTE to PUBLIC on function creation, and anon/authenticated are members
-- of PUBLIC, both retained EXECUTE by inheritance (residual ACL entry `=X/postgres`).
-- Effect: the function was directly callable via PostgREST with the public anon key,
-- bypassing the intended application access path
--   verifyPrincipal -> jurisdiction -> principalMayAccessCasino -> service-side RPC.
--
-- REMEDIATION: revoke EXECUTE from PUBLIC (the real source of the grant) and, for
-- defence-in-depth/explicitness, from anon and authenticated; re-affirm the only
-- intended caller, service_role. The trusted Edge Functions call it with the
-- service client after their own authorization, so they are unaffected.
--
-- This migration changes ONLY the EXECUTE privilege. It does NOT alter the function
-- body, its SECURITY DEFINER property, its owner, or any data. REVOKE/GRANT are
-- idempotent, so re-running this migration is safe.

revoke execute on function public.sbiq_certified_financial_posture_v2(uuid, timestamptz) from public;
revoke execute on function public.sbiq_certified_financial_posture_v2(uuid, timestamptz) from anon;
revoke execute on function public.sbiq_certified_financial_posture_v2(uuid, timestamptz) from authenticated;
grant  execute on function public.sbiq_certified_financial_posture_v2(uuid, timestamptz) to service_role;
