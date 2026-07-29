# Phase 3.7 — Enterprise Consumer Platform

**Status: COMPLETE & DEPLOYED** (2026-07-12, SafeBet Demo project `uexdjngogzunjxkpxwll`; production never touched)

ONE Enterprise Consumer Platform is now the only presentation gateway. Every consumer — casino dashboards, regulator views, executive summaries, compliance workspaces, future mobile/REST/GraphQL clients — obtains information exclusively through it. The last duplicate runtime model (the browser session-pool simulation) and every legacy compatibility adapter (`live_events` distribution, `machine_activity`/`live_kpi_snapshots` mirrors) are **deleted**.

---

## 1. Architecture

```
Casino Event
    ↓
Identity Resolution → Policy → Provider                    (3.1/A/B)
    ↓
ENTERPRISE EVENT PLATFORM         lib/eventPlatform         (3.2)
    persist casino_event_log — persisting IS distribution (Realtime)
    ↓
ENTERPRISE PROJECTION PLATFORM    lib/projectionPlatform    (3.3, v2)
    ↓
ENTERPRISE CASINO DIGITAL TWIN    lib/digitalTwin           (3.4)
    ↓
ENTERPRISE DOMAIN INTELLIGENCE    lib/domainIntelligence    (3.5)
    ↓
ENTERPRISE POLICY & RULES         lib/policyPlatform        (3.6)
    ↓
ENTERPRISE CONSUMER PLATFORM      lib/consumerPlatform      (3.7 — THIS)
    version negotiation → authorization → routing → shaping
    ↓                                    ↓
  consumer-gateway (REST views)     Realtime distribution
    ↓                                (event log + machine read model,
Consumers: casino dashboards ·       shaped client-side with the
regulator · executive · compliance · Consumer Platform's own shapers)
mobile · REST · future GraphQL
```

The gateway owns: presentation contracts, response shaping, consumer filtering, authorization integration, routing, versioning. It never recalculates intelligence, never evaluates policy logic, never mutates anything (test-asserted: serving all five views leaves the twin byte-identical).

## 2. Consumer interaction

`GET consumer-gateway?consumer=<profile>&view=<view>&casino_id=…[&version=v1][&jurisdiction=ZA]` → `ConsumerResponse envelope { contractVersion, consumer, view, casinoId, generatedAt, data }`. Live updates arrive on the platform's published Realtime channels (`casino_event_log` INSERTs, `projection_machine_state` changes), shaped client-side with `shapeEventRow`/`shapeMachineRow` — shapers owned by the Consumer Platform, so shaping logic never leaks into consumers.

## 3. Consumer authorization model

`profileForRole(users.role)` → profile; unknown roles get **no** profile. `VIEW_GRANTS` (authorization filters, never widens):

| Profile | live-floor | activity-feed | compliance | summary | actions |
|---|---|---|---|---|---|
| casino-operator | ✓ | ✓ | | ✓ | |
| regulator | | | ✓ | | |
| executive | | | | ✓ | |
| compliance-officer | | | ✓ | | ✓ |
| administrator | ✓ | ✓ | ✓ | ✓ | ✓ |
| api-client | | ✓ | | ✓ | |

Field-level filtering is a property of the contracts: a profile can only see the fields its granted views carry. Live-proven: regulator requesting `live-floor` → **403**.

## 4. Presentation contract model (v1)

`LiveEventView · LiveKpiView · MachineStatusView · PlayerView · InterventionView · DecisionView` composed into `OperatorLiveFloorView` (KPIs, 80-position floor grid, players, interventions, floor occupancy), `ActivityFeedView`, `RegulatorComplianceView` (risk tiers, monitoring cohort, regulatory decisions verbatim, audit evidence), `ExecutiveSummaryView` (KPIs, floor utilisation, critical/high headline decisions, operational health), `ComplianceActionsView` (outstanding actions from Compliance Intelligence, alerts, execution-required decisions). Shaping = selecting/arranging/labeling platform facts; risk tier labels use the bands the Projection Platform published (80/60/40); feed statistics describe the served feed window itself.

## 5. Consumer routing model

One router (`ConsumerGateway.serve`): negotiate version → validate profile/view → authorize → build the granted view from injected `ConsumerSources { twin, recentEvents(), decisions() }` → envelope. No per-consumer APIs, no feature endpoints.

## 6. Versioning strategy

- **REST:** explicit `version` parameter; `CONTRACT_VERSIONS = ['v1']`; unknown versions rejected with the supported list (live-proven: `v9` → 400). Breaking changes mint `v2` while `v1` keeps serving; additive changes extend v1.
- **GraphQL-ready:** contracts are plain typed view models — a future GraphQL layer maps them 1:1 as its type source and resolves through the same `serve()`.
- **Evolution:** UI changes ride on contracts; core platform changes never propagate past the shapers.

## 7. Legacy migration report

**Migrated / removed this phase:**
- `contexts/CasinoDataContext.tsx` — browser session-pool simulation (the last duplicate runtime model), legacy table reads (`live_events`, `live_kpi_snapshots`, `machine_activity`), legacy Realtime subscriptions, and client-side KPI calculation **deleted** (1 279 → ~330 lines). The context is now a pure Consumer Platform client: gateway views + published Realtime distribution + the producer trigger (casino-simulator bursts). Its external contract is unchanged — all 8 dashboard components work untouched.
- `lib/eventPlatform/distribution.ts` (legacy `live_events` adapter) — **deleted**; distribution is the event-log insert itself.
- `lib/projectionPlatform/legacy.ts` (`machine_activity`/`live_kpi_snapshots` mirrors) — **deleted**.
- Identity-pool bootstrap in the browser — removed (the simulator resolves identities server-side).

**Enabling change:** migration `20260710170000_enable_event_log_distribution.sql` — authenticated SELECT on `casino_event_log` (no PII; append-only trigger and service-role-only writes unchanged) + publication membership for `casino_event_log`, `projection_machine_state`, `projection_player_state`.

## 8. Files created

- `lib/consumerPlatform/{contracts,shaping,authorization,gateway,index}.ts`
- `supabase/functions/consumer-gateway/index.ts`
- `supabase/migrations/20260710170000_enable_event_log_distribution.sql`
- `tests/consumerPlatform.test.mjs` (14 tests)

## 9. Files modified

- `contexts/CasinoDataContext.tsx` — rewritten as a Consumer Platform client
- `lib/eventPlatform/platform.ts`, `lib/projectionPlatform/platform.ts` — legacy adapter calls removed
- `lib/eventPlatform/envelope.ts`, `supabase/functions/casino-simulator/index.ts` — stale comments corrected
- `tests/eventPlatform.test.mjs`, `tests/projectionPlatform.test.mjs` — now assert the legacy channels are **gone**

## 10–11. Tests executed / passed

`node --test tests/*.test.mjs` → **115 tests, 115 pass, 0 fail** (101 pre-existing across all six platforms — updated where they asserted legacy behaviour — plus 14 new). `tsc --noEmit` clean. **Full `next build` succeeds** — all dashboards compile against the migrated context.

## 12–13. Remaining legacy components & removal plan

| Component | Reason it remains | Risk | Removal |
|---|---|---|---|
| DB tables `live_events`, `machine_activity`, `live_kpi_snapshots` (historical rows) | Nothing writes or reads them any more; dropping data is a destructive operation the user should schedule | None (dead tables) | Cleanup migration in a housekeeping phase, after a demo soak period |
| `simulate_live_feed` DB function + demo tooling edge fns (`demo-sync-all-casinos`, `sync-real-casino-data`) | Out-of-flow demo utilities, not part of any dashboard path | Low — unused by the enterprise flow | Retire or convert to Event Platform producers when demo tooling is next touched |
| `digital-twin` edge function | Internal operations/verification surface (snapshot/health/intelligence/decisions) — not a consumer path | None — ops-only | Keep as the platform ops endpoint |

## 14–15. Updated diagrams

Enterprise flow + consumer architecture: §1–2.

## 16. Evidence: consumers access SafeBet IQ only through the Consumer Platform

- Repo-wide sweep: **zero** application code references to `live_events` / `machine_activity` / `live_kpi_snapshots` (only retirement comments in platform files)
- The only dashboard data source (`CasinoDataContext`) calls exactly: `consumer-gateway`, the published Realtime channels (shaped by Consumer Platform shapers), and the `casino-simulator` producer trigger
- Live-proven on demo: operator `live-floor` (80-position grid, 24 occupied, 29 players, 5 floors), regulator `compliance` (risk tiers, 2 monitored, 14 regulatory decisions with references, audit evidence), executive `summary` (headline decisions, health `live`) — one gateway, three profiles; 403/400 refusals enforced

## 17. Evidence: all five constitutions intact

1. **Enterprise:** one continuous flow — event → projections → twin → intelligence → policy → consumer platform; nothing forks (the retired adapters were the last parallel channels)
2. **Runtime:** the twin is the ONLY runtime model — the browser pool simulation is deleted; consumers hold shaped views, never runtime objects
3. **Intelligence:** unchanged; the gateway reads `intelligenceOf(object)`, never recomputes (twin enrichments byte-identical after serving every view — test-asserted)
4. **Policy:** unchanged; decisions presented verbatim (`DecisionView` is a field-for-field pass-through)
5. **Consumer:** the gateway shapes/filters/authorizes only — surface test forbids mutation/evaluation/calculation methods; consumers own no business logic

---

**The Phase 3 enterprise refactor is complete: SafeBet IQ operates as ONE enterprise platform** — one event flow, one runtime model, one intelligence layer, one decision layer, one presentation gateway — supporting multiple operators, regulators and African jurisdictions through configuration, not code.
