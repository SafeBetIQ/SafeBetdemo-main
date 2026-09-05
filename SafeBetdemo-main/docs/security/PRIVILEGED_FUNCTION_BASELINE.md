# Privileged Function Security Baseline (ARCH-V4-A5 — final close-out)

Authoritative end-state of the SECURITY DEFINER estate hardening track (A5.1–A5.5), Demo only.
Canonical `a425ce3d`; live app `bfa8b08` (A5 is DB-attribute/docs/CI only — no app redeploy).
Companions: `FUNCTION_ACCESS_MATRIX.md` (per-class rationale), `PRIVILEGED_FUNCTION_REGISTER.md`
(batch history), `ADR-0005`, `security-hardening-runbook.md`, `security/privileged-function-baseline.json`
(machine-readable, consumed by `scripts/ci/privfn-guard.mjs`).

## Final counts
| Metric | Pre-A5 | Final (A5.5) |
|---|---|---|
| SECURITY DEFINER | 141 | **138** |
| PUBLIC execute | 61 | **1** |
| anon execute | 62 | **1** |
| authenticated execute | 131 | **84** (secdef-scoped; grants only narrowed, never broadened) |
| service_role execute | 140 | 137 (secdef-scoped; 3 A5.4 conversions no longer secdef) |
| owner = postgres | — | **138 / 138** |
| explicit search_path | — | **138 / 138** |
| security-material UNKNOWN | — | **0** |

## Retained exceptions (governed)
- **Sole PUBLIC/anon:** `sbiq_may_access_chain_scope` — RLS predicate for 4 audit policies. Allowlisted
  in `security/privileged-function-baseline.json`; rationale in the access matrix. This is required by
  PostgreSQL RLS execution semantics, not a gap.

## Owner model
Single trusted owner (`postgres`) for all privileged functions. No lower/tenant/anon principal owns a
SECURITY DEFINER routine. No new privileged role was created (deliberately — avoids blast radius).

## search_path posture
All 138 pin an explicit search_path; trusted schema first; `pg_temp` last where present; one function
uses the fully-qualified (`search_path=""`) model. No `$user`, no untrusted-schema precedence, no
caller-controlled resolution. No hardening mutation was necessary.

## Future-regression guard (CI)
`scripts/ci/privfn-guard.mjs` (npm `ci:privfn`) statically scans migrations **after** the baseline
version `20260905150000` and fails when a migration:
1. GRANTs EXECUTE to PUBLIC or anon on a function not in the allowlist; or
2. creates a SECURITY DEFINER function without pinning `SET search_path`.
Pre-baseline history is grandfathered. Allowlist currently = `sbiq_may_access_chain_scope` only.
Unit-tested in `tests/privfnGuard.test.mjs`. No database credentials required; no DB event trigger.

## Default-privileges posture
PostgreSQL's built-in default is that **new functions receive EXECUTE to PUBLIC** unless altered.
That default is the historical root cause of the estate's over-exposure. Rather than a broad
`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ... FROM PUBLIC` (whose blast radius spans every future
function, including Supabase-managed ones, and can surprise unrelated features), the guard above catches
regressions at migration-review time with a narrow, reviewable, reversible mechanism. A targeted
`ALTER DEFAULT PRIVILEGES` improvement remains a **proposal** for a future milestone, to be introduced
only with a proven blast-radius assessment — not applied blindly here.

## MFA disposition (final)
**MFA OPEN P1 — HARD GATE BEFORE PRIVILEGED REGULATORY-ROLE ACTIVATION.** Supabase Auth MFA is
available; `mfa_settings` is 0 enrolled / 0 enforced; privileged roles (2 super_admin, 1 regulator,
7 casino_admin) are password-only. Enforcement is **not** enabled in A5 because doing so before any
privileged identity has enrolled a factor would lock out all privileged users (enforce-before-enrol).
Target model: **privileged role → MFA enrolled → MFA verified → privileged access allowed** (enrol
first, then enforce). Recorded hard gate: **no real Guardian privileged user, no real Regulator-Suite
privileged user, and no production privileged regulatory access may be activated until MFA enforcement
is proven.** Not silently resolved.

## Intact guarantees (re-verified at A5 close)
- Financial: 6/6 casinos parity RPC==VIEW==(stakes−winnings); worker operational; old cron disabled;
  ADR-0002 unchanged.
- Audit/evidence: 0 unhashed, 0 duplicate-sequence scopes; verification healthy; tenant chains intact.
- Auth: Prestige/Betway 200, no latency regression.
- RLS unchanged; no new privileged exposure; A1–A4 intact; identityFederation OFF; Production untouched.

## Open / carried items (consciously accepted)
- **P1:** MFA enforcement (gated as above); remaining broad `authenticated` (84) narrowing under a
  future RBAC/ABAC model; any future retained-definer hardening surfaced by review.
- **P2:** legacy retirement (Academy, RPI, `guardianlayer_*`); further low-risk INVOKER conversions
  (per-function proof); GRPI pepper GUC — set `app.settings.grpi_pepper` as a DB-level GUC in any
  environment holding real identity data (Demo uses the dev fallback on synthetic data).
- **Separate defect (not A5):** regulator `national-overview` edge endpoint 500 — pre-existing,
  grant/mode-independent; unchanged by A5.

## Review requirements
Re-run `npm run ci:privfn` on every migration PR. Re-verify this baseline whenever a privileged
function is added, an owner changes, or the allowlist changes. Re-assess the MFA gate before any
privileged regulatory-role activation.
