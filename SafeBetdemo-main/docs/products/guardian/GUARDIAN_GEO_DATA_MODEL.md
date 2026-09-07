# SafeBet Guardian — Geo Intelligence Data Model (ARCH-V4-C5)

All tables live in the dedicated `guardian` schema, carry `jurisdiction`, a synthetic
marker (`is_synthetic`), RLS, and history semantics where appropriate. **No SafeBet IQ
public business table is referenced. No person entity and no person-level column exist.**

## Tables (10)
| Table | Purpose | Notes |
|---|---|---|
| `geo_region` | Region modelled independently (country/province/regulatory jurisdiction/…) | Guardian immutable IDs; `parent_region_id` self-FK; regulatory jurisdiction need not map 1:1 to a geographic boundary. |
| `geo_source` | Lawful/public/regulator-approved synthetic signal categories | `authority_level = SYNTHETIC_TEST`. |
| `geo_signal` | Aggregate/region-level signal instances | `aggregate_metric` for region-level visibility; no person-level value. |
| `geo_subject` | References a SERVICE / PROPERTY (never a person) | `subject_type ∈ {DOMAIN, MOBILE_APP, OPERATOR, BRAND, PAYMENT_CHANNEL, SERVICE, INFRASTRUCTURE_REFERENCE}`; unique `(subject_reference, jurisdiction)`. |
| `geo_observation` | **Append-only** observation | `availability_state` neutral; unique `(geo_subject_id, idempotency_key)`; UPDATE/DELETE blocked by trigger. |
| `geo_service_availability` | Derived current availability per subject/region | unique `(geo_subject_id, region_id)`. |
| `geo_registry_comparison` | Structured NON-LEGAL, NON-ENFORCEMENT result | DB CHECK: `is_illegal_determination = false`, `is_enforcement_authorised = false`. |
| `geo_entity_link` | Cross-domain links via governed contracts | `link_type ∈ {OPERATOR, BRAND, LICENCE, DOMAIN, APP, PAYMENT}`. |
| `geo_review_item` | Bounded human-review states/decisions | No `GEO_BLOCK_APPROVED` / `SERVICE_BLOCK_APPROVED` / `LEGAL_ILLEGALITY_CONFIRMED`. |
| `geo_change_history` | **Append-only** history | Prior state preserved; UPDATE/DELETE blocked by trigger. |

## Availability states (neutral, observational)
`AVAILABLE`, `NOT_OBSERVED`, `RESTRICTED_BY_FIXTURE`, `UNKNOWN`, `INCONSISTENT`,
`REQUIRES_REVIEW`. **There is no `ILLEGAL_IN_REGION` state.**

## Freshness (tracked separately — never combine fresh geo with stale legal reference)
`geo_observed_at`, `source_as_of`, `registry_last_verified_at`, `domain_last_observed_at`,
`app_last_observed_at`, `payment_last_observed_at`.

## Append-only guard
`guardian.geo_block_mutation()` (SECURITY INVOKER; trigger-only; PUBLIC EXECUTE revoked)
raises on UPDATE/DELETE of `geo_observation` and `geo_change_history`.

## Access
RLS jurisdiction-scoped for `authenticated`/`service_role` (via `guardian_jurisdiction`
JWT claim) and for the least-privilege worker role `guardian_geo_worker` (via the
`app.guardian.jurisdiction` GUC). `anon` and IQ `casino_admin` have **no** grant.
