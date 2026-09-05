# ADR-0005 — Privileged-function hardening, batch A5.1 (ARCH-V4-A5)

- **Status:** Accepted (A5.1 applied on Demo; further batches planned)
- **Date:** 2026-09-05
- **Products affected:** Shared Platform Foundation (security); SafeBet IQ (callers preserved)
- **Approver:** pending independent PR review (Demo-only; no Production)
- **Relates to:** Architecture Authority v4.0 §11.1/§20.2; ADR-0001..0004; SEC-SD-1 (prior audit)

## Context
The estate carries a systemic over-exposure: **61 SECURITY DEFINER functions granted to PUBLIC**
(so anon/authenticated inherit EXECUTE) — Authority §11.1 prohibits anon/public execution of
privileged functions without an approved exception. A5 reduces *unjustified* privilege safely,
function-by-function, in bounded reversible batches — **not** a blanket revoke and **not** an
arbitrary "SECURITY DEFINER = 0" target.

## Decision
Execute **batch A5.1**: revoke PUBLIC/anon EXECUTE from the **18** functions that are provably not
reachable by the anon client — the **19 trigger functions** (of which 4 currently held the grant;
triggers bypass EXECUTE) and **14 cron/worker-only** functions (invoked by pg_cron as superuser or
the A2 worker as service_role; none in the app `.rpc()` set). service_role is retained; grants only
— no body/search_path/ownership/SECURITY-DEFINER/arithmetic/RLS/auth change. Reversible via exact
PUBLIC re-grants (runbook).

Deliberately **deferred** (need per-function caller proof): auth/identity + player-risk mutation
(`log_auth_event`, `clear_force_password_reset`, `generate_grpi`, `link_player_to_grpi`,
`update_global_player_metrics`, `detect_*`, `resolve_alert`), app-invoked read/utility functions,
authenticated narrowing, INVOKER conversion, and ownership review — batches A5.2–A5.5.

## Results
anon 62→**44** (−18); PUBLIC 61→**44** (−17); authenticated 131→127; service_role 140 (unchanged);
SECURITY DEFINER 141 (unchanged). All A5.1 regression gates PASS (grant enforcement, audit-trigger
firing + hashing, A2 worker, financial parity + positive, auth, routes, 714/714 tests). MFA state
recorded = AVAILABLE BUT NOT ENFORCED (deferred; enforcing would lock out un-enrolled accounts).

## Consequences
- Materially smaller anon/PUBLIC attack surface with zero functional regression.
- Retained SECURITY DEFINER routines have documented rationale (register); further batches tracked.
- No RLS/auth architecture change; A1/A2/A3/A4 intact; ADR-0002 unchanged.

## Rollback
Per-function `grant execute … to public;` (runbook). DB-only change; no app/edge/infra/Production
mutation; no runtime redeploy required (the app never invoked the revoked functions as anon).
