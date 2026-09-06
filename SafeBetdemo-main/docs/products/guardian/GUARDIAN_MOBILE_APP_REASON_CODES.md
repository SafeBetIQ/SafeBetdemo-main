# SafeBet Guardian — Mobile App Reason Codes (ARCH-V4-C3)

Explicit reason codes support review; they are **not** legal violations. Defined in
`products/guardian/src/app/types.ts` (`AppReasonCode`).

| Reason code | Meaning (non-legal) |
|---|---|
| `NO_AUTHORITATIVE_REGISTRY_MATCH` | no authoritative registry match — **NOT** illegal |
| `DECLARED_LICENCE_MISMATCH` | declared licence resolves to a different operator |
| `DECLARED_OPERATOR_MISMATCH` | declared operator inconsistent with registry |
| `DECLARED_BRAND_MISMATCH` | declared brand resolves to a different operator than the declared licence |
| `LICENCE_RECORD_STALE` | matched licence verification is stale |
| `SOURCE_CONFLICT` | registry sources disagree; human review |
| `PUBLISHER_CHANGED` | publisher changed between observations |
| `APP_IDENTIFIER_CHANGED` | app identifier changed |
| `DECLARED_WEBSITE_CHANGED` | declared website changed |
| `METADATA_FINGERPRINT_CHANGED` | metadata hash changed |
| `GAMBLING_CONTENT_SIGNAL` | gambling terminology in synthetic metadata |
| `UNKNOWN_PUBLISHER_REFERENCE` | ambiguous/absent publisher/operator reference |

Reason codes feed the explainable investigation priority (review-policy doc). Never a
black-box score; never an illegality determination.
