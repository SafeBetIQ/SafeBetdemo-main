# SafeBet IQ — Milestone 4.6B Report

**Actual Non-Production Deployment & Deployed Regression · Corrective Completion Gate for 4.6 · 2026-07-16.**
**ADR-006 ACCEPTED (frozen). Production: UNCHANGED. Federation: OFF by default.**

> **HONEST OUTCOME UP FRONT.** A **genuine independent application process** (Next.js production server,
> not a class or test process) was deployed and driven over **real HTTP**, and the Consumer Platform passed a
> deployed route + leakage + federation-surface smoke with V2 present. **However, a managed non-production
> cloud deployment (Elastic Beanstalk / RDS / Secrets Manager / CloudWatch) was NOT executed** — the only
> configured AWS credentials are **invalid** (`InvalidClientTokenId`), no approved Elastic Beanstalk
> environment is configured, deployment is owner-executed, and production must not be touched. Deployed
> **server-side** auth/operator-isolation was **not proven** (the app gates client-side; static shells return
> 200), and the federation/connector/financial pipelines have **no HTTP surface by frozen design** (the
> isolation invariant), so they cannot be exercised "over deployed boundaries" without a forbidden
> architecture change. **C8 therefore remains PARTIALLY CLOSED**, and Phase 4.6 remains partially complete for
> the managed-deployment portion.

## 1. Executive Summary
Established what deployment is genuinely executable here, then executed the strongest honest option: a **real,
independent Next.js production process** (`next start`, PID 24452, "Ready in 496ms", serving HTTP on
`127.0.0.1:3123`) built fresh from branch `Demo` **with the Version 2.0 federation library present in the
tree**. Drove it over HTTP: `/api/health` → **200** `{"status":"ok","service":"safebet-iq"}`; **43/43**
Consumer Platform routes served with **0 × 5xx**; **0** federation/PII/secret leakage across every response;
and **all 5** federation probe routes (`/api/federation`, `/api/sb-nat`, `/federation`,
`/regulator/federation`, `/api/national-policy`) → **404**, proving no federation HTTP surface exists.
`tsc` clean; federation imported by **0** operator/app/edge files; full library regression **428**. What was
**not** achievable — a managed cloud deployment, managed infra (RDS/native-RLS, WORM, Secrets Manager/HSM,
CloudWatch), deployed server-side auth/isolation, and deployed federation/connector/financial pipelines — is
reported as OPEN, not glossed over. **Consumer Platform hard gate: PASS WITH CONDITIONS** (deployed HTTP tests
actually ran; no regression). **C8 PARTIALLY CLOSED; C1/C5 no new deployed evidence; C2/C3/C4 unchanged;
C10 CLOSED.**

## 2. Phase 4.6A Evidence Retained (not overwritten)
4.6A (in-process runtime composition) stands unchanged: `FederationRuntime` composition, feature-flag
governance, health/version models, in-process full-pipeline smoke (SB-NAT minted; GGR 50 balanced), registry
reconstruction, operator denial of national reads, 428 tests, clean `tsc`, import-boundary non-impact. This
report adds **deployed independent-process** evidence for the Consumer Platform layer only; it does not
restate 4.6A in-process evidence as deployed evidence.

## 3. Exact C8 Wording
- **C8 — "Deployed Consumer Platform runtime regression."**
- **Test of satisfaction:** *"Deployed app regression suite + route/contract smoke tests pass with V2 present."*

## 4. Environment Classification
**`local-independent-process` (non-production, synthetic).** A real OS process running the Next.js 13.5.1
production server, independent of the test runner, reachable over HTTP. **Not** a managed cloud deployment,
**not** `deployed-non-production` on Elastic Beanstalk, **not** production. Classified this way on every
statement below.

## 5. Deployment Identifier
- Process: Next.js production server via `node ./node_modules/next/dist/bin/next start -p 3123`, **PID 24452**.
- Build: fresh `next build` (exit 0) from branch `Demo` with `lib/identityFederation/` present.
- Startup: **"Ready in 496ms"**; served until SIGTERM/SIGKILL by the harness.

## 6. Deployment URL
`http://127.0.0.1:3123` (loopback, local, non-production). No public/managed URL — none was provisioned.

## 7. Runtime Platform
Node.js v24.14.1, Next.js 13.5.1 production server (`next start`), Windows. `.env.local` bound to the **demo**
Supabase project `uexdjngogzunjxkpxwll` (anon key public/safe) — **not** production `ilibvipqbkugqkppzdmh`.

## 8. Production-Isolation Evidence
- **AWS:** `aws sts get-caller-identity` → **`InvalidClientTokenId`** — no valid AWS session; a cloud
  deployment to any account/region was **not possible**, so no production EB/RDS/Secrets Manager/IAM/DNS could
  be touched.
- **Supabase:** target ref `uexdjngogzunjxkpxwll` (demo); production `ilibvipqbkugqkppzdmh` string absent from
  `.env.local`.
- **Network:** loopback only; no public traffic, no managed endpoint.
- **Data:** synthetic/demo only; no real operator or player data.
- **Import boundary:** federation imported by 0 operator/app/edge files.

## 9. Application-Version Evidence
`next build` succeeded (exit 0) producing the route manifest (42 static pages + `/api/health` server route +
`/casino/players/[id]/investigate` server-rendered λ). `/api/health` returns `service: "safebet-iq"` with a
runtime timestamp — served by the running process, not the test runner.

## 10. Health-Endpoint Results
| Endpoint | Method | Status | Latency | Body |
|---|---|---|---|---|
| `/api/health` | GET (HTTP) | **200** | 13 ms | `{"status":"ok","service":"safebet-iq","ts":"…Z"}` |

Liveness only (by design — the endpoint does no data access). **Limitation:** deep per-component health
(Event/Projection/persistence/registry/connector/financial/correlation/policy) is **not** exposed over HTTP —
those components have no HTTP surface (they live in the isolated federation library). Deep health remains an
in-process concern (4.6A) and a managed-deployment residual.

## 11. Feature-Flag Results
Federation is OFF by default and has **no** HTTP toggle surface in the deployed app (correctly — flags are a
federation-library concern, not an operator route). No federation flag could be, or was, activated over HTTP.
In-process feature-flag governance (approved-tenant-only, jurisdiction activation, emergency shutdown, restart
persistence) remains as validated in 4.6A. Deployed managed-runtime flag validation is a residual.

## 12. Deployed Smoke Results
Independent-process smoke (PID 24452): server reached readiness over HTTP; `/api/health` 200; 43 routes
probed; **0** failures to serve; **0** leakage; **0** federation surface. Full artefact:
`V2_NON_PRODUCTION_DEPLOYMENT_EVIDENCE.md`.

## 13. Deployed Route Results
**43/43 page routes → HTTP 200**, latencies 21–151 ms; `/api/health` → 200. Full table:
`V2_DEPLOYED_HTTP_ROUTE_RESULTS.md`. **Honest caveat:** most routes are statically-rendered (`○`) shells that
enforce role/auth **client-side**, so a 200 proves the shell serves — it does **not** prove server-side
authorisation. See §15/§17.

## 14. Contract-Comparison Results
Deployed responses match the baseline structurally: HTML shells for pages, `application/json` for
`/api/health` with the expected `{status, service, ts}` contract. **No** SB-NAT / national-twin /
national-policy / national-GGR / cross-operator field appears in any response (leakage scan clean). No
required-field/type/enum/status change observed. Full: `V2_DEPLOYED_CONTRACT_COMPARISON.md`. Caveat: only
routes that render without a live session were compared at the HTTP layer.

## 15. Authentication Results
**Not proven at the server (HTTP) layer.** The app authenticates/authorises **client-side**; server-side the
role-gated shells return 200. Genuine deployed auth negative tests (401/403, expired/revoked session,
role/tenant/jurisdiction switch over HTTP) were therefore **not** satisfiable against this build and remain
OPEN. This is reported as a limitation, not a pass.

## 16. Consumer Platform Regression
Deployed HTTP regression **ran** against a real process: 43/43 routes served, 0 × 5xx, 0 leakage, 0 federation
surface, health 200. No regression detected. **Result: PASS WITH CONDITIONS** — conditions are (a) a managed
cloud deployment and (b) deployed server-side auth/isolation coverage. Full: `V2_DEPLOYED_CONSUMER_HARD_GATE.md`.

## 17. Operator Access-Control Results
**Structural (strong):** operators cannot reach SB-NAT/candidates/decisions/registry/correlation/policy/
national-GGR — those have **no HTTP route** (all 5 federation probe routes → 404) and the federation library
is imported by no operator path. **Server-side per-route** operator-vs-regulator enforcement was **not**
proven over HTTP (client-side gating). So: federation non-exposure = proven; deployed server-side isolation =
OPEN.

## 18. Regulator Access-Control Results
Regulator routes (`/regulator/*`) serve their shells (200); regulator-scoped data access + jurisdiction
binding is enforced by the federation correlation/policy layer (validated in-process, 3.5/3.6/4.6A) which has
no HTTP surface here. Deployed server-side regulator-jurisdiction negatives remain OPEN.

## 19. Connector Deployment Results
**Not achieved.** The Phase 4.4 connector was **not** run as an independently deployed service — it has no
HTTP/worker deployment here, and no managed runtime was available. It remains an **in-process component**
(4.6A). **C5 gains no deployed evidence.** Full: `V2_DEPLOYED_CONNECTOR_EVIDENCE.md`.

## 20. Federation Pipeline Results
**Not achieved over deployed boundaries.** The federation pipeline has **no HTTP surface by frozen design**
(isolation invariant; all federation probe routes → 404). Exercising it "over deployed boundaries" would
require wiring federation into an operator/HTTP route — a **forbidden** architecture change. It remains
validated **in-process** (4.6A). Full: `V2_DEPLOYED_FEDERATION_EVIDENCE.md`.

## 21. Financial Pipeline Results
**Not achieved over deployed boundaries** — same reason as §20 (no HTTP surface). Validated in-process (4.6A:
GGR 50, balanced). Full: `V2_DEPLOYED_FINANCIAL_EVIDENCE.md`.

## 22. GGR Reconciliation Results
No **deployed** GGR reconciliation (no HTTP/managed financial surface). In-process result unchanged (GGR 50,
4-level balanced, 4.6A). **C1 gains no deployed evidence.**

## 23. Database Binding Evidence or Limitation
**Limitation.** No approved managed non-production PostgreSQL/RDS was available (no valid AWS session). The
regulator-plane store remains the 4.1 in-memory/file backend. **No managed DB binding evidence.**

## 24. Native RLS Evidence or Limitation
**Limitation.** Native PostgreSQL RLS not implemented — no managed DB. **C2 remains PARTIALLY CLOSED.**

## 25. Database Append-Only Evidence or Limitation
**Limitation.** DB-permission WORM not implemented — no managed DB. Application + SHA-256 chain only (4.1).
**C3 remains PARTIALLY CLOSED.**

## 26. Managed Secret-Store Evidence or Limitation
**Limitation.** No AWS Secrets Manager/HSM/KMS binding (no valid AWS session). The 4.2 provider remains the
in-memory pilot secret store. A local WeakMap is **not** managed-secret-store evidence. **C4 remains PARTIALLY
CLOSED.**

## 27. Runtime Logging Results
Server log captured: `▲ Next.js 13.5.1 / - Local: http://localhost:3123 / ✓ Ready in 496ms`. No PII/secret/
raw-attribute/token in the captured server output or in any HTTP response (leakage scan clean). No managed
log aggregation (CloudWatch) — residual.

## 28. Monitoring Results
No managed monitoring (CloudWatch) — no valid AWS session. Liveness endpoint + process readiness are the only
deployed signals here. Managed metrics/alarms map to Phase 4.7. Residual.

## 29. Process-Restart Results
An **actual two-cycle restart** was executed on the deployed Consumer Platform process: cycle 1 (**PID 1396**,
"Ready in 668ms", `/api/health` 200 + `/`,`/login`,`/casino/dashboard`,`/regulator/dashboard` all 200) →
SIGTERM/SIGKILL → cycle 2 (**PID 19736**, "Ready in 415ms", same probes all 200). **Distinct PIDs** prove a
genuine new process (not a reused in-memory object); **both cycles recovered** over HTTP. **Limitation:** this
is application-process restart for the Consumer Platform layer — **not** a managed-runtime (EB) restart, and it
does not exercise federation-state restart (registry reconstruction, connector checkpoint), which has no HTTP
surface and was validated in-process (4.6A). Managed-runtime restart remains a residual. See
`V2_DEPLOYED_RESTART_AND_ROLLBACK.md` §1a.

## 30. Deployment-Rollback Results
**Not achieved.** A managed deployment rollback (redeploy prior artifact + managed DB/secret failover) was not
possible without a managed environment. The additive, import-isolated design means an app rollback reverts
only `lib/identityFederation/` behaviour with no operator route/contract/schema to revert — but this was
**not** executed as a deployed drill. Residual. Full: `V2_DEPLOYED_RESTART_AND_ROLLBACK.md`.

## 31. Failure-Injection Results
Controlled, non-destructive: server termination (SIGTERM/SIGKILL) handled cleanly; non-existent federation
routes fail closed with 404. Managed-infra failure injection (DB unavailability, secret-provider failure) was
not possible without managed infra. Residual.

## 32. PII Leakage Results
**Clean.** Every HTTP response (43 pages + health) scanned for email PII and raw attributes → **0** hits.

## 33. Secret Leakage Results
**Clean.** Responses + captured server log scanned for pepper/service-role/token/credential markers →
**0** hits. `service_role` key never appears in any client-facing response.

## 34. Full Regression Results
`node --test "tests/**/*.test.mjs"` → **428 pass / 0 fail** (unchanged from 4.6A — no test/source files changed
in 4.6B; 4.6B added only a scratchpad HTTP-smoke harness + documentation).

## 35. TypeScript Validation
`npx tsc --noEmit` → **clean** (exit 0).

## 36. Import-Boundary Validation
Federation imported by **0** files across `app`/`components`/`pages`/`src`/`supabase/functions`. Confirmed
independently by the 404 on all federation probe routes on the live server.

## 37. Technical Debt Check
**None.** No business logic changed to force a pass; no test weakened; no architecture deviation; no forbidden
federation HTTP surface added; no production touched; no managed-deployment claim made without a managed
deployment; every limitation stated explicitly.

## 38. C8 Closure Assessment → **PARTIALLY CLOSED**
- **New deployed evidence (genuine):** the Consumer Platform builds and runs as a **real independent HTTP
  process** with V2 present; 43/43 routes served; 0 × 5xx; 0 leakage; 0 federation surface; health 200.
- **Still OPEN:** managed cloud deployment; managed infra (RDS/native-RLS, WORM, Secrets Manager/HSM,
  CloudWatch); deployed **server-side** auth/operator/regulator isolation; deployed federation/connector/
  financial pipelines (the last three are architecturally out of HTTP scope by the frozen isolation design).
- The brief's C8 standard requires a real non-production **application deployment** with deployed Consumer +
  route/contract tests passing, restart, rollback, and production isolation. Production isolation, a genuine
  independent deployed process, deployed route/contract smoke, and no-regression are met; **managed deployment,
  restart-as-managed-runtime, rollback, and server-side isolation are not** → **PARTIALLY CLOSED** (advanced
  beyond 4.6A, not closed).

## 39. Consumer Hard-Gate Result → **PASS WITH CONDITIONS**
Deployed HTTP tests **actually ran** against a real independent process and found **no regression** (43/43
served, no 5xx, no leakage, no federation exposure). Conditions (limited, testable): (a) managed cloud
deployment; (b) deployed server-side auth/operator/regulator isolation coverage. Not a FAIL; not an
unconditional deployed PASS (no managed deployment).

## 40. C1 Updated Assessment
No **deployed** Event-Platform/financial/GGR execution occurred (no HTTP surface; no managed runtime). **C1
remains PARTIALLY CLOSED** — no new deployed evidence.

## 41. C5 Updated Assessment
The connector was **not** deployed as an independent service. **C5 remains PARTIALLY CLOSED** — no new deployed
evidence.

## 42. Remaining Condition Status
- **C1** PARTIALLY CLOSED · **C2** PARTIALLY CLOSED · **C3** PARTIALLY CLOSED · **C4** PARTIALLY CLOSED ·
  **C5** PARTIALLY CLOSED · **C8** PARTIALLY CLOSED · **C10** CLOSED. No condition closed on in-process
  evidence; no condition closed without its exact criteria met.

## 43. Risks and Limitations
- No valid AWS session → managed non-production cloud deployment and all managed-infra evidence (C2/C3/C4,
  CloudWatch) **unobtainable** in this environment.
- Federation/connector/financial have **no HTTP surface by frozen design** → cannot be exercised over deployed
  boundaries without a forbidden architecture change (correctly not attempted).
- App gates **client-side** → deployed server-side auth/isolation not provable against this build.
- Local loopback runtime is genuine but **not** a managed cloud deployment; it must not be over-credited.

## 44. Go / No-Go Recommendation for Phase 4.7
**NO-GO to close Phase 4.6; GO to schedule the managed deployment as a discrete owner-executed activity.**
The genuine deployed evidence obtained (independent-process Consumer Platform, no regression, no federation
exposure) advances C8 but does not close it. Full closure needs an authorised managed non-production
environment (valid AWS session + approved EB/RDS/Secrets Manager) and a deployed server-side isolation suite.
Phase 4.7 remains **NOT AUTHORISED** until Phase 4.6 is fully closed.

---
**Phase 4.6 Remains Partially Complete — Actual Non-Production Deployment Evidence Still Required.**
