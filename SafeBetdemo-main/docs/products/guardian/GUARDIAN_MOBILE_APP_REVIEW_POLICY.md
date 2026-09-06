# SafeBet Guardian — Mobile App Review Policy (ARCH-V4-C3)

## Investigation priority (NOT legal-illegality probability)
Derived from transparent reason codes (`derivePriority`), never a black-box score.
`LOW/MEDIUM/HIGH_REVIEW_PRIORITY`:
- **HIGH** — ≥2 independent mismatch/conflict indicators, OR NO_MATCH + gambling content.
- **MEDIUM** — a single mismatch/conflict indicator, a stale licence, or a source conflict.
- **LOW** — matched authoritative + fresh, no mismatch/conflict.
Thresholds are Demo policy — **not** legal thresholds.

## Review states + bounded decisions
States: `NEW → TRIAGED → REQUIRES_REVIEW → VERIFIED_REFERENCE / UNRESOLVED → CLOSED`.
Decisions: `REFERENCE_MATCH_CONFIRMED · NO_REFERENCE_FOUND · SOURCE_DATA_INSUFFICIENT ·
REQUIRES_FURTHER_INVESTIGATION · FALSE_POSITIVE · DUPLICATE_SUBJECT`.

A reviewer may **not** record `APP_REMOVAL_APPROVED`, `PLATFORM_REFERRAL_APPROVED`, or a
legal-illegality determination — those belong to future enforcement orchestration.
Synthetic roles only; MFA hard gate blocks real privileged use.

## Classification vocabulary (non-final)
`REFERENCE_MATCHED · POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION · REQUIRES_HUMAN_REVIEW ·
INSUFFICIENT_DATA`. No final legal status from any automated path.
