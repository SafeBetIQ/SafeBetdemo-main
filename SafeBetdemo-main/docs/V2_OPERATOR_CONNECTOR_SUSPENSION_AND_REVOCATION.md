# Operator Connector Suspension & Revocation (Milestone 4.4)

**ADR-006 (frozen) · Governed · History preserved.**

## 1. Authorisation
Suspension / reactivation / revocation / retirement require an authorised `ConnectorAdminContext`
(`regulator` or `platform-admin`). Operator/other contexts are denied (`unauthorised`).

## 2. Suspension
`suspend(ctx)` → state `suspended`: new source processing stops, submissions are prevented (`sync` throws
`not-active`), checkpoints + accepted contributions are **preserved**, an audit event is emitted, safe
health remains readable. **Reactivation requires an approved review** (`reactivate(ctx, approvedReview=true)`),
else rejected.

## 3. Revocation
`revoke(ctx)` → **permanently denies** the connector identity: the credential is revoked (auth fails
closed), state becomes terminal `revoked`, historical contributions + audit are **preserved**, affected
connector records are marked. A **new connector identity** is required for future onboarding; a revoked
connector is **never** silently reactivated (terminal state).

## 4. Non-negotiables
- Suspension/revocation **never delete history**.
- Reactivation of a suspended connector needs explicit approval.
- A revoked connector cannot be reactivated (a new identity is required).
- All transitions are audited.

## 5. Validation
Tested: suspend stops sync; reactivate (approved) resumes; revoke → terminal + credential-revoked + `sync`
denied + reactivate rejected (`invalid-transition`); admin actions require an authorised context.
