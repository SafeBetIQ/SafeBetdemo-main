# SafeBet Guardian — Entitlement Model (ARCH-V4-PR1)

`guardian.identity_entitlement` (one row per trusted subject): `subject, identity_provider, guardian_role, jurisdiction, account_state, mfa_required, is_human, effective_from, effective_until, activated_by, activated_at, audit_reference, is_synthetic_test`.

- Role + permitted jurisdiction originate ONLY here (governed, administratively managed, audited). Request parameters may name a resource jurisdiction for routing/filtering, but the entitlement jurisdiction determines access; a request cannot elevate jurisdiction.
- Account states: INVITED, ACTIVE, SUSPENDED, DISABLED, EXPIRED. Only ACTIVE within the effective window is permitted; SUSPENDED/DISABLED/EXPIRED deny even with a valid token.
- Multi-jurisdiction is only ever explicit (a distinct entitlement row); jurisdiction is never inferred from email domain or organisation name.
- Governed activation (PR1 test identities): `activated_by` + `activated_at` + `audit_reference` recorded, and an append-only `identity_entitlement_history` row per change (CREATED/ACTIVATED/SUSPENDED/DISABLED/…).
- `is_synthetic_test = true` for all PR1 rows (NON-PRODUCTION).
