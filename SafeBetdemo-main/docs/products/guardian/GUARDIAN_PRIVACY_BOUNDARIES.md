# SafeBet Guardian — Privacy Boundaries (ARCH-V4-C5)

Guardian's overriding privacy principle for Geo & Jurisdiction Intelligence:

> **GEO INTELLIGENCE ≠ INDIVIDUAL SURVEILLANCE.**

The default and only permitted data unit is
`PROPERTY / SERVICE / DOMAIN / APP / OPERATOR / AGGREGATE REGION`. Guardian does **not**
build a person-level location graph.

## Prohibited person-level fields (rejected by design)
These must never appear as person-level Geo fields. The worker rejects any message
carrying them (schema/validation rejection → DLQ; `GeoPersonDataRejectedError`), and a
privacy test enforces their absence from the business model. Enforced list
(`PROHIBITED_PERSON_FIELDS`): `player_id`, `customer_id`, `subscriber_id`,
`device_ad_id` / `advertising_id`, `mobile_number` / `msisdn`, `bank_customer_id`,
`cardholder`, `ip_address` / `ip_history`, `browsing_history`, `precise_location` /
`person_location`, `lat`/`lng`/`latitude`/`longitude`/`geo_coordinates`, `wifi_probe`.

## Prohibited signal classes (require separate governance before ANY future use)
ISP/household/consumer browsing history; identifiable consumer IP history; mobile
subscriber location history; bank/cardholder transaction geography; precise persistent
personal geolocation; Wi-Fi probe / device tracking; covert device telemetry;
confidential provider telemetry without lawful authority.

If such a source is ever proposed: **STOP** and require a separate review of
`LEGAL BASIS · PURPOSE · DATA PROTECTION IMPACT · MINIMISATION · RETENTION · AUTHORITY ·
PROVIDER AGREEMENT`.

## Aggregate-first design
Where C5 models traffic/visibility, it uses **region-level aggregate** signals — e.g.
"subject X observed available in synthetic Region Y" — never "User A visited subject X
from coordinates Y". There is no person-level observation table.

## No real network surveillance
C5 introduces no capability to inspect real consumer traffic: no packet capture, no
subscriber lookups, no browser-history ingestion, no device-location feeds, no real
IP-to-person resolution. Synthetic public/network-location fixtures only.

## POPIA / ISO 27701 alignment
Minimisation (property/service/aggregate-region only), purpose limitation (RegTech
jurisdiction intelligence), jurisdiction scoping (RLS), and retention/history semantics
are built in. No certification is claimed.

## C7 Evidence Vault privacy (ARCH-V4-C7)
The Digital Evidence Vault stores **synthetic** evidence only — no real illegal-gambling
evidence, customer/player data, bank records, or regulator documents. Minimisation: the Vault
holds a **hash + storage reference**, never duplicated bodies into case/audit/queue rows;
purpose limitation (every access carries a purpose or is denied); classification-driven access
(role ceiling); jurisdiction-scoped RLS; retention `POLICY_DEFINED` (no hard-coded statutory
period). The private S3 vault blocks all public access (SSE-AES256, versioned, TLS-only). No
person-level tracking is introduced. No legal determination, no enforcement, no provider action.
