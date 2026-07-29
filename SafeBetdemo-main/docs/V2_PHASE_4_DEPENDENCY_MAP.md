# Version 2.0 — Phase 4 Dependency Map

**Phase 4.0 · PLANNING ONLY · 2026-07-16.** No milestone may begin before its dependencies are
satisfied. Each milestone ends in a mandatory stop gate.

## 1. Condition → milestone → dependency
| Condition | Milestone | Depends on (conditions) | Depends on (milestones) |
|---|---|---|---|
| C2 Durable regulator-plane DB + RLS | 4.1 | — | — |
| C3 Durable append-only audit | 4.1 | C2 | 4.1 (same) |
| C10 Runtime-private state | 4.1 | — | — |
| C4 Pepper + rotation | 4.2 | — | 4.1 |
| C1 Contribution wiring (part) | 4.3 | C2, C3, C4 | 4.1, 4.2 |
| C5 Live connector | 4.4 | C4, C2, C3 | 4.2, 4.3 |
| C1 Live reconciliation (part) | 4.5 | C1(4.3), C5 | 4.3, 4.4 |
| C8 Deployed regression | 4.6 | — (deployable build) | 4.1 |
| C6 Backup/restore | 4.7 | C2, C3 | 4.1, 4.4 |
| C7 Legal/privacy | 4.7 | — (non-technical) | — |
| C9 Operational readiness | 4.7 | C2, C3, C6 | 4.1, 4.4 |
| All (re-test) | 4.8 | C1–C10 | 4.1–4.7 |

## 2. Critical path
```
4.1 (C2,C3,C10)
  ├─► 4.2 (C4)
  │      └─► 4.3 (C1a) ──► 4.5 (C1b) ─┐
  │              └─► 4.4 (C5) ────────┤
  ├─► 4.6 (C8, C2-5 hard gate) ───────┤
  └─► 4.7 (C6,C7,C9) ─────────────────┤
                                       └─► 4.8 (re-test C1–C10 → pilot go/no-go)
```
**Longest chain:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.8. **Parallelisable:** 4.6 (deployed regression)
and 4.7 (legal/privacy/ops) can run alongside 4.2–4.5 once 4.1 is complete; C7 (legal) has no
technical dependency and should start early to de-risk schedule.

## 3. Entry/exit gate summary
| Milestone | Entry gate | Exit gate |
|---|---|---|
| 4.1 | Plan approved; isolated pilot store provisioned | C2/C3 closure tests + C10 hardening + regression green |
| 4.2 | 4.1 exit | C4 rotation/recovery drill passes |
| 4.3 | 4.1 + 4.2 exit | contribution path validated (replay/idempotency/PII-free) |
| 4.4 | 4.2 + 4.3 exit | C5 hash-only ingestion + isolation negatives pass |
| 4.5 | 4.3 + 4.4 exit | C1 live reconciliation passes (no direct totals) |
| 4.6 | deployable build (post-4.1) | **C8 / C2-5 deployed hard gate passes** |
| 4.7 | 4.1 + 4.4 exit | C6 restore + C7 legal + C9 ops closure |
| 4.8 | 4.1–4.7 exit | all pilot hard gates pass → pilot go/no-go |

## 4. Cross-cutting invariants (every milestone)
ADR-006 frozen · SB-PLR unchanged · SB-NAT correlation-only · tenant + jurisdiction + sovereign
isolation · federation off by default · no plaintext PII · operators write-only, no national access
· immutable auditability · Evidence Integrity preserved · production untouched · stop-gate review
before next milestone · new ADR for any architectural deviation.

## 5. Blocking rules
- No live data before **C7** (legal/privacy) — sandbox/synthetic only until then.
- No connector (4.4) before **C4** (peppers) and **4.3** (contribution boundary).
- No live reconciliation (4.5) before **4.3 + 4.4**.
- No pilot go (4.8) before **all** of C1–C9 closed (C10 recommended; residual-risk-accepted if open).
- **Production is never unblocked by Phase 4** — it requires a separate assessment + authorisation.
