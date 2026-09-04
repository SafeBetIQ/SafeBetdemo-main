# Edge Function — Shared-Consumer Migration Register (ARCH-V4-A4)

Classifies edge functions by how they consume Shared Foundation capabilities after the audit (A3)
and evidence (A4) extractions. **No edge function is redeployed merely to change imports** — the
relocations are byte-identical, so the live bundles remain correct; they adopt the governed paths on
their next functional deploy (controlled migration, not a mass redeploy).

Status values: `MIGRATED` (imports the governed `lib/platform/*` path, deployed) ·
`BYTE_IDENTICAL_LEGACY_BUNDLE` (live bundle predates the relocation but is byte-identical) ·
`REQUIRES_NEXT_DEPLOY` (will pick up the governed path on its next deploy) · `PRODUCT_SPECIFIC` ·
`UNKNOWN`.

| Edge function | Shared capability used | Status | Note |
|---|---|---|---|
| `consumer-gateway` | audit (`lib/platform/audit` via `consumerPlatform`) | BYTE_IDENTICAL_LEGACY_BUNDLE / REQUIRES_NEXT_DEPLOY | live bundle (A1 deploy) has the pre-A3 audit path; byte-identical output. Adopts `lib/platform/audit` on next deploy. |
| `evidence-gateway` | evidence (`lib/platform/evidence`) | BYTE_IDENTICAL_LEGACY_BUNDLE / REQUIRES_NEXT_DEPLOY | consumes the evidence framework via `consumerPlatform`; byte-identical after A4 relocation. Adopts governed path on next deploy. |
| `regulator-portal` | evidence/audit (via `consumerPlatform`) | REQUIRES_NEXT_DEPLOY | same; product boundary = future Regulator Suite. |
| `workflow` | workflow primitives | PRODUCT_SPECIFIC | IQ workflow semantics today. |
| `projection-platform`, `digital-twin`, `intervention-engine`, `cross-operator-intelligence`, `bri-risk-score`, `safeplay-ai-risk-engine`, `wellbeing-*`, `self-exclusion-network`, `commerce` | IQ domain | PRODUCT_SPECIFIC | SafeBet IQ. |
| `evidence-gateway`, `identity-resolution`, `connector-ingest`, `api-ingest`, `platform-ops`, `db-maintenance` | Shared foundation | SHARED | foundation services. |
| `integration-*-sync`, `integration-whatsapp-send`, `sync-real-casino-data` | integration primitives | SHARED (integration) | governed adapter mechanics. |
| `casino-simulator`, `demo-sync-all-casinos` | demo | PRODUCT_SPECIFIC (Demo) | Demo only. |
| `reset-staff-password` | identity/security | SHARED | admin/ops. |

**Migration plan:** no forced redeploys. Each edge function adopts the governed `lib/platform/*`
paths on its next functional release; because relocations are byte-identical, there is no behaviour
drift in the interim. Track adoption here.
