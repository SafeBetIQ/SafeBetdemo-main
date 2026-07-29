# SafeBet IQ — Milestone 4.6 Implementation Report

**Deployed Runtime & Consumer Platform Regression · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: IN-PROCESS composition (deployed-service topology) · Production: UNCHANGED · Federation: OFF by default · Deployment: NOT AUTHORISED.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.7.**

> **HONEST SCOPE:** No real deployment to a managed platform (Elastic Beanstalk / RDS / running Next.js
> app) was performed — none is available in this environment and production must remain untouched. This
> milestone builds and validates the **deployed-runtime COMPOSITION** (the topology a deployed service
> would run) **in-process**, and evidences Consumer Platform non-impact via the **import boundary** + full
> library regression. **C8 is therefore PARTIALLY CLOSED** — a real deployed app + deployed Consumer
> regression + managed infra remain OPEN. No production-readiness claim is made.

## 1. Executive Summary
Built a **deployed-runtime composition root** (`FederationRuntime`) that wires the full Version 2.0 pipeline
— crypto (4.2), SB-NAT Registry + durable regulator-plane persistence (4.1), contribution Event Platform +
projector (4.3), Matching + Decision (3.2/3.3), Correlation (3.5), National Policy (3.6), operator connector
auth (4.4), and the financial Event Platform/Projection/Reconciler (4.5) — with **feature-flag governance**
(federation OFF by default; approved test-tenant + explicit jurisdiction activation; unapproved denial;
emergency shutdown; restart persistence), **health checks** (distinguishing healthy/degraded/unavailable/
disabled/misconfigured), and **safe version metadata** (no secrets). A **deployed smoke harness** drives the
full federation + financial pipelines through the **actual boundaries** end-to-end, plus access-control
regression, restart/recovery, and a rollback simulation — all green. **Consumer Platform non-impact** is
proven by the import boundary (Version 2.0 federation is imported by **no** operator/app/edge path → purely
additive) plus the full library regression (**428 tests**). `tsc` clean. **C8 PARTIALLY CLOSED; C1/C2/C3/C4/
C5 unchanged; C10 CLOSED.**

## 2. Exact C8 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C8 — "Deployed Consumer Platform runtime regression."**
- **Test of satisfaction:** *"Deployed app regression suite + route/contract smoke tests pass with V2 present."*

## 3. Files Added
Under `lib/identityFederation/runtime/`:
- `model.ts` — env classification; `FederationFeatureFlags` (off-by-default; approved test-tenant; jurisdiction activation; emergency shutdown; restart persistence via injected store); health-status types; deployment version metadata.
- `composition.ts` — `FederationRuntime` composition root (wires all Version 2.0 components; `health()`; `version()`; feature-flag governance; correlation/policy factories; `reconstructRegistry()`).
- `smoke.ts` — `DeployedSmokeHarness` (full-pipeline smoke through the actual boundaries).
- `index.ts` — public API.
- `tests/identityFederation.runtime.test.mjs` — 6 tests (incl. Consumer-Platform import-boundary proof).

## 4. Files Modified
- `lib/identityFederation/index.ts` — re-exports the runtime API (additive).
**No operator app path, route, component, API, or certified/prior-milestone component was changed.**

## 5. Justification for Files Changed Outside Deployment/Test Boundaries
| File | Change | Justification |
|---|---|---|
| `index.ts` | additive re-export | single federation public entry point |
**No operator application file, production config, credential, or endpoint was changed.**

## 6. Environment Classification
**`in-process-composition`** — the deployed-service topology assembled and exercised **in-process**. **Not**
a deployed non-production service, **not** production, **not** production-live, **not** real-money, **not**
external-operator. Stated explicitly on every `RuntimeHealth` / `DeploymentVersion` result.

## 7. Production-Isolation Evidence
The composition uses only in-memory/pilot components (no production DB, secrets, IAM, topics, queues,
callbacks, domains, or traffic); grep confirms the federation library (incl. this runtime) imports **no**
production endpoint/credential/env/cloud-SDK and is imported by **no** operator/app/edge path. Production
files are untouched by the Version 2.0 work (the pre-existing `app/` demo edits predate and are unrelated to
federation). Feature flags default OFF.

## 8. Deployment Architecture
Documented in `V2_NON_PRODUCTION_DEPLOYMENT_ARCHITECTURE.md`: the composition root maps 1:1 onto a deployed
Next.js/Node service on the approved non-production platform (Elastic Beanstalk + RDS + Secrets Manager +
CloudWatch + NGINX). This milestone realises the **composition + smoke**; the managed-platform binding is a
deployment activity (residual).

## 9. Deployment Version Evidence
`version()` exposes application version, build id, environment, architecture version, ADR-006, event-schema
versions (contribution/financial/rule-set), projection version, matching/decision/registry/correlation/
national-policy/connector/financial versions, crypto algorithm + canonical-format version, and the
feature-flag snapshot — **no secrets** (tested: no secret/pepper/token in the metadata).

## 10. Feature-Flag Validation
Federation OFF by default; only **approved synthetic test tenants** can be enabled; jurisdiction activation
is explicit; an unapproved tenant is denied; emergency shutdown disables all; state **persists across
restart** (injected store). Production flags are never touched. Tested.

## 11. Health-Check Validation
`health()` reports per component (application, registry, persistence, audit-integrity, event-platform,
projection, financial-projector, connector, feature-flags, correlation, policy, secret-provider) and
**distinguishes `disabled` (federation intentionally off) from `unhealthy`** — correlation/policy read
`disabled` when federation is off, not a failure. Tested.

## 12. Deployment Smoke-Test Results
`DeployedSmokeHarness.run()` → **all steps ok**: startup+health+version; feature-flag governance; **federation
pipeline** (connector→contribution→matching→decision→**SB-NAT registered**); **correlation** (National Player
Twin); **financial pipeline** (session→wager→settle→projection→**GGR 50**→reconciliation balanced);
access-control regression; restart+recovery; rollback simulation. Every step records name/result/detail.

## 13. Consumer Platform Baseline
Baseline = the certified pre-Version-2 Consumer Platform (branch `Demo`). Version 2.0 adds **only**
`lib/identityFederation/` + tests + docs; it modifies **no** route, component, API, or contract. The
operator app (43 page routes, 1 API route, 93 components) is unchanged **by** the federation work.

## 14. Route Inventory Results
See `V2_DEPLOYED_ROUTE_AND_CONTRACT_INVENTORY.md`. Version 2.0 introduces **no** operator/consumer routes and
**no** federation-serving route in operator space; the regulator plane is not wired into any operator route.
**Deployed route smoke tests were not executed** (no deployed app) — residual.

## 15. Contract Compatibility Results
Because the federation library is imported by **no** operator/consumer code (verified), existing route/API
contracts are **structurally unchanged** — no required-field/type/enum/error/status/pagination/date/identity
change, and **no SB-NAT / regulator-metadata / national-policy leakage** into operator contracts is possible.
A **deployed** contract diff was not run (residual).

## 16. UI and Dashboard Regression
Not executed — no deployed app/UI available. The import boundary guarantees Version 2.0 introduces no
UI/dashboard change or federation-data exposure to operator users. Deployed UI regression is a residual.

## 17. Authentication Regression
Not executed against a deployed app. The federation runtime enforces its own regulator/service/operator
access model (tested); deployed application auth/session regression is a residual.

## 18. Operator Access-Control Regression
In the runtime, an **operator is denied** the SB-NAT twin, national correlation, and national financial
aggregate (tested in the smoke). Operators cannot query SB-NAT/candidates/decisions/registry/correlation/
policy/national-financial (structural — operators hold no such handle). Deployed API-level negative tests
are a residual.

## 19. Regulator Access-Control Validation
A regulator is jurisdiction-bound and role-scoped (correlation + policy access model); cross-sovereign and
wrong-role access are denied (tested across 3.5/3.6 + this smoke). The regulator cannot mutate operator
runtime / financial projections / Digital Twins (read-only design).

## 20–23. Existing Event / Projection / Digital Twin / Operator Policy Platform Regression
**Not modified** by Version 2.0 (import boundary). The federation Event/Projection platforms are **separate**
regulator-plane components; the operator Event/Projection/Twin/Policy platforms are untouched. Deployed
regression of those operator platforms is a residual.

## 24. Deployed Connector Validation
The Phase 4.4 connector runs within the composition (activate → source → hash-before-boundary → Event
Platform submission → checkpoint) as part of the smoke. **It remains an in-process component, not an
independently deployed service** — stated plainly (not an external-vendor connector). Deployed-service
connector evidence is a residual (C5).

## 25. Deployed Federation Pipeline Validation
Executed end-to-end through the composition's actual boundaries: synthetic operator source → connector →
HMAC contribution → Event Platform → projection → Matching → Decision → **SB-NAT Registry** → Correlation →
(policy factory ready). Full provenance, tenant + jurisdiction isolation, no operator federation read, no
PII, no direct insertion, restart durability, deterministic results (tested).

## 26. Deployed Financial Pipeline Validation
Executed: session → wager → settlement → projection → reconciliation (GGR 50, balanced) through the
composition — no direct total insertion; integer minor units (tested).

## 27. GGR and Reconciliation Validation
GGR derived from accepted events (50); 4-level reconciliation balanced (via the smoke). No direct insertion.

## 28. Database and Migration Validation
The pilot uses the in-memory/file-backed regulator-plane store (4.1); the pilot-store migration plan validates
(dry-run). **No managed PostgreSQL binding** was used → **C2/C3 remain PARTIALLY CLOSED** (unchanged). No
production target/credentials.

## 29. Native RLS Evidence or Limitation
**Not implemented** — no managed non-production PostgreSQL/RDS available. Application-enforced RLS is not
equivalent to database-native RLS. **C2 remains PARTIALLY CLOSED** (unchanged).

## 30. Database Append-Only Evidence or Limitation
**Not implemented** — no managed DB. Application + SHA-256-chain append-only is not database-permission
immutability. **C3 remains PARTIALLY CLOSED** (unchanged).

## 31. Secret-Store Binding Evidence or Limitation
**Not implemented** — no managed Secrets Manager/HSM binding. **C4 remains PARTIALLY CLOSED** (unchanged). No
production secret access.

## 32. Logging and Leakage Validation
Health/version/smoke outputs carry correlation-safe references only; a serialised scan finds **no** email
PII, **no** secret/pepper/credential/token material, and **no** raw synthetic attribute value (tested).

## 33. Monitoring Foundation
Health checks per component are the monitoring foundation; full pilot monitoring/alarms map to **Phase 4.7**
(per the approved roadmap).

## 34. Runtime Failure Validation
Health distinguishes unavailable/degraded/disabled/misconfigured; the smoke exercises restart, emergency
shutdown (rollback), and fail-closed federation reads. Failures fail safely, preserve evidence, and avoid
corruption/PII leakage.

## 35. Restart and Recovery Validation
Registry **reconstructs from durable persistence** with intact integrity after restart; SB-NAT survives; no
duplicate evidence (tested).

## 36. Rollback Validation
Rollback simulation: emergency shutdown disables federation (correlation reads denied), feature flags off,
production untouched; the (in-process) rollback path is exercised. A managed deployment rollback drill is a
residual (Phase 4.7/deployment).

## 37. Performance Notes (pilot-scale)
Full smoke (federation + financial pipelines + restart) completes in a few ms in-process. Not production/
deployed throughput certification.

## 38. Security Validation
Federation off by default; operator denied SB-NAT/national/financial-national reads; tenant + jurisdiction
isolation; emergency shutdown; no secret/PII in outputs; no production endpoint/credential. Deployed
runtime-attack testing is a residual.

## 39. Privacy Validation
No plaintext PII / raw attribute / secret in health/version/smoke; anonymous references only (tested).

## 40. Milestone Test Results
`identityFederation.runtime` → **6 pass**: deployed smoke (all steps); health/version (disabled≠unhealthy; no
secrets); feature-flag governance (off/approved/shutdown/restart-persistence); restart+recovery;
**Consumer Platform import-boundary non-impact**; no PII/secret leakage.

## 41. Full Regression Results
**428 pass / 0 fail** (422 prior + 6 new). No prior test affected (additive).

## 42. TypeScript Validation
`npx tsc --noEmit` → clean.

## 43. Import-Boundary Validation
Federation (incl. the runtime composition) imported by **no** operator/UI/edge path (grep-verified); the
runtime imports only federation-internal modules — **no** operator-runtime/app/Supabase/cloud-SDK/env import.

## 44. Contract-Comparison Results
Structural: the operator route/API contracts are unchanged because no operator/consumer code imports
federation. A **deployed** contract diff was not executed (residual). No SB-NAT / regulator / national-policy
field can appear in operator contracts.

## 45. Technical Debt Check
**None.** A real non-production deployment was **not** claimed; no production deployment/DB/secrets/traffic;
Consumer Platform routes/contracts structurally unaffected; SB-NAT/national-policy/national-financial not
exposed to operators; federation deny-by-default; no PII/secret leakage; restart + rollback (in-process)
work; no direct financial/federation bypass; no TODO/stub/temporary deploy logic; no weakened tests; no
architecture deviation.

## 46. Risks and Limitations (explicit, mapped)
- **No real deployed app / managed platform** → deployed Consumer regression, route/contract/UI/auth deployed
  smoke, managed RDS/RLS (C2), DB append-only (C3), Secrets Manager/HSM (C4), external connector (C5), and
  deployed federation/financial evidence (C1) all remain OPEN.
- The connector remains an **in-process component**, not a deployed service.

## 47. C8 Closure Assessment → **PARTIALLY CLOSED**
- **Done:** deployed-runtime composition + feature flags + health + version + full-pipeline smoke +
  access-control regression + restart/recovery + rollback simulation; **Consumer Platform non-impact** via
  import boundary + 428-test library regression.
- **Missing (OPEN):** a **real deployed application** + a **deployed Consumer Platform regression suite** +
  deployed route/contract/UI/auth smoke + managed infra.
- **Retest to close:** deploy Version 2.0 to the approved non-production platform and run the deployed app
  regression + route/contract smoke with V2 present.
- **Status: PARTIALLY CLOSED** (per the brief: "Do not close C8 based solely on local or in-process tests.").

## 48. C1 Deployed-Evidence Assessment
The federation + financial pipelines ran **in-process**, not deployed → **no new deployed-runtime evidence**
toward C1's live/deployed residual. **C1 remains PARTIALLY CLOSED** (unchanged).

## 49. C5 Deployed-Evidence Assessment
The connector ran **in-process**, not as a deployed service → **no new deployed-runtime evidence** toward
C5's deployed/external residual. **C5 remains PARTIALLY CLOSED** (unchanged).

## 50. Confirmation of Remaining Condition Status
- **C1** PARTIALLY CLOSED · **C2** PARTIALLY CLOSED · **C3** PARTIALLY CLOSED · **C4** PARTIALLY CLOSED ·
  **C5** PARTIALLY CLOSED · **C8** PARTIALLY CLOSED · **C10** CLOSED. No status closed without the exact
  criteria satisfied.

## 51. Hard-Gate Result (C2-5 / C8, deployed scope)
**PASS WITH CONDITIONS.** No regression was detected: Version 2.0 is additive and imported by no operator/
consumer code (import boundary), and the full **428-test** library regression is green — so existing routes/
contracts/behaviour are architecturally unaffected. **Condition:** a **deployed application regression** with
V2 present (C8 residual). This is **not** a FAIL (no breakage found) — it is a scoped pass pending deployed
evidence.

## 52. Provisional Certification Evidence (no final claim)
Provisional toward **C2-1 Architecture** (additive; import boundary; no bypass), **C2-2 Security** (feature
flags off-by-default, access control, no secret leakage), **C2-5 Consumer Platform Regression** (scoped —
architectural non-impact + library regression). No pilot/production readiness claimed.

## 53. Go / No-Go Recommendation for Phase 4.7
**GO to plan-approve Phase 4.7 (Pilot Operations, Privacy & Legal Readiness)** — the deployed-runtime
composition, feature-flag governance, health/version, full-pipeline smoke, restart/recovery, and rollback
simulation are complete and tested, and Consumer Platform non-impact is evidenced. **C8 remains PARTIALLY
CLOSED** (deployed app + managed infra outstanding); the deployed-app regression should be scheduled when a
non-production deployment target is available (alongside Phase 4.7 operational readiness).

---
**Phase 4.6 Complete — Awaiting Approval for Phase 4.7 Pilot Operations, Privacy and Legal Readiness.**
