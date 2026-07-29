# V2 — Financial Pipeline Validation (Milestone 4.6)

**Sandbox/pilot-path wagering & GGR pipeline exercised end-to-end through the composition (in-process, synthetic). NOT production-live, NOT real-money.**

## 1. Path Exercised
```
FinancialEventPlatform (session-started → wager-placed → wager-settled, integer minor units)
  → FinancialProjectionPlatform (operator projection, GGR)
  → FinancialReconciler (4-level reconciliation)
```

## 2. Result (deployed smoke)
- Events: session `sess`; wager `wg` stake **200** (minor); settlement **won**, payout **150** (minor).
- **GGR = 50** minor (Σ settled non-void/refund stake − Σ won payout = 200 − 150).
- **Reconciliation balanced** across all 4 levels; submission ledger 3 submitted / 3 accepted / 0 rejected.

## 3. Guarantees Verified
- **Integer minor units only** — no floating-point summation.
- **No direct total insertion** — GGR derived solely from accepted events.
- Idempotency keys + source refs per event; jurisdiction/operator/tenant scoped.

## 4. Limitation
Ran **in-process** on **synthetic** data — **sandbox/pilot-path**, not production-live wagering or a deployed
reconciliation service. No new deployed-runtime evidence toward **C1** → remains **PARTIALLY CLOSED**.
