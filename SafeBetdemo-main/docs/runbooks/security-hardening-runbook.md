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

## A5.2 rollback (exact)
Restore prior PUBLIC grants on the 12 proven-dormant P0 functions:
```
grant execute on function clear_force_password_reset() to public;
grant execute on function detect_binge_sessions(uuid) to public;
grant execute on function detect_cross_casino_chasing(uuid) to public;
grant execute on function detect_late_night_activity(uuid) to public;
grant execute on function detect_loss_chasing(uuid) to public;
grant execute on function detect_rapid_deposits(uuid) to public;
grant execute on function generate_grpi(text,text,text) to public;
grant execute on function link_player_to_grpi(uuid,uuid,text,text,text) to public;
grant execute on function log_auth_event(text,text,text,jsonb,uuid,text) to public;
grant execute on function resolve_alert(uuid) to public;
grant execute on function run_full_detection_scan() to public;
grant execute on function update_global_player_metrics(uuid,numeric,numeric,integer) to public;
```

## A5.3 rollback (exact)
Restore prior PUBLIC grants on the 31 changed functions:
```
-- 3a (service-only, 29): grant execute on function <sig> to public;  (see migration 20260905140000)
grant execute on function check_player_self_exclusion(text,text,text) to public;
grant execute on function generate_alerts_for_grpi(uuid) to public;
grant execute on function get_alerts_by_pattern() to public;
grant execute on function get_assessment_stats(uuid) to public;
grant execute on function get_bie_grpi_profiles(integer,integer) to public;
grant execute on function get_cross_operator_metrics() to public;
grant execute on function get_grpi_compliance_queue(integer) to public;
grant execute on function get_grpi_cross_casino_alerts(integer) to public;
grant execute on function get_grpi_dashboard_rows(integer,integer) to public;
grant execute on function get_grpi_summary() to public;
grant execute on function get_player_audit_count(uuid,integer) to public;
grant execute on function get_player_cross_casino_profile(uuid) to public;
grant execute on function get_player_recent_audit_events(uuid,integer) to public;
grant execute on function get_severity_distribution() to public;
grant execute on function hash_identity(text) to public;
grant execute on function recalculate_grpi_risk_score(uuid) to public;
grant execute on function sbiq_admin_financial_section(timestamp with time zone) to public;
grant execute on function sbiq_admin_overview_snapshot(boolean) to public;
grant execute on function sbiq_admin_refresh_registered() to public;
grant execute on function sbiq_admin_refresh_registered_manual(uuid,uuid) to public;
grant execute on function sbiq_admin_registered_status() to public;
grant execute on function sbiq_demo_activate_showcase(text,uuid,text,integer,uuid,uuid) to public;
grant execute on function sbiq_demo_partition_readiness(boolean) to public;
grant execute on function sbiq_demo_sim_health_snapshot() to public;
grant execute on function sbiq_financial_rollup_backfill(integer) to public;
grant execute on function sbiq_financial_rollup_status() to public;
grant execute on function sbiq_regulator_national(text) to public;
grant execute on function sbiq_regulator_operators(text) to public;
grant execute on function sbiq_verify_audit_chain_range(text,bigint,bigint) to public;
-- 3b (authenticated-retained, 2): (migration 20260905141000)
grant execute on function get_user_by_email_fast(text) to public;
grant execute on function sbiq_verify_audit_chain(text) to public;
```

## A5.4 rollback (exact)
Restore SECURITY DEFINER on the 3 pure functions converted to INVOKER (grants were not changed):
```
alter function public.mask_email(text) security definer;
alter function public.mask_phone(text) security definer;
alter function public.hash_identity(text) security definer;
```

## A5.5 — final close-out (no DB mutation)
A5.5 re-queried the live estate and found it already safe: **138/138 owned by `postgres`**, **138/138
with a pinned explicit `search_path`**, sole PUBLIC/anon = the RLS predicate. No search_path or
ownership change was warranted, so **no migration was applied**. Deliverables were classification +
governance only: `FUNCTION_ACCESS_MATRIX.md`, `PRIVILEGED_FUNCTION_BASELINE.md`,
`security/privileged-function-baseline.json`, and the CI guard below.

### Future-regression guard
`npm run ci:privfn` (`scripts/ci/privfn-guard.mjs`) statically scans migrations **after** baseline
`20260905150000` and fails when one (a) grants EXECUTE to PUBLIC/anon on a non-allowlisted function, or
(b) adds a SECURITY DEFINER function without a pinned `SET search_path`. Allowlist =
`sbiq_may_access_chain_scope`. Unit-tested (`tests/privfnGuard.test.mjs`). Run it on every migration PR.
To add a legitimate exception: add the function to `publicAnonExecuteAllowlist` in the baseline JSON
**with a written rationale** (independent review required).

### search_path / ownership rollback (A5.5)
None required — A5.5 changed no function attribute. Had a change been made, the runbook records prior
`proconfig` (search_path), prior `proowner` (owner), and prior mode before any ALTER.

## INVOKER-conversion rule (A5.4 learning)
Only convert SECURITY DEFINER → INVOKER where the function is **pure with respect to execution role**:
reads NO table, writes nothing, reads no auth/session/`current_user` context, and is NOT an RLS
`USING`/`WITH CHECK` predicate. For such functions the output is a deterministic function of arguments,
so the role cannot change the result → DEFINER is unjustified and INVOKER is behaviour-preserving
(prove by capturing deterministic output before and confirming byte-identical after). A GUC read via
`current_setting('app.settings.*', true)` is config, not a table, and is role-independent — still pure.
Do **not** convert functions that touch tables, bypass RLS deliberately, resolve tenant/regulator scope,
certify financials, append/hash audit, or run as service-role admin — their elevation is required.

## RLS-predicate rule (A5.3 learning)
Before revoking authenticated/anon on any function, check `pg_policies` for references to it
(`qual`/`with_check`). A function used as an RLS `USING`/`WITH CHECK` predicate is evaluated as the
querying role and MUST retain EXECUTE for that role — **leave it unchanged** (e.g.
`sbiq_may_access_chain_scope`).

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
