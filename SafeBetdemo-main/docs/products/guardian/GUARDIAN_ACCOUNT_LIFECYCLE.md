# SafeBet Guardian — Account Lifecycle (ARCH-V4-PR1)

States: `INVITED → ACTIVE → (SUSPENDED | DISABLED | EXPIRED)`. A directory account existing in Cognito does NOT by itself grant privilege — a governed entitlement activation is required.

- Activation (PR1 test identities only): admin creates the Cognito user (admin-create-only), the user enrols TOTP MFA, and an administrator activates a governed entitlement (role + jurisdiction) with `activated_by` + `activated_at` + `audit_reference` + an append-only history row.
- Suspension/disablement: set `account_state` to SUSPENDED/DISABLED — denied at the next request even if a valid token exists; recorded in history.
- Expiry: `effective_until` in the past → denied.
- No real regulator staff are onboarded in PR1. All identities are labelled NON-PRODUCTION / SYNTHETIC TEST.
