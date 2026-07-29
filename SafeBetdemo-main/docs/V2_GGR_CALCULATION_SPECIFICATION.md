# GGR Calculation Specification (Milestone 4.5)

**ADR-006 (frozen) · Integer minor units · Single currency per operator.**

## 1. Formula (exact)
```
Turnover  = Σ stake(wager)   over wagers with final state ∈ {won, lost}
WinsPaid  = Σ payout(settle) over won settlements (of non-void/refund wagers)
GGR       = Turnover − WinsPaid
```
All arithmetic is **integer minor units** (e.g. cents) — exact summation, **no floating-point**.

## 2. Definitions
| Term | Definition |
|---|---|
| Stake | wager-placed `amountMinor` (positive integer) |
| Turnover | Σ stake over settled non-void/refund wagers |
| Win / payout | wager-settled `won` `amountMinor` |
| Loss | stake of a `lost` wager (informational) |
| Void | wager fully reversed → excluded |
| Refund | wager fully reversed (refund ≤ stake) → excluded |
| Correction | references original event; original preserved |
| GGR | Turnover − WinsPaid |

## 3. Per metric, recorded
formula · included event types · excluded event types (void/refund; unsettled) · currency · time window ·
projection version · source-event count · adjustment treatment (reversal via replay) · rounding (n/a —
integer).

## 4. Levels
GGR is computed at operator level and aggregated to national (Σ eligible operators, single currency).
Per-product GGR is exposed; per-player and per-session are derivable from the same replay.

## 5. Currency
One currency per operator (mismatch rejected). The sandbox uses **ZAR** only — multi-currency conversion is
**not** implemented (no invented exchange rate; different currencies are **not** summed). Stated limitation.

## 6. Bonuses / promotions
**Not** implemented — bonus/free-bet/promotional/cashback/loyalty value is **explicitly excluded**, never
silently treated as cash wagering.

## 7. Validation
Tested: turnover 200, winsPaid 150 → GGR 50; void+refund → turnover/GGR 0; end-to-end turnover 500, payout
300 → GGR 200; national = Σ operator GGR; integer precision.
