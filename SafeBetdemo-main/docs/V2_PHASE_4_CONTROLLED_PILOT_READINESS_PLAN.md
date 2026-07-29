# Version 2.0 — Phase 4 Controlled Pilot Readiness Plan (Master)

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Controlled Pilot: NOT APPROVED · Production: NOT APPROVED · Production environment MUST remain UNCHANGED.**

Master plan for the Phase 4 controlled-pilot-integration and readiness programme. This is a
documentation deliverable — **no implementation code, migrations, infrastructure, connectors, or
secrets are created in Phase 4.0.** Companion documents: Condition Register, Milestone Roadmap,
Dependency Map, Pilot Acceptance Gates, Risk Register, Live Integration Plan, Security & Key-
Management Plan, Privacy & Legal Readiness Plan, Operational Readiness Plan.

## 1. Executive Summary
SafeBet IQ Version 2.0 completed all Phase 3 milestones and was certified **PASS WITH CONDITIONS**
for the **domain implementation** and **isolated demonstration** scopes. Live operator integration,
durable persistence, production cryptographic key management, deployed-runtime regression, pilot
operations, and production deployment are **not** certified and are tracked as conditions **C1–C10**.
Phase 4 is authorised as a controlled pilot-integration and readiness programme; Phase 4.0 produces
the plan and **stops for review** before any implementation. The plan maps every condition to
implementation, evidence, and testing across eight stage-gated milestones (4.1–4.8), each ending in
a mandatory review, and reserves production deployment behind a separate, explicit authorisation.

## 2. Current Certification Status
- **Verdict:** Version 2.0 Enterprise Certification — **PASS WITH CONDITIONS**.
- **Certified:** domain implementation; isolated demonstration; supervised regulator demonstration (with C7).
- **Not certified / prohibited:** controlled pilot, production deployment, live operator integration, production Event Platform integration, production federation activation.
- **Open conditions:** C1–C10 (all OPEN; see Condition Register).
- **Hard gates carried forward:** C2-1 Architecture and C2-5 Consumer Platform Regression (deployed scope via C8).

## 3. Architecture Compliance Statement
ADR-006 remains authoritative and the architecture remains **frozen**. Phase 4 wires the certified
domain components into durable/live infrastructure **without redesigning them**. SB-PLR remains the
operational identity; SB-NAT remains an Enterprise Correlation Identity only; operators remain
write-only contributors with tenant isolation; federation stays off by default with explicit
per-jurisdiction activation; no plaintext PII enters SafeBet IQ; all regulator-plane actions remain
auditable; Evidence Integrity is preserved end-to-end. **Any architectural deviation requires a new
ADR and halts the affected milestone.**

## 4. Controlled Pilot Scope Definition (proposed; placeholders where customer-specific)
| Parameter | Proposed value |
|---|---|
| Participating operators | 1–2 (start with **one** controlled connector) — `[OPERATOR_PLACEHOLDER]` |
| Jurisdictions | 1 (ZA primary) |
| Regulator-led | Yes — `[REGULATOR_PLACEHOLDER]` (supervised) |
| Data type | **Sandbox or approved anonymised** (real anonymised only after C7) — synthetic first |
| Data volume | Bounded pilot volume `[VOLUME_PLACEHOLDER]` (not production scale) |
| Transaction volume | Bounded `[TXN_PLACEHOLDER]` |
| Identity attributes | Only jurisdiction-approved hashed attributes (ZA: national_id, phone, device_fingerprint) |
| Data-processing responsibility | Operator = controller of source; SafeBet IQ = processor of hashes; regulator = authority — per C7 DPA |
| Activation | Explicit master + per-jurisdiction feature flag (owner-executed) |
| Suspension | Connector suspension + flag off (documented runbook) |
| Rollback | Documented rollback runbook; restore drill (C6) |
| Support model | Pilot support hours `[SUPPORT_PLACEHOLDER]`; incident escalation (C9) |
| Duration | `[DURATION_PLACEHOLDER]` (time-boxed) |
| Success measures | See Pilot Success Metrics (Roadmap §metrics) |
| Failure criteria | Any Critical/High incident, tenant/PII breach, or hard-gate failure |
| Exit criteria | Pilot certification gates passed OR pilot suspended with evidence |
| Production exclusion | **Production remains prohibited** regardless of pilot outcome |

## 5. Production Exclusions
Phase 4 does **not** authorise production deployment. A controlled pilot approval applies **only** to
the approved pilot scope. Production deployment requires a **separate** production-readiness
assessment, closure of production-specific conditions, explicit executive authorisation, explicit
change approval, a deployment plan, a rollback plan, and production certification evidence
(`V2_DEPLOYMENT_READINESS_DECISION.md` §5, §8).

## 6. Recommended First Implementation Milestone
**Phase 4.1 — Pilot Persistence & Regulator-Plane Security** (closes C2, C3; addresses C10). It is
foundational: durable persistence + RLS + durable append-only audit are prerequisites for C1, C5,
C6, and pilot operations. It carries the lowest external dependency and highest downstream leverage,
and CERT-L1/C10 encapsulation is naturally scoped to the registry persistence work.

## 7. Go / No-Go Recommendation for Phase 4.1
**GO to plan-approve Phase 4.1** (durable pilot persistence + RLS + append-only audit + registry
runtime-encapsulation evaluation), subject to: (a) review/approval of this Phase 4.0 plan; (b)
confirmation that Phase 4.1 will use an **isolated pilot/sandbox data store** separate from
production; (c) no production change. Implementation of Phase 4.1 must **not** begin until this plan
is approved. No other milestone may start before its dependencies (Dependency Map) are satisfied.

## 8. Standing Constraints (Phase 4 governance)
All work remains on the Demo/approved pilot branch and pilot environment; production is untouched;
federation is off by default; commit/tag/merge/deploy are owner-executed and require separate
explicit authorisation; each milestone STOPs for review before the next begins; any architectural
deviation requires a new ADR.
