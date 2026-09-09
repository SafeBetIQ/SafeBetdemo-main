# SafeBet Guardian — Contract Catalogue (governed cross-module interfaces)

Guardian modules consume each other ONLY through governed contracts — never raw base
tables or arbitrary query capability. This catalogue records the owned contracts.

## Domain Reference Contract (ARCH-V4-C3.1)
- **Owner:** Domain Intelligence (C2).
- **Consumers:** Mobile App Intelligence (C3); future modules.
- **Purpose:** obtain a bounded, jurisdiction-scoped Domain reference for a hostname,
  without depending on Domain Intelligence's persistence implementation or base tables.
- **Interface (input):** `{ hostname, jurisdiction, correlationId? }`.
- **Interface (output — bounded):** `{ matchState (REFERENCED | DOMAIN_REFERENCE_NOT_FOUND),
  canonicalHostname, jurisdiction, domainReferenceId, freshness, referenceStatus }`. The full
  domain row is never returned; no query capability is exposed.
- **Implementations (two, aligned):**
  1. **TS** `resolveDomainReference(...)` (`products/guardian/src/domain/contract.ts`) — used by
     consumers at analysis time (over the synthetic domain fixtures).
  2. **DB** view `guardian.domain_reference` — used by a consumer worker at persistence time.
     Owned by Domain Intelligence; exposes only the bounded columns; jurisdiction-scoped by the
     `app.guardian.jurisdiction` GUC. **Not** a SECURITY DEFINER function (a plain view); no
     PUBLIC/anon grant.
- **Privilege:** consumers get SELECT on `guardian.domain_reference` **only**. `guardian_app_worker`
  has **no** grant on `guardian.domain_subject` (revoked in C3.1). Verified: base-table access
  DENIED; contract view resolves the real reference id; wrong-jurisdiction → not found.
- **Separate-database compatibility:** because App Intelligence depends only on this contract,
  Domain Intelligence may move its datastore (P1 exit) without rewriting App Intelligence.

## App Reference Contract (ARCH-V4-C4)
- **Owner:** Mobile App Intelligence (C3). **Consumers:** Payment Intelligence (C4); future modules.
- **Purpose/interface:** bounded, jurisdiction-scoped app reference — input `{ appIdentifier, jurisdiction }`;
  output `{ matchState (REFERENCED | APP_REFERENCE_NOT_FOUND), canonicalAppIdentifier, jurisdiction,
  appReferenceId, freshness, referenceStatus }`. Implementations: TS `resolveAppReference(...)` +
  DB view `guardian.app_reference` (owner postgres; own jurisdiction predicate; plain view, not
  SECURITY DEFINER). Consumers get SELECT on the view only — never `guardian.mobile_app_subject`.

## Payment Reference Contract (ARCH-V4-C5)
- **Owner:** Payment Intelligence (C4). **Consumers:** Geo & Jurisdiction Intelligence (C5); future modules.
- **Purpose/interface:** bounded, jurisdiction-scoped payment/merchant-channel reference — input
  `{ merchantReference, jurisdiction }`; output `{ matchState (REFERENCED | PAYMENT_REFERENCE_NOT_FOUND),
  paymentReferenceId, merchantReferenceState, jurisdiction, channelType, freshness, referenceStatus }`.
  Implementations: TS `resolvePaymentReference(...)` + DB view `guardian.payment_reference` (owner
  postgres; own jurisdiction predicate; plain view, not SECURITY DEFINER). Consumers get SELECT on the
  view only — never `guardian.merchant_subject` / `guardian.payment_subject`.

## Geo Reference Contract (ARCH-V4-C6)
- **Owner:** Geo & Jurisdiction Intelligence (C5). **Consumers:** Case & Investigation Management (C6); future modules.
- **Purpose/interface:** bounded, jurisdiction-scoped geo/service reference — input
  `{ geoReference, jurisdiction }`; output `{ matchState (REFERENCED | GEO_REFERENCE_NOT_FOUND),
  geoReferenceId, subjectType, jurisdiction, regionReference, availabilityState, freshness, referenceStatus }`.
  Implementations: TS `resolveGeoReference(...)` + DB view `guardian.geo_reference` (owner postgres; own
  jurisdiction predicate; plain view, not SECURITY DEFINER). Consumers get SELECT on the view only — never
  the C5 base tables.

## Legal Operator Registry Contract (ARCH-V4-C1)
- **Owner:** Legal Operator Registry (C1). **Consumers:** Domain (C2), App (C3).
- `resolveLegalReference(...)` → bounded legal standing + provenance; `isIllegalDetermination`
  is never true; NO_MATCH ≠ illegal. Consumers never query raw registry tables.

## Shared Platform Foundation contracts
- `@/lib/platform/audit` (tamper-evident chain verification) and `@/lib/platform/evidence`
  (evidence envelope/pagination/scope). Pure; no DB/credentials.
