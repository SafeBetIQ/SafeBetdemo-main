# Operator Connector Reconciliation (Milestone 4.4)

**ADR-006 (frozen) · No source record silently disappears.**

## 1. Report (`reconcile()`)
sourceDiscovered · sourceEligible · sourceExcluded · contributionsGenerated · contributionsSubmitted ·
contributionsAccepted · contributionsRejected · contributionsDeduplicated · revoked · retryBacklog ·
deadLetterBacklog · `balanced` · `differences[]`.

## 2. Balance equations
- **Source:** `discovered = eligible + excluded + revoked`.
- **Contributions:** `submitted = accepted + deduplicated + rejected + openDeadLetters`.
Any imbalance is reported in `differences` with an explanation — **every** difference is accounted for.

## 3. What it proves
- No source record is silently dropped (every record is eligible, excluded, or revoked).
- Every submitted contribution is accepted, deduplicated, rejected, or awaiting retry.
- Duplicate/revoked/expired contributions are counted, not lost.

## 4. Categories (kept distinct)
| Category | Meaning |
|---|---|
| eligible | resolved SB-PLR + approved attributes |
| excluded | duplicate sequence / no approved attributes / invalid mapping |
| deduplicated | idempotent replay/content-duplicate (one authoritative contribution) |
| rejected | permanent validation failure |
| revoked | source-revocation processed |
| retryBacklog / deadLetterBacklog | transient failures awaiting/beyond retry |

## 5. Validation
Tested: after processing (incl. a duplicate sequence) the report is `balanced` with no unexplained
difference.

## 6. Deployment binding
Connector↔Event-Platform reconciliation is exercised in-process; the **live operator↔national
reconciliation** (with wager/GGR) is Phase 4.5 (C1 remainder).
