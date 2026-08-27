# SEC-SD-1 — SECURITY DEFINER Estate: Classification & Remediation Plan

**Status:** audit + design only. **No broad ACL mutation performed.** The only function
already remediated is `sbiq_certified_financial_posture_v2` (SEC-RPC-1, PR #45).
Authoritative live check: [`supabase/security/security_definer_estate_audit.sql`](../../supabase/security/security_definer_estate_audit.sql).
Forward guard: [`tests/securityDefinerGuard.test.mjs`](../../tests/securityDefinerGuard.test.mjs).

## 1. Root cause (systemic)
A freshly `CREATE`d function **default-grants `EXECUTE` to `PUBLIC`**. Migrations that
revoked only `anon, authenticated` (not `PUBLIC`) left the grant intact because
`anon`/`authenticated` **inherit** `PUBLIC`. Combined with `SECURITY DEFINER` (runs as
`postgres`, bypassing table RLS/grants), any such function is directly callable via
PostgREST `/rpc` with the **public anon key**.

Source quantification (Demo migrations): **55** migrations define `SECURITY DEFINER`
functions; only **~9** ever `revoke … from public`. The rest hardened nothing or only
`anon, authenticated`.

## 2. Estate (effective privileges, live)
| Env | secdef fns | PUBLIC-exec | anon-exec | authenticated-exec | trigger-only (not API-callable) |
|-----|-----------:|------------:|----------:|-------------------:|--------------------------------:|
| Demo (`uexdjngogzunjxkpxwll`) | 141 | 61 | 62 | 131 | 20 |
| Prod (`ilibvipqbkugqkppzdmh`) | 57 | 49 | 50 | 51 | 11 |

Severity triage (heuristic; P0/P1 body-verified): Demo **28 CRITICAL / 26 HIGH / 24 MED / 34 LOW / 29 INFO**;
Prod **11 CRITICAL / 6 HIGH / 24 MED / 0 LOW / 16 INFO**. `trigger`-returning functions are
**not** PostgREST-invokable → hygiene-only, excluded from CRITICAL/HIGH.

## 3. Confirmed exploitability (live)
- **Demo, anon direct call, data returned:** `sbiq_admin_financial_section`,
  `sbiq_financial_rollup_status`, `get_player_audit_count`, `check_player_self_exclusion`,
  `get_user_by_email_fast`, `hash_identity` → HTTP 200 with data.
- **Prod, anon direct call (safe read-only probes, fake inputs):** `get_performance_stats`,
  `player_belongs_to_casino`, `get_user_by_email_fast`, `calculate_rpi_roi` → HTTP 200
  (function reached). Mutating prod functions share the same grant; **not invoked** (boundary).

## 4. Demo remediation queue
### P0 — CRITICAL (anon-callable unguarded mutation, or user enumeration)
| Function | Impact | Remediation |
|---|---|---|
| `get_user_by_email_fast(text)` | anon **user enumeration** (id/email/role/casino_id/is_active) — used in the **login flow** | **C: code-fix** — move to a server-side route (service_role) or add rate-limited, minimal-return design; then revoke anon/public |
| `log_auth_event(...)` | anon **audit/auth-log injection** (INSERT audit_events) | A: revoke public/anon/authenticated → service_role |
| `sbiq_seed_demo_financials`, `sbiq_financial_rollup_refresh`, `sbiq_fin_rollup_upsert_range`, `sbiq_financial_rollup_watchdog`, `sbiq_financial_rollup_backfill` | anon triggers financial **writes/backfills** | A: → service_role (some postgres/cron-only) |
| `sbiq_demo_live_tick`, `sbiq_demo_audit_insert`, `sbiq_demo_audit_cleanup`, `sbiq_demo_scale_seed_batch`, `sbiq_demo_scale_cleanup`, `sbiq_demo_activate_showcase`, `sbiq_demo_raise_alert`, `sbiq_demo_showcase_maintenance`, `sbiq_demo_tick_watchdog`, `sbiq_demo_sim_health_snapshot`, `sbiq_admin_refresh_registered(_manual)` | anon drives the **simulator / admin refresh** (writes, volume) | A: → service_role |
| `generate_grpi`, `generate_alerts_for_grpi`, `detect_*` (binge/loss/rapid/late-night/cross-casino), `recalculate_grpi_risk_score`, `update_global_player_metrics`, `sbiq_audit_chain_backfill` | anon mutates **player-intelligence / audit chain** | A: → service_role (these are internal-only; also called by other definer fns, unaffected by revoke) |

### P1 — HIGH (anon-callable sensitive READ, no internal authz)
`sbiq_admin_financial_section`, `sbiq_admin_overview_snapshot`, `sbiq_regulator_national`,
`sbiq_regulator_operators`, `sbiq_financial_rollup_status`, `get_player_audit_count`,
`get_player_recent_audit_events`, `check_player_self_exclusion`, `hash_identity` (pepper oracle).
→ **A: revoke-only → service_role** (all consumed by server routes / the regulator edge fn with service_role).

### P2 — MEDIUM
`authenticated`-only mutators/maintenance (`archive_old_records`, `purge_old_ingest_requests`,
`create_monthly_partition`, `refresh_*_views`, `check_rate_limit_*`, partition helpers),
`clear_force_password_reset` (auth.uid()-scoped → anon no-op, but authenticated **self-clears
forced-reset** — review), `player`/role helper reads. → A/C per function.

### P3 — LOW / INFO
Trigger functions (20), role/context helpers protected by `auth.uid()`, `resolve_alert`
(guarded by `is_super_admin() OR is_regulator()` → anon blocked), correctly service_role-locked fns.

## 5. Production remediation queue — **URGENT**
Production runs on **live data**. Anon-reachable CRITICAL:
- `get_user_by_email_fast` (user enumeration), `log_auth_event` (audit injection),
  `simulate_live_feed` (data mutation), `cleanup_rate_limit_entries` / `purge_old_ingest_requests`
  / `archive_old_records` (anon **DELETE**/purge + disabling rate-limit state),
  `refresh_all_materialized_views` / `refresh_realtime_views` (anon **DoS**),
  `create_monthly_partition`, `check_distributed_rate_limit` / `check_rate_limit_sliding` (rate-limit tampering).
- HIGH: `log_security_event`, `calculate_rpi_roi`, `get_performance_stats`,
  `player_belongs_to_casino`, `fn_vault_secret_exists` (authenticated secret-existence oracle).

→ **Recommend `SEC-SD-PROD-1`** for narrowly-scoped P0 containment (batched, not one migration),
executed under its own explicit authorisation. **No Production mutation in SEC-SD-1.**

## 6. Caller / dependency map (drives desired grant)
| Function | Legitimate caller | Caller auth | Desired grant |
|---|---|---|---|
| `sbiq_regulator_national` | `regulator-portal` edge fn | service client after `verifyPrincipal` | service_role |
| `sbiq_admin_financial_section` / `_overview_snapshot` / `_rollup_status` | `app/api/admin/*` server routes | server (service_role) | service_role |
| `sbiq_demo_live_tick` + `sbiq_demo_*` | `lib/demoSimGovernance` (server/cron) | service_role | service_role |
| `get_user_by_email_fast` | `lib/auth.ts`, `app/login/page.tsx` | **anon (pre-login)** | **needs code-fix → server route**, not a blind revoke |
| `log_auth_event`, `generate_grpi`, `detect_*`, `update_global_player_metrics`, `hash_identity`, `check_player_self_exclusion`, `get_player_audit_*`, `resolve_alert`, `sbiq_financial_rollup_*` | none in app; internal/definer callers or unused | n/a | service_role (internal callers keep working under definer rights) |

## 7. Remediation batches (each independently testable + reversible)
- **BATCH A (Demo P0 revoke-only):** service_role-only functions with no anon caller — the mutators + audit + rollup + demo-sim set. Revoke public/anon/authenticated; grant service_role.
- **BATCH B (Demo P1 sensitive-read revoke-only):** admin/regulator/player-read functions.
- **BATCH C (code-fix):** `get_user_by_email_fast` (login path) — server-route redesign before revoke; `clear_force_password_reset` self-clear review.
- **BATCH D (Demo P2 maintenance):** authenticated-only maintenance/partition/rate-limit — revoke to service_role/postgres.
- **BATCH E (Demo P3 cleanup):** trigger/helper tidy-up; no functional change.
- **PROD batches** mirror A/B/D under `SEC-SD-PROD-1`.

## 8. Future migration standard (mandatory for new sensitive SECURITY DEFINER fns)
```sql
create or replace function <schema>.<fn>(<args>) ... security definer set search_path = ... ;
revoke execute on function <schema>.<fn>(<exact-arg-types>) from public;
revoke execute on function <schema>.<fn>(<exact-arg-types>) from anon;
revoke execute on function <schema>.<fn>(<exact-arg-types>) from authenticated;
grant  execute on function <schema>.<fn>(<exact-arg-types>) to <only the intended role>;  -- often service_role; NOT automatically
```
Enforced forward by `tests/securityDefinerGuard.test.mjs` (baseline-grandfathered; opt-out marker
`-- sec-sd: intentional-public-execute` for deliberately public RPCs, which must then add explicit grants).

## 9. Default-privilege design (Phase 15 verdict: **REQUIRES SEPARATE DESIGN**)
`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`
would make public schema secure-by-default and is fully reversible, **but** it changes behaviour for
every intentionally-public RPC (each must re-`grant` explicitly) and must be impact-checked against
extension-created functions. **Do not apply now.** Recommend as its own designed change; the per-function
standard + CI guard are the immediate controls.
