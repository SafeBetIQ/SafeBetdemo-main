# Version 2.0 Certification — Risk & Conditions Register

**Milestone 3.8 · 2026-07-16.** Defects classified honestly; every condition is testable.

## 1. Defect register
| ID | Severity | Evidence | Impact | Affected cert | Remediation | Deployment consequence | Retest |
|---|---|---|---|---|---|---|---|
| CERT-L1 | **LOW** | ADV-4; `registry.ts` uses TS `private` (compile-time) at a sub-ES2015 build target | Internal registry state is not runtime-private; a same-process caller with a registry reference could theoretically reach internals. **No approved public path fabricates an SB-NAT**; create() is approval-gated. | C2-1, C2-2 | Enforce runtime-private internal state: raise TS target to ES2015+ and use ECMAScript `#private`, or capture state in constructor closures. | None for demo; production-hardening condition (C10). | Re-run adversarial + full regression after hardening. |
| DOC-M1 | **Medium** | Milestone reports used provisional wording; limitation risked being non-prominent | Certification wording + live-integration limitation must be first-class, not appendix. | C2-1/4/6/7 | Stated prominently in the certification report §3/§24 and all affected domain findings. | None. | N/A (documentation). |

**No Critical or High defects.** No constitutional violation, tenant breach, PII exposure, false
SB-NAT creation, unauthorised access, audit mutation, or hard-gate failure was found.

## 2. Severity definitions applied
- **Critical:** constitutional violation / tenant breach / PII exposure / false SB-NAT / unauthorised access / audit mutation / hard-gate failure. → **none found.**
- **High:** incorrect federation outcome / invalid Registry lifecycle / missing provenance / policy mis-evaluation / cross-jurisdiction leak / Consumer regression. → **none found.**
- **Medium:** incomplete diagnostics/documentation / minor integrity inconsistency / non-blocking workflow. → **DOC-M1.**
- **Low:** clarity / naming / non-functional hardening. → **CERT-L1.**

## 3. Residual risk register
| ID | Risk | Likelihood if productionised as-is | Severity | Mitigation / condition |
|---|---|---|---|---|
| R1 | Live Event Platform / operator-DB ingestion uncertified (synthetic GGR ≠ live) | High | High | C1, C5 |
| R2 | No durable regulator-plane persistence + RLS / durable audit storage | Certain | Medium–High | C2, C3 |
| R3 | No production pepper management (HSM/Secrets Manager) + rotation | Certain | Medium–High | C4 |
| R4 | Internal-state runtime privacy (CERT-L1) | Low | Low | C10 |
| R5 | Deployed-runtime Consumer Platform regression not executed | Certain (demo) | Low–Medium | C8 |
| R6 | Regulator legal/privacy approval not obtained | Certain | Medium | C7 |

## 4. Certification conditions (each testable)
| ID | Condition | Test of satisfaction |
|---|---|---|
| C1 | Live Event Platform contribution wiring + live reconciliation | Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes |
| C2 | Durable regulator-plane database + RLS | Regulator-plane data persisted; RLS negative tests (operator denied) pass against the live store |
| C3 | Durable append-only audit storage | Audit persisted append-only; update/delete attempts rejected at the store |
| C4 | Production HSM / Secrets Manager pepper + rotation | Pepper served from HSM/Secrets Manager; a key-rotation + recovery exercise completes with versioned continuity |
| C5 | Live operator connector validation | Each operator connector ingests hash-only contributions; isolation negative tests pass |
| C6 | Backup and restore test | Restore from backup reproduces registry/audit state; integrity verifier passes post-restore |
| C7 | Regulator legal + privacy approval | Signed DPA, lawful basis, retention schedule, DSAR procedure, cross-border restrictions, regulator authorisation model |
| C8 | Deployed Consumer Platform runtime regression | Deployed app regression suite + route/contract smoke tests pass with V2 present |
| C9 | Pilot operational-readiness review | Monitoring/alarms, HA/scaling, incident response, support runbook, deployment pipeline, rollback all present and exercised |
| C10 | Runtime-private internal state (CERT-L1) | Internal registry state unreachable at runtime; adversarial injection attempt fails |

No vague conditions (e.g. "improve monitoring") are used; each is objectively testable.

## 5. Architectural-defect check
No architectural defect was found. ADR-006 remains fully compliant; no new ADR is required.
Certification did not change architecture, matching rules, decision policies, SB-NAT lifecycle,
analytics, or national policies.
