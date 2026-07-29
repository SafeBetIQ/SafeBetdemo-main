# Phase 4.1 — Enterprise Security & Multi-Tenant Isolation

**Status: COMPLETE & DEPLOYED** (2026-07-12, SafeBet Demo `uexdjngogzunjxkpxwll`; production untouched)
**Governed by:** `SAFEBET_ENTERPRISE_CONSTITUTION.md` (Constitution 6) · **Closes certification conditions C1, C2** · **Gate G1: PASS** · **Decision: ADR-002**

Authorization across SafeBet IQ now derives exclusively from cryptographically verified material. Tenant isolation is enforced twice — at the database (RLS) and at every edge surface (mirrored predicate). No enterprise layer, runtime model, event pipeline, or business logic was added or changed; this is hardening of the existing architecture.

---

## 1. Security Review Summary

The Independent Review found the platform's authorization trusted client-supplied identity and its read paths had no tenant scope. Phase 4.1 removes every client-supplied trust vector and scopes every read path, without touching the enterprise flow. Two enforcing layers now express ONE tenant matrix:
- **Database:** `app_visible_casinos()` (SECURITY DEFINER, keyed on the verified `auth.uid()`) drives RLS on the event log and projection tables; catalogue views run `security_invoker` so they inherit it.
- **Edge:** `verifyPrincipal()` resolves the caller from the verified JWT + `users` registry; `resolveConsumerScope()` / `principalMayAccessCasino()` enforce the SAME matrix before any platform read.

## 2. Threat Model (reviewed; status after 4.1)

| Threat | Before | After | Evidence |
|---|---|---|---|
| Cross-casino read | Open (`using (true)`) | **Blocked** at DB + edge | casino_admin saw 1/30 rows (own only); operator→other casino = 403 |
| Cross-jurisdiction read | Open | **Blocked** | ZA regulator lost a casino the instant it moved to BW |
| JWT spoofing (claimed profile) | **Exploitable** (anon got regulator views) | **Blocked** | anon+`consumer=regulator` = 401 |
| JWT tampering | Not verified | **Blocked** | forged-signature token = 401 |
| Consumer bypass (query-param identity) | Trusted | **Eliminated** | params select view/casino only; never widen entitlement |
| Privilege escalation (ungranted view) | View grants only | **Blocked** | operator→compliance = 403; regulator→live-floor = 403 |
| Platform-ops abuse | Open to any bearer | **Admin-only** | operator→rebuild = 403; anon→rebuild = 401 |
| Unauthenticated production | anon key accepted | **Rejected** | anon→gateway = 401 |
| Realtime leakage | Inherited `using (true)` | **Blocked** | postgres_changes enforces the new RLS automatically |
| Injection | None found | Unchanged | parameterized supabase-js; RLS predicate is a set-returning function, not string-built |

## 3. RLS Implementation Report

Migration `20260712100000_phase41_tenant_isolation.sql`:
1. **Jurisdiction registry** — `casinos.jurisdiction` (not null, default `'ZA'`) is the sole source of the policy-evaluation jurisdiction; `users.jurisdiction` scopes regulator principals.
2. **`app_visible_casinos()`** — SECURITY DEFINER set-returning function; the matrix: super_admin → all; casino_admin/compliance_officer → own casino; regulator/national_regulator → jurisdiction; provincial_regulator → jurisdiction + province; anything else/anon → none. `execute` revoked from `anon`.
3. **Tenant RLS** — `casino_event_log`, `projection_player_state`, `projection_session_state`, `projection_machine_state`: `using (casino_id in (select app_visible_casinos()))` replacing every `using (true)`. `IN (subquery)` evaluates once per statement (no per-row cost).
4. **View bypass closed** — the seven catalogue views were owner-executed (RLS-bypassing; `reloptions` null, verified live). All set `security_invoker = true` — **a leak the certification did not catch**, now closed: a view can no longer return rows the invoker's RLS forbids.

## 4. Consumer Authorization Report

`consumer-gateway` rewritten (Constitution 6.2): identity is derived, never claimed.
- `verifyPrincipal()` → 401 unless the bearer is a Supabase-verified JWT for an active `users` row (or the service-role key for internal jobs).
- Consumer profile from `role`; casino scope from the principal (operators/compliance pinned to their own casino — a differing `casino_id` is **refused, never substituted**); jurisdiction from the `casinos` registry.
- `consumer` and `jurisdiction` query parameters are **no longer read**; `view`/`casino_id` select within entitlement only. The browser client was updated to stop sending `consumer`.

## 5. JWT Validation Report

`lib/security/principal.ts` centralizes verification: `bearerToken()` extracts only well-formed bearer credentials; `verifyPrincipal()` calls `auth.getUser(token)` (Supabase validates signature + expiry — anon keys and tampered tokens fail), then loads role/casino/jurisdiction/province from `users` keyed by the **verified** `auth.uid()`, rejecting missing or inactive users. The service-role key authenticates internal platform jobs only on exact match. 14 unit tests cover the matrix incl. tamper/anon/inactive/service-role.

## 6. Realtime Security Report

Realtime `postgres_changes` enforces table RLS at delivery. Because the event log and projection tables are now tenant-scoped, a subscriber receives only their visible casinos' changes — no cross-casino or cross-jurisdiction event leakage, with no code change to the subscription (isolation is a property of the underlying policies). Verified transitively via the DB RLS tests (the same policies govern query and stream).

## 7. IAM / Least-Privilege Review

- **Edge functions:** consumer-gateway = authenticated consumers (scoped); `digital-twin`, `projection-platform` = administrators/service-role only (ops surfaces; rebuild disposes read models); `casino-simulator` = verified principals, burst restricted to casinos in the producer's scope, `tick` admin-only. All previously accepted the anon key.
- **DB roles:** `anon` has no execute on `app_visible_casinos()` and sees zero rows; `authenticated` reads only visible casinos; writes remain service-role only (event store append-only trigger unchanged).
- **Secrets/AWS:** review-only per standing constraint; no production infra touched. Recommendation carried to 4.4: move service-role usage behind narrowly-scoped internal credentials where feasible.

## 8. Files created
- `lib/security/principal.ts` — verified-principal resolution + tenant predicate
- `supabase/migrations/20260712100000_phase41_tenant_isolation.sql`
- `tests/security.test.mjs` — 14 adversarial/authorization unit tests
- `docs/phase-4.1-security-tenant-isolation.md`; ADR-002 in `ARCHITECTURE_DECISION_RECORD.md`

## 9. Files modified
- `lib/consumerPlatform/authorization.ts` — `resolveConsumerScope`, `ConsumerScopeError`, regulator role variants; `index.ts` exports
- `supabase/functions/consumer-gateway/index.ts` — verified-principal authorization; query-param identity removed
- `supabase/functions/{digital-twin,projection-platform,casino-simulator}/index.ts` — principal verification + least-privilege gates
- `contexts/CasinoDataContext.tsx` — stops sending client-supplied `consumer`

## 10. Database migrations
One additive migration (applied to demo): jurisdiction columns + backfill, `app_visible_casinos()`, tenant RLS on 4 tables, `security_invoker` on 7 views. No table/shape changes; no data loss.

## 11. ADRs created
**ADR-002 — Authorization derives exclusively from verified material** (Accepted). Not a breaking change under Constitution §9 (no event/projection/twin/intelligence/policy/contract *shape* changes).

## 12–13. Tests executed / passed
`node --test tests/*.test.mjs` → **129 tests, 129 pass, 0 fail** (115 pre-existing — zero regressions — + 14 new security tests). `tsc --noEmit` clean; `next build` succeeds. Live adversarial + positive verification on demo (real JWTs):

| Case | Expected | Result |
|---|---|---|
| DB: casino_admin cross-tenant read | own only | 1/30 rows, 0 foreign ✓ |
| DB: anon read | none | 0 rows ✓ |
| DB: ZA regulator (table + views) | both ZA casinos | 30 rows / 2 casinos; views 2/2 ✓ |
| DB: casino→BW, ZA regulator | loses it | 2 → 1 casino ✓ |
| Edge: anon → gateway | 401 | 401 ✓ |
| Edge: anon + `consumer=regulator` | 401 | 401 ✓ |
| Edge: tampered JWT | 401 | 401 ✓ |
| Edge: operator → own casino | 200 | 200 ✓ |
| Edge: operator → other casino | 403 | 403 ✓ |
| Edge: operator → compliance (ungranted) | 403 | 403 ✓ |
| Edge: regulator → ZA casino compliance | 200 | 200 ✓ |
| Edge: regulator → live-floor (ungranted) | 403 | 403 ✓ |
| Edge: anon/operator → ops rebuild | 401/403 | 401 / 403 ✓ |

## 14. Remaining risks
- Isolation depends on registry correctness (`users.casino_id/jurisdiction`, `casinos.jurisdiction`) — onboarding must set these; a data-quality check is a 4.4 ops item.
- Service-role usage inside edge functions is broad by necessity (platform reads bypass RLS); acceptable as these surfaces now authenticate + authorize before reading, but tightening is a 4.4 candidate.
- `province` values must match between `users` and `casinos` for provincial regulators (string equality) — a registry constraint to formalize.
- Out-of-flow producers (`api-ingest`) still write directly and are **not** covered by this workstream (H1, Phase 4.4).

## 15. Performance impact
Negligible: `app_visible_casinos()` is `stable`, evaluated once per statement via `IN (select …)`; the per-request edge adds one `auth.getUser` + one `users` lookup + one `casinos` lookup. No change to the event/projection hot paths.

## 16. Rollback strategy
Additive and reversible. Restoring the prior `using (true)` policies and reverting the four edge functions returns the pre-4.1 posture (not advised). Views revert with `security_invoker = false`. No data migration to unwind; jurisdiction columns are harmless if left. Demo is the blast radius; production is owner-executed.

## 17. Security architecture (after 4.1)

```
Request (Bearer JWT)
  → verifyPrincipal(): Supabase verifies signature/expiry  → users registry (auth.uid)
        anon / tampered / unknown / inactive ⇒ 401
  → resolveConsumerScope(): profile=role · casino=principal (own, or entitled request)
        · jurisdiction=casinos registry     ungranted/cross-tenant ⇒ 403
  → platform read (service role) scoped to resolved casino
        ── in parallel, DB RLS enforces the SAME matrix on every table + view + Realtime stream ──
  → shaped ConsumerResponse
```

## 18. Go / No-Go Recommendation

**GO for Gate G1 — proceed to Phase 4.2.** Every G1 success criterion is met with objective evidence: multi-tenant isolation is production-grade (DB + edge, cross-tenant and cross-jurisdiction reads blocked live), consumers cannot impersonate roles (claim-spoofing = 401), JWT claims/registry are the only source of authorization (query-param identity eliminated), Realtime streams are tenant-safe (RLS-governed), no architectural layer was bypassed, no duplicate state introduced, no workaround added, and all governing documents remain satisfied (ADR-002 records the decision). The enterprise flow, six constitutions, and 115-test regression floor are intact.
