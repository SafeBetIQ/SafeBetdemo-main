# ADR-0021 — Guardian Privileged Identity, MFA & Authentication Assurance (ARCH-V4-PR1)

- **Status:** Accepted (Demo / pre-production; synthetic test identities only)
- **Date:** 2026-09-18
- **Context:** Guardian C0–C10 authenticated privileged principals only via a synthetic in-memory
  registry (`SYNTHETIC_PRINCIPALS`) selected by a request header (`x-guardian-principal`) behind
  API-Gateway IAM SigV4. That is a service-auth boundary, not a human-identity system: role and
  jurisdiction effectively rode on a header-supplied id, and there was no MFA, no token validation,
  and no account lifecycle. PR1 must establish a production-ready human identity foundation without
  changing any C1–C10 business semantics or activating real regulator users.

## Decision
Adopt **AWS Cognito User Pool (OIDC) + a cryptographic JWT middleware + a governed DB entitlement**:
1. **Cognito User Pool** (`eu-west-1_2Hfe3vYk5`, demo) as the managed directory: `MfaConfiguration=ON`
   with **software-token (TOTP) MFA required**, admin-create-only (no self-signup), RS256-signed
   tokens, rotating JWKS. App client `3rbeba55nie1ugn3olvudnnhsn` (no secret).
2. **JWT middleware** (`products/guardian/src/identity-auth`, pure/testable, Node built-in crypto —
   no new dependency, no pinned key): validates RS256 signature via the issuer JWKS (kid), plus
   issuer, audience/client_id, expiry, not-before, token_use, subject. Rejects `alg:none`/HS downgrade.
3. **Governed entitlement** (`guardian.identity_entitlement`) keyed by the trusted token `sub` is the
   ONLY source of Guardian role + permitted jurisdiction + account state — never a request body,
   token custom claim, email domain, or org name. Account state + effective window enable
   suspension/disablement/expiry to deny even with a valid token.
4. **MFA assurance:** from `amr` when the IdP emits it; Cognito omits `amr`, so we use a verified
   SERVER-SIDE assertion `issuerEnforcesMfa` (the pool is MFA-required, so a valid token structurally
   evidences a completed MFA challenge). Never a caller-supplied flag.
5. **No synthetic fallback:** in `jwt` mode the synthetic registry is never consulted; a missing/invalid
   token or a body carrying a known synthetic id can never become a privileged principal. The synthetic
   path survives only for the automated test harness/demo behind `GUARDIAN_AUTH_MODE=synthetic`.
6. **Human vs service:** workers remain IAM/service principals; the entitlement table is human-only
   (`is_human` CHECK), so a service principal can never hold a human role or reach the C8 gate.
7. **C8 gate (strongest):** `AUTHORISATION_GRANTED` requires a HUMAN `AUTHORISING_OFFICER` with MFA.
8. **Least-privilege resolver:** the API looks up entitlements via a dedicated role
   `guardian_identity_resolver` (SELECT `identity_entitlement` + INSERT `audit_context` only; no
   UPDATE/DELETE, no other table, no BYPASSRLS) with its own secret.

## Alternatives considered
- **Pre-Token-Generation Lambda to inject `amr`** — more infra; the trigger would itself assert MFA. The
  verified pool-enforcement assertion is simpler and equally honest.
- **Roles as Cognito groups/claims** — rejected: role must be a governed, administratively-managed,
  audited server-side entitlement, not an IdP directory attribute the directory admin alone controls.
- **A third-party IdP (Auth0/Okta)** — rejected for PR1: unjustified new vendor; the AWS-native pool
  satisfies OIDC/MFA/JWKS/rotation/account-state/admin-API with the existing estate.

## Consequences
- Step-up authentication is DEFERRED as an explicit decision (see `GUARDIAN_SESSION_SECURITY.md`): PR1
  requires MFA for every privileged operation; a distinct fresh-auth step-up for `AUTHORISATION_GRANTED`
  is a documented PR-later option.
- Revocation: disable/suspend the entitlement (immediate deny at next request) and/or `admin-user-global-sign-out`
  in Cognito; access tokens live ≤60 min. Honest limits documented.
- Carried P1 (unchanged): separate Guardian DB (PR2), CA-validated Postgres TLS (PR2), duplicate hosted zones.
- **Rollback:** runtime target stays C10 `94355f4`; auth is env-flagged (`GUARDIAN_AUTH_MODE`) but MUST NOT
  be disabled in any future Production config. No identity/audit history is deleted on rollback.
