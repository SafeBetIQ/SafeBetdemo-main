# SafeBet Guardian — Authentication Assurance (ARCH-V4-PR1)

## Token validation (cryptographic; no trust of unsigned claims)
RS256 signature via issuer JWKS (kid) → issuer → audience/client_id → expiry → not-before → token_use → subject. `alg:none` and HS256 downgrade are rejected. No signing key is committed; keys come from the rotating JWKS with a TTL cache and a rotation-tolerant refetch on an unknown kid.

## MFA assurance
`mfa_satisfied` is true when the trusted token carries an `amr` MFA marker (or an AAL2 `acr`) OR when the verified server-side assertion `issuerEnforcesMfa` is set (the Cognito pool is MFA-required, so a valid token evidences a completed MFA challenge). Cognito omits `amr`, so the pool-enforcement assertion is the operative signal on Demo. It is a deployment config asserting a verified IdP property — never a claim a caller can supply. `assurance_level` is `AAL2_MFA` when satisfied, else `AAL1_SINGLE_FACTOR`.

## Gate
Privileged roles require `mfa_satisfied`. The C8 `AUTHORISATION_GRANTED` gate additionally requires a HUMAN AUTHORISING_OFFICER. A valid identity with the officer role but without MFA assurance is denied (403).
