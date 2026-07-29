# Financial Projection Specification (Milestone 4.5)

**ADR-006 (frozen) · Derived from accepted events · No direct insertion.**

## 1. Purpose
`FinancialProjectionPlatform` derives operator + national totals by **replaying accepted Event Platform
events** (the authoritative source). It is deterministic and fully rebuildable; it exposes **no** insert /
setTotal / setGgr / writeGgr / update surface.

## 2. Operator projection
operatorId · tenantId · jurisdiction · currency · projectionVersion · formula · sessions · wagers ·
turnoverMinor · winsPaidMinor · lossesMinor · voidsCount · refundsMinor · **ggrMinor** · eventCount ·
byProduct · dataFreshness · sourceEventIds.

## 3. Rebuild rules
Replay accepted events: session-started → session; wager-placed → wager(stake); wager-settled → won(payout)/
lost; wager-voided → voided; refund-recorded → refunded; financial-correction → corrected. Then compute
turnover/wins/losses/voids/GGR per the GGR formula. **Deterministic** — re-running yields identical output.

## 4. National aggregate (regulator-only)
Σ eligible operator GGR/turnover/winsPaid for one jurisdiction + currency; includedOperators,
excludedOperators (different currency), window, dataFreshness. Operators cannot read it.

## 5. No direct insertion
Totals **only** come from replaying accepted events. There is no method to inject a total; the integrity
verifier asserts `no-direct-total-insertion` (structural). Tested.

## 6. Data freshness
Each projection carries `dataFreshness` (latest accepted timestamp); national carries a window + freshness.
Stale totals are surfaced with the watermark, never as current.

## 7. Deployment binding
The pilot uses a certified-boundary-shaped sandbox projection; the **live operator Projection Platform**
binding is a deployment activity (C1 residual).
