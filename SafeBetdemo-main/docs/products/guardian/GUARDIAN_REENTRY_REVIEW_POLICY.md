# SafeBet Guardian — Re-entry Review & Routing Policy (ARCH-V4-C10 §20–§22/§40–§44)

Human review is REQUIRED before any routing. Reviewer role (INVESTIGATOR / LEGAL_REVIEWER) and
jurisdiction are bound from the authenticated Guardian principal — never self-asserted from the
request body (same lesson as C9 §42).

## Review outcomes (§21) — no `AUTO_BLOCK_APPROVED`
`SAME_TARGET_CONFIRMED` · `RELATED_TARGET_CONFIRMED` · `RELATIONSHIP_UNRESOLVED` · `FALSE_POSITIVE`
· `EXISTING_AUTHORITY_REVIEW_REQUIRED` · `NEW_INVESTIGATION_REQUIRED` · `INSUFFICIENT_EVIDENCE`.

## Routing outcomes (§20) — target C6/C8 only
| Coverage / review | Routing outcome | Target |
|---|---|---|
| explicit valid coverage + confirmed | `EXISTING_AUTHORITY_REVIEW` | C8 authority review (still no C9 until a valid contract) |
| authority expired/withdrawn/superseded | `NEW_C8_AUTHORISATION_REQUIRED` | C8 |
| not covered / out of scope | `NEW_C8_AUTHORISATION_REQUIRED` | C8 |
| coverage unclear | `COVERAGE_REVIEW` | C8 |
| new investigation required | `NEW_INVESTIGATION` | C6 |
| false positive | `CLOSED_FALSE_POSITIVE` | none |

## Authority stays in C8; dispatch stays in C9 (§43/§44)
C10 cannot create `AUTHORISATION_GRANTED` (only request a C8 authority review) and cannot set
`PUBLISHED/REFERRED/ACKNOWLEDGED/ACTIONED` for a new enforcement request. C10 records a routing
outcome only; it has no capability to enqueue C9 enforcement (§40).
