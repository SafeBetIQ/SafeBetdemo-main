# SafeBet IQ — Independent Enterprise Architecture Review & Certification

**Review board:** Enterprise/TOGAF/Event-Driven/Distributed/Security/Platform/Quality/Casino/Regulatory/AWS/PostgreSQL/DevSecOps/Performance/AI architecture + technical due diligence
**Date:** 2026-07-12 · **Scope:** Phases 3.1–3.7 as deployed to the SafeBet Demo environment · **Method:** adversarial — attempt to prove the architecture incorrect; approve only on objective evidence
**Verdict: APPROVED WITH CONDITIONS** (see §12)

---

## 1. Is this genuinely ONE continuous enterprise platform?

**Within the casino-floor domain: YES, with objective evidence.** The measured import graph is strictly layered and acyclic at runtime:

```
playerIdentity → (nothing)
eventPlatform  → playerIdentity, projectionPlatform (in-flow handoff)
projectionPlatform → eventPlatform (envelope type + table name only)
digitalTwin    → projectionPlatform
domainIntelligence → digitalTwin
policyPlatform → digitalTwin, domainIntelligence
consumerPlatform → digitalTwin, domainIntelligence, policyPlatform
```

No layer imports downward-facing consumers; no consumer imports platform internals; grep sweeps confirm zero references from `lib/digitalTwin|domainIntelligence|policyPlatform` to any store, and zero application references to the retired legacy tables. The event enters once (`getEventPlatform().ingestBatch`), is persisted append-only (immutability trigger verified in `20260710090000_create_casino_event_log.sql:62`), flows in-process into projections, and everything downstream observes.

**At the whole-product level: NO — and this is the board's most significant architectural finding.** The repository contains substantial business capability *outside* the enterprise flow:

- `supabase/functions/api-ingest` writes `sessions` and `transactions` **directly** (lines 185–247) — a second ingestion pipeline that bypasses Identity Resolution, the Event Platform, and projections entirely.
- `safeplay-ai-risk-engine` (305 lines), `bri-risk-score` (289 lines) and `wellbeing-risk-calculator` each compute risk **independently** of the Domain Intelligence Platform — three parallel risk calculators, violating "risk is calculated once."
- The `simulate_live_feed` DB function and demo-sync tooling remain as out-of-flow producers.
- Wellbeing games, BRI, ESG, and training-academy subsystems retain feature-owned tables and logic.

The Phase 3 constitutions were enforced rigorously — but only over the casino-floor domain that Phase 3 migrated. **Constitution 1 is satisfied within scope and violated outside it.** This is architectural drift by omission, not by design error, and it must be scheduled, not ignored (Conditions H1, H2).

## 2. The five constitutions — evidence-based verdicts

| Constitution | Verdict | Evidence |
|---|---|---|
| 1. One flow | **PASS in-scope / FAIL product-wide** | §1 above |
| 2. One runtime reality | **PASS** | Browser pool simulation deleted (context now 330 lines, zero state ownership); `getDigitalTwin()` one-per-casino; registry reference-equality proven by tests; the only "second models" are per-process twin materializations of the same projections — views, not owners |
| 3. Intelligence enriches only | **PASS** | Zero I/O in `lib/domainIntelligence` (grep: only `Array.from`); enrichment writes only via the twin's extension host onto existing instances; purity test (same input → same output) |
| 4. Policy decides only | **PASS** | Comparisons-only evaluator; twin byte-identical after evaluation (test); absent intelligence ⇒ rules silent, never recomputed (test); no execute/persist surface (test) |
| 5. Consumers present only | **PASS with one hole** | Dashboards reach data only via gateway + published Realtime; but the gateway **trusts the claimed profile** (§4, Condition C2) |

## 3. Event architecture

**Sound:** 17-field frozen envelope; validation rejects-never-repairs; identity resolved exactly once; append-only enforced by trigger; five purposeful indexes (casino+time, player, correlation, trace, type); replay through the same reducers as the live path, live-proven twice (45-event and 30-event rebuilds reconstructing projections and twin).

**Weaknesses found:**
- **No ingestion idempotency.** `eventId` is minted during enrichment; a producer retry after a network failure creates duplicate events with new ids. No producer-supplied idempotency key, no dedupe constraint. (H3)
- **Projection apply has a read-modify-write race.** `loadStates → reduce → upsert` with only a same-`last_event_id` guard; two concurrent batches for one player can lose an update. Single-producer demo traffic never triggers it; multi-producer production will. (H3)
- **Rebuild pagination lacks a tiebreaker** — `order('occurred_at')` only; equal timestamps across a page boundary can skip/duplicate rows. (M2)
- **Schema versioning is a stamp, not a mechanism** — `schemaVersion: 1` exists but there is no upcaster registry for replaying v1 events under a future v2 reducer. (M3)
- **Sequential enrichment RPCs:** `for (const draft of drafts) await enrichDraft(...)` — one identity RPC round-trip per event per batch. This is the measured throughput ceiling (§8).

## 4. Security review — the board's sharpest findings

1. **CRITICAL — No tenant isolation on the read path.** `projection_player/session/machine_state` and (since 3.7) `casino_event_log` all carry `for select to authenticated using (true)` (evidence: `20260710120000:145–151`, `20260710170000:19`). Any authenticated user of any casino can read every casino's events, projections, and Realtime streams. Acceptable for a single-org demo; disqualifying for multi-operator production. (C1)
2. **CRITICAL — The gateway authorizes a *claimed* identity.** `consumer-gateway` reads `consumer=` from the query string (line 54) and never verifies the caller's JWT role; during this review's own live checks, an **anon key** successfully retrieved regulator and executive views by claiming those profiles. `profileForRole()` exists but is applied client-side only. The 403 matrix is real but gates the wrong thing. (C2)
3. **HIGH — Jurisdiction is client-chosen.** `jurisdiction=BW` on the query string switches which regulator's policies evaluate — policy evasion by parameter. Jurisdiction must come from the casino registry, not the caller. (C2)
4. **Positives:** anonymous SB-PLR identifiers keep PII out of events/projections/views end-to-end; the event store refuses UPDATE/DELETE at the database layer; writes are service-role only; policy rules validate reject-never-repair; no injection surface found in the platform paths (parameterized supabase-js throughout).

## 5. Identity domain

**CRITICAL for the stated scale target:** SB-PLR ids are the first 8 hex chars of SHA-256 — **32 bits per casino** (`sha256.ts:33`). Birthday math: ~50% collision probability at ~77,000 players in one casino; near-certainty at the platform's stated ambition of millions of players. A collision silently merges two patrons' histories, risk scores, and interventions — a regulatory-grade defect. The Phase 3.1 report correctly flagged the formula as a breaking migration; the board's position: **widen to ≥64 bits before any production onboarding** (C3). The abstraction (`IdentityProvider`/policy layers) makes this a contained change.

## 6. Digital Twin & Domain Intelligence

**Sound:** single object graph per casino, in-place mutation with reference integrity (test-proven), disposability via projections, floors grouping references not copies; intelligence is one engine with seven ordered stages, dependency-validated at construction, enriching the same instances.

**Weaknesses:** per-request assembly in the edge host re-reads six queries and re-enriches O(objects × stages) on every gateway call — "intelligence is calculated once" holds per assembly, not per platform (no long-lived observing host exists yet; dashboards poll at 10 s) (M5/H4-adjacent); the player map is unbounded (all patrons ever seen per casino stay resident — heavy at 100k+ players) ; the `stale` lifecycle state is defined but never entered, so observation loss is silent (L1). JS single-threaded isolates make in-twin concurrency a non-issue; cross-isolate consistency is delegated to projections (correct).

## 7. Policy & Consumer platforms

**Policy:** genuinely configuration-driven (JSON-serializable rules, runtime `configure()`, live-proven ZA↔BW switching with zero code) — but the packs ship **in code and nothing persists custom rule sets**, so today a regulator threshold change is a redeploy. A DB-backed, versioned, audited policy store is required (M1). No hidden business logic found: the evaluator is comparisons-only, confidence is read, thresholds live in data.

**Consumer:** contracts are versioned with negotiation (live-proven `v9` → 400), envelope-stable, GraphQL-mappable; consumer isolation via grants; the retired context proves UI migration without component changes. Findings: the auth hole (C2); `InterventionView` **fabricates** `channel: 'WhatsApp', status: 'delivered'` — presentation inventing facts that were never recorded, which in a regulator's hands is evidence integrity failure; must present only recorded facts or be explicitly labeled simulated (M4); each open browser tab triggers simulator bursts every 10 s — producer triggering belongs server-side (M5).

## 8. Performance & scalability

Evidence-based estimates (single event-platform instance, current code):

| Load | Verdict | Binding constraint |
|---|---|---|
| 100 ev/s | **OK** | Sequential identity RPCs (~N round-trips/batch) is already the hot path |
| 1,000 ev/s | **FAILS** | Per-event RPC enrichment + read-modify-write projection apply; requires batch identity resolution + optimistic concurrency (H3) |
| 10,000 ev/s | **FAILS** | Above + single-table `casino_event_log` without partitioning; per-request twin assembly on the read side (H4) |
| 100,000 ev/s | Out of scope for this topology | Requires partitioned/streamed ingestion and a persistent twin tier — architecture *permits* this evolution (layers are cleanly separable) but does not implement it |

Growth: no partition/retention/archive strategy exists for the event log (H4). 10 → 1,000 casinos: per-casino isolation of projections/twins scales horizontally in principle; the blockers are C1 (isolation), C3 (identity), H3/H4 (throughput/growth) — none require re-architecture; all are hardening of the existing layers. That is the strongest structural compliment the board can pay.

## 9. Database & AWS

**Database:** projection tables correctly keyed and indexed; views-over-tables eliminates aggregate drift; event log indexed for replay/journey queries. Missing: partitioning, retention, archive (H4); policy config store (M1). Multi-jurisdiction data separation is logical-only today (C1).
**AWS:** review limited to repository artifacts (production access is out of scope by standing instruction). EB single-environment Next hosting with RC1 security headers and release scripts; data layer is Supabase-managed (HA delegated). No HA/DR evidence for the app tier, secrets as EB env vars, no platform-level monitoring/alerting (projection lag, ingest failures) — operational readiness is the weakest non-security area (conditions H5, M7).

## 10. Regulator & operator readiness

**Regulator:** immutable evidence chain, journey correlation ids, live-proven replay, anonymous-by-design data, decisions carrying regulation citations, jurisdiction packs + four registered African extension points — a genuinely strong foundation. Gaps: fabricated intervention channel metadata (M4), cross-casino/self-exclusion intelligence still outside the flow (H2), no regulator-facing replay UI yet.
**Operator:** live floor (80 positions, occupancy, hot/cold), wellbeing monitoring, executive KPIs, AI recommendations with confidence, floor pressure — served from one gateway. Ready to demonstrate.

## 11. Demonstration readiness — **9/10**

The demo will impress CEOs, operations managers, RG teams, and investors: a live floor, intelligence with visible reasoning, policy decisions citing real Acts, jurisdiction switching on stage. Technical architects will probe exactly the conditions below. Recommendations (no architecture changes): seed bet-heavy bursts before demos (a lifecycle-only burst shows GGR 0 on a fresh casino); demo the ZA↔BW switch live; show a projection rebuild reconstructing the twin — it is the platform's most persuasive artifact.

## 12. Conditions of approval

**CRITICAL (before any production tenant):**
- **C1** Tenant-scoped RLS on `casino_event_log` + projection tables (casino claims in JWT; Realtime inherits).
- **C2** Gateway derives profile, casino scope, and jurisdiction from the **verified** JWT / casino registry — never from query parameters.
- **C3** Widen SB-PLR identity to ≥64 bits (32-bit space collides at ~77k players/casino); execute as the flagged breaking identity migration while data is synthetic.

**HIGH:**
- **H1** Retire or convert out-of-flow producers (`api-ingest`, `simulate_live_feed`, demo-sync fns) into Event Platform producers.
- **H2** Fold the parallel risk calculators (`safeplay-ai-risk-engine`, `bri-risk-score`, `wellbeing-risk-calculator`) into Domain Intelligence stages, or formally scope those products outside the certified platform.
- **H3** Ingestion idempotency keys + optimistic concurrency (version column) on projection upserts.
- **H4** Event-log partitioning + retention/archive strategy; a persistent twin/read-cache tier for high-QPS consumers.
- **H5** Platform observability: projection-lag, ingest-failure and rebuild alarms; runbooks.

**MEDIUM:** M1 DB-backed versioned policy store · M2 rebuild ordering tiebreaker `(occurred_at, event_id)` · M3 event upcaster registry · M4 intervention views present recorded facts only · M5 server-side producer scheduling (stop per-tab bursts) · M6 extract envelope/table-name shared kernel to break the eventPlatform⇄projectionPlatform module cycle · M7 integration/E2E + load-test harness.

**LOW:** L1 wire the twin's `stale` state · L2 correct `events_per_min` labeling · L3 drop dead legacy tables after soak.

## 13. Final scorecard

| Category | Score | | Category | Score |
|---|---|---|---|---|
| Enterprise Architecture | **8** | | Security | **4** |
| Software Architecture | **8** | | Performance | **5** |
| Domain Architecture | **7** | | Scalability | **5** |
| Event Architecture | **8** | | Maintainability | **8** |
| Projection Architecture | **7** | | Regulator Readiness | **7** |
| Digital Twin | **7** | | Operator Readiness | **8** |
| Domain Intelligence | **8** | | AI Readiness | **7** |
| Policy Platform | **7** | | Cloud Architecture | **5** |
| Consumer Platform | **6** | | Operational Readiness | **5** |
| Demonstration Readiness | **9** | | **Overall Enterprise Readiness** | **7** |

## 14. Certification

**APPROVED WITH CONDITIONS.** The layered enterprise architecture is real, measured, and test-enforced — not aspirational documentation: one flow, one runtime model, one intelligence layer, one decision layer, one gateway, 115 passing tests, live-proven replay. The conditions are hardening work (isolation, verified identity, throughput, growth), not redesign; nothing found requires re-architecture. The board specifically cautions that the security scores reflect **production** criteria — the demo posture is appropriate for a demo. Phase 4 – Enterprise Production Readiness should be sequenced C1→C3 first, then H1–H5.
