# SafeBet Guardian — Provider Adapter Contract (ARCH-V4-C9)

Provider-neutral adapter contract with a SYNTHETIC-ONLY implementation.

## Contract
`publishAuthorisedRequest({ requestPayloadHash, scenario, attemptNo }) -> SyntheticProviderResult`.
The synthetic result carries `delivered` (false = technical delivery failure, retryable),
`providerState` (ACKNOWLEDGED/UNDER_REVIEW/MORE_INFO_REQUIRED/ACTIONED/DECLINED), a synthetic
`providerReference`, and a `reasonCode`.

## Synthetic providers only
`SYNTHETIC_ISP, SYNTHETIC_DNS_PROVIDER, SYNTHETIC_REGISTRAR, SYNTHETIC_REGISTRY, SYNTHETIC_HOST,
SYNTHETIC_PAYMENT_PROVIDER, SYNTHETIC_MOBILE_PLATFORM, SYNTHETIC_GEO_PROVIDER`. No real
commercial provider is named; no partnership is implied. Mobile-platform referrals are
provider-neutral (no Google/Play/Apple/App Store naming).

## Delivery methods
Modelled for future compatibility (`API_MTLS, H2H, SFTP, SECURE_PORTAL, MANUAL_REFERRAL,
SECURE_FILE, OTHER`) but C9 Demo uses `SYNTHETIC_ADAPTER` only.

## Network egress safety (§37)
The `SyntheticProviderAdapter` and the enforcement worker have NO real HTTP/provider endpoint,
NO real IP/DNS name, NO provider credential, and NO arbitrary-URL input (no SSRF surface) —
boundary-tested. The worker IAM grants only logs + SQS + one DB secret (no network/provider
permission).

## Receipt
A synthetic provider returns a `providerReference` + `provider_state` + `request_payload_hash`.
The receipt proves the synthetic adapter accepted the request — it does NOT prove the provider
performed the action (that requires independent verification).
