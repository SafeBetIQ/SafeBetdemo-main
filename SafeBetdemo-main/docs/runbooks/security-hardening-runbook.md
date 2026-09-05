# Security Hardening Runbook — privileged-function EXECUTE grants (ARCH-V4-A5)

Process for evidence-driven, reversible, batched least-privilege remediation of the SECURITY
DEFINER estate. See ADR-0005 and `docs/security/PRIVILEGED_FUNCTION_REGISTER.md`.

## Method (per batch)
1. **Inventory** grants + callers read-only: `has_function_privilege(role, fn, 'EXECUTE')`;
   trigger functions via `pg_trigger`; app callers via `grep -rhoE "\.rpc\('[a-z_]+'"` over
   `lib app supabase/functions components` (note: `workers/` calls the rollup RPC as **service_role**
   via PostgREST, not `.rpc()`).
2. **Classify** each function (A–F, register). Only touch high-confidence, non-app-anon-called fns.
3. **Prove safety** before revoke:
   - Trigger function? → EXECUTE grant is irrelevant (triggers bypass EXECUTE) → safe to revoke.
   - Called only by pg_cron (superuser bypasses) or the service_role worker? → keep service_role.
   - In the app `.rpc()` set as anon/authenticated? → DO NOT revoke that role.
4. **Narrow migration** (never `supabase db push`): capture exact current grants first so rollback is
   exact. Because exposure is usually a PUBLIC grant (anon/authenticated inherit), the fix is
   `revoke execute … from public[, anon[, authenticated]]; grant execute … to <needed roles>;`.
5. **Apply** the single reviewed migration via the Management API SQL runner; record in the ledger.
6. **Test matrix + regression** (below). If any gate fails → **ROLL BACK the batch**.

## A5.1 rollback (exact)
Restore the prior PUBLIC grants (each function had a PUBLIC grant before A5.1):
```
grant execute on function fn_contact_submission_guard() to public;
grant execute on function sbiq_audit_chain_insert() to public;
grant execute on function sbiq_audit_config_change() to public;
grant execute on function sbiq_supersede_prior_sessions() to public;
grant execute on function sbiq_financial_rollup_refresh(integer) to public;
grant execute on function sbiq_fin_rollup_upsert_range(timestamp with time zone,timestamp with time zone) to public;
grant execute on function sbiq_financial_rollup_watchdog() to public;
grant execute on function sbiq_seed_demo_financials(uuid,text) to public;
grant execute on function sbiq_demo_live_tick(integer) to public;
grant execute on function sbiq_demo_tick_watchdog() to public;
grant execute on function sbiq_demo_showcase_maintenance() to public;
grant execute on function sbiq_demo_scale_seed_batch(uuid,text,integer,integer,integer,integer,text,integer) to public;
grant execute on function sbiq_demo_scale_cleanup(text) to public;
grant execute on function sbiq_demo_audit_insert(uuid) to public;
grant execute on function sbiq_demo_audit_cleanup(text) to public;
grant execute on function sbiq_demo_raise_alert(text,text,text,uuid,jsonb,uuid) to public;
grant execute on function sbiq_audit_chain_backfill() to public;
grant execute on function sbiq_run_audit_verification(text) to public;
```

## Regression gates (every batch)
- **Grant enforcement:** `has_function_privilege('anon', fn, 'EXECUTE')` = false on revoked fns;
  service_role (and any retained role) = true.
- **Audit chain:** new writes still hash (trigger fires); `hash is null` = 0; sequence-dupe scopes = 0.
- **A2 worker:** enqueue a message → `rollup_success` (service_role → PostgREST rollup RPC).
- **Financial:** all 6 casinos parity RPC==VIEW==(wagers−winnings) + positive; old cron stays disabled.
- **Auth:** Prestige + Betway login 200, no 20–40s regression (app 429 rate-limit ≠ infra failure).
- **Product routes:** casino dashboard/players/reports/self-exclusion/evidence/cases + admin/audit = 200.
- **Source:** `node --test`, typecheck, build, secret scan green.

## STOP condition
Auth failure, cross-tenant leak, financial/audit/evidence regression, worker failure, or major API
regression → **roll back the batch, understand the cause, do not proceed.**

## Guardrails
No blanket `revoke … from public` across all functions. No SECURITY DEFINER body/search_path/owner
change without separate proof. Never weaken RLS to fix a function. Production is out of scope.
