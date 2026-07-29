# SafeBet IQ — Release Notes, Version 1.1

**Workstream 1 — Enterprise Casino Integration Platform** · 2026-07-14 · Demo project (production owner-executed)

The first commercial capability on top of the certified v1.0 enterprise platform: a **Connector Framework** that lets a real casino connect with minimal engineering effort — **integration is configuration, not code** — while preserving the certified architecture unchanged.

---

## Highlights
- **Connector Framework** (`lib/connectorFramework`) — adapters that translate external casino records into the certified `CasinoEventDraft` contract and submit them through the ONE Enterprise Event Platform. No parallel pipeline, no business logic, no bypass of Identity Resolution.
- **Eight built-in connector profiles** (declarative configuration): loyalty, slot-management, table-management, casino-management, cash-desk, rg-system, generic-api, batch-file.
- **`connector-ingest` edge function** — the authenticated, casino-scoped producer endpoint (the first-class realisation of the Phase-5 "convert api-ingest into an Event Platform producer" item).
- **Data-quality diagnostics** — actionable pre-flight feedback (missing identity, timestamp anomalies, unmapped event types, unknown machines, invalid mappings) for casino administrators.
- **Integration Health** — a new `integration` view on the existing Consumer Platform (no parallel management app), plus a Management dashboard and an 8-step Onboarding Wizard.

## What's new (files)
- `lib/connectorFramework/{types,translate,runtime,connectors,validation,index}.ts`
- `supabase/functions/connector-ingest/index.ts`
- `supabase/migrations/20260714100000_v11_connector_runs.sql` (`connector_runs` telemetry + `sbiq_connector_health`)
- `app/casino/integration/page.tsx` (Management & Health), `app/casino/integration/onboarding/page.tsx` (Wizard)
- `lib/consumerPlatform/*` — `integration` view/contract/grant/shaper; `consumer-gateway` wires connector health
- `docs/CASINO_INTEGRATION_CERTIFICATION.md`; updates to `CASINO_INTEGRATION_GUIDE.md` and `API_REFERENCE.md`
- `tests/connectorFramework.test.mjs` (12 tests)

## Architecture compliance (Constitutions upheld)
- **One flow:** every connector event enters via `getEventPlatform().ingestBatch` — the single certified ingestion path. **Live-verified:** connector events appear in `casino_event_log` (producer `connector:slot-management`).
- **Identity unchanged:** raw player references are resolved to anonymous 96-bit SB-PLR ids by the IRS. **Live-verified:** raw loyalty reference `real-loyalty-777` never reached the store (0 leaks); both events carry 96-bit identity.
- **One runtime reality:** connectors add no runtime state; `connector_runs` is operational telemetry only (never players/sessions/machines).
- **Consumers present only:** integration health is served through the existing gateway; the UI is presentation over contracts.
- **Replay deterministic; dashboards unchanged:** the 152-test enterprise regression suite is unaffected.

## Validation evidence
- **Tests:** `node --test tests/*.test.mjs` → **164 pass, 0 fail** (152 prior — zero regressions — + 12 connector: translation, mapping, timestamp normalisation, data quality, config validation, e2e through the Event Platform, idempotency, identity-privacy). `tsc` clean; `next build` succeeds (both new pages compiled).
- **Live e2e:** slot-management batch (2 good + 1 bad) → `received 3, translated 2, submitted 2, rejected 1`, diagnostics `MISSING_IDENTITY`, `TIMESTAMP_ANOMALY`; events in the certified log with anonymous identity; Integration Health view returns `runs 1, submitted 2, rejected 1`.
- **Security:** cross-tenant `connector-ingest` → `403`; anon → `401`; the Event Platform remains the authoritative validator (a future-dated resend was correctly rejected, proving connectors do not bypass validation).

## Performance
Translation is pure in-memory field mapping (negligible per record); ingestion uses the certified batched idempotent path. Requests are capped at 500 records; larger feeds batch into multiple calls.

## Remaining limitations
- Streaming/push transports and vendor-specific profile libraries are future work.
- Full IANA timezone conversion is not built in; supported forms are ISO-8601 (with offset), epoch seconds/millis, and naive local + fixed `offsetMinutes`.
- Managed-cron/alert-delivery wiring for connector monitoring follows the platform ops-onboarding (Phase 5).
- Out-of-flow `api-ingest` remains for legacy `safeplay-connect`; the Connector Framework is its architecture-compliant successor.

## Upgrade / deployment
Apply migration `20260714100000_v11_connector_runs.sql`; deploy `connector-ingest` and `consumer-gateway`; deploy the app (adds the integration pages). No breaking changes; the enterprise flow and all six constitutions are unchanged. Rollback: remove the connector view wiring and the connector-ingest function; the `connector_runs` table is harmless if left.
