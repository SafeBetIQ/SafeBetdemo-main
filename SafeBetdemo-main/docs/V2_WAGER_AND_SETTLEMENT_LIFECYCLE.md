# Wager & Settlement Lifecycle (Milestone 4.5)

**ADR-006 (frozen) · Append-only · History preserved.**

## 1. States + transitions
`placed → won | lost | voided | refunded`; `won | lost → voided | corrected`. Terminal: voided, refunded,
corrected.

## 2. Rejected transitions
- Settling an **unknown** wager → `settle-unknown-wager`.
- Settling a wager **twice** → `double-settlement`.
- Voiding an already-final wager improperly → `invalid-transition`.
- Refund **exceeding** the eligible stake → `refund-exceeds-eligible`.
- Changing tenant / SB-PLR / currency / session (reassignment) → `reassign-denied` / `currency-mismatch`.

## 3. Session lifecycle
`session-started` registers a session (tenant/operator/SB-PLR/jurisdiction/currency); `session-ended` marks
it closed. A wager on an unknown / cross-tenant / wrong-player / ended session is rejected.

## 4. Reversals (append-only)
Void / refund / correction **never delete or modify** the original accepted event — they append a new event
and change the wager's derived state, so projections exclude the reversed wager. Corrections reference the
original event id.

## 5. Financial effect (via projection)
| Final state | Turnover | Wins paid | GGR effect |
|---|---|---|---|
| won | + stake | + payout | + (stake − payout) |
| lost | + stake | 0 | + stake |
| voided / refunded | 0 | 0 | 0 (reversed) |
| placed (unsettled) | 0 (excluded from GGR) | 0 | 0 |
| corrected | per correction (original preserved) | — | — |

## 6. Validation
Tested: double-settlement + unknown-wager rejected; void/refund reverse (turnover/GGR → 0); over-refund
rejected; original event preserved.
