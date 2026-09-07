# SafeBet Guardian — Geo Intelligence Reason Codes (ARCH-V4-C5)

Reason codes are **review reasons, not legal violations**. They are deterministic and
explainable (no AI, no black-box score). Presence of any code never sets illegality or
enforcement.

| Reason code | Meaning (non-legal) |
|---|---|
| `NO_AUTHORITATIVE_REGISTRY_MATCH` | No C1 registry match for the service. Absence ≠ illegal. |
| `SERVICE_REGION_MISMATCH` | Service observed available in a region outside its licence scope. |
| `LICENCE_JURISDICTION_MISMATCH` | Declared service jurisdiction differs from the licence jurisdiction. |
| `DECLARED_REGION_MISMATCH` | Declared service jurisdiction differs from the observed region. |
| `REGISTRY_REFERENCE_STALE` | Matched licence/source is stale (freshness STALE). |
| `DOMAIN_REGION_INCONSISTENCY` | Declared domain not resolvable via the Domain Reference Contract. |
| `APP_REGION_INCONSISTENCY` | Declared app not resolvable via the App Reference Contract. |
| `PAYMENT_REGION_INCONSISTENCY` | Declared merchant not resolvable via the Payment Reference Contract. |
| `SOURCE_CONFLICT` | Conflicting registry source data → human review. |
| `UNKNOWN_REGION_REFERENCE` | Unknown service + unknown availability. |
| `REGIONAL_AVAILABILITY_CHANGED` | Availability state changed/inconsistent → append history. |

## Review priority (deterministic)
- **HIGH** — `NO_AUTHORITATIVE_REGISTRY_MATCH`, or ≥2 strong signals
  (licence/service-region/domain/app/payment mismatch, source conflict).
- **MEDIUM** — one strong signal, or stale/source-conflict/declared-region/availability-changed.
- **LOW** — matched authoritative reference with no review signal (accepted).

`HIGH REVIEW PRIORITY ≠ ENFORCEMENT AUTHORISATION`.
