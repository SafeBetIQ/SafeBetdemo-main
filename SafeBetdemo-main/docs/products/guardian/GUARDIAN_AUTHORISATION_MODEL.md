# SafeBet Guardian — Authorisation Model (ARCH-V4-C8)

C8 records a human-approved AUTHORISED ACTION RECORD and STOPS. It never executes and never
notifies a provider.

## Authorisation gate (deterministic; all must pass for AUTHORISED)
1. Policy current + applicable (ACTIVE/approved, effective window, not expired/superseded).
2. Action type permitted by the policy version.
3. Authority reference present.
4. Jurisdiction match (proposed action + evidence + policy).
5. Legal review complete (`SUFFICIENT_FOR_AUTHORISATION_REVIEW`) where policy requires it.
6. Evidence gate (HARD): required count present, integrity `VERIFIED`, jurisdiction match.
7. Separation of duties: Investigator != Legal Reviewer != Authorising Officer (3 distinct).
8. Final Authoriser is a HUMAN `AUTHORISING_OFFICER` (never `SYSTEM_SERVICE`).
9. Scope bounded (concrete target + type + jurisdiction).
10. No unresolved blocking policy exception.

Any failure -> `AUTHORIZATION_BLOCKED` with explicit reason codes (see
[GUARDIAN_ACTION_TYPES.md](./GUARDIAN_ACTION_TYPES.md) / the reason-code list in code). No
black-box score.

## Reason codes
`POLICY_NOT_FOUND, POLICY_EXPIRED, POLICY_SUPERSEDED, AUTHORITY_NOT_ESTABLISHED,
JURISDICTION_MISMATCH, EVIDENCE_MISSING, EVIDENCE_INTEGRITY_FAILED, LEGAL_REVIEW_REQUIRED,
LEGAL_REVIEW_INCOMPLETE, SOD_VIOLATION, SCOPE_INVALID, AUTHORISER_NOT_PERMITTED,
CONDITION_NOT_MET, ACTION_TYPE_NOT_PERMITTED, AUTHORIZATION_EXPIRED, POLICY_EXCEPTION_ESCALATION`.

## Authorisation status (bounded)
PENDING, AUTHORISED, DECLINED, WITHDRAWN, EXPIRED, SUPERSEDED. **No** ACTIONED / BLOCKED /
REMOVED / PROVIDER_ACKNOWLEDGED — those belong to later architecture.

## Machine authorisation is impossible (two layers)
- **Code:** the gate returns `AUTHORISER_NOT_PERMITTED` unless `authorisingOfficerRole ==
  AUTHORISING_OFFICER`; `SYSTEM_SERVICE` can never authorise.
- **Privilege:** `guardian_policy_worker` has NO INSERT on `action_authorisation` (or
  `legal_review`) — proven live (insert DENIED). The worker may only PREPARE a
  `proposed_action`.

## Immutability, expiry, withdrawal
Once AUTHORISED, action type / target / jurisdiction / policy / evidence package / scope are
not silently modified — a material change requires a new/superseding proposed action + new
authorisation (`scope_snapshot` captures the authorised scope). Authorisations expire
(`expires_at`) and can be human-withdrawn; history is append-only (`authorisation_history`).
Expired/withdrawn records are not eligible for future C9 consumption.

## No external side effect
A successful AUTHORISED state produces **0** provider API calls / messages / emails / SFTP
writes / block commands. The C8 module has no outbound/provider client (boundary-tested).
