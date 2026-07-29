# National GGR Reconciliation (Milestone 4.5)

**ADR-006 (frozen) · Regulator-only · Operator separation preserved.**

## 1. National aggregate
`NationalAggregate { jurisdiction, currency, projectionVersion, includedOperators, excludedOperators,
operatorCount, nationalGgrMinor, nationalTurnoverMinor, nationalWinsPaidMinor, window, dataFreshness }`.

## 2. Aggregation rule
`nationalGgrMinor = Σ ggrMinor` over **eligible** operator projections (same jurisdiction + currency).
Operators with a different currency are **excluded** (with a reason) — currencies are never summed without
an approved conversion (none invented).

## 3. Access
National aggregation is **regulator-only** (throws for operator/casino-admin/unauthenticated). Operators
cannot view another operator's GGR or the national total; no competitor financial data is exposed through
operator-facing reads.

## 4. National intelligence boundary
Financial projections may become **reference-based inputs** to the Enterprise Correlation Layer / National
Player Twin / cross-operator analytics / National Policy Platform. The national plane **does not mutate**
financial projections, and policy outcomes **do not rewrite** wagering events.

## 5. Data freshness
National result carries a window (min/max accepted timestamp) + `dataFreshness`. Stale aggregates are
surfaced with the watermark.

## 6. Validation
Tested: national GGR = Σ operator GGR; regulator-only enforced; single-currency inclusion; operator exclusion
by currency.

## 7. Deployment binding
Live national aggregation over deployed operator projections is the C1 residual; the pilot proves it on the
sandbox.
