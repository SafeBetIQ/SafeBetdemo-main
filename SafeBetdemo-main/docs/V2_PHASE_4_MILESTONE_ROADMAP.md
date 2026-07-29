# Version 2.0 — Phase 4 Milestone Roadmap

**Phase 4.0 · PLANNING ONLY · 2026-07-16.** Each milestone STOPs for review before the next.
Mapped directly to conditions C1–C10 (see Condition Register). No milestone starts before its
dependencies are satisfied (see Dependency Map).

## Milestone overview
| Milestone | Closes | Depends on | Hard-gate contribution |
|---|---|---|---|
| 4.1 Pilot Persistence & Regulator-Plane Security | C2, C3, C10 | — | C2-2 |
| 4.2 Pepper & Cryptographic Operations | C4 | 4.1 | C2-2, C2-3 |
| 4.3 Operator Contribution & Event Platform Wiring | C1 (part) | 4.1, 4.2 | C2-1, C2-4 |
| 4.4 Live Operator Connector Sandbox | C5 | 4.2, 4.3 | C2-2, C2-4 |
| 4.5 Live Wagering & GGR Reconciliation | C1 (part) | 4.3, 4.4 | C2-4, C2-6 |
| 4.6 Deployed Runtime & Consumer Regression | C8 | 4.1 (deploy) | **C2-5 (hard)** |
| 4.7 Pilot Operations, Privacy & Legal Readiness | C6, C7, C9 | 4.1, 4.4 | C2-3, C2-6, C2-7 |
| 4.8 Controlled Pilot Readiness Certification | re-test C1–C10 | 4.1–4.7 | all |

---

## Phase 4.1 — Pilot Persistence and Regulator-Plane Security
- **Entry:** Phase 4.0 plan approved; isolated pilot data store provisioned (non-production).
- **Scope:** durable regulator-plane persistence (registry, decision/appeal/override history, policy outcomes, correlation results or reconstruction inputs); RLS; durable append-only audit; registry runtime-encapsulation for CERT-L1/C10; integrity controls against the durable store.
- **Excluded:** live operator data; peppers; connectors; deployment.
- **Implementation deliverables:** persistence adapters behind the existing domain interfaces (no domain redesign); RLS policies; append-only audit store.
- **Test deliverables:** RLS negative tests (operator denied) against the live store (C2); audit update/delete rejected (C3); registry runtime-injection blocked (C10); integrity verifier passes against the store.
- **Docs:** persistence design; RLS spec; audit-storage spec. **Security evidence:** RLS + immutability. **Privacy evidence:** sovereign separation, operator write-only.
- **Exit:** C2, C3 closure tests pass; C10 hardening validated; regression green. **Stop gate → 4.2.**

## Phase 4.2 — Pepper and Cryptographic Operations
- **Entry:** 4.1 complete. **Scope:** Secrets Manager/HSM pepper storage; jurisdiction-specific peppers; retrieval + caching policy; rotation + dual-pepper transition; recovery; least-privilege access; audit logging; demo/pilot/production separation.
- **Excluded:** real production secrets (sandbox/pilot only); connectors.
- **Deliverables:** key-management integration at the composition root (injected `PepperProvider`); rotation/recovery procedure. **Tests:** rotation + recovery drill with versioned continuity (`pepperKeyVersion`); least-privilege access tests.
- **Docs:** `V2_PHASE_4_SECURITY_AND_KEY_MANAGEMENT_PLAN.md` realised. **Security evidence:** rotation drill, access audit.
- **Exit:** C4 closure test passes. **Stop gate → 4.3.**

## Phase 4.3 — Operator Contribution and Event Platform Wiring
- **Entry:** 4.1, 4.2 complete. **Scope:** hash-before-boundary contribution path via the certified Event Platform / approved contribution boundary; contribution authn/authz; tenant + jurisdiction context; event validation; idempotency; replay/duplicate protection; contribution revocation/expiry; audit; error/dead-letter handling; rate limits; schema validation; no plaintext logging.
- **Excluded:** external connector code (4.4); GGR reconciliation (4.5).
- **Deliverables:** contribution boundary wiring (no domain redesign). **Tests:** replay/duplicate rejected; malformed rejected; write-only enforced; PII-free payload; audit present.
- **Docs:** `V2_PHASE_4_LIVE_INTEGRATION_PLAN.md` (contribution). **Exit:** contribution path validated (C1 part-1). **Stop gate → 4.4.**

## Phase 4.4 — Live Operator Connector Sandbox
- **Entry:** 4.2, 4.3 complete. **Scope:** ONE controlled operator connector using sandbox/approved pilot data; connector authentication; tenant isolation; failure + recovery; suspension + revocation.
- **Excluded:** multiple operators; production data; real regulator data (needs C7).
- **Deliverables:** sandbox connector. **Tests:** hash-only ingestion; tenant-isolation negatives; suspend/revoke; recovery.
- **Docs:** connector onboarding runbook. **Exit:** C5 closure test passes. **Stop gate → 4.5.**

## Phase 4.5 — Live Wagering and GGR Reconciliation
- **Entry:** 4.3, 4.4 complete. **Scope:** session/wagering ingestion via certified Event Platform; projection reconciliation; national aggregation; rejected-event visibility; no direct total insertion; tenant isolation; data freshness; source-to-report provenance.
- **Deliverables:** reconciliation harness against live/sandbox source. **Tests:** operator↔projection↔national reconciliation; no duplicate counting; rejected-event handling.
- **Docs:** wagering/GGR reconciliation report. **Exit:** C1 closure test passes (live reconciliation). **Stop gate → 4.6.**

## Phase 4.6 — Deployed Runtime and Consumer Regression
- **Entry:** 4.1 (deployable build). **Scope:** deployed application regression; Consumer route/contract validation; operator dashboard smoke; API compatibility; Event/Projection/Twin/Policy platform validation; operator + regulator access-control regression; SB-NAT + national-policy non-exposure to operators; error-path + rollback validation; performance sanity.
- **Deliverables:** deployed regression suite. **Tests:** all of the above against a deployed environment.
- **Docs:** deployed regression plan/results. **Exit:** **C8 closes; C2-5 hard gate satisfied in deployed scope.** **Stop gate → 4.7.**

## Phase 4.7 — Pilot Operations, Privacy and Legal Readiness
- **Entry:** 4.1, 4.4 complete. **Scope:** DPA + lawful basis + retention + DSAR + cross-border + regulator authorisation (C7); backup + restore drill (C6); monitoring/alarms, incident response, support runbook, deployment pipeline, rollback (C9); PIA update; security review.
- **Deliverables (non-code where legal):** signed legal instruments; ops runbooks; monitoring. **Tests:** restore drill (integrity post-restore); operational drills.
- **Docs:** `V2_PHASE_4_PRIVACY_AND_LEGAL_READINESS_PLAN.md`, `V2_PHASE_4_OPERATIONAL_READINESS_PLAN.md` realised. **Exit:** C6, C7, C9 closure tests pass. **Stop gate → 4.8.**

## Phase 4.8 — Controlled Pilot Readiness Certification
- **Entry:** 4.1–4.7 complete. **Scope:** independent re-test of C1–C10; pilot end-to-end test (live/sandbox); regulator acceptance (pilot level); pilot go/no-go decision.
- **Deliverables:** pilot certification report + condition closure evidence. **Tests:** full re-run of all closure tests + pilot e2e.
- **Exit:** all pilot hard gates pass → **controlled pilot go decision** (pilot scope only). **Production remains excluded.** **Stop gate → separate production assessment.**

---

## Pilot Success Metrics (proposed; each requires an approval owner)
| Metric | Definition | Calculation | Evidence source | Target/owner | Review freq | Failure threshold | Escalation |
|---|---|---|---|---|---|---|---|
| Connector availability | uptime of the pilot connector | up / total time | connector health | `[PROPOSED]`/ops | daily | `[PROPOSED]` | ops incident |
| Accepted event rate | accepted / submitted events | ratio | Event Platform | `[PROPOSED]`/eng | daily | `[PROPOSED]` | eng review |
| Rejected event rate | rejected / submitted (with reasons) | ratio | Event Platform | visible, explained/eng | daily | unexplained > 0 | eng review |
| Federation contribution success | valid hash contributions accepted | ratio | contribution audit | `[PROPOSED]`/eng | daily | `[PROPOSED]` | eng review |
| False-positive rate | rejected false links / candidates | ratio | decision audit | review/regulator | weekly | `[PROPOSED]` | regulator review |
| Manual-review backlog | pending reviews | count | policy/decision store | `[PROPOSED]`/regulator | daily | `[PROPOSED]` | regulator |
| Registry integrity | integrity verifier result | pass/fail | registry verifier | 100% pass/eng | continuous | any fail | STOP pilot |
| Provenance completeness | insights with full provenance | ratio | correlation | 100%/eng | continuous | < 100% | STOP feature |
| Policy reproducibility | deterministic re-eval match | ratio | policy integrity | 100%/eng | continuous | any mismatch | eng review |
| Tenant-isolation incidents | isolation breaches | count | access logs | 0/security | continuous | ≥ 1 | STOP pilot |
| PII leakage incidents | PII in outputs/logs | count | PII scans | 0/security | continuous | ≥ 1 | STOP pilot |
| Regulator query performance | twin/timeline/policy latency | p95 | monitoring | `[PROPOSED]`/ops | daily | `[PROPOSED]` | ops |
| Reconciliation accuracy | operator↔national match | ratio | reconciliation report | 100%/eng | daily | < 100% | eng review |
| Incident response time | detect→respond | duration | incident log | `[PROPOSED]`/ops | per incident | `[PROPOSED]` | escalation |
| Restore-test result | post-restore integrity | pass/fail | restore drill | pass/ops | per drill | fail | ops |

All numeric targets are **PROPOSED** placeholders pending an approval owner; none are committed.
