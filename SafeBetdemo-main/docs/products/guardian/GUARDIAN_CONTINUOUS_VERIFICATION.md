# SafeBet Guardian — Continuous / Follow-up Verification (ARCH-V4-C10 §5–§8/§25)

Formalises repeated verification observations AFTER a C9 ACTIONED/VERIFIED outcome. Append-only
(`guardian.enforcement_verification_observation`), synthetic, and **bounded scheduling only** —
no high-frequency uncontrolled scanning and no real crawl/DNS/provider query
(`is_real_observation_source = false`, `is_external_network_call = false`).

## Provider state semantics preserved (C9 regression)
`PUBLISHED/REFERRED` · `ACKNOWLEDGED` · `UNDER_REVIEW` · `MORE_INFO_REQUIRED` · `ACTIONED` ·
`DECLINED` · `VERIFIED` · `CLOSED` · `EXPIRED` · `WITHDRAWN`. `ACKNOWLEDGED != ACTIONED`,
`ACTIONED != VERIFIED`, and `VERIFIED != GUARANTEED PERMANENT OUTCOME`.

## Observation kinds
`INITIAL` · `FOLLOWUP` · `PERIODIC` (bounded). Observation results are factual states (§7) — never
an illegal-again / auto-re-enforce conclusion.

## ACTIONED but verification NOT_VERIFIED (§25)
Recorded as a discrepancy → follow-up required; the state is **never** silently converted to VERIFIED.

## Historic immutability (§4/§26/§30)
A historic VERIFIED record remains historically true for its observation time even after a later
contrary observation. Re-entry APPENDS a new observation/candidate; it never rewrites the prior
VERIFIED record.
