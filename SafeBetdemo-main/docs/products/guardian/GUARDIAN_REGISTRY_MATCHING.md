# SafeBet Guardian — Registry Matching (ARCH-V4-C1)

Bounded, **deterministic** matching over synthetic registry records
(`products/guardian/src/registry/matching.ts`). **No AI / no fuzzy resolution at C1.**

## Signals (deterministic, in precedence order)
1. exact **licence reference**
2. **registration reference**
3. exact **legal name**, then **normalised** legal name
4. explicit **alias** (normalised)
5. known **brand** association → parent legal entity

`normalise()` lowercases, strips punctuation, drops common company suffixes
(`pty/ltd/limited/inc/llc/holdings/company/co`), and collapses whitespace — so
"X (Pty) Ltd" matches "X". Matching is **jurisdiction-scoped**: a caller for jurisdiction
A never matches jurisdiction B (scenario 6).

## Match states
`EXACT_MATCH · KNOWN_ALIAS_MATCH · MULTIPLE_CANDIDATES · NO_MATCH · REQUIRES_REVIEW`.

## No-match safety (invariant, tested)
`NO_MATCH` = **"no authoritative registry match found"**. It **never** means illegal:
`candidateOperatorIds` is empty and `requiresReview` is false; the resolver maps it to
`legalStanding: NO_MATCH`, `isIllegalDetermination: false`, with an explicit note.

## Ambiguity → human review
`MULTIPLE_CANDIDATES` (or any `requiresReview`) → the resolver returns
`REQUIRES_HUMAN_REVIEW` and never silently picks a candidate. Source conflict on a matched
licence → `SOURCE_CONFLICT` / `REQUIRES_REVIEW`. Both route to `human_review_record`.

## Resolution mapping
| matcher outcome | resolutionState | legalStanding |
|---|---|---|
| NO_MATCH | NO_MATCH | NO_MATCH (not illegal) |
| MULTIPLE_CANDIDATES | MULTIPLE_MATCHES | REQUIRES_HUMAN_REVIEW |
| matched + source conflict | SOURCE_CONFLICT / REQUIRES_REVIEW | CONFLICTING_SOURCE_DATA / REQUIRES_HUMAN_REVIEW |
| matched + fresh | MATCHED_AUTHORITATIVE | licence status (LICENSED/EXPIRED/…) |
| matched + stale | MATCHED_BUT_STALE | licence status |

Future entity resolution (fuzzy/AI) is explicitly deferred; C1 is deterministic only.
