# SafeBet Guardian — Service Catalogue & Metadata Register (ARCH-V4-C0)

## Service metadata
| Field | Value |
|---|---|
| product | `GUARDIAN` |
| service | `safebet-guardian` |
| schema version | `c0` |
| runtime strategy | Option C — monorepo package, independent entry point |
| data strategy | Option B — dedicated `guardian` schema (interim); separate project = final |
| environment | Demo (non-production) |
| data class | synthetic |
| depends on SafeBet IQ business data | **no** |
| depends on SafeBet IQ runtime | **no** |
| MFA required for real privileged use | **true** |
| owner | SafeBet Guardian product |

## Package surface (`products/guardian/src`)
`product` (constants/invariants) · `identity` (roles, principal, MFA gate) · `sod`
(separation-of-duties) · `jurisdiction` (scoping) · `envelope` (message envelope) · `case`
(case primitive) · `audit` (Shared-audit adapter, `product=GUARDIAN`) · `evidence`
(Shared-evidence adapter) · `worker` (idempotent foundation worker) · `observability`
(health/version) · `index` (composition root + `guardianFoundationDescriptor`).

## API namespace (`/api/guardian`)
| Endpoint | Purpose |
|---|---|
| `GET /api/guardian/health` | liveness; `product=GUARDIAN`; no IQ dependency |
| `GET /api/guardian/version` | own provenance (`guardian-version.json`); never IQ SHA |
| `GET /api/guardian/foundation` | synthetic contract demonstration (identity/SoD/case/evidence/audit/worker) |

No business detection/enforcement API. No endpoint proxies a SafeBet IQ business function.

## Queue / worker namespace
`guardian-*` (never `safebet-iq-*`). Foundation queue `guardian-foundation-events`, DLQ
`guardian-foundation-events-dlq`. C0 worker is in-memory/idempotent (no SQS/crawl/enforcement);
a real SQS+DLQ+Lambda path is a later milestone under the queue-ownership convention.

## Message envelope
`product=GUARDIAN`, `schemaVersion`, `eventType`, `jurisdiction`, `correlationId`,
`idempotencyKey`, `occurredAt`, `payloadReference` (pointer only — sensitive evidence is never
inlined; forbidden inline keys are rejected).

## Standalone entry
`npx tsx products/guardian/bin/guardian-service.ts` — runs the full synthetic flow and a
self-check, proving the foundation works with no SafeBet IQ runtime present.
