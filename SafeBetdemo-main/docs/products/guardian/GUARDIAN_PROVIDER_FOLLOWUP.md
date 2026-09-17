# SafeBet Guardian — Provider Response Follow-up (ARCH-V4-C10 §23–§25)

## MORE_INFO_REQUIRED (§23)
Governed follow-up. Supplementary evidence is NOT a bulk attach of all Evidence Vault material — it
uses a bounded evidence package (purpose + classification + jurisdiction + human/governed approval)
and C7 evidence references only (no body duplication).

## DECLINED (§24)
Routed for review / scope correction / authority review / additional evidence. A business DECLINE
is never retried as a network error, and eventual compliance is never fabricated.

## ACTIONED but NOT_VERIFIED (§25)
Discrepancy recorded → `FOLLOW_UP_REQUIRED`. Never silently converted to VERIFIED.

## VERIFIED then re-entry (§26)
A later `TARGET_AVAILABLE` / related-target observation creates a `REENTRY_CANDIDATE`. The original
verification record is never erased.
