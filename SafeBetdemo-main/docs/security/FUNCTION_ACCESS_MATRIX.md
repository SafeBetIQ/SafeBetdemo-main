# Privileged Function Access Matrix (ARCH-V4-A5.5 — final retained-definer classification)

Final A5 classification of the **138 retained SECURITY DEFINER** functions (Demo,
canonical `a425ce3d`). Every retained definer has an explicit reason its privilege elevation
remains necessary. Companion to `PRIVILEGED_FUNCTION_REGISTER.md` (history) and
`PRIVILEGED_FUNCTION_BASELINE.md` (final baseline + governance). **Not** a claim that SECURITY
DEFINER is inherently a vulnerability — the goal is that no *unjustified* privilege remains.

## Estate snapshot (re-queried from the live DB, not carried forward)
| Metric | Value |
|---|---|
| public functions total | 157 |
| **SECURITY DEFINER** | **138** |
| PUBLIC execute (secdef) | **1** (RLS predicate only) |
| anon execute (secdef) | **1** (RLS predicate only) |
| authenticated execute (secdef) | 84 |
| service_role execute (secdef) | 137 |
| owner = `postgres` | **138 / 138** |
| explicit pinned `search_path` | **138 / 138** (0 missing) |

> authenticated dropped 86→84 only because `mask_email`/`mask_phone` are now SECURITY INVOKER (A5.4)
> and no longer counted in the secdef-scoped metric; **their grants were not changed.** No grant was
> broadened anywhere in A5.

## Retained-definer classification (all 138, no UNKNOWN)
| Class | Count | Why elevation is retained |
|---|---|---|
| DEFINER REQUIRED — RLS / protected-read boundary | 58 | Read RLS-protected tables (users/roles/casinos/audit/GRPI/financial/rate-limit) and return **scoped** results, or are authz/scope resolvers; caller (anon/authenticated) must not read the base rows directly. Includes the 1 RLS predicate (below). |
| DEFINER REQUIRED — controlled privileged write | 35 | Insert/update protected state (projection writes, rollup upserts, alerts/risk, GRPI, auth/security events, MV refresh, id/token issuance, updated-at triggers) that the caller role is not entitled to perform directly. |
| DEFINER REQUIRED — audit/evidence integrity | 12 | Audit-chain insert/hash/verify, immutability guards, session supersession — must run privileged so the tamper-evident chain cannot be bypassed or forged by a caller. |
| DEFINER REQUIRED — internal maintenance/system operation | 23 | Partition create/ensure/archive, cleanup/purge, rate-limit accounting, risk-engine invocation, demo simulation/seed — system operations invoked by cron/service, not by end users. |
| INTERNAL DEFINER CHAIN | 6 | `detect_*` (5) + `run_full_detection_scan` — reachable only from other SECURITY DEFINER functions (`generate_alerts_for_grpi`/scan) which bypass the caller EXECUTE check; no external principal path. |
| LEGACY / DORMANT — retained pending retirement | 4 | `award_training_credits`, `generate_certificate_on_pass` (Academy — planned, dormant); `calculate_rpi_roi` ×2 (Responsible Profitability — not active). No reactivation; tracked in the Retirement Register. |
| FURTHER INVOKER CANDIDATE | 0 | No additional role-pure function this batch — every remaining definer touches a table, writes, resolves auth/scope context, or is an RLS predicate. Future pure helpers evaluated per-function (do not bulk-convert). |
| UNKNOWN | 0 | Every function maps to a known subsystem with evidence. |
| **Total** | **138** | |

## The single PUBLIC/anon exception (governed allowlist)
| Function | Grants | Used by | Justification |
|---|---|---|---|
| `sbiq_may_access_chain_scope(text)` | anon + authenticated + service_role | 4 RLS `USING` policies: `ach_read` (audit_chain_head), `acc_read` (audit_chain_checkpoint), `avr_read` (audit_verification_run), `pia_read` (platform_integrity_alert) | Evaluated **as the querying role** during RLS policy evaluation, so every role that reads those tables must hold EXECUTE. Does **not** read chain-data tables directly — it enforces scope; wrong-scope reads stay denied, correct-scope reads permitted. Removing the grant would break RLS. Explicit allowlisted exception (Authority §11.1). |

## search_path posture (all 138 SAFE)
All 138 pin an explicit, immutable `search_path`; none rely on `$user`, none place a
writable/untrusted schema before the trusted schema, none use caller-controlled resolution.
Distribution: `""` (fully-qualified model) ×1 · `public` ×42 · `public, pg_temp` ×88 ·
`public, extensions` ×6 · `public, extensions, pg_temp` ×1. Where present, `pg_temp` is always
**last** (safe ordering). **HARDEN REQUIRED: 0. UNKNOWN: 0. Changed: 0.**

## Ownership posture (all 138 EXPECTED TRUSTED)
All 138 owned by `postgres` (the trusted Supabase platform role). **No** SECURITY DEFINER owned by
`anon`, `authenticated`, an ordinary application user, or an unexpected tenant role. **RISK: 0.
Changed: 0.**

## hash_identity execution-context note (A5.4 terminology correction)
`hash_identity(text)` is **role-independent with respect to database object access** (reads no
table) but **configuration-dependent on the GRPI pepper GUC** (`current_setting('app.settings.grpi_pepper', true)`).
It is **not** "argument-only pure." GUC resolution is session-level and identical under DEFINER and
INVOKER, which is why A5.4 produced byte-identical output. EXECUTE is **service_role only**
(anon/authenticated denied), so no untrusted caller can invoke it or influence its effective pepper.
See the register's GUC review for the pepper-configuration finding.
