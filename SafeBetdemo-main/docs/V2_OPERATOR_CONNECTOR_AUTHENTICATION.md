# Operator Connector Authentication (Milestone 4.4)

**ADR-006 (frozen) · Fail-closed · One operator/tenant/jurisdiction per connector.**

## 1. Model
`ConnectorAuthenticator` provisions a credential bound to exactly one `{ operatorId, tenantId,
jurisdiction, expiresAt? }`. Secrets live in a **non-exported module WeakMap** — no getter, no export, no
serialisation, no log. `validate(connectorId, presentedSecret)` returns the bound identity or throws.

## 2. Failure handling (fail-closed)
- `credential-revoked` — connector revoked.
- `credential-expired` — past `expiresAt`.
- `invalid-credential` — secret mismatch.
- `unknown-connector` — not provisioned.
- `binding-mismatch` — auth identity ≠ connector config (at activation).
Re-validation runs on **every** sync (revoke/expiry take effect immediately).

## 3. Binding restrictions
- Bound to **one** operator, tenant, jurisdiction, and connector identity.
- **No** connector-supplied tenant/jurisdiction switching (config + binding are authoritative).
- **No** shared credentials across operators; **no** hard-coded/source-controlled/logged credentials; **no**
  credentials in diagnostics; **no** fallback to unauthenticated submission; **no** production credentials.

## 4. Deployment binding (C4/deployment)
The pilot uses an in-process authenticator with synthetic secrets. Managed authentication (mTLS / OAuth2
client-credentials / signed service tokens / AWS IAM) + secret storage is the deployment binding; where
managed secret storage is unavailable, the non-production binding is used and **C4 stays partially closed**.

## 5. Validation
Tested: invalid, expired, revoked credentials rejected; binding mismatch rejected; revocation permanently
denies; secrets never appear in output.
