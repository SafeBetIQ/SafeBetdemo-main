# SafeBet Guardian — Domain Review Policy (ARCH-V4-C2)

## Investigation priority (NOT legal-illegality probability)
Priority is derived from **transparent reason codes** (`derivePriority`), never a black-box
score. Categories: `LOW_REVIEW_PRIORITY` / `MEDIUM_REVIEW_PRIORITY` / `HIGH_REVIEW_PRIORITY`.

- **HIGH** — ≥2 independent mismatch/conflict indicators, OR `NO_AUTHORITATIVE_REGISTRY_MATCH`
  together with `CONTENT_GAMBLING_SIGNAL`.
- **MEDIUM** — a single mismatch/conflict indicator, a stale licence record, or a source conflict.
- **LOW** — matched authoritative + fresh, no mismatch/conflict.

Thresholds are **Demo policy**, configurable — explicitly **not** legal thresholds.

## Review queue states
`NEW → TRIAGED → REQUIRES_REVIEW → VERIFIED_REFERENCE / UNRESOLVED → CLOSED`.
No enforcement states exist at C2.

## Bounded human-review decisions (intelligence only)
`REFERENCE_MATCH_CONFIRMED · NO_REFERENCE_FOUND · SOURCE_DATA_INSUFFICIENT ·
REQUIRES_FURTHER_INVESTIGATION · FALSE_POSITIVE · DUPLICATE_SUBJECT`.

A reviewer may **not** record `BLOCK APPROVED`, any payment action, or a legal-illegality
determination — those are later controlled workflows. Synthetic Investigator/reviewer roles
only; the MFA hard gate blocks all real privileged human use.

## Classification vocabulary (non-final)
`REFERENCE_MATCHED · POTENTIALLY_UNAUTHORISED_REQUIRES_VERIFICATION · REQUIRES_HUMAN_REVIEW ·
INSUFFICIENT_DATA`. No final legal status is produced by any automated path.
