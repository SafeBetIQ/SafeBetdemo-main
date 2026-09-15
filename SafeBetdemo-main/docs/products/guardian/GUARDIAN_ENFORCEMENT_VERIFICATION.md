# SafeBet Guardian — Enforcement Verification (ARCH-V4-C9)

Verification is **separate** from dispatch (distinct function/component; §40). `ACTIONED !=
VERIFIED`: only the verification process may set VERIFIED, using synthetic verification
evidence — it never contacts real public infrastructure.

## Verification types (synthetic)
`DOMAIN_UNAVAILABLE, DNS_POLICY_OBSERVED, HOSTING_STATUS_CHANGED, REGISTRAR_STATUS_CHANGED,
APP_LISTING_CHANGED, PAYMENT_CHANNEL_STATUS_CHANGED, GEO_RESTRICTION_OBSERVED, OTHER`.

## Result
`verifyProviderOutcome(actionType, providerActioned, syntheticObservation)` returns `VERIFIED`
only when the synthetic observed state matches the expected state; a mismatch -> `NOT_VERIFIED`
(follow-up); no observation -> `INCONCLUSIVE`. A provider that did not claim ACTIONED can never
be VERIFIED. Results are recorded append-only in `enforcement_verification`.

## Separation of dispatch and verification
Dispatching the request and verifying the provider outcome are distinct functions
(`orchestrate` / `SyntheticProviderAdapter` vs `verifyProviderOutcome`) — even where they share
a Lambda, they are separate components, so a dispatch success cannot self-certify an outcome.
