# SafeBet Guardian — Geo & Jurisdiction Intelligence (ARCH-V4-C5)

**Status:** Planned / in development (synthetic Demo only). Not live, not production, not
used by regulators.

Geo & Jurisdiction Intelligence is Guardian's fifth intelligence domain. It analyses
**property / service / jurisdiction-level** signals — never individuals.

## Conceptual flow
```
GEO / JURISDICTION SIGNAL RECEIVED
 → VALIDATE SOURCE
 → NORMALISE PROPERTY / SERVICE / REGION REFERENCE
 → LINK TO DOMAIN / APP / OPERATOR / PAYMENT SUBJECTS (governed contracts)
 → COMPARE EXPECTED LEGAL JURISDICTION
 → PRODUCE EXPLAINABLE GEO INTELLIGENCE (non-legal, non-enforcement)
 → HUMAN REVIEW WHERE REQUIRED
```

## Core privacy boundary
**GEO INTELLIGENCE ≠ INDIVIDUAL SURVEILLANCE.** The default data unit is
`PROPERTY / SERVICE / DOMAIN / APP / OPERATOR / AGGREGATE REGION` — never a `PERSON`.
There is deliberately **no** person entity and **no** person-level field. See
[GUARDIAN_PRIVACY_BOUNDARIES.md](./GUARDIAN_PRIVACY_BOUNDARIES.md).

C5 does **not**: track individual gamblers/consumers; ingest ISP subscriber or household
browsing histories; ingest individual bank/cardholder geography; monitor individual
devices; compel geo-blocking; automatically determine illegality; perform enforcement.

## Legal-safety invariants (encoded + tested)
- SERVICE OBSERVED IN REGION ≠ ILLEGAL OPERATION
- SERVICE AVAILABLE ACROSS JURISDICTION ≠ LEGAL VIOLATION
- LICENCE JURISDICTION MISMATCH ≠ FINAL LEGAL FINDING
- UNKNOWN GEO SIGNAL ≠ ILLEGAL
- HIGH REVIEW PRIORITY ≠ ENFORCEMENT AUTHORISATION

Every result carries `isIllegalDetermination = false` and `isEnforcementAuthorised =
false`. The `geo_registry_comparison` table enforces both with DB CHECK constraints.
No availability state `ILLEGAL_IN_REGION` exists.

## Governed cross-module contracts (no raw base tables)
- **C1** `resolveLegalReference(...)` — operator/brand/licence/licence-jurisdiction/freshness.
- **C2** Domain Reference Contract (`guardian.domain_reference` / `resolveDomainReference`).
- **C3** App Reference Contract (`guardian.app_reference` / `resolveAppReference`).
- **C4** Payment Reference Contract (`guardian.payment_reference` / `resolvePaymentReference`)
  — formalised in C5 so Geo obtains payment-channel jurisdiction context without touching
  C4 base tables.

## Allowed vs prohibited signal classes
**Allowed (synthetic):** declared service jurisdiction, operator/licence jurisdiction,
domain/app regional availability fixtures, payment-channel jurisdiction reference,
hosting/service-region reference, regulator aggregate regional observation, synthetic
network-location metadata, synthetic accessibility observation, aggregate region-visibility
metric.

**Prohibited (require a separate legal-basis / DPIA / minimisation / retention / authority /
provider-agreement review before ANY future consideration):** ISP/household/consumer
browsing history, mobile subscriber location history, bank/cardholder transaction geography,
precise persistent personal geolocation, Wi-Fi/device tracking, covert telemetry.

## Durable pipeline & API
- Queue `guardian-geo-observation` + DLQ `guardian-geo-observation-dlq`
  (maxReceiveCount 2, visibility 15, ReportBatchItemFailures), worker Lambda
  `safebet-guardian-geo-worker`, alarm `guardian-geo-observation-dlq-not-empty`.
- API (IAM-protected): `GET /geo`, `GET /geo/:id`, `GET /geo/:id/observations`,
  `POST /geo/observe`, `POST /geo/:id/review`. Responses carry `isIllegalDetermination:false`
  and `isEnforcementAuthorised:false`. No `geoBlock`, `illegal`, or `enforce` field exists.
