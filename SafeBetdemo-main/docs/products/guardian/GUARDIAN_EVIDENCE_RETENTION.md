# SafeBet Guardian — Evidence Retention & Holds (ARCH-V4-C7)

## Retention
No hard-coded statutory retention period. `retention_policy` defaults to `POLICY_DEFINED`;
`retention_review_at` is configurable. A real schedule requires an approved policy (out of
scope for the synthetic Demo).

## Legal / preservation hold
`guardian_evidence_hold` (ACTIVE/RELEASED) means **DO NOT DELETE WHILE HOLD ACTIVE** — it is
**not** a legal finding. Records `hold_id`, evidence/case scope, reason, `placed_by`,
`placed_at`, `released_by`, `released_at`, jurisdiction, audit.

**Hold SoD:** PLACE (Investigator / Legal Reviewer), REVIEW (Legal Reviewer / Authorising
Officer), RELEASE (**Legal Reviewer only** — not any evidence consumer). Proven: an
Investigator cannot RELEASE a hold; a Legal Reviewer can.

## Disposition
Destructive purge is **disabled** in C7 (no destructive operation on synthetic fixtures
unless a controlled test explicitly needs it). A future lifecycle (RETENTION_REVIEW_DUE ->
DISPOSITION_APPROVED -> DISPOSED) would be audited and policy-referenced. **Disposition is
blocked while a preservation hold is ACTIVE** (`dispositionBlockedByHold`).

## Closed case (scenario 18)
A closed case does not silently delete its evidence — evidence remains retrievable per policy
via the controlled C7.2 reader path (access-policy + byte verification + audit); there is no
automatic deletion (no DeleteObject grant exists).
