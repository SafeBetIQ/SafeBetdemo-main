# SafeBet Guardian — Policy Versioning & Supersession (ARCH-V4-C8)

## Versioning
Policies are versioned (`policy_version`, unique `(policy_id, version_no)`). Each version has its
own effective window, permitted actions, conditions and exceptions.

## Effective dating
Authorisation may not occur under a future, expired, withdrawn or superseded policy version
(reason codes `POLICY_EXPIRED` / `POLICY_SUPERSEDED`; applicability `NOT_APPLICABLE` for a future
window).

## Supersession
When policy version B supersedes A, new reviews use B where effective; historical authorisations
preserve their A `version_id`. Supersession never mutates historical records (append-only
`policy_status_history`).

## Historical integrity
A historical case/authorisation retains the exact policy version used at authorisation time; a
later policy update does not rewrite past authorisation reasoning (tested: a decision retains its
`policyVersionId`).
