# SafeBet IQ — National Demonstration Dataset v1.0

**2026-07-16 · Regulator-grade multi-casino demonstration environment (demo project only)**

## Purpose
Transform the demo environment into a believable **national, multi-tenant deployment** across the six existing ZA casino tenants, suitable for demonstrations to national/provincial regulators, casino CEOs, compliance directors, RG officers, investors and pilot customers. **No new casinos were created; no casino IDs, names, tenant relationships, foreign keys, architecture, Consumer Platform, or business logic were modified.** Only the existing tenants were populated.

## Design principles
- **Certified injection path only.** All runtime data enters through the **Event Platform** via the certified `casino-simulator` producer → Projections → Digital Twin → Domain Intelligence → Policy → Consumer Platform. No table was populated by writing projections/presentation directly. Events carry the demo/simulated marking; patrons live in the synthetic demo namespace; **demo project `uexdjngogzunjxkpxwll` only** — production is never touched.
- **Distinct personalities via volume + province.** No two casinos look alike.
- **Referential integrity preserved.** Tenant isolation intact; the regulator aggregates by jurisdiction (ZA).
- **Honest evidence (Constitution §8).** Every value is a Recorded Fact / Derived Intelligence / Policy Decision. Nothing was fabricated — see *Architectural boundaries & honest limitations*.

## Data generation methodology
1. **Lifecycle seeding** — `casino-simulator?action=burst` per casino, volume varied by personality. Produces certified player/session/machine projections + emergent risk classification from the Domain Intelligence Platform.
2. **Case & investigation seeding** — `workflow?action=create-case` per casino (high-risk-player, rg-recommendation, compliance-finding) + regulatory-investigations, referencing real anonymous SB-PLR ids and policy references.
3. **Aggregation** — the Regulator Portal (`regulator-portal`) composes all six tenants into the national view automatically (no separate national store).

## 1. National Demonstration Dataset Report (summary)
Six ZA operators are now fully operational with distinct profiles. National totals: **398 players · 247 machines · ~3,400 events · 44 players under monitoring · 22 cases (incl. 2 regulatory investigations)**. National risk distribution: **0 critical / 44 high / 149 medium / 205 low**. Every regulator KPI reconciles to the per-casino projections.

## 2. Casino Summary
| Casino | Province | Personality | Players | Machines | Events | Monitored | Cases |
|---|---|---|---|---|---|---|---|
| Prestige Casino (Demo) | Gauteng | **Flagship** | 152 | 71 | 2,508 | 17 | 5 |
| SunBet | Gauteng | Large regional | 67 | 44 | 270 | 5 | 4 |
| Hollywoodbets | KwaZulu-Natal | Sportsbook-focused | 64 | 45 | 240 | 11 | 4 |
| Gold Rush | Gauteng | Traditional gaming | 46 | 34 | 165 | 5 | 3 |
| Betway | Western Cape | Premium VIP | 35 | 27 | 120 | 2 | 3 |
| Royal Palace | Eastern Cape | Small independent | 34 | 26 | 120 | 3 | 3 |
| **National** | 4 provinces | — | **398** | **247** | **~3,423** | **44** | **22** |
Each casino has a different player volume, machine count, monitoring rate, case load and province — a realistic national spread (Gauteng-heavy with regional operators across KZN, W. Cape and E. Cape).

## 3. Cross-Operator Intelligence Report
Cross-operator intelligence is demonstrated at the **certified aggregate/cohort level** (`regulator-portal?view=cross-operator`): per-operator risk distribution, monitoring and intervention rates, national risk tiers, and operator rankings across all six tenants. The view reports `identityModel: 'per-operator-anonymous'` and `perPlayerLinkage: 'not-available-by-design'`.

> **Architectural boundary (important, ADR-001).** SafeBet IQ's anonymous SB-PLR identity is **per-casino**, and cross-casino **federation is denied by default** at the Identity Policy layer. Therefore **per-individual** cross-operator correlation — the "same person / shared phone / shared device / shared payment instrument" scenarios, and a cross-operator self-exclusion *federation* register — is **impossible by design** and is *not* seeded. This is a deliberate privacy guarantee, not a gap: a legacy component that fabricated such per-player linkage was removed in v1.5.1 as an Evidence-Integrity violation. Demonstrating it would require enabling identity federation (an architecture change requiring an ADR) or fabricating data — both out of scope and non-compliant. The demonstrable, honest differentiator is **anonymous aggregate/cohort cross-operator intelligence + national oversight**, which is fully populated.

## 4. Regulator Summary
- **National totals:** 6 operators · 397 active players · 44 monitored · risk tiers 0/44/149/205 (critical/high/medium/low).
- **Operator comparison (operator health):** Prestige 151 active / 17 monitored; SunBet 67 / 5; Hollywoodbets 64 / 11; Gold Rush 46 / 5; Betway 35 / 2; Royal Palace 34 / 4.
- **Cross-operator:** aggregate risk distribution per operator + national rollup; per-player linkage denied by design.
- **Investigations:** 2 open regulatory investigations (SunBet, Hollywoodbets) + 22 total cases across operators.
- **National trends / emerging risks:** derived from projected tiers (currently no critical-risk cohort — see limitations).

## 5. Validation Report
| Check | Result |
|---|---|
| Every existing casino contains realistic data | ✅ all 6 populated (34–152 players) |
| No casino empty | ✅ |
| Regulator totals reconcile | ✅ national tiers sum (0+44+149+205)=398=Σ projected players; operatorHealth active Σ=397=national activePlayers |
| Operator totals reconcile | ✅ per-casino projections = regulator operatorHealth |
| Cross-operator intelligence functions | ✅ 6 operators aggregated; privacy boundary enforced |
| Tenant isolation intact | ✅ per-casino data isolated; regulator aggregates by verified jurisdiction (cross-tenant 403 — CPR-1) |
| Investigation workflows functional | ✅ 22 cases, 2 investigations, timelines/audit present |
| Risk engine exercised | ⚠ low/medium/high exercised; **critical not reached** (see limitations) |
| No duplicated datasets / broken relationships | ✅ each tenant distinct; referential integrity preserved |
| Certified architecture unchanged | ✅ injection via Event Platform only; no arch/contract/schema/logic change |

## Architectural boundaries & honest limitations
These reflect the certified demonstration producer and architecture — documented, not faked:
1. **Wagering / GGR is minimal** (~R0). The simulator generates bet events only from *legacy* active `gaming_sessions`, and such bets are correctly **rejected by the certified Event Platform** (they reference non-certified sessions — reject-not-repair). Even the flagship shows ~R420. GGR is not a focus of an RG-intelligence demo; the value KPIs (risk/players/monitoring/cases) are fully populated.
2. **Recorded intervention *events* are minimal.** Intervention *coordination* is demonstrated through the certified **Case & Workflow** layer (22 cases incl. intervention-origin) and the **monitored** counts; the platform's "interventions recorded" event count reflects the same producer limitation as (1).
3. **No critical-risk cohort.** The simulator's synthetic behaviour peaks in the *high* band; the Domain Intelligence therefore classifies 0 critical players, so "emerging national risks" is currently empty. Low/Medium/High are exercised.
4. **Per-individual cross-operator linkage is not-available-by-design** (ADR-001) — see §3.
Closing (1)–(3) fully would require modifying the certified producer/engine (business-logic change), which is out of scope for a demonstration-data task.

## Reset / reseed procedure (repeatable)
The dataset is reproducible (approximately — the producer is not seed-locked). To refresh:
1. **Scope:** demo project `uexdjngogzunjxkpxwll` only.
2. **Truncate** the certified runtime for the five regional tenants (never Prestige unless intended): remove their rows from `casino_event_log` + `projection_{player,session,machine}_state` (event log is partitioned; use the documented archive/detach or a scoped delete on the demo project), and their `workflow_cases/tasks/audit`.
3. **Reseed lifecycle:** `casino-simulator?action=burst&casino_id=<id>&count=100` — bursts per casino: SunBet 23, Hollywoodbets 16, Gold Rush 11, Betway 8, Royal Palace 7 (adjust for target volumes).
4. **Reseed cases:** `workflow?action=create-case` — 3 per casino + 2 investigations (see the seeding script in this task's history).
5. **Validate:** `regulator-portal?view=national-overview` reconciles to the per-casino projections.

## Expected dataset statistics
6 operators · ~398 players · ~247 machines · ~3,400 events · 44 monitored · 22 cases · 2 investigations · risk tiers 0/44/149/205. Volumes vary ±small per reseed (producer randomness); the *shape* (flagship + graduated regional operators across 4 provinces, reconciling national aggregate) is stable.

## Demo labelling / production safety
All events are producer-generated and simulated (demo patron namespace, `is_simulated` marking); the dataset exists only in the **demo Supabase project**. Production (`ilibvipqbkugqkppzdmh`) is never referenced or touched. This dataset must not be promoted to production.

## Version history
- **v1.0 (2026-07-16):** initial national dataset — 6 tenants populated via the certified Event Platform producer; cases/investigations seeded; national reconciliation verified; boundaries documented.
