# Phase 3.5 — Enterprise Domain Intelligence Platform

**Status: COMPLETE & DEPLOYED** (2026-07-10, SafeBet Demo project `uexdjngogzunjxkpxwll`; production never touched)

ONE Enterprise Domain Intelligence Platform now enriches THE Digital Twin. It registers with the twin as a **single** enrichment engine (`domain-intelligence`) containing seven intelligence pipelines in a fixed dependency chain. Every pipeline analyses the SAME runtime objects and writes its output into the object's enrichment slot — no second Player, Session, Machine, Risk, Behaviour, Intervention or Compliance object exists anywhere.

---

## 1. Architecture

```
Casino Event
    ↓
Identity Resolution → Policy → Provider                       (3.1/A/B)
    ↓
ENTERPRISE EVENT PLATFORM         lib/eventPlatform            (3.2)
    ↓  same envelopes, in-flow
ENTERPRISE PROJECTION PLATFORM    lib/projectionPlatform       (3.3, v2)
    ↓  read models only
ENTERPRISE CASINO DIGITAL TWIN    lib/digitalTwin              (3.4)
    ↓  ONE engine registration: registerEngine(platform)
ENTERPRISE DOMAIN INTELLIGENCE    lib/domainIntelligence       (3.5 — THIS)
    session → machine → behaviour → risk → ai → intervention → compliance
    ↓  the SAME enriched runtime objects
Realtime → Dashboards → Reports → Operators → Regulators
```

The platform owns **analysis, inference, classification, scoring, recommendations — nothing else**. No events, no projections, no runtime state, no persistence, no distribution, no presentation. It consumes the twin, enriches the twin, returns control to the flow.

## 2. Intelligence pipeline architecture

ONE `DomainIntelligencePlatform` (one class, one engine id, one registration per twin — a second `attach()` throws). Pipelines are internal stages, not engines:

| Stage | Applies to | Consumes | Produces |
|---|---|---|---|
| **session** | sessions, players | — | lifecycle, duration, bets/min, concurrency, player movement |
| **machine** | machines, floors | — | occupancy, availability, idle minutes, hot/warm/cold (peer-relative), floor utilisation |
| **behaviour** | players | session | betting velocity, bet frequency, loss ratio, chasing-loss indicator, play style, patterns — **indicators only, no risk** |
| **risk** | players | behaviour | GRPI (weighted composite), dynamic risk score, escalation level, trend, confidence — **no intervention triggers** |
| **ai** | players | session, machine, behaviour, risk | predicted risk, emerging behaviour, recommendations, operational insights, confidence — **recommends, never performs** |
| **intervention** | players | risk, ai | recommended/active/pending intervention, effectiveness — **no regulator workflow** |
| **compliance** | players | behaviour, risk, intervention | readiness, obligations, outstanding actions, audit readiness, RG evidence |

## 3. Intelligence dependency graph

Fixed chain, validated at construction (`validateChain()` throws if any stage consumes a stage that has not yet run):

```
session ──┬───────────────► behaviour ──► risk ──┬──► ai ──┐
machine ──┴──────────────────────────────────────┴─────────┼──► intervention ──► compliance
```

Each stage reads earlier stages' output for the SAME object via the `stages` accumulator in the same pass — one pass, one object, one enrichment record.

## 4. Runtime enrichment flow

```
projection change (Realtime) ──► registry upsert ──► SAME instance mutated
                                        │
twin.start()/refresh() ──► assembly ──► twin.reenrich()  (complete-casino pass)
                                        │
                                 ExtensionHost.apply(object, {registry})
                                        │
                        DomainIntelligencePlatform.enrich(object, ctx)
                          runs 7 stages in order, accumulating outputs
                                        │
                 object.enrichments['domain-intelligence'] = {session, …, compliance}
```

Player example (the mandated invariant): the SAME `PlayerTwin` instance flows through session → behaviour → risk → ai → intervention → compliance; reference equality is test-asserted before and after enrichment and after live projection changes.

## 5. Extension model

- **To the twin (3.4, unchanged shape):** the platform is ONE `TwinEnrichmentEngine`. The 3.4 contract gained a read-only `EnrichmentContext { registry }` (sibling-object access for concurrency/peer/floor analysis) and floors now flow through enrichment when their machines change. `twin.reenrich()` guarantees enrichment always sees the complete casino after assembly.
- **From the platform (future Rules Engine):** jurisdiction rules will consume `intelligenceOf(object)` — the enriched twin — as another reader AFTER this platform. Integration point prepared (`intelligenceOf`, stage catalogue exported); no rules engine implemented.

## 6. Files created

- `lib/domainIntelligence/contracts.ts` — stage ids, pipeline contract, shared arithmetic
- `lib/domainIntelligence/pipelines/{session,machine,behaviour,risk,ai,intervention,compliance}.ts`
- `lib/domainIntelligence/platform.ts` — THE platform (chain validation, single-engine enrich, attach/detach)
- `lib/domainIntelligence/index.ts` — public API (`getIntelligencePlatform`, `intelligenceOf`)
- `tests/domainIntelligence.test.mjs` — 17 tests

## 7. Files modified

- `lib/digitalTwin/extensions.ts` — `enrich(object, context)` with read-only `EnrichmentContext`; host takes a context supplier
- `lib/digitalTwin/registry.ts` — machine upserts also notify the machine's floor (floors enrich in-flow)
- `lib/digitalTwin/twin.ts` — wires registry context; `reenrich()` public sweep, called after assembly/refresh
- `lib/digitalTwin/index.ts` — exports `EnrichmentContext`
- `supabase/functions/digital-twin/index.ts` — attaches THE platform; new `action=intelligence` returning the same runtime objects with their enrichment

No database changes. No migrations. The intelligence layer persists nothing.

## 8–9. Tests executed / passed

`node --test tests/*.test.mjs` → **88 tests, 88 pass, 0 fail** (71 pre-existing — identity, event platform, projections, twin — zero regressions, plus 17 new). New coverage: ONE-engine registration, fixed stage order, per-kind stage applicability, same-instance mutation under enrichment and live changes, every stage's analysis correctness on a deterministic journey (GRPI 72, escalation critical, care_call recommended, compliance obligations), calm output for low-risk players (no false escalation), platform purity (identical output for identical input, no persistence surface), detach cleanliness, double-attach refusal, unenriched-until-attached.

## 10. Performance considerations

- Enrichment is pure in-memory arithmetic per object — O(stages) per update, O(objects × stages) per assembly sweep; no I/O anywhere in the platform
- Peer comparisons (machine temperature, concurrency) read the already-in-memory registry; no queries
- Edge endpoint assembles + enriches per request (demo scale: 20 players/19 machines enriched in one invocation); long-lived hosts enrich incrementally via Realtime-driven upserts

## 11. Memory lifecycle

The platform holds only its seven stateless pipeline closures. All analysis output lives inside the twin objects' enrichment slots and shares their lifecycle exactly: evicted with ended sessions, reconciled away with vanished entities, released by `twin.dispose()` (which also clears engine registrations). Nothing outlives the twin.

## 12–14. Updated diagrams

Enterprise flow: §1. Runtime enrichment flow: §4. Intelligence chain: §2–3.

## 15. Evidence: ONE continuous enterprise event flow

- Events still enter only via `getEventPlatform().ingestBatch` (simulator unchanged this phase)
- `grep -rE "casino_event_log|eventPlatform|projection_|\.from\(|insert|upsert" lib/domainIntelligence/` → zero data-access code; the platform imports ONLY `lib/digitalTwin` public API
- The intelligence stage sits strictly between Twin and Realtime/Dashboards in the flow; nothing forks

## 16. Evidence: same runtime objects enriched

- Reference-equality tests: the `PlayerTwin`/`MachineTwin` instance before attach, after enrichment, and after a live projection change is the same object
- Pipelines cannot create objects: `analyse()` returns plain data; only the twin's `ExtensionHost` writes it, onto the existing instance's `enrichments` slot
- Floors/interventions enriched are the registry's own instances (grouped references, 3.4-verified)

## 17. Evidence: Enterprise Casino Intelligence Platform (live, demo project)

`digital-twin?action=intelligence&casino_id=cc000003…` after a 15-event burst returned the enriched twin: 20 players / 5 floors / 19 occupied machines, `stages: [session, machine, behaviour, risk, ai, intervention, compliance]`. Live sample — player `SB-PLR-21AB858C` (projected risk 65): risk → `escalationLevel: elevated`, ai → `proactive_contact` + operational insights (`active_on:Zone C – VIP`, `floor_pressure:1.05`), intervention → `session_break` recommended + pending, compliance → `attention_required` with `act_on_recommended_intervention` outstanding and RG evidence block. Floor `Zone E – RNG` → utilisation 1.0; machines → occupancy/temperature. Operational intelligence (floors, machines, movement, pressure) and wellbeing intelligence (risk, interventions, compliance) come from the SAME platform over the SAME twin — one integrated Enterprise Casino Intelligence Platform, not a feature collection.

---

**Phase gate for the Rules Engine / 3.6+:** jurisdiction rules consume `intelligenceOf(object)` on the enriched twin. The intelligence layer is complete, ordered, pure and singular; nothing downstream needs — or is able — to own business reality.
