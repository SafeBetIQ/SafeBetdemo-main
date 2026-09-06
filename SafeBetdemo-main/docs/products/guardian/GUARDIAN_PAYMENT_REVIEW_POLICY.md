# SafeBet Guardian — Payment Review Policy (ARCH-V4-C4)

## Investigation priority (NOT probability of illegality)
Derived from transparent reason codes. `LOW/MEDIUM/HIGH_REVIEW_PRIORITY`:
- **HIGH** — NO registry match, or ≥2 independent mismatch/conflict indicators.
- **MEDIUM** — a single mismatch/conflict indicator, a stale licence, or a source conflict.
- **LOW** — matched authoritative + fresh.
Demo policy — not legal thresholds.

## Review states + bounded decisions
`NEW → TRIAGED → REQUIRES_REVIEW → VERIFIED_REFERENCE / UNRESOLVED → CLOSED`. Decisions:
`REFERENCE_MATCH_CONFIRMED · NO_REFERENCE_FOUND · SOURCE_DATA_INSUFFICIENT ·
REQUIRES_FURTHER_INVESTIGATION · FALSE_POSITIVE · DUPLICATE_SUBJECT`.

A reviewer may **not** record `PAYMENT_BLOCK_APPROVED`, `ACCOUNT_FREEZE_APPROVED`, or
`MERCHANT_TERMINATION_APPROVED` — those belong to future Enforcement Orchestration. Synthetic roles
only; MFA hard gate. No provider-response workflow at C4.
