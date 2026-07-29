# Phase 3.4 — Enterprise Casino Digital Twin

**Status: COMPLETE & DEPLOYED** (2026-07-10, SafeBet Demo project `uexdjngogzunjxkpxwll`; production never touched)

The Enterprise Casino Digital Twin is now the ONLY runtime representation of the casino: the live operational model at this exact moment, assembled exclusively from the Enterprise Projection Platform's read models, enriched (from Phase 3.5) by Shared Domain Engines on the SAME runtime instances, and observed by everything downstream.

---

## 1. Architecture

```
Casino Event
    ↓
Identity Resolution → Identity Policy → Identity Provider        (Phase 3.1/A/B)
    ↓
ENTERPRISE EVENT PLATFORM        lib/eventPlatform                (Phase 3.2)
    validate → enrich → version → persist (casino_event_log, append-only) → distribute
    ↓  (same envelopes, in-flow)
ENTERPRISE PROJECTION PLATFORM   lib/projectionPlatform           (Phase 3.3, now v2)
    pure reducers → projection_player/session/machine_state + 7 catalogue views
    ↓  (read models only — tables read + Realtime observed)
ENTERPRISE CASINO DIGITAL TWIN   lib/digitalTwin                  (Phase 3.4 — THIS)
    assemble → ONE shared runtime object graph → live sync → operational queries
    ↓
Shared Domain Engines (3.5, extension points ready) → Realtime → Dashboards → Reports
    ↓
Casino Operators / Regulators
```

The event enters once, never forks, never restarts. The twin creates no second event, no second projection, no second store. It is **assembly + observation only**:

| Concern | Owner | Twin's role |
|---|---|---|
| History | `casino_event_log` (immutable) | never reads it |
| Runtime state production | Projection Platform (reducers + views) | sole data source |
| Business logic (thresholds, scores, flags) | reducers materialize event facts; catalogue views hold thresholds; 3.5 engines compute | copies facts verbatim |
| Live operational model | **Digital Twin** | assembles + serves |
| Presentation | dashboards/reports (3.7) | consume the twin |

## 2. Runtime object model (`lib/digitalTwin/runtimeObjects.ts`)

ONE runtime instance each, guaranteed by the identity-map registry:

- **PlayerTwin** — status, current session/machine, projected risk score & flags, totals, intervention counters, `requiresMonitoring` (compliance-view membership), `enrichments`
- **SessionTwin** — live sessions only; ended sessions leave the model (history stays in events)
- **MachineTwin** — type, **floorLocation** (materialized event fact, projection v2), occupancy, projected risk
- **GamingFloorTwin** — a grouping of the SAME MachineTwin instances (references, never copies)
- **InterventionTwin** — current intervention observations (projection_intervention_state members)
- **Casino** — the `CasinoDigitalTwin` itself: registry + `CasinoAggregates` mapped 1:1 from `projection_casino_state`

Every mapper (`mapPlayer/mapSession/mapMachine/mapAggregates`) is a 1:1 field copy — no computation exists in the twin.

## 3. Runtime dependency graph

```
twin.ts (CasinoDigitalTwin, getDigitalTwin — ONE per casino per process)
 ├── registry.ts    identity map: ONE instance per entity; in-place mutation
 ├── assembly.ts    reads READ_MODEL_CATALOGUE only (3 tables + casino/intervention/compliance views)
 ├── sync.ts        Realtime postgres_changes on the 3 projection tables → same instances
 ├── queries.ts     "at this exact moment" answers — pure assembly/filtering
 ├── health.ts      infrastructure freshness (projection lag), never business judgement
 ├── extensions.ts  Phase 3.5 engine contract (enrich same instances)
 └── runtimeObjects.ts  types + 1:1 row mappers
        ↑ imports ONLY lib/projectionPlatform public API (types, table names)
        ✗ zero imports from lib/eventPlatform — bypass is structurally impossible
```

## 4. Digital Twin lifecycle

`created → assembling → live → disposed` (+ future `stale` on observation loss)

- `getDigitalTwin(casinoId)` — returns THE single twin per casino; a disposed twin is replaced, never resurrected
- `start(client)` — assemble from projections; auto-subscribes to projection Realtime when the client supports it
- `refresh()` — re-assembles; surviving instances are updated IN PLACE (references + enrichments survive), vanished entities reconciled away
- `applyProjectionChange(table, row)` — live-sync entry; foreign casinos and non-projection tables refused
- `dispose()` — releases the Realtime channel, engines, and every runtime object

## 5. Projection consumption flow

Assembly reads, in one parallel batch, exactly: `projection_player_state`, `projection_session_state` (active only), `projection_machine_state`, `projection_casino_state` (aggregates), `projection_intervention_state` (current interventions), `projection_compliance_state` (monitoring membership). Live sync observes `postgres_changes` on the three maintained tables and routes changed rows onto the same instances. Threshold decisions (risk tiers, who requires monitoring) remain in the catalogue views — the twin only reads membership.

## 6. Extension points for Shared Domain Engines (3.5)

`TwinEnrichmentEngine { engineId, enrich(object) }` → `twin.registerEngine(engine)`. Every registry create/refresh flows through the `ExtensionHost`, which stores each engine's returned enrichment under `object.enrichments[engineId]` on the SAME instance. Registering the same engineId twice throws — one instance of every engine. No engine implemented in this phase (contract only, verified by tests).

## 7. Files created

- `lib/digitalTwin/runtimeObjects.ts` — shared object model + 1:1 mappers
- `lib/digitalTwin/registry.ts` — identity map, reconcile, update notifications
- `lib/digitalTwin/assembly.ts` — projection consumption (read models only)
- `lib/digitalTwin/sync.ts` — Realtime observation + change routing
- `lib/digitalTwin/queries.ts` — operational questions (assembly only)
- `lib/digitalTwin/health.ts` — infrastructure freshness
- `lib/digitalTwin/extensions.ts` — Phase 3.5 engine contract
- `lib/digitalTwin/twin.ts` — CasinoDigitalTwin + ONE-per-casino accessor
- `lib/digitalTwin/index.ts` — public API
- `supabase/functions/digital-twin/index.ts` — operations endpoint (snapshot | health) — the twin's surface, not a second twin
- `supabase/migrations/20260710150000_add_floor_location_to_machine_projection.sql`
- `tests/digitalTwin.test.mjs` — 17 tests

## 8. Files modified

- `lib/projectionPlatform/readModels.ts` — `MachineState.floor_location`; `PROJECTION_VERSION` 1 → 2
- `lib/projectionPlatform/reducers.ts` — machine reducer materializes `metadata.casino_floor_location` (an event fact recorded by the producer — materialized, never derived)

## 9. Database changes

One additive migration (applied to demo): `projection_machine_state.floor_location text` — backfilled automatically by projection rebuild from the immutable log. No new tables, no new stores, no RLS changes.

## 10–11. Tests executed / passed

`node --test tests/*.test.mjs` → **71 tests, 71 pass, 0 fail** (54 pre-existing incl. identity/event/projection platforms — zero regressions — plus 17 new). New coverage: floor materialization (v2), assembly from projection rows exactly as the platform writes them, single-instance guarantee under updates and refresh, enrichment survival, floor grouping by reference, ended-session removal, operational queries, health, engine registration/refusal, ONE-twin accessor, foreign-row refusal, no-persistence surface check, disposed-twin refusal, rebuild-reconstructs-twin equality.

## 12. Live runtime verification (demo project)

1. `casino-simulator?action=burst&casino_id=cc000003…` → 15 events ingested through the ONE event flow
2. `projection-platform?action=rebuild&casino_id=cc000003…` → `{"events_replayed":45,"players_projected":15,"sessions_projected":15,"machines_projected":15}` — floor_location backfilled from history by the v2 reducers
3. `digital-twin?action=snapshot&casino_id=cc000003…` → `state:"live"`, 15 active players, 15 open sessions, 15 occupied machines, **5 gaming floors** with occupancy (busiest: Zone B – Tables 5/5), 1 player requiring monitoring (`SB-PLR-21AB858C`, projected risk 65 via the compliance view), assembled alerts, health with `projectionLagMs`

Step 2→3 is the replay proof: the twin was reconstructed purely by rebuilding projections from immutable events — the twin itself needed nothing.

## 13. Performance considerations

- Assembly is one parallel batch of six indexed reads scoped to `casino_id`; the demo scale (≤150 players, 80 machines) assembles in a single round trip
- Live sync applies single-row deltas in O(1) map operations — no re-reads
- Twin queries are in-memory filters; no query touches the database
- Edge invocations are short-lived so the endpoint re-assembles per request (`observe:false`); long-lived hosts (3.7 dashboards) hold one live twin with Realtime observation instead of polling

## 14. Memory lifecycle strategy

The twin owns ONLY live state: ended sessions are evicted on arrival, entities the projections no longer contain are reconciled away on refresh, floors with no machines are dropped, and `dispose()` releases the channel, engines and all objects. Everything is disposable — the projection rebuild path makes loss impossible by construction.

## 15–16. Updated architecture diagrams

Enterprise flow: §1. Runtime dependency graph: §3. (One flow, one read side, one runtime model.)

## 17. Evidence: ONE continuous enterprise event flow

- Simulator remains the sole producer via `getEventPlatform().ingestBatch` (unchanged)
- The same envelopes continue in-flow into projections (unchanged); the twin observes projections only
- `grep -rE "casino_event_log|eventPlatform|live_events|machine_activity" lib/digitalTwin/` → only comments; zero code references
- Zero write operations in `lib/digitalTwin` (all `.delete()` hits are in-memory Maps)

## 18. Evidence: the twin is the ONLY runtime representation

- `getDigitalTwin()` returns the single instance per casino; test-verified
- The twin persists nothing and computes nothing — verified by surface tests and grep
- **Known transitional duplicates, documented for Phase 3.7 removal (unchanged this phase):**
  - `contexts/CasinoDataContext.tsx` browser pool simulation — the last dashboard-side runtime model; deleted when dashboards migrate onto the twin (3.7)
  - `lib/projectionPlatform/legacy.ts` mirrors (`machine_activity`, `live_kpi_snapshots`) + legacy `live_events` adapter — derived views of the same events, marked REMOVE IN 3.7
  These are consumers awaiting migration, not competing sources of truth; both are marked in code.

---

**Phase gate for 3.5:** every Shared Domain Engine can now `registerEngine()` and enrich the SAME PlayerTwin/SessionTwin/MachineTwin/GamingFloorTwin/InterventionTwin instances. No engine needs — or is able — to create its own runtime model.
