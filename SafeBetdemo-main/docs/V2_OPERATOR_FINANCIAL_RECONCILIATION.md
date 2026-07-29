# Operator Financial Reconciliation (Milestone 4.5)

**ADR-006 (frozen) · Four separate levels · No unexplained difference.**

## 1. Levels (kept distinct — never merged)
- **L1 — operator source ↔ connector:** source records = connector-submitted.
- **L2 — connector ↔ Event Platform:** `submitted = accepted + rejected + duplicates + deferred + dead-lettered`; ledger accepted = platform accepted.
- **L3 — Event Platform ↔ projection:** projected eventCount = accepted; projected wagers = wager-placed.
- **L4 — operator ↔ national:** Σ eligible operator GGR = national GGR.

## 2. Reconciliation equation
```
Source Records = Accepted + Rejected + Duplicates + Deferred + Dead-Lettered   (L1+L2)
Accepted Financial Events = Projected Financial Inputs                          (L3)
Σ Eligible Operator Projections = National Aggregate                            (L4)
```
Every difference is **quantified, classified, explained, and traceable**; no unexplained discrepancy is
permitted at milestone completion.

## 3. Output
`ReconciliationOutput { jurisdiction, generatedAt, levels[4], equation, balanced }`. Each level reports its
own checks + balanced flag; `differences[]` lists any imbalance with detail.

## 4. Tenant isolation
Operators reconcile only their own tenant; national reconciliation is regulator-only. Operators cannot view
competitor financial data.

## 5. Validation
Tested: two operators seeded → all four levels balanced; national = Σ operator GGR; integrity verifier ok.

## 6. Deployment binding
Live operator↔national reconciliation on a deployed environment with an external operator is the C1
residual; the pilot proves the reconciliation on the in-process sandbox.
