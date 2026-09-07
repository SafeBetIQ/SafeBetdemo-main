# SafeBet Guardian — Geo Intelligence Review Policy (ARCH-V4-C5)

Geo Intelligence routes findings to **human review**. It never makes an automated legal
determination and never authorises enforcement or geo-blocking.

## Review states
`NEW` → `TRIAGED` → `REQUIRES_REVIEW` → (`VERIFIED_REFERENCE` | `UNRESOLVED`) → `CLOSED`.

## Allowed bounded outcomes
`REFERENCE_MATCH_CONFIRMED`, `REGION_REFERENCE_CONFIRMED`, `SOURCE_DATA_INSUFFICIENT`,
`INCONSISTENCY_CONFIRMED`, `REQUIRES_FURTHER_INVESTIGATION`, `FALSE_POSITIVE`,
`DUPLICATE_SUBJECT`.

## Explicitly NOT available
`GEO_BLOCK_APPROVED`, `SERVICE_BLOCK_APPROVED`, `LEGAL_ILLEGALITY_CONFIRMED`, and any
provider referral (ISP/DNS/hosting/PSP). Enforcement orchestration is a **later, separate**
milestone with its own authority model — it is not part of C5.

## What review CANNOT do
- Determine illegality (`isIllegalDetermination` is always false).
- Authorise enforcement (`isEnforcementAuthorised` is always false).
- Trigger geo-blocking, DNS blocking, traffic diversion, or subscriber action.
- Introduce person-level location data (rejected at ingest).

## Human accountability
A geo inconsistency (region/licence mismatch, stale reference, source conflict) is an
**investigation signal** for a qualified human reviewer, presented with the evidence
reference, freshness breakdown, and governed cross-module reference states.
