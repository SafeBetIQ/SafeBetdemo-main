# Privileged Function Register & Access Matrix (ARCH-V4-A5)

Read-only inventory + classification of the SECURITY DEFINER estate, and the evidence-driven
least-privilege remediation. **Not a claim that SECURITY DEFINER is inherently a vulnerability** —
the goal is removing *unjustified* privilege (esp. anon/PUBLIC), not an arbitrary count reduction.

## Baseline (bfa8b08, 2026-09-05)
| Metric | Before A5 | After A5.1 |
|---|---|---|
| SECURITY DEFINER functions | 141 | **141** (unchanged — grants only) |
| PUBLIC execute | 61 | **44** (−17) |
| **anon execute** | 62 | **44** (−18) |
| authenticated execute | 131 | **127** (−4) |
| service_role execute | 140 | **140** (unchanged) |
| secdef with explicit search_path | 141/141 | 141/141 (already safe — no unsafe search_path) |
| secdef using dynamic SQL (EXECUTE) | 0 | 0 |

## Grant-profile distribution (before A5.1)
`authenticated+service_role` 69 · `anon+public+authenticated+service_role` **61 (the systemic
PUBLIC-EXECUTE root cause)** · `service_role` only 9 · `none` 1 · `anon+authenticated+service_role` 1.

## Classification (primary)
- **A — REQUIRED SECURITY DEFINER:** privileged routines whose elevation is genuine (audit hashing,
  rollup, projection writes, admin snapshots). Keep; scope EXECUTE tightly.
- **B — SHOULD BECOME INVOKER:** candidates where caller perms suffice — future batch (needs per-fn proof).
- **C — KEEP DEFINER, RESTRICT EXECUTE:** privileged impl but grants too broad — **A5.1 addressed the
  provably-safe subset**; more in A5.2/A5.3.
- **D — INTERNAL ONLY:** trigger functions (19) + cron/worker-only — no external principal should hold EXECUTE.
- **E — LEGACY/UNUSED:** Academy (`award_training_credits`, `generate_certificate_on_pass`, …),
  `guardianlayer_*` — retire separately (Legacy Register).
- **F — UNKNOWN:** insufficient evidence — **not modified**.

## A5.1 batch — REVOKED PUBLIC/anon (18 functions, provably safe)
**Trigger functions (4)** — triggers fire in the statement context and do NOT check EXECUTE, so no
caller needs the grant: `fn_contact_submission_guard`, `sbiq_audit_chain_insert`,
`sbiq_audit_config_change`, `sbiq_supersede_prior_sessions` → revoked public/anon/authenticated,
kept service_role.
**Cron/worker-only (14)** — invoked by pg_cron (superuser, bypasses grants) or the A2 rollup worker
via service_role; none in the app `.rpc()` caller set: `sbiq_financial_rollup_refresh`,
`sbiq_fin_rollup_upsert_range`, `sbiq_financial_rollup_watchdog`, `sbiq_seed_demo_financials`,
`sbiq_demo_live_tick`, `sbiq_demo_tick_watchdog`, `sbiq_demo_showcase_maintenance`,
`sbiq_demo_scale_seed_batch`, `sbiq_demo_scale_cleanup`, `sbiq_demo_audit_insert`,
`sbiq_demo_audit_cleanup`, `sbiq_demo_raise_alert`, `sbiq_audit_chain_backfill`,
`sbiq_run_audit_verification` → revoked public/anon, kept authenticated + service_role.
Migration: `20260905120000_arch_v4_a5_1_revoke_public_anon_safe_batch.sql`. Reversible (runbook).

### A5.1 verification (all PASS)
anon **DENIED** on revoked fns; service_role/authenticated **retained**; **audit trigger still fires
+ hashes** (2 login events hashed post-revoke, 0 unhashed, 0 sequence-dupes); **A2 worker still runs**
(service_role→rollup, 415 events/12 buckets); financial parity RPC==VIEW==wagers−winnings + all-6
positive; demo tick running; auth 200 (prestige 4.16s / betway 1.89s); 714/714 tests; product routes 200.

## A5.2 batch — REVOKED PUBLIC/anon/authenticated on 12 proven-dormant P0 functions
Migration: `20260905130000_arch_v4_a5_2_revoke_p0_dormant_privileged.sql` (reversible).
**Caller proof:** each function has **ZERO** callers in the application (frontend, server, API,
`.rpc()`, edge, workers, tests, scripts, contexts — full grep), **ZERO** cron, **ZERO** triggers.
The only DB callers are other SECURITY DEFINER functions in the same **dormant** GRPI/detection
subsystem (`link_player_to_grpi`→`generate_grpi`; `generate_alerts_for_grpi`→`detect_*`), which run
as the definer (postgres) and **bypass** the client EXECUTE check. The app's real auth logging is a
**direct `audit_events` insert via the service client** (`writeAudit`), not `log_auth_event`.

| Function (signature) | Runtime EXECUTE caller | Current→Required grants | Decision | Caller proof |
|---|---|---|---|---|
| `log_auth_event(text,text,text,jsonb,uuid,text)` | none (app uses direct audit insert) | anon+pub+auth+svc → svc | revoke pub/anon/auth | grep 0; not called by login route |
| `clear_force_password_reset()` | none | " | revoke pub/anon/auth | grep 0; no cron/trigger |
| `generate_grpi(text,text,text)` | `link_player_to_grpi` (secdef, bypass) | " | revoke pub/anon/auth | internal secdef only |
| `link_player_to_grpi(uuid,uuid,text,text,text)` | none | " | revoke pub/anon/auth | grep 0; dormant entry |
| `update_global_player_metrics(uuid,numeric,numeric,integer)` | none | " | revoke pub/anon/auth | grep 0 |
| `detect_binge_sessions/cross_casino_chasing/late_night_activity/loss_chasing/rapid_deposits(uuid)` (5) | `generate_alerts_for_grpi` (secdef, bypass) | " | revoke pub/anon/auth | internal secdef only |
| `resolve_alert(uuid)` | none | " | revoke pub/anon/auth | grep 0 |
| `run_full_detection_scan()` | none | " | revoke pub/anon/auth | grep 0 |

service_role retained (future authorised worker/admin). **Verified (all PASS):** anon DENIED on all
12; service_role retained; **definer (postgres) retains EXECUTE on `generate_grpi`+`detect_*`** so
internal secdef calls are unaffected; audit chain 0 unhashed/0 dupes; login audit written+hashed
(writeAudit path healthy); A2 worker runs (46 events/12 buckets); financial parity + all-6 positive;
demo tick running; product routes 200; 714/714 tests, typecheck + build green, secret-scan clean.

### Cumulative after A5.2
anon **32** (62→44→**32**, −30 total) · PUBLIC **32** (61→44→**32**, −29) · authenticated **115**
(131→127→**115**) · service_role **140** (unchanged) · SECURITY DEFINER **141** (unchanged).

## Remaining exposure (future bounded batches — NOT done in A5.1/A5.2)
Still `anon`-executable (32) / `PUBLIC` (32) — remediate after per-function caller confirmation:
- **A5.2** — remaining anon/PUBLIC read/utility functions (e.g. `is_*`, `get_*`, `mask_*`, health,
  `sbiq_admin_*`, `sbiq_regulator_national`) — confirm each app `.rpc()` caller's role first (several
  ARE app-invoked, e.g. `sbiq_platform_health`, `sbiq_connector_health`, `resolve_player_identity`).
- **A5.2-risk** — auth/identity + player-risk mutation (`log_auth_event`, `clear_force_password_reset`,
  `generate_grpi`, `link_player_to_grpi`, `update_global_player_metrics`, `detect_*`,
  `generate_alerts_for_grpi`, `resolve_alert`) — HIGH-RISK; require end-to-end caller proof (may be
  invoked during registration/login) before any change.
- **A5.3** — narrow over-broad `authenticated` grants where role already allows narrowing.
- **A5.4** — SECURITY DEFINER → INVOKER candidates (per-fn).
- **A5.5** — ownership review (functions owned by superuser where a lower principal suffices).

## MFA (Phase 28)
`mfa_settings`: 0 rows / 0 enforced / 0 configured; login is password-only; privileged accounts =
2 super_admin + 1 regulator (+7 casino_admin). **State: MFA AVAILABLE BUT NOT ENFORCED.** Enforcing
now would lock out accounts with no enrolled factors → deferred to a separately-approved enrolment
milestone (not a safe config-only change today).

## Secrets (Phase 29)
No hard-coded secrets (secret-scan clean, 939 files). Service-role key lives in Secrets Manager
(A2), read by the worker at runtime, never logged. A5 changes are grants-only; no secret touched.
