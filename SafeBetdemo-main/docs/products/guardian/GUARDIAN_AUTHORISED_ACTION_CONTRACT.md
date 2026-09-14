# SafeBet Guardian — Authorised Action Contract (ARCH-V4-C8 → C9 handoff)

C8 DEFINES a bounded immutable snapshot that a FUTURE C9 enforcement-orchestration milestone
will consume. C8 never invokes C9 and never performs any external action.

## Contract (`AuthorisedActionContract`)
`authorisationReference, actionType, targetType, targetReference, jurisdiction, policyReference,
authorityReference, caseReference, evidenceManifestReference, evidenceManifestHash, authorisedAt,
expiresAt, conditions, status` plus `isEnforcementExecuted:false` and `isProviderNotified:false`
(so any consumer can see C8 performed no execution/notification).

## C9 eligibility (read-only gate; C8 does not consume it)
`isEligibleForOrchestration(contract)` returns true ONLY when `status == AUTHORISED`, not
expired, and not withdrawn. Expired / withdrawn / declined / pending records are never eligible.

## Safety
The contract is a read-only snapshot. C9 (a separate, later, independently-authorised milestone)
would consume it; C8 itself emits no external message and grants no provider permission.
