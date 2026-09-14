# SafeBet Guardian — Legal / Regulatory Review Workflow (ARCH-V4-C8)

The Legal Reviewer considers the case, policy, authority reference, evidence, jurisdiction,
action scope, conditions, exceptions and expiry. The reviewer does **not** execute any action.

## Proposed-action lifecycle
`DRAFT → READY_FOR_LEGAL_REVIEW → LEGAL_REVIEW_REQUIRED → LEGAL_REVIEW_COMPLETE →
READY_FOR_AUTHORISATION → (AUTHORISED | DECLINED | WITHDRAWN | EXPIRED)`. There is **no
EXECUTED state**.

## Legal review outcomes (bounded)
`SUFFICIENT_FOR_AUTHORISATION_REVIEW, INSUFFICIENT_EVIDENCE, POLICY_NOT_APPLICABLE,
AUTHORITY_NOT_ESTABLISHED, JURISDICTION_MISMATCH, RETURN_TO_INVESTIGATION,
ADDITIONAL_INFORMATION_REQUIRED`.

## Evidence gate (hard)
A proposed action cannot reach AUTHORISED unless required evidence exists, is accessible to the
reviewer, `integrity_status = VERIFIED`, jurisdiction matches, and classification access is
satisfied. `INTEGRITY_FAILED` or missing evidence → AUTHORISATION BLOCKED. Evidence is consumed
through the governed **Evidence Reference Contract** (`guardian.evidence_reference` /
`resolveEvidenceReference`) — never the C7 base tables. Where a package is required, the C7
export/manifest (reference + SHA-256 manifest hash) is recorded, not duplicated.

## Policy exceptions
Exceptions (e.g. `MANUAL_ESCALATION_REQUIRED`, `COURT_REVIEW_REQUIRED`) block/route the review —
they do not silently disappear (reason code `POLICY_EXCEPTION_ESCALATION`).
