# SafeBet Guardian — Provider Payload & Data Minimisation (ARCH-V4-C9)

## Minimisation (§20/§21/§54)
The provider payload contains ONLY what the authorised request needs: `authorisationReference,
actionType, targetType, targetReference, jurisdiction, authorityReference, policyReference,
evidenceManifestReference, evidenceManifestHash, requestVersion`. It does NOT include the full
investigation, case notes, all evidence, unrelated intelligence, or any consumer data. Evidence
is referenced by manifest reference + SHA-256 manifest hash, never sent as unrestricted Vault
contents.

## Payload hash (§45)
Before dispatch the payload is canonicalised (sorted keys) and SHA-256 hashed
(`request_payload_hash`). A retry reuses the exact immutable authorised payload -> same hash
(proven stable across attempts). A material change requires a new provider-request version.

## Request versioning (§46)
If additional information materially changes the request, a new `provider_request` version /
reference is created (`unique (orchestration_id, request_version)`); the previous published
package is never overwritten (append-only).

## Domain/DNS/mobile/geo/payment safety
`DOMAIN_BLOCK`/`DNS_POLICY` = an authorised request category (synthetic adapter only; Guardian
does not change DNS/resolvers/registrar records/seize domains). `PAYMENT_REFERRAL` = a referral
to a synthetic provider (Guardian does not freeze funds / block transactions / terminate merchant
accounts / access customer banking). `APP_PLATFORM_REFERRAL` = provider-neutral synthetic
adapter. `GEO_RESTRICTION` = provider-side request modelling only — no subscriber/device/geo
surveillance (the C5 privacy boundary remains intact).
