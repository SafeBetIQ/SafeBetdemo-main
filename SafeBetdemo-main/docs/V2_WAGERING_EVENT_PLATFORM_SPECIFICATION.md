# Wagering Event Platform Specification (Milestone 4.5)

**ADR-006 (frozen) · SANDBOX / PILOT-PATH · Authoritative for accepted events.**

## 1. Event types
`session-started · session-ended · wager-placed · wager-settled · wager-voided · refund-recorded ·
financial-correction` (`fin-evt-1`). Mapped to the certified Event Platform families; where a category is
unsupported it is documented (not worked around).

## 2. Event contract (integer minor units; anonymous SB-PLR)
eventId · eventType · schema version · timestamps · sourceOperatorId · tenantId · jurisdiction · sbPlr ·
sessionId · wagerId? · product? · channel? · currency (ISO-4217) · **amountMinor (integer)** ·
settlementResult? · sourceSequence? · idempotencyKey · sourceSystemRef · correctionOfEventId?.

## 3. Acceptance pipeline (all must pass)
schema (+ PII scan + integer precision + ISO-4217) → auth/attribution → currency consistency →
idempotency → replay → sequence → **session integrity** → **wager integrity + lifecycle** → persist
(append-only) → audit. Rejected events produce safe records (no plaintext).

## 4. Authority & no-bypass
Accepted events are the **source of truth**; projections replay them. There is **no** direct-total
insertion, no projection bypass, and no Digital-Twin/dashboard mutation. Rejected events remain visible.

## 5. Access
Submit = authorised `financial-service` (matching operator/tenant/jurisdiction). Read = regulator or
service; operators are scoped to their own tenant; national is regulator-only; unauthenticated/casino-admin
denied.

## 6. Deployment binding
The pilot boundary is in-process; the live/deployed certified Event Platform transport is a deployment
binding (C1 residual).
