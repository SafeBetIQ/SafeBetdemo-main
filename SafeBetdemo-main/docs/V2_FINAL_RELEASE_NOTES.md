# SafeBet IQ — Version 2.0 Final Release Notes

**National Identity Federation & Cross-Operator Intelligence · 2026-07-16 · ADR-006 (Accepted).**
**Status: Enterprise Certification PASS WITH CONDITIONS · Demo branch only · Production UNCHANGED.**

## Overview
Version 2.0 adds a **regulator-plane** national capability that can determine that several
per-operator `SB-PLR` players are the same **anonymous** individual — without exposing plaintext
PII and without breaking tenant isolation — and evaluate national responsible-gambling policy over
that correlation. The operator platform (SB-PLR, Event/Projection/Twin/Policy/Consumer platforms,
UI, APIs) is **unchanged**; the new capability is **additive**, **isolated**, and **off by default**.

## What shipped (domain + demonstration, certified)
- **Identity Matching Engine (3.2)** — deterministic, explainable candidate generation (candidates only).
- **Federation Decision Engine (3.3)** — policy-driven auto/review/reject decisions with review, override, appeal, and immutable audit.
- **SB-NAT Registry (3.4)** — the first authority that creates the anonymous Enterprise Correlation Identity, only from approved decisions; immutable identifiers; split/merge that never modify SB-PLR; historical reconstruction; integrity verification.
- **Enterprise Correlation Layer (3.5)** — regulator-plane, read-only National Player Twin, cross-operator timeline/intelligence, national behaviour analytics, self-exclusion view, investigation services; complete provenance; deny-by-default access.
- **National Policy Platform Extension (3.6)** — declarative policy-as-data; deterministic evaluation into national outcomes; review/override/appeal; conflict detection; policy integrity; nine-part version stamp; role-based access.
- **National Demonstration Dataset v2.0 (3.7)** — deterministic, fully synthetic dataset driving the real pipeline end-to-end across six operators, 14 flagship scenarios + override/appeal, split/merge, and full reconciliation.

## Guarantees (independently certified)
- No fabricated SB-NAT; every national identity is minted through the approved flow.
- No plaintext PII in federation services or outputs; synthetic attributes hashed then discarded.
- Tenant + jurisdiction + sovereign isolation; deny-by-default regulator-plane access; role separation.
- Immutable, append-only decision/registry/policy audit; deterministic + explainable everywhere.
- Additive + isolated: federation imported by no operator/UI/edge path; 354/354 regression; `tsc` clean.

## Certification result
**Version 2.0 Enterprise Certification: PASS WITH CONDITIONS.** Both hard gates pass
(C2-1 Architecture PASS; C2-5 Consumer Platform Regression PASS within library + import-boundary
scope). Certified scope: **domain/architecture implementation** and **isolated demonstration**.

## NOT certified (prominent limitation)
The demonstration used an **isolated, in-memory ledger**. **Live operator-database ingestion,
production Event Platform wagering/GGR integration, durable regulator-plane persistence, production
pepper management, deployed Consumer Platform runtime regression, and production deployment are NOT
certified.** Synthetic GGR reconciliation is **not** live Event Platform reconciliation. See
`V2_ENTERPRISE_CERTIFICATION_REPORT.md` §3/§24 and `V2_CERTIFICATION_RISK_AND_CONDITIONS.md`.

## Readiness decisions
- Domain implementation — **APPROVED**
- Isolated demonstration — **APPROVED**
- Supervised regulator demonstration — **APPROVED WITH CONDITIONS** (regulator legal/privacy approval; synthetic data only)
- Controlled pilot — **NOT APPROVED**
- Production deployment — **NOT APPROVED**

## Known items
- **CERT-L1 (LOW):** registry internal state uses TypeScript `private` (compile-time) at the current
  build target; production hardening should enforce runtime-private state. No approved path fabricates an SB-NAT.
- Production conditions C1–C10 tracked in the risk & conditions register.

## Operational notes
Federation is off by default and per-jurisdiction opt-in. The demonstration dataset is deterministic
and reset/reseed-safe (in-memory, no external writes). All work remains on the Demo branch; production
is untouched; deployment is not authorised by this certification.

---

## Addendum — Phase 4.1 (Pilot Persistence & Regulator-Plane Security · 2026-07-16)
Post-certification pilot-readiness work (non-production, no deployment authorised):
- **Added:** durable, pilot-only regulator-plane persistence (`RegulatorPlaneStore` + file-backed
  append-only backend); application-enforced deny-by-default RLS; SHA-256 hash-chained append-only
  audit with tamper detection; durable SB-NAT Registry persistence + restart/recovery reconstruction;
  backup foundation; pilot-store migration validation.
- **Hardened:** SB-NAT Registry internal state is now **runtime-private** (module-closure encapsulation)
  — **CERT-L1 / condition C10 CLOSED**; no global TypeScript target change.
- **Condition status:** C10 **CLOSED**; C2 (durable DB + RLS) and C3 (append-only audit) **PARTIALLY
  CLOSED** — native Postgres RLS on a managed RDS and DB-permission WORM immutability are documented
  deployment bindings; C6 backup/restore has a tested foundation (full drill at Phase 4.7).
- **Compatibility:** domain behaviour unchanged; **375/375** tests pass; `tsc` clean; federation still
  imported by no operator/UI/edge path; no production credentials/endpoints; no plaintext PII.
- **Still not authorised:** controlled pilot and production deployment remain NOT approved.
See `V2_MILESTONE_4.1_PERSISTENCE_SECURITY_REPORT.md` and `V2_PHASE_4_CONDITION_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.2 (Pepper & Cryptographic Operations · 2026-07-16)
Post-certification pilot-readiness work (non-production, no deployment authorised):
- **Added:** narrow **HMAC-SHA-256** federation crypto provider over a **versioned collision-safe
  canonical input** (`cf-1`, length-prefixed + NFC); **jurisdiction-isolated peppers** with governed
  lifecycle + **dual-version rotation** (versioned continuity; old≠new); non-production pilot secret store
  (raw peppers in a non-exported module WeakMap — never exposed); **bounded caching**; **fail-closed**
  behaviour (no unkeyed/demo/global fallback); **compromise response**; **least-privilege** operator
  roles; **secret-free append-only crypto audit**.
- **Condition status:** C4 (HSM/Secrets Manager pepper + rotation) **PARTIALLY CLOSED** — provider,
  rotation, recovery, compromise, fail-closed and versioned continuity implemented + tested; the managed
  AWS Secrets Manager/HSM binding + KMS at-rest is the OPEN deployment residual. C2/C3 **PARTIALLY
  CLOSED, unchanged**; C10 **CLOSED**.
- **Security note (CRYPTO-F1, fixed in-milestone):** a runtime-reachable `store.raw()` returning the raw
  pepper map was closed via a non-exported module accessor.
- **Compatibility:** certified `security.ts`/matching/decision untouched; **390/390** tests pass; `tsc`
  clean; crypto imports only `node:crypto` + internal modules; no production secrets/endpoints; no
  plaintext PII or secret in any output.
See `V2_MILESTONE_4.2_CRYPTOGRAPHIC_OPERATIONS_REPORT.md` and `V2_PHASE_4_CONDITION_C4_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.3 (Operator Contribution & Event Platform Wiring · 2026-07-16)
Post-certification pilot-readiness work (non-production, no deployment authorised):
- **Added:** hash-only **federation contribution path** (`IDENTITY_FEDERATION_ATTRIBUTE`) through a
  certified **(non-production) Event Platform boundary** — full validation pipeline (schema →
  auth/attribution → jurisdiction → SB-PLR → attribute policy → crypto version → idempotency → replay →
  sequence → PII → persistence → audit), append-only accepted records, revocation/expiry, dead-letter +
  bounded retry, deny-by-default access, a deterministic **projector** into the certified Matching
  Engine (version-segregated, provenance-preserving), and a test/sandbox-only **synthetic operator
  harness**. Verified **end-to-end** through the real boundaries (contribution → matching → decision →
  SB-NAT).
- **Condition status:** C1 (contribution & Event-Platform wiring portion) **PARTIALLY CLOSED** — the live
  operator connector (4.4) and live wager/GGR reconciliation (4.5) remain OPEN. C2/C3/C4 **PARTIALLY
  CLOSED, unchanged**; C10 **CLOSED**.
- **Compatibility:** certified matching/decision/registry/crypto untouched; Event Platform authoritative
  with **no downstream insertion bypass**; **400/400** tests pass; `tsc` clean; contribution layer imports
  only crypto/types/profiles; no production credentials/endpoints; no plaintext PII crosses the boundary.
See `V2_MILESTONE_4.3_OPERATOR_CONTRIBUTION_REPORT.md` and `V2_PHASE_4_C1_CONTRIBUTION_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.4 (Live Operator Connector Sandbox · 2026-07-16)
Post-certification pilot-readiness work (non-production, no deployment authorised):
- **Added:** one controlled, vendor-neutral **operator connector** for a non-production sandbox — bound
  authentication (one operator/tenant/jurisdiction), synthetic source read, SB-PLR resolution,
  **hash-before-boundary** (4.2), submission through the certified Event Platform (4.3); full lifecycle,
  durable checkpoint + restart, idempotency/sequencing, rate limit + backpressure (circuit), retry +
  dead-letter (no payload), suspension + revocation, source corrections, health, reconciliation, and proven
  **multi-operator tenant isolation**. Verified **end-to-end** (two connectors → one certified matching
  candidate). The connector is **write-only w.r.t. federation** and cannot read federation data.
- **Condition status:** C5 (live operator connector validation) **PARTIALLY CLOSED** — connector implemented
  + integration-tested vs a controlled in-process sandbox (hash-only ingestion + isolation negatives pass);
  **external-vendor + deployed-runtime evidence OPEN**. C1/C2/C3/C4 **PARTIALLY CLOSED, unchanged**; C10 **CLOSED**.
- **Compatibility:** certified + prior-milestone components untouched; **411/411** tests pass; `tsc` clean;
  connector imports only contribution/crypto/types/profiles (no federation-read handle); no production
  casino/credential/endpoint; no plaintext PII into SafeBet IQ.
See `V2_MILESTONE_4.4_OPERATOR_CONNECTOR_SANDBOX_REPORT.md` and `V2_PHASE_4_C5_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.5 (Wagering & GGR Reconciliation · sandbox/pilot-path · 2026-07-16)
Post-certification pilot-readiness work (non-production, in-process, no deployment authorised):
- **Added:** the **sandbox / pilot-path** wagering + GGR pipeline — an authoritative, certified-boundary-
  shaped financial **Event Platform** (session/wager/settlement/void/refund/correction integrity, integer-
  minor-unit money with **no floating-point**, currency + precision, idempotency/replay, deny-by-default),
  a deterministic **Projection Platform** (GGR derived by replaying accepted events; rebuildable; **no direct
  total insertion**), and a **four-level reconciliation + integrity verifier** (source→connector→Event
  Platform→projection→operator→national) with the reconciliation equation and full provenance. Tenant
  isolation (operators read own tenant; national regulator-only); no PII.
- **Condition status:** C1 (wagering/GGR + operator↔national reconciliation portion) **PARTIALLY CLOSED** —
  proven on an **in-process sandbox**; **external-operator, deployed-runtime, and production-live evidence
  OPEN** (single-currency ZAR; bonuses excluded). C2/C3/C4/C5 **PARTIALLY CLOSED, unchanged**; C10 **CLOSED**.
- **Compatibility:** certified + prior-milestone components untouched; **422/422** tests pass; `tsc` clean;
  financial layer imports only `../types` + internal (no operator-runtime; no direct downstream insertion);
  no production casino/credential/endpoint; no plaintext PII; no float money.
See `V2_MILESTONE_4.5_WAGERING_GGR_RECONCILIATION_REPORT.md` and `V2_PHASE_4_C1_GGR_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.6 (Deployed Runtime & Consumer Platform Regression · in-process · 2026-07-16)
Post-certification pilot-readiness work (non-production, **in-process composition**, no deployment authorised):
- **Added:** a **deployed-runtime composition root** (`FederationRuntime`) wiring the full Version 2.0 pipeline
  (crypto → registry/persistence → contribution/event platform → matching → decision → SB-NAT registry →
  correlation → national policy → connector auth → financial platform/projection/reconciler) with
  **feature-flag governance** (federation OFF by default; approved synthetic test-tenant + explicit
  jurisdiction activation; unapproved denial; emergency shutdown; restart persistence), **health checks**
  (distinguishing healthy/degraded/unavailable/misconfigured/**disabled**), **safe version metadata** (no
  secrets), and a **deployed smoke harness** driving federation + financial pipelines through the actual
  boundaries plus access-control, restart/recovery, and rollback simulation — all green (SB-NAT minted;
  GGR 50 balanced).
- **Consumer Platform hard gate:** **PASS WITH CONDITIONS** — Version 2.0 is imported by **no** operator/app/
  edge path (0 offenders across 43 pages / 1 API route / 93 components) so existing routes/contracts are
  architecturally unaffected, and the full **428/428** library regression is green. **Condition:** a
  **deployed application regression** with V2 present (not executed — no deployed target).
- **Condition status:** **C8 PARTIALLY CLOSED** — deployed-runtime composition + full-pipeline validation done;
  real deployed app + deployed Consumer regression + managed infra (RDS/RLS, WORM, Secrets Manager, CloudWatch)
  **OPEN**. **C1 & C5** — pipelines/connector ran **in-process**, **no new deployed evidence** → remain
  **PARTIALLY CLOSED**. C2/C3/C4 **PARTIALLY CLOSED, unchanged**; **C10 CLOSED**. Environment classified
  **`in-process-composition`** — not a real deployment; no production/pilot-live claim.
- **Compatibility:** certified + prior-milestone components untouched; **428/428** tests pass; `tsc` clean;
  runtime imports only federation-internal modules (no operator-runtime/app/Supabase/cloud-SDK); no production
  endpoint/credential; no plaintext PII/secret in health/version/smoke.
See `V2_MILESTONE_4.6_DEPLOYED_RUNTIME_REGRESSION_REPORT.md` and `V2_PHASE_4_C8_CLOSURE_EVIDENCE.md`.

## Addendum — Phase 4.6B (Actual Non-Production Deployment · local independent process · 2026-07-16)
Corrective completion gate for 4.6 (non-production, no managed deployment authorised/available):
- **Deployed (genuine):** the Consumer Platform was built fresh **with V2 present** (`next build` exit 0) and
  run as a **real independent Next.js production process** (PID 24452, "Ready in 496ms", `127.0.0.1:3123`) —
  not a class/test process. Driven over HTTP: `/api/health` → **200**; **43/43** page routes → **200**,
  **0 × 5xx**; **0** federation/PII/secret leakage; **0** federation HTTP surface (5 federation probe routes →
  **404**). Full library regression **428**; `tsc` clean; federation imported by **0** app files.
- **NOT achieved (reported, not glossed):** managed cloud deployment (AWS session invalid —
  `InvalidClientTokenId`; no approved EB env); managed infra (RDS/native-RLS C2, DB WORM C3, Secrets
  Manager/HSM C4, CloudWatch); deployed **server-side** auth/operator/regulator isolation (app gates
  client-side; static shells return 200); deployed federation/connector/financial pipelines (no HTTP surface by
  frozen design — correctly not exposed).
- **Consumer Platform hard gate:** **PASS WITH CONDITIONS** (deployed HTTP tests actually ran; no regression;
  conditions = managed deployment + deployed server-side isolation).
- **Condition status:** **C8 PARTIALLY CLOSED** (advanced with deployed independent-process evidence, not
  closed). **C1 & C5** — no deployed evidence (no HTTP surface / no managed runtime) → remain **PARTIALLY
  CLOSED**. C2/C3/C4 **PARTIALLY CLOSED, unchanged**; **C10 CLOSED**.
- **Environment:** classified **`local-independent-process`** — a genuine independent process, but **not** a
  managed cloud deployment and **not** production. Production untouched; demo Supabase only.
- **Outcome:** *Phase 4.6 Remains Partially Complete — Actual Non-Production Deployment Evidence Still Required.*
See `V2_MILESTONE_4.6B_ACTUAL_DEPLOYMENT_REPORT.md`, `V2_NON_PRODUCTION_DEPLOYMENT_EVIDENCE.md`,
`V2_DEPLOYED_HTTP_ROUTE_RESULTS.md`, `V2_DEPLOYED_CONSUMER_HARD_GATE.md`.
