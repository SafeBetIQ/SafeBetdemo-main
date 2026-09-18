# SafeBet Guardian — MFA Policy (ARCH-V4-PR1)

- MFA is REQUIRED for every privileged Guardian human role: INVESTIGATOR, LEGAL_REVIEWER, AUTHORISING_OFFICER, POLICY_ADMINISTRATOR, GUARDIAN_ADMINISTRATOR.
- MFA method: software-token TOTP (RFC 6238), enforced at the identity provider (Cognito user pool, MfaConfiguration=ON). MFA is NOT satisfied by a request-body boolean, client UI state, a role fixture, or a caller-supplied session variable.
- Enforcement point: the identity/authentication system. The API additionally enforces an MFA gate for privileged roles and, for the C8 `AUTHORISATION_GRANTED` gate, requires a HUMAN AUTHORISING_OFFICER with MFA.
- Assurance claim: `mfa_satisfied` is derived from the trusted token `amr` when present, or from the verified server-side assertion that the issuer pool enforces MFA (`issuerEnforcesMfa`) — because Cognito omits `amr`. This assertion is set ONLY after verifying MfaConfiguration=ON, and is recorded in the runbook.
- Admin MFA: any identity administrator able to modify entitlements is itself an MFA-required role (GUARDIAN_ADMINISTRATOR) — Authorising Officers are not secured while identity admins are left weakly protected.
- Service principals (workers) never receive human MFA and can never hold a human role.
