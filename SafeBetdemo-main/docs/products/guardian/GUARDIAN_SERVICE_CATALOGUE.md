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

## Branded Demo edge (ARCH-V4-C3.2)
- **Demo hostname:** `https://guardian-demo.safebetiq.com` (API Gateway HTTP API `safebet-guardian-demo-edge`
  → Lambda `safebet-guardian-demo`; ACM TLS 1.2; Route 53 alias in the authoritative safebetiq.com zone).
- **Future Production hostname (NOT created):** `guardian.safebetiq.com` — planned only; not live.
- **Auth model:** `/health` + `/version` public; `/apps`, `/domains`, `/registry`, `/foundation`
  require **AWS_IAM** (SigV4) → 403 unauthenticated. Proven: branded `/health`=200, `/version`=200
  (`product=GUARDIAN`, SHA `2d9ca93…`), privileged=403.
- **Raw AWS Lambda Function URL:** retained as an **internal infrastructure endpoint** (not the
  normal external address). CORS: none configured (no permissive `*`). Rate: API Gateway default throttling.

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
