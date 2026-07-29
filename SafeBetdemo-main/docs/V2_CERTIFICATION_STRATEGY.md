# SafeBet IQ — Version 2 Certification Strategy (National Identity Federation)

**Status: PROPOSED — Phase 1/2 documentation. Certifications execute in Phase 3 after ADR-006 is Accepted. No implementation exists yet.**

Every certification below must pass **before** the National Intelligence Plane is enabled in any real jurisdiction. Each mirrors an existing certified gate so v2.0 meets the same bar as the certified platform.

| # | Certification | Scope | Pass criteria (evidence) | Analogue |
|---|---|---|---|---|
| C2-1 | **Architecture** | NIP fits the certified flow additively | `SB-PLR`/Event/Projection/Twin/Intelligence/Policy/Consumer unchanged (byte-identical); NIP fed only by hashed-attribute events + reads by reference; boundary tests prove no operator mutation; §1–§9 satisfied | Architecture Review Board |
| C2-2 | **Security** | New surface (submit + regulator reads + pepper) | STRIDE mitigations verified live: operator→federation 403, anon→401, cross-jurisdiction→403, pepper never client-exposed, `federation_audit` append-only; penetration test of submit + regulator-read paths passes | CPR-1 / ADR-002 |
| C2-3 | **Privacy** | No PII; regulator-only; explainable; reversible | DPIA signed per jurisdiction; grep/schema proof of zero PII columns; every national read audited; erasure + disable/rollback rehearsed | PIA / §8 |
| C2-4 | **Cross-Operator Intelligence** | Correctness of federation + national views | Deterministic matcher unit tests (Confirmed/Probable/Possible/Rejected); `SB-NAT` clusters reconcile to their `SB-PLR`s; national twin aggregates = underlying per-casino projections; explainability record present on every link | UDC-1 / new |
| C2-5 | **Consumer Platform Regression** | Operator experience unchanged | Full existing suite green (225+); operator dashboards/reports/regulator aggregate views identical; no operator view learns `SB-NAT`; live reconciliation unchanged | UDC-1 / CPR-1 |
| C2-6 | **Operational Readiness** | Run/monitor/recover the NIP | Pepper provision + versioned rotation runbook; enable/disable per jurisdiction; national projection rebuild deterministic; monitoring (match rate, confidence dist, override/appeal); DR drill on the regulator plane | ORR-1/1A |
| C2-7 | **Regulator Acceptance** | Fitness for the regulator's mandate | A regulator can answer the five national RG questions with explainable, auditable, anonymous evidence; merge/split/override/appeal workflow usable; jurisdiction profile configurable without a deploy | new (flagship) |

**Governance:** each certification produces a dated report in `docs/`; ADR-006 references the passing evidence; a failing gate blocks enablement. Consumer Platform Regression (C2-5) and Architecture (C2-1) are **hard gates** — any operator-facing change or architecture drift fails v2.0 outright. Regulator Acceptance (C2-7) is per jurisdiction.

## Component → certification mapping (Phase 2.1 freeze)
Every frozen component maps to the certifications that gate it:
| Component | Certifications |
|---|---|
| **Identity Matching Engine** (deterministic candidates) | C2-1 Architecture · C2-2 Security · C2-3 Privacy |
| **Federation Decision Engine** (governed decisions) | C2-4 Explainability (Cross-Operator Intelligence) · Audit (within C2-3/C2-6) · C2-7 Regulator Acceptance |
| **SB-NAT Registry** (correlation ids + immutable version stamp) | C2-2 Security · C2-6 Operational Readiness |
| **Enterprise Correlation Layer** (read-only correlation/aggregation) | C2-4 Cross-Operator Intelligence · C2-5 Consumer Platform Regression |
A component may not ship until its mapped certifications pass; a change to a component re-runs its mapped certifications.
