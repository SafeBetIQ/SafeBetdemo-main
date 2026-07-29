# Financial Reconciliation Runbook (Milestone 4.5)

**ADR-006 (frozen) · SANDBOX / PILOT-PATH · NON-PRODUCTION.**

## 1. Ingest
Submit financial events (session/wager/settlement/void/refund/correction) via the authorised
`financial-service` context through `FinancialEventPlatform.submit`. Invalid events are rejected with safe
reasons and remain visible.

## 2. Project
`FinancialProjectionPlatform.operatorProjections(platform, ctx)` — deterministically derives operator totals
(sessions, wagers, turnover, wins, losses, voids, refunds, **GGR**, per-product) by replaying accepted
events. `national(platform, regulatorCtx, jurisdiction)` aggregates (regulator-only).

## 3. Reconcile (4 levels)
`FinancialReconciler.reconcile({ platform, projection, ctx, jurisdiction, sourceCounts, submissionLedger })`
→ `ReconciliationOutput` with L1–L4 + equation + `balanced`. Investigate any `differences[]`.

## 4. Verify integrity
`FinancialReconciler.verifyIntegrity(input)` → structured report (source/status/projection/operator/national
reconcile; GGR formula; duplicates/replays no effect; currency; integer precision; deterministic rebuild;
provenance complete; no direct insertion; no PII).

## 5. Interpret
- `balanced = true` and integrity `ok = true` → the sandbox pilot-path reconciles.
- Any difference is quantified/classified/explained/traceable — resolve before sign-off.

## 6. Freshness
Check `dataFreshness` on operator + national results; do not present stale totals as current.

## 7. Guardrails
No production casino connection; no real player/financial data; no direct total insertion; no floating-point
money; operators cannot read competitor/national data. **Sandbox pilot-path only** — not live/deployed/
production reconciliation.

## 8. Deployment binding
Running this runbook against a **deployed** environment with an **external** operator (live reconciliation)
is the C1 residual (Phase 4.6 + deployment).
