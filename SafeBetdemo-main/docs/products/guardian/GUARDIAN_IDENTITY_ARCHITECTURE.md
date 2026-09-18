# SafeBet Guardian — Identity Architecture (ARCH-V4-PR1)

Production-ready human identity for Guardian privileged roles. DEMO / test identities only; no real
regulator user is activated.

## Flow
`IDENTITY → AUTHENTICATION (Cognito OIDC) → MFA (TOTP required) → cryptographic JWT validation → TRUSTED SUBJECT → governed entitlement (role + jurisdiction + account state) → MFA gate → authenticated GuardianPrincipal → privileged API`.

## Components
- AWS Cognito User Pool `eu-west-1_2Hfe3vYk5` (MfaConfiguration=ON, software-token TOTP, admin-create-only, RS256 tokens, rotating JWKS). App client `3rbeba55nie1ugn3olvudnnhsn` (no secret).
- JWT middleware `products/guardian/src/identity-auth` (jwt/jwks/assurance/entitlement/principal/authenticate/authorize). Node built-in crypto only; no new dependency; no pinned key.
- Governed entitlement `guardian.identity_entitlement` (subject → role → jurisdiction → account_state → window).
- Least-privilege resolver role `guardian_identity_resolver` (SELECT identity_entitlement + INSERT audit only).

## Boundaries
- Role and jurisdiction come ONLY from the entitlement; never from a request body, token custom claim, email domain, or org name.
- No synthetic fallback on the jwt path. Human vs service principals are distinct; the C8 `AUTHORISATION_GRANTED` gate is HUMAN `AUTHORISING_OFFICER` + MFA only.
- AWS IAM SigV4 protects the edge (service auth); this identity layer is the HUMAN auth layer. The two are distinct and both apply.

## Feature flag
`GUARDIAN_AUTH_MODE = jwt` (production-ready) | `synthetic` (isolated test harness / demo). Authentication must NEVER be disabled in any future Production configuration.
