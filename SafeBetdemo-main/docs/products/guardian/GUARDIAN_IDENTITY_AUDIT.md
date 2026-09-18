# SafeBet Guardian — Identity Audit (ARCH-V4-PR1)

Auth/identity events (safe metadata only; never credentials or full tokens): `AUTHENTICATION_SUCCEEDED, AUTHENTICATION_FAILED, MFA_REQUIRED, MFA_SUCCEEDED, MFA_FAILED, SESSION_REJECTED, ACCOUNT_DISABLED, ENTITLEMENT_DENIED, PRIVILEGED_ACCESS_ALLOWED, PRIVILEGED_ACCESS_DENIED`.

- Business audit (case review, evidence access, legal review, policy administration, authorisation, orchestration review, re-entry review) correlates with the trusted subject + role + jurisdiction + session/auth context — WITHOUT storing the raw auth token.
- No access/refresh token, password, or MFA seed is ever written to an audit event or a business table.
- Identity privacy/minimisation: only subject, provider, role, jurisdiction, account state and timestamps are stored. No unnecessary IdP profile data; no unrelated personal profiling.
