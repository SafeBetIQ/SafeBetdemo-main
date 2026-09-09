# SafeBet Guardian — Case Retention & Privacy (ARCH-V4-C6)

## Purpose limitation & minimisation (§46)
Each case records `purpose`, `jurisdiction`, `classification`, `retention_policy`, and
`access_scope`. Cases do **not** copy all intelligence/evidence — they hold **references**
(`case_intelligence_link`, `case_evidence_link`) with minimisation. No secrets or
unnecessary personal data in notes. Synthetic only.

## Retention (§47)
Retention is configurable synthetic metadata: `retention_policy` defaults to
`POLICY_DEFINED`. C6 does **not** invent or hard-code statutory retention periods; a real
retention schedule requires an approved policy and is out of scope for the synthetic Demo.

## Access
Jurisdiction-scoped RLS. `access_scope` defaults to `JURISDICTION_LOCAL`; no
cross-jurisdiction case access without explicit permitted scope. `anon` and SafeBet IQ
identities are denied.

## Not a data-aggregation store
Cases must not become uncontrolled data aggregation. Reference-based linking + jurisdiction
scoping + classification keep the case record minimal and purpose-bound.
