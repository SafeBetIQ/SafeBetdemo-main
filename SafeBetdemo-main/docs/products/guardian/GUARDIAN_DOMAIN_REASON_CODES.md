# SafeBet Guardian — Domain Reason Codes (ARCH-V4-C2)

Explicit reason codes support human review. **They do not create a legal finding.**
Defined in `products/guardian/src/domain/types.ts` (`ReasonCode`).

| Reason code | Meaning (non-legal) |
|---|---|
| `NO_AUTHORITATIVE_REGISTRY_MATCH` | No authoritative registry match found — **NOT** illegal |
| `LICENCE_RECORD_STALE` | Matched licence's verification is stale (freshness STALE) |
| `BRAND_OPERATOR_MISMATCH` | Claimed brand resolves to a different operator than the claimed licence |
| `LICENCE_REFERENCE_MISMATCH` | Claimed licence reference belongs to a different operator |
| `SOURCE_CONFLICT` | Registry source records disagree; routed to human review |
| `CONTENT_GAMBLING_SIGNAL` | Gambling terminology present in synthetic page content |
| `REDIRECT_CHANGED` | Redirect target changed between observations |
| `DOMAIN_FINGERPRINT_CHANGED` | Content fingerprint (hash) changed between observations |
| `UNKNOWN_OPERATOR_REFERENCE` | Multiple/ambiguous candidate operators |

Reason codes feed the explainable investigation priority (`GUARDIAN_DOMAIN_REVIEW_POLICY.md`).
They are transparent inputs, never a black-box score, and never an illegality determination.
