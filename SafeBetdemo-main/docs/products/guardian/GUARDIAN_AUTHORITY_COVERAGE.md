# SafeBet Guardian — Authority-Coverage Assessment (ARCH-V4-C10 §16–§19)

C10 determines an INTERNAL ROUTING coverage assessment. **C10 does NOT make the final legal
authority determination** (`is_final_legal_determination = false`) — that remains C8.

## States (§16)
`EXPLICITLY_COVERED` · `NOT_COVERED` · `COVERAGE_UNCLEAR` · `AUTHORITY_EXPIRED` ·
`AUTHORITY_WITHDRAWN` · `AUTHORITY_SUPERSEDED` · `REQUIRES_C8_REVIEW`.

## Never infer standing authority (§17)
Existing authority may be treated as potentially covering a re-entry target ONLY when the C8
authority/policy scope EXPLICITLY says so — i.e. machine-readable coverage metadata that names
BOTH the relationship class AND the exact candidate target reference, in the matching jurisdiction,
while the authority is still live. Coverage is never inferred from same operator / similar domain /
same brand / same payment reference / same infrastructure / same app name alone. Missing explicit
coverage ⇒ `COVERAGE_UNCLEAR` ⇒ C8 review.

## Scope immutability (§18)
The C8 authorised scope is immutable. A re-entry candidate whose target is outside the exact
authorised scope never mutates the old `AuthorisedActionContract` — it routes to a NEW / superseding
C8 authorisation.

## Covered fast path (§19)
An expedited `EXISTING_AUTHORITY_REVIEW` route is available ONLY when: the existing authority is
still valid; explicit policy/authority scope covers the candidate; evidence is verified; jurisdiction
matches; a human reviewer confirms the relationship/coverage; and C8 produces/confirms a valid
`AuthorisedActionContract`. Only THEN may C9 orchestrate. **C10 itself never dispatches.**
