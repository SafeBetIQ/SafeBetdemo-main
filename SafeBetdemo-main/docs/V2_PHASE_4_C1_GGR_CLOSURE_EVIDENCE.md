# Phase 4 — Condition C1 (Wagering & GGR Reconciliation) Closure Evidence (Milestone 4.5)

**2026-07-16 · ADR-006 (frozen). C1: PARTIALLY CLOSED** — sandbox/pilot-path wager/GGR reconciliation proven;
external-operator + deployed-runtime + production evidence OPEN.

## C1 — verbatim
- **Condition:** "Live Event Platform contribution wiring + live reconciliation."
- **Test of satisfaction:** "Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes."

## What is DONE (sandbox / pilot-path)
| Requirement | Evidence |
|---|---|
| Valid sessions + session integrity | invalid/legacy/cross-tenant/wrong-player/ended session rejected (tested) |
| Wager integrity + settlement lifecycle | double-settlement / unknown-wager / reassignment / over-refund rejected (tested) |
| Events through the (sandbox) certified Event Platform | authoritative; append-only accepted; rejected visible (tested) |
| Integer precision (no float) | non-integer/negative rejected; exact integer sums (tested) |
| Accepted events feed the Projection Platform | derived-by-replay; deterministic rebuild (tested) |
| GGR by the documented formula | Turnover − WinsPaid; void/refund excluded (tested) |
| Operator totals reconcile | GGR = turnover − winsPaid per operator (tested) |
| National totals reconcile | Σ eligible operator GGR = national (tested) |
| No direct total insertion | no insert/setGgr surface; structural (tested) |
| No duplicate/replay financial effect | GGR unchanged by replay (tested) |
| Provenance | every total → accepted events (tested) |
| Tenant isolation + regulator-only national | operator scoped; national regulator-only (tested) |
| 4-level reconciliation + integrity verifier | all balanced; integrity ok (tested) |
| Privacy (anonymous refs, no PII) | serialised scan clean (tested) |

## What is NOT done (OPEN → residual)
- **External-operator sandbox** connectivity — in-process simulator only.
- **Deployed-runtime** Event/Projection Platform — execution was in-process.
- **Production-live** reconciliation — prohibited; not attempted.
- **Multi-currency** conversion — single-currency (ZAR) sandbox only.
- **Bonus/promotional** treatment — explicitly excluded.

## Status & retest to fully close C1
- **Status: PARTIALLY CLOSED.**
- **Retest to close:** live wager/GGR events flow through the **deployed** certified Event/Projection Platform
  with an **external** approved operator; the **live operator↔national reconciliation report passes**.

## Cross-condition confirmation (unchanged)
C2 PARTIALLY CLOSED · C3 PARTIALLY CLOSED · C4 PARTIALLY CLOSED · C5 PARTIALLY CLOSED · C10 CLOSED. No status
altered without new evidence; native RLS, DB append-only, managed Secrets Manager/HSM, external connector,
and deployed evidence remain open.

## Addendum — Milestone 4.6B (2026-07-16): no new deployed C1 evidence
The deployed milestone (4.6B) ran a real independent Consumer Platform process over HTTP, but the financial /
Event-Platform / GGR pipeline has **no HTTP surface by frozen design** and no managed runtime was available
(invalid AWS session). The pipeline therefore ran only **in-process** (4.6A: GGR 50, 4-level balanced).
**C1 remains PARTIALLY CLOSED — no deployed wager/GGR/reconciliation evidence was obtained.** See
`V2_DEPLOYED_FINANCIAL_EVIDENCE.md`.
