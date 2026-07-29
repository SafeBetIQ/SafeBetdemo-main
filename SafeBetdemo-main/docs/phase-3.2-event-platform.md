# Phase 3.2 — Enterprise Event Platform: Deliverables

**Date:** 2026-07-10 · **Branch:** Demo · **Deployed to:** SafeBet Demo (`uexdjngogzunjxkpxwll`) — Production untouched.

---

## 1. Architecture

`lib/eventPlatform/` is the central nervous system — **infrastructure only**. It receives, validates, enriches, versions, persists, and distributes events; it never interprets them. Business engines (risk, behaviour, AI, intervention) arrive in later phases as *consumers* of this platform.

```
Producer (casino-simulator today; syncs/api-ingest next)
        │  getEventPlatform().ingest / ingestBatch(drafts, ctx)
        ▼
┌──────────────────────── Enterprise Event Platform ────────────────────────┐
│ 1 validateDraft      reject-never-repair (schema, vocabulary, identity,   │
│                      tenant, timestamp; batch rejects atomically)         │
│ 2 enrichDraft        identity resolved ONCE via IdentityResolutionService │
│                      → Identity Policy → Identity Provider; correlation   │
│                      (session journey), trace (per ingest), tenant,       │
│                      jurisdiction, receivedAt/processedAt                 │
│ 3 version            schemaVersion = 1 stamped into the envelope         │
│ 4 validateEnvelope   full 17-field integrity check pre-persist            │
│ 5 persist            casino_event_log — append-only, DB-trigger immutable │
│ 6 distribute         Supabase Realtime on casino_event_log (persisting    │
│                      IS publishing) + transitional legacy live_events     │
│                      adapter (same eventId; removed in Phase 3.7)         │
└───────────────────────────────────────────────────────────────────────────┘
        ▼
future in-line stages: Projection Engine → Digital Twin → Rules → Behaviour
→ Risk → AI Decision → Intervention → Compliance → Dashboards → Regulator
```

## 2. Event lifecycle diagram

```
Casino Event ─► Identity Resolution ─► Identity Policy ─► Identity Provider
   (either upstream, or in-platform during enrichment — exactly once)
        ─► Platform: validate ─► enrich ─► version ─► persist ─► distribute
        ─► (same event, never restarted, never forked) ─► consumers
```

## 3. Event envelope specification (`lib/eventPlatform/envelope.ts`)

All 17 fields, always present, deep-frozen at creation:
`eventId · correlationId · traceId · tenantId · casinoId · jurisdiction · safeBetPlayerId · sessionId · machineId · producer · schemaVersion · eventType · occurredAt · receivedAt · processedAt · replayNumber · payload`
(`sessionId`/`machineId` carry explicit `null` for non-session events; `tenantId` = casinoId under the current one-tenant-per-casino model.) Mutation attempts throw `TypeError` (frozen); DB rows refuse UPDATE/DELETE via trigger. Corrections are new events — the example journey (CARD_INSERT → … → SESSION_END) is expressed purely as successive immutable events.

## 4. Validation design (`validation.ts`)

Two checkpoints: `validateDraft` (structure, vocabulary, identity presence + SB-PLR canonicality, casino UUID, ISO timestamp with ≤5-min future skew, payload shape) and `validateEnvelope` (all 17 fields, schema version, integrity) immediately before persistence. Violations throw `EventValidationError` with the complete list — nothing is repaired, nothing partial is persisted, and one bad draft rejects its whole batch atomically.

## 5. Enrichment design (`enrichment.ts`)

Enriches the SAME event once: identity (raw `casinoPlayerRef` → SB-PLR through Service → Policy → Provider; pre-resolved ids pass through with zero identity round-trips), tenant, jurisdiction (default `ZA`), correlationId (defaults to the session journey), traceId (one per ingest call), receivedAt/processedAt, replayNumber 0. No later component repeats any of this.

## 6. Persistence implementation

`persistence.ts` + migration `20260710090000_create_casino_event_log.sql`: exact 1:1 envelope↔column mapping; indexes on (casino, time), player, correlation, trace, type; `casino_event_log_immutable()` trigger refuses UPDATE/DELETE; RLS enabled with no client policies (service-role writes; consumers read via Phase 3.4 projections). Supports audit, replay, recovery, analytics, and future event sourcing.

## 7. Realtime publishing implementation

Primary: persisting to `casino_event_log` IS publication — consumers subscribe to `postgres_changes` on the store, so the published event can never differ from the persisted one. Transitional: `distribution.ts` projects the same envelope (same `eventId`) into legacy `live_events` so today's dashboards keep functioning; explicitly scheduled for removal in Phase 3.7. No dashboard-specific events exist.

## 8. Dependency graph

```
casino-simulator ─► lib/eventPlatform/index.ts ─► platform.ts
   (sole producer)                                   ├─► validation.ts ─► envelope.ts, playerIdentity (isSafeBetId)
                                                     ├─► enrichment.ts ─► playerIdentity (getIdentityService)
                                                     ├─► persistence.ts ─► envelope.ts
                                                     └─► distribution.ts ─► envelope.ts
```
Platform imports nothing from app/, components/, engines. Grep-verified: no business logic inside `lib/eventPlatform/` (the only "risk"/"intervention" strings are event-type *names* in the vocabulary constant).

## 9. Files created

`lib/eventPlatform/{envelope,validation,enrichment,persistence,distribution,platform,index}.ts` · `supabase/migrations/20260710090000_create_casino_event_log.sql` · `tests/eventPlatform.test.mjs` · this document.

## 10. Files modified

`supabase/functions/casino-simulator/index.ts` — direct `live_events` insert **deleted**; all events now enter via `getEventPlatform().ingestBatch(...)`. (Its `machine_activity` / `live_kpi_snapshots` upserts remain temporarily as interim projections; they move into the Projection Engine in Phase 3.4.)

## 11. Test results

- **Platform suite: 15/15 pass** — 17-field completeness, deep-frozen immutability, exact persist mapping, one-ingest→one-store-row+one-legacy-row with identical `eventId`, batch trace sharing + journey correlation, rejection (unknown type, missing/malformed identity, future timestamp, atomic batch, no-client refusal), in-flow IRS enrichment with raw-ref-never-stored, pinned identity vector, reserved replay, no-business-surface API check.
- **Full regression: 43/43** (identity 28 + platform 15). `tsc --noEmit`: 0 errors. `next build`: compiled successfully.
- **Live:** burst → 15 events through the platform; `casino_event_log` 15 rows; **15/15 joined to `live_events` on the same `event_id`**; 1 trace; 0 non-canonical identities; UPDATE and DELETE both **refused** by the trigger (row count unchanged after tamper attempts).

## 12. One continuous flow — evidence

✓ One entry point (`ingest`/`ingestBatch`); the simulator's direct event write was removed, and grep finds no other producer writing event stores.
✓ One envelope, one store, one lifecycle; the legacy channel is a derived projection of the same event (join proof above), not a second pipeline.
✓ No mutation possible in code (frozen) or DB (trigger).
✓ Browser `CasinoDataContext` pool events remain UI-side presentation simulation only (never persisted, never authoritative) — a documented transitional element that Phase 3.7 deletes when dashboards become platform consumers.

## 13. No business logic in the platform — confirmation

The platform computes nothing about risk, behaviour, interventions, machines, or sessions; it carries payloads opaquely. Verified by grep (§8) and by the API-surface unit test. Replay is designed (append-only store, `replayNumber`, correlation/trace/player indexes) and deliberately reserved.
