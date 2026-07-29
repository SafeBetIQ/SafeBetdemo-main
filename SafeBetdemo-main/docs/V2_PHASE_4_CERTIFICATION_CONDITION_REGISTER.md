# Version 2.0 — Phase 4 Certification Condition Register (C1–C10)

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (Accepted, frozen).**
**No condition may be marked closed during Phase 4.0.** Production remains prohibited.

Conditions are extracted **verbatim** from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4 and
cross-referenced to `V2_ENTERPRISE_CERTIFICATION_REPORT.md` §23/§24 and
`V2_DEPLOYMENT_READINESS_DECISION.md`. Nothing here is invented; the "Test of satisfaction"
column reproduces the certification's own closure test.

## Source-of-truth cross-reference
| Doc | Role |
|---|---|
| `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4 | Authoritative C1–C10 wording + test of satisfaction |
| `V2_ENTERPRISE_CERTIFICATION_REPORT.md` §23/§24 | Conditions list + prominent live-integration limitation |
| `V2_DEPLOYMENT_READINESS_DECISION.md` §4/§5 | Pilot blocked on C1–C9; production on C1–C10 |
| `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §1 | CERT-L1 defect (→ C10) |

**Document-conflict check:** no conflict found between these sources. Cert report §23 lists
C1–C10; risk register §4 gives the testable closure criteria; deployment decision maps pilot to
C1–C9 and production to C1–C10 (C10 is the runtime-privacy hardening, treated as production-facing).
This mapping is consistent and preserved unchanged.

---

## C1 — Live Event Platform contribution wiring + live reconciliation
- **Exact wording:** "Live Event Platform contribution wiring + live reconciliation."
- **Test of satisfaction (verbatim):** "Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes."
- **Source:** Risk & Conditions §4 · Cert Report §23/§24 (live-integration limitation).
- **Affected domain:** C2-1, C2-4, C2-6. **Severity:** High (blocks pilot). **Current status:** OPEN.
- **Current evidence:** demonstration-ledger reconciliation only (Milestone 3.7; in-memory).
- **Missing capability:** live/sandbox wager+GGR ingestion via the certified Event Platform; live operator↔national reconciliation.
- **Required implementation:** Phase 4.3 (contribution/Event-Platform wiring) + 4.5 (wagering/GGR reconciliation).
- **Required documentation:** `V2_PHASE_4_LIVE_INTEGRATION_PLAN.md`. **Required testing:** live/sandbox ingestion + reconciliation suite.
- **Security review:** contribution authn/authz, replay/idempotency. **Privacy review:** hash-before-boundary, no plaintext.
- **Operational evidence:** rejected-event visibility, freshness, source-to-report provenance.
- **Dependency:** C2, C3 (durable persistence to hold results), C5 (connector). **Responsible component:** Event Platform boundary + NIFS contribution path.
- **Pilot impact:** HARD blocker. **Production impact:** required. **Closure criteria:** live reconciliation report passes with no direct total insertion.
- **Retest criteria:** re-run reconciliation from live/sandbox source. **Go-live consequence if unresolved:** no pilot.

## C2 — Durable regulator-plane database + RLS
- **Exact wording:** "Durable regulator-plane database + RLS."
- **Test of satisfaction (verbatim):** "Regulator-plane data persisted; RLS negative tests (operator denied) pass against the live store."
- **Source:** Risk & Conditions §4. **Affected:** C2-2, C2-6. **Severity:** Medium–High. **Status:** OPEN.
- **Current evidence:** in-memory registry/policy/audit (demo). **Missing:** durable persistence + row-level security.
- **Required implementation:** Phase 4.1. **Documentation:** `V2_PHASE_4_OPERATIONAL_READINESS_PLAN.md` (persistence).
- **Testing:** RLS negative tests (operator denied at the store). **Security:** RLS + least privilege. **Privacy:** sovereign data separation.
- **Operational evidence:** persistence + isolation proof. **Dependency:** none upstream (foundational). **Responsible:** regulator-plane data store.
- **Pilot impact:** HARD blocker. **Production impact:** required. **Closure:** RLS negative tests pass on the live store.
- **Retest:** re-run RLS negative suite. **Go-live consequence:** no pilot persistence → no pilot.

## C3 — Durable append-only audit storage
- **Exact wording:** "Durable append-only audit storage."
- **Test of satisfaction (verbatim):** "Audit persisted append-only; update/delete attempts rejected at the store."
- **Source:** Risk & Conditions §4. **Affected:** C2-2. **Severity:** Medium–High. **Status:** OPEN.
- **Current evidence:** in-memory append-only sinks (deep-frozen; no update/delete surface). **Missing:** durable append-only store.
- **Required implementation:** Phase 4.1. **Testing:** update/delete rejected at the store. **Security:** immutability at rest.
- **Dependency:** C2. **Responsible:** audit store. **Pilot impact:** HARD blocker. **Production impact:** required.
- **Closure:** store rejects mutation; audit survives restart. **Retest:** mutation-attempt suite. **Consequence:** no immutable audit → no pilot.

## C4 — Production HSM / Secrets Manager pepper + rotation
- **Exact wording:** "Production HSM / Secrets Manager pepper + rotation."
- **Test of satisfaction (verbatim):** "Pepper served from HSM/Secrets Manager; a key-rotation + recovery exercise completes with versioned continuity."
- **Source:** Risk & Conditions §4. **Affected:** C2-2, C2-3. **Severity:** Medium–High. **Status:** OPEN.
- **Current evidence:** injected demo pepper provider (scaffolding). **Missing:** HSM/Secrets Manager integration + rotation + recovery.
- **Required implementation:** Phase 4.2. **Documentation:** `V2_PHASE_4_SECURITY_AND_KEY_MANAGEMENT_PLAN.md`.
- **Testing:** rotation + recovery exercise with versioned continuity (pepperKeyVersion already modelled). **Security:** least privilege, audit. **Privacy:** jurisdiction-specific peppers.
- **Dependency:** none upstream. **Responsible:** key-management service + `security.ts` composition root.
- **Pilot impact:** HARD blocker (sandbox peppers acceptable if via Secrets Manager). **Production impact:** required.
- **Closure:** rotation+recovery drill passes. **Retest:** re-run drill. **Consequence:** no managed peppers → no pilot cryptographic boundary.
- **NOTE:** do NOT create or rotate real secrets in Phase 4.0.

## C5 — Live operator connector validation
- **Exact wording:** "Live operator connector validation."
- **Test of satisfaction (verbatim):** "Each operator connector ingests hash-only contributions; isolation negative tests pass."
- **Source:** Risk & Conditions §4. **Affected:** C2-2, C2-4. **Severity:** High. **Status:** OPEN.
- **Current evidence:** synthetic contributions in the demo generator. **Missing:** real/sandbox operator connectors.
- **Required implementation:** Phase 4.4. **Documentation:** `V2_PHASE_4_LIVE_INTEGRATION_PLAN.md`.
- **Testing:** hash-only ingestion + tenant-isolation negative tests. **Security:** connector authn/authz, revocation. **Privacy:** hash-before-boundary.
- **Dependency:** C4 (peppers), C2/C3 (persistence). **Responsible:** operator connector + contribution boundary.
- **Pilot impact:** HARD blocker. **Production impact:** required. **Closure:** connector ingests hash-only; isolation negatives pass.
- **Retest:** per-connector isolation suite. **Consequence:** no live contribution → no pilot.

## C6 — Backup and restore test
- **Exact wording:** "Backup and restore test."
- **Test of satisfaction (verbatim):** "Restore from backup reproduces registry/audit state; integrity verifier passes post-restore."
- **Source:** Risk & Conditions §4. **Affected:** C2-6. **Severity:** Medium. **Status:** OPEN.
- **Current evidence:** none (in-memory). **Missing:** backup + restore drill. **Required implementation:** Phase 4.7.
- **Testing:** restore reproduces registry/audit; integrity verifier passes post-restore. **Operational evidence:** RPO/RTO.
- **Dependency:** C2, C3. **Responsible:** persistence/ops. **Pilot impact:** required. **Production impact:** required.
- **Closure:** post-restore integrity passes. **Retest:** restore drill. **Consequence:** unrecoverable pilot → no pilot approval.

## C7 — Regulator legal + privacy approval
- **Exact wording:** "Regulator legal + privacy approval."
- **Test of satisfaction (verbatim):** "Signed DPA, lawful basis, retention schedule, DSAR procedure, cross-border restrictions, regulator authorisation model."
- **Source:** Risk & Conditions §4 · Cert Report §25 · Regulator Acceptance §4. **Affected:** C2-3, C2-7. **Severity:** Medium. **Status:** OPEN.
- **Current evidence:** PIA v2 (implementation-consistent). **Missing:** signed legal instruments + regulator authorisation.
- **Required implementation:** Phase 4.7 (non-code). **Documentation:** `V2_PHASE_4_PRIVACY_AND_LEGAL_READINESS_PLAN.md`.
- **Testing:** evidence review (documented approvals). **Privacy review:** PIA update. **Dependency:** none technical.
- **Responsible:** Legal/DPO + regulator. **Pilot impact:** HARD blocker for real-data / regulator engagement (also gates supervised demo per Cert §25).
- **Production impact:** required. **Closure:** signed evidence present. **Consequence:** no approval → synthetic-only, no real-data pilot.

## C8 — Deployed Consumer Platform runtime regression
- **Exact wording:** "Deployed Consumer Platform runtime regression."
- **Test of satisfaction (verbatim):** "Deployed app regression suite + route/contract smoke tests pass with V2 present."
- **Source:** Risk & Conditions §4 · Cert Report §10 (C2-5 scope). **Affected:** C2-5 (hard gate, deployed scope). **Severity:** Low–Medium. **Status:** OPEN.
- **Current evidence:** library-level + import-boundary regression (354/354). **Missing:** deployed-runtime regression.
- **Required implementation:** Phase 4.6. **Documentation:** deployed regression plan (in `V2_PHASE_4_OPERATIONAL_READINESS_PLAN.md` §deployed-regression).
- **Testing:** deployed routes/contracts/dashboards/APIs + operator/regulator access-control + SB-NAT/policy non-exposure. **Dependency:** deploy pipeline.
- **Responsible:** app/runtime. **Pilot impact:** HARD blocker (library-only is insufficient for pilot). **Production impact:** required.
- **Closure:** deployed regression + smoke pass with V2 present. **Retest:** on each deploy. **Consequence:** unproven runtime → no pilot.

## C9 — Pilot operational-readiness review
- **Exact wording:** "Pilot operational-readiness review."
- **Test of satisfaction (verbatim):** "Monitoring/alarms, HA/scaling, incident response, support runbook, deployment pipeline, rollback all present and exercised."
- **Source:** Risk & Conditions §4. **Affected:** C2-6. **Severity:** Medium. **Status:** OPEN.
- **Current evidence:** demo determinism + integrity checkers. **Missing:** monitoring/alarms/incident/runbook/pipeline/rollback exercised.
- **Required implementation:** Phase 4.7. **Documentation:** `V2_PHASE_4_OPERATIONAL_READINESS_PLAN.md`.
- **Testing:** operational drills. **Dependency:** C2, C3, C6. **Responsible:** ops. **Pilot impact:** HARD blocker. **Production impact:** required (plus HA/scaling).
- **Closure:** all items present and exercised. **Consequence:** no operational readiness → no pilot.

## C10 — Runtime-private internal state (CERT-L1)
- **Exact wording:** "Runtime-private internal state (CERT-L1)."
- **Test of satisfaction (verbatim):** "Internal registry state unreachable at runtime; adversarial injection attempt fails."
- **Source:** Risk & Conditions §1 (CERT-L1) + §4 · Cert Report §21. **Affected:** C2-1, C2-2. **Severity:** LOW. **Status:** OPEN.
- **Current evidence:** TS `private` (compile-time); no approved public path fabricates an SB-NAT (ADV-4/5). **Missing:** runtime-private internal state.
- **Required implementation:** Phase 4.1 (evaluated in Phase 4.0 §CERT-L1 options; NOT implemented in 4.0).
- **Documentation:** `V2_PHASE_4_SECURITY_AND_KEY_MANAGEMENT_PLAN.md` (encapsulation options). **Testing:** adversarial injection attempt fails at runtime.
- **Security review:** encapsulation approach. **Dependency:** none (isolated to `registry.ts`). **Responsible:** SB-NAT Registry.
- **Pilot impact:** LOW (recommended, not hard). **Production impact:** required (production-facing). **Closure:** runtime injection blocked; adversarial test passes.
- **Retest:** adversarial suite + full regression. **Consequence if unresolved:** LOW residual risk carried into pilot with compensating service-boundary controls.
- **Constraint:** do NOT assume changing the global TS target is acceptable; see options in the security plan.

---

## Condition summary matrix
| ID | Severity | Pilot gate | Production gate | Phase 4 milestone | Status |
|---|---|---|---|---|---|
| C1 | High | HARD | required | 4.3 + 4.5 | OPEN |
| C2 | Med–High | HARD | required | 4.1 | OPEN |
| C3 | Med–High | HARD | required | 4.1 | OPEN |
| C4 | Med–High | HARD | required | 4.2 | OPEN |
| C5 | High | HARD | required | 4.4 | OPEN |
| C6 | Medium | required | required | 4.7 | OPEN |
| C7 | Medium | HARD (real data) | required | 4.7 | OPEN |
| C8 | Low–Med | HARD | required | 4.6 | OPEN |
| C9 | Medium | HARD | required | 4.7 | OPEN |
| C10 | Low | recommended | required | 4.1 | OPEN |

All conditions remain **OPEN**. None is closed in Phase 4.0.

---

## Current Status Addendum — after Milestone 4.6B (2026-07-16)

The register above is the Phase 4.0 planning snapshot. Status after milestones 4.1–4.6B:

| # | Status | Evidence / residual |
|---|---|---|
| C1 | **PARTIALLY CLOSED** | Contribution (4.3) + sandbox wager/GGR (4.5) in-process; deployed/external/production-live evidence OPEN (no deployed HTTP/managed runtime) |
| C2 | **PARTIALLY CLOSED** | Durable store + app-enforced RLS (4.1); native Postgres/RDS RLS OPEN (no managed DB) |
| C3 | **PARTIALLY CLOSED** | Durable append-only + SHA-256 chain (4.1); DB-permission WORM OPEN (no managed DB) |
| C4 | **PARTIALLY CLOSED** | HMAC provider + rotation/compromise (4.2); managed Secrets Manager/HSM/KMS OPEN (invalid AWS session) |
| C5 | **PARTIALLY CLOSED** | In-process connector sandbox (4.4); external/deployed connector service OPEN |
| C8 | **PARTIALLY CLOSED** | In-process composition (4.6A) + **deployed independent-process Consumer smoke (4.6B: 43/43 routes, 0 leak, 0 federation surface, no regression)**; managed cloud deployment + deployed server-side isolation + managed infra OPEN |
| C6 | OPEN | backup/restore drill → 4.7 |
| C7 | OPEN | privacy/legal → 4.7 |
| C9 | OPEN | operational readiness/monitoring → 4.7 |
| C10 | **CLOSED** | registry module-closure encapsulation (4.1) |

No condition was closed on in-process evidence. C8 advanced (deployed independent-process evidence) but is
**not** closed — managed deployment + server-side isolation still required.
