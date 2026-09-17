# SafeBet Guardian — Re-entry Reason Codes & Relationship Types (ARCH-V4-C10)

Deterministic, explainable. **No automatic legal conclusion.** Reason codes accompany every
candidate so a human reviewer sees *why* it surfaced.

## Relationship types (§10) — correlation labels, NOT legal or same-entity findings
`SAME_TARGET_REAPPEARED` · `KNOWN_ALIAS` · `MIRROR_REFERENCE` · `REDIRECT_RELATIONSHIP` ·
`BRAND_RELATIONSHIP` · `ENTITY_RELATIONSHIP` · `INFRASTRUCTURE_REUSE` · `APP_RELISTING` ·
`PAYMENT_REFERENCE_REUSE` · `GEO_AVAILABILITY_CHANGE` · `UNKNOWN_RELATIONSHIP`.

`ENTITY_RELATIONSHIP` (same-entity) is asserted ONLY when an operator signal is corroborated by
at least two independent shared governed references; otherwise the label degrades to
`UNKNOWN_RELATIONSHIP` pending human confirmation (`SIMILAR != SAME`).

## Reason codes (§12)
`ORIGINAL_TARGET_REAPPEARED` · `KNOWN_ALIAS_OBSERVED` · `MIRROR_TARGET_OBSERVED` ·
`REDIRECT_RELATIONSHIP_OBSERVED` · `COMMON_BRAND_REFERENCE` · `COMMON_OPERATOR_REFERENCE` ·
`COMMON_PAYMENT_REFERENCE` · `COMMON_APP_REFERENCE` · `COMMON_INFRASTRUCTURE_REFERENCE` ·
`GEO_AVAILABILITY_CHANGED` · `PRIOR_VERIFIED_ACTION_EXISTS` · `AUTHORITY_COVERAGE_UNKNOWN` ·
`EXISTING_AUTHORITY_EXPIRED` · `EXISTING_AUTHORITY_WITHDRAWN` · `NEW_TARGET_OUTSIDE_SCOPE` ·
`SOURCE_CONFLICT` · `INSUFFICIENT_EVIDENCE`.

## Review priority (§11)
`LOW | MEDIUM | HIGH` — a REVIEW PRIORITY only. There is deliberately no illegal-probability,
re-enforcement, or enforcement score anywhere in C10.
