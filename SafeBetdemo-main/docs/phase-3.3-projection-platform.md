# Phase 3.3 — Enterprise Projection Platform: Deliverables

**Date:** 2026-07-10 · **Branch:** Demo · **Deployed to:** SafeBet Demo (`uexdjngogzunjxkpxwll`) — Production untouched.

## 1. Architecture

ONE platform (`lib/projectionPlatform/`) — the enterprise read side and the **only producer of runtime state**. Invoked in-line by the Enterprise Event Platform immediately after persistence: the SAME envelopes continue through it (no second pipeline, no event copies, no per-feature projection services).

```
… Event Platform: validate → enrich → version → persist(casino_event_log)
        │  (same envelopes continue)
        ▼
Enterprise Projection Platform
  load current rows → PURE reducers (occurred_at order) → upsert
        │
        ├─► projection_player_state ─┐
        ├─► projection_session_state ├─ the ONLY maintained state tables
        └─► projection_machine_state ┘
                 │ SQL views (no duplicate state, consistent by construction)
                 ▼
  casino / risk / behaviour / intervention / compliance / executive / regulator
        │ Supabase Realtime on projection tables = publishing
        ▼
 future: Shared Domain Engines (3.6) · Digital Twin (3.5) · Dashboards (3.7)
```

## 2. Projection lifecycle

generate (in-flow apply) → publish (Realtime on the tables) → version (`projection_version` on every row) → invalidate/rebuild (dispose + replay) → consistency (views derive, never store). Apply is at-least-once with an immediate-duplicate guard (`last_event_id`); **rebuild is the authoritative corrector** and runs the *same reducers* as the live path — one code path, two entry points, so live and replay can never diverge in logic.

## 3. Dependency graph

`eventPlatform/platform.ts → projectionPlatform/platform.ts → {apply, rebuild, legacy} → reducers → readModels`. The Projection Platform imports only from `eventPlatform` (envelope types + `EVENT_LOG_TABLE`) — never from app/, components/, or any engine. `projection-platform` edge function is the operational surface (rebuild/status) of the same platform, not a separate service.

## 4. Read-model catalogue (10)

| Model | Kind | Backing |
|---|---|---|
| projection_player_state | table | reducers |
| projection_session_state | table | reducers |
| projection_machine_state | table | reducers |
| projection_casino_state | view | aggregates of the 3 tables |
| projection_risk_state / behaviour / intervention / compliance | views | player_state slices |
| projection_executive_state / regulator_state | views | casino_state slices |

Reducers **materialize** event facts (copy risk scores/amounts as recorded; sums and counters are projection arithmetic). No business rule exists anywhere in the platform.

## 5. Replay strategy

Projections are disposable: `rebuild` deletes a casino's rows and replays `casino_event_log` in `occurred_at` order (paged, 1000/page) through the same reducers, using `rowToEnvelope` — the exact inverse of the persistence mapping (unit-proven). Event-level re-emission (replayNumber > 0) remains reserved.

## 6–8. Files & database

**Created:** `lib/projectionPlatform/{readModels,reducers,apply,rebuild,legacy,platform,index}.ts`, `supabase/functions/projection-platform/index.ts`, `supabase/migrations/20260710120000_create_projection_platform.sql` (3 tables + 7 views; authenticated read, service-role write), `tests/projectionPlatform.test.mjs`, this doc.
**Modified:** `lib/eventPlatform/platform.ts` (projection stage in the one lifecycle), `supabase/functions/casino-simulator/index.ts` (**deleted** its `machine_activity` + `live_kpi_snapshots` upserts and `buildMachineRows` — the producer no longer owns any state), `tests/eventPlatform.test.mjs` (mock widened).

## 9–10. Tests

**54/54 pass** (identity 28, event platform 15, projections 11): full-journey player/session/machine reduction, mid-journey occupancy, order-independence, duplicate guard, `rowToEnvelope∘envelopeToRow = identity`, dispose+replay ≡ live state, one-flow test (same `eventId` in event store + 3 projections + legacy channel from a single ingest), catalogue completeness, no-business-surface. `tsc` 0 errors; `next build` compiled.

**Live:** burst 15 events → 5 journeys projected in-flow; status endpoint 30 events/5 projected; **rebuild replayed 30 events → 10/10/10**, recovering pre-projector history (proof that dispose loses nothing); SQL cross-check `consistent: true` (log distincts and wagered sums exactly equal projection counts and sums); all 7 catalogue views returning rows.

## 11–12. Temporary adapters ledger

| Adapter | Where | Removed in |
|---|---|---|
| Legacy event channel (`live_events` insert) | `eventPlatform/distribution.ts` | **3.7** |
| `machine_activity` mirror | `projectionPlatform/legacy.ts` | **3.7** |
| `live_kpi_snapshots` mirror | `projectionPlatform/legacy.ts` | **3.7** |
| Browser pool simulation (UI-side presentation events, never persisted) | `contexts/CasinoDataContext.tsx` | **3.7** (dashboards become projection consumers) |
| Dashboards reading legacy tables & computing display aggregates | various pages | **3.7** |
| At-least-once apply (rebuild-corrected) → exactly-once ledger | `projectionPlatform/apply.ts` | **3.5** (Digital Twin) |

## 13. Updated enterprise architecture

Casino Event → Identity Resolution → Identity Policy → Identity Provider → **Enterprise Event Platform** (validate·enrich·version·persist) → **Enterprise Projection Platform** (the only runtime state) → [3.5 Digital Twin] → [3.6 Shared Engines] → Realtime → Dashboards → Reports → Operators → Regulators.

## 14. One-flow evidence

✓ One projection platform; zero per-feature projection services (grep: only `eventPlatform/platform.ts` and the ops endpoint invoke it). ✓ Producers own no state (simulator's last state writes deleted). ✓ All runtime state derives from immutable events (rebuild proof). ✓ No new workflows: projection application is a stage of the existing ingest lifecycle; the ops endpoint only disposes/replays. ✓ Dashboards unchanged this phase — they still read legacy mirrors *fed by this same flow*, and their migration is the explicit subject of Phase 3.7 (see adapter ledger).
