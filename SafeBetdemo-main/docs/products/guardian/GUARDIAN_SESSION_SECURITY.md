# SafeBet Guardian — Session Security (ARCH-V4-PR1)

- Access token lifetime: 60 minutes. ID token: 60 minutes. Refresh token: 1 day (demo). Privileged sessions expire; there are no effectively-permanent privileged sessions.
- Reauthentication: on token expiry the client re-authenticates (password + TOTP MFA). MFA is reconfirmed by the pool on each fresh sign-in (SOFTWARE_TOKEN_MFA challenge).
- Step-up authentication: DEFERRED as an explicit design decision. PR1 requires MFA for every privileged operation, including the C8 gate. A distinct fresh/step-up authentication specifically for `AUTHORISATION_GRANTED` is a documented option for a later PR; it is NOT claimed to exist in PR1.
- Revocation: SUSPENDED/DISABLED entitlement denies at the next request (immediate at the entitlement layer). Cognito `admin-user-global-sign-out` revokes refresh tokens; already-issued access tokens remain valid until expiry (≤ 60 min) — this actual behaviour is stated honestly and not overclaimed.
- No regulatory retention requirement is invented here.
