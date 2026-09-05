# ADR-0005 — Privileged-function hardening, batch A5.1 (ARCH-V4-A5)

- **Status:** Accepted — **A5 CLOSED** (A5.1–A5.5 applied/completed on Demo; hardened + governed)
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
**A5.1:** anon 62→**44** (−18); PUBLIC 61→**44** (−17); authenticated 131→127; service_role 140;
SECURITY DEFINER 141. All A5.1 gates PASS. MFA = AVAILABLE BUT NOT ENFORCED (deferred).

**A5.2** (migration `20260905130000`): revoked PUBLIC/anon/authenticated on **12 proven-dormant P0
functions** (auth/identity/player-risk/alert) — complete caller proof shows no runtime EXECUTE
caller (0 app/cron/trigger; only internal secdef calls that bypass grants; app auth-logging uses a
direct `audit_events` insert, not `log_auth_event`). service_role retained. Result — **cumulative:
anon 62→32 (−30); PUBLIC 61→32 (−29); authenticated 131→115; service_role 140 & SECURITY DEFINER 141
unchanged.** All A5.2 gates PASS (anon denied; **definer retains EXECUTE so internal calls
unaffected**; audit chain intact + login audit written/hashed; A2 worker; financial parity+positive;
auth; routes; 714/714 tests). Remaining anon/PUBLIC (32) → batches A5.3–A5.5 (per-function caller proof).

**A5.3** (migrations `20260905140000` + `20260905141000`): live-caller narrowing of the remaining
32 externally-exposed functions. Full caller proof → **29 service-only** (revoke anon/public/auth;
21 dormant + 8 proven service-client callers), **2 authenticated-retained** (`get_user_by_email_fast`
post-login, `sbiq_verify_audit_chain` admin/regulator page), **1 left unchanged** because it is an
**RLS policy predicate** (`sbiq_may_access_chain_scope`, 4 policies — must retain grants for policy
evaluation). Result — **cumulative: anon 62→1 (−61); PUBLIC 61→1 (−60); authenticated 131→86;
service_role 140 & SECURITY DEFINER 141 unchanged.** All gates PASS (negative grant tests; RLS
predicate + RLS read intact; internal secdef chains intact; regulator service path proven; A2 worker;
financial parity+positive; login+audit; routes; 714/714). MFA finding recorded (privileged roles
lack second factor; enrolment-then-enforce = separate milestone). A pre-existing regulator
`national-overview` 500 (edge-logic, grant-independent) noted, outside scope.

**A5.4** (migration `20260905150000`): first **execution-mode** batch — converted **3 proven-pure**
functions from SECURITY DEFINER to SECURITY INVOKER: `mask_email(text)`, `mask_phone(text)`,
`hash_identity(text)`. Each reads no table, writes nothing, reads no auth/session context, and is not
an RLS predicate, so output is a deterministic function of arguments and the execution role cannot
affect it — DEFINER was unjustified. Grants were **not** changed (A5.3 restrictions remain
authoritative); only the security mode flipped. Excluded from this batch by rule: auth, tenant/scope
resolution, regulator scope, financial certification/rollup, audit append/hash, evidence integrity,
service-role admin, RLS predicates (`sbiq_may_access_chain_scope` untouched), identity federation,
cross-operator. Result — **SECURITY DEFINER 141→138 (−3, first reduction)**; anon **1**, PUBLIC **1**,
authenticated **86**, service_role grants unchanged. All gates PASS (prosecdef=false ×3; **output
byte-identical before/after** on deterministic samples → zero behavioural change; grants unchanged/no
broadening; RLS predicate + RLS read intact; internal secdef chains intact; A2 worker; financial
parity+positive; login+audit; routes; 714/714). DB-only, no redeploy.

**A5.5** (no migration — governance/CI/docs close-out): re-queried the live estate and found it already
safe — **138/138 owned by `postgres`**, **138/138 with pinned explicit search_path**, sole PUBLIC/anon
= the RLS predicate. Produced the **final retained-definer classification of all 138** (protected-read
58 · write 35 · audit/evidence 12 · maintenance 23 · internal-chain 6 · legacy/dormant 4 · further-
INVOKER 0 · **UNKNOWN 0**) in `FUNCTION_ACCESS_MATRIX.md`; a **future-regression CI guard**
(`scripts/ci/privfn-guard.mjs` + `security/privileged-function-baseline.json`, unit-tested) that blocks
new PUBLIC/anon privileged grants and unpinned SECURITY DEFINER functions in future migrations; a
default-privileges review (kept the reviewable guard over a broad `ALTER DEFAULT PRIVILEGES`); the
**hash_identity GUC correction** (role-independent w.r.t. object access, config-dependent on the GRPI
pepper GUC, service_role-only EXECUTE, no untrusted influence); and the **final MFA disposition**
(OPEN P1 — hard gate before privileged regulatory-role activation). Final baseline in
`PRIVILEGED_FUNCTION_BASELINE.md`. All close-out gates PASS (6/6 financial parity; audit 0/0; worker;
auth; routes; 724/724 tests; typecheck; build; secret-scan; privfn-guard). No DB mutation → no redeploy.

## A5 close
**Status → Accepted; A5 CLOSED (hardened + governed).** Externally-reachable privileged execution is
least-privilege and evidenced; the sole PUBLIC/anon exception is justified and explicitly governed;
every retained SECURITY DEFINER has a recorded rationale; **no material UNKNOWN**; search_path and
ownership are safe estate-wide; a future-regression guard is in place; financial/auth/audit/evidence
and A1–A4 remain intact; Production untouched; MFA has an explicit disposition with a hard gate before
privileged regulatory-role activation. Carried items (consciously accepted): **P1** MFA enforcement
(gated), broad `authenticated` (84) RBAC/ABAC narrowing; **P2** legacy retirement, further INVOKER
conversions, GRPI pepper DB-GUC for real-identity environments. The regulator `national-overview` 500
remains a separate pre-existing defect (grant/mode-independent), unchanged by A5.

## Consequences
- Materially smaller anon/PUBLIC attack surface with zero functional regression.
- Retained SECURITY DEFINER routines have documented rationale (register); further batches tracked.
- No RLS/auth architecture change; A1/A2/A3/A4 intact; ADR-0002 unchanged.

## Rollback
Per-function `grant execute … to public;` (runbook). DB-only change; no app/edge/infra/Production
mutation; no runtime redeploy required (the app never invoked the revoked functions as anon).
