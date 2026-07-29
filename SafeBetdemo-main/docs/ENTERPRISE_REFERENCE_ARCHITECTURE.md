# SafeBet IQ — Enterprise Reference Architecture

**Version 1.0** · 2026-07-13 · Status: AUTHORITATIVE TECHNICAL BLUEPRINT
Certified by the Independent Enterprise Certification Board (`docs/ENTERPRISE_READINESS_DOSSIER.md`, overall 8.7/10, production-ready).

This document describes the architecture **as implemented and certified** — not an ideal. It is the permanent reference for engineering, casino operators, regulators, investors, technical due diligence, AWS architects, and new developers. It is governed by, and consistent with, the SafeBet IQ Enterprise Constitution and the ADR register. No code was changed in producing it.

Convention: **[Implemented]** = certified in Version 1.0; **[Phase 5]** = approved future work; **[Out-of-flow]** = product surface outside the certified enterprise flow.

---

## 1. Executive Overview

**Purpose.** SafeBet IQ is the Enterprise Casino Intelligence Platform for African gaming: one continuous, event-sourced platform that gives casino operators live operational intelligence, gives players measurable wellbeing protection, and gives regulators verifiable evidence — across multiple operators, jurisdictions, and regulators, from configuration rather than code.

**Mission.** Route every casino fact through ONE enterprise event flow, exactly once, so it is validated once, analysed once, decided upon once, and presented truthfully to every audience.

**Business objectives.** Responsible-gambling protection with audit-grade evidence; real-time operational intelligence for operators; regulator-ready compliance across African jurisdictions; multi-operator/multi-jurisdiction scale from configuration; long-term maintainability under one architecture.

**Platform vision.** A single flow — Event → Projection → Digital Twin → Domain Intelligence → Policy → Consumer — scaling from one demo floor to a continent of operators without re-architecture.

**Architectural philosophy.** Events are the truth; everything else is a disposable, rebuildable view. Capabilities are stages in one flow, never independent modules. A capability may only validate, enrich, analyse, decide, project, or present — nothing else. Boundaries are proven by tests, import direction, and live verification, not by assertion.

**Guiding principles (summary; full set §19).** One flow · one runtime reality · intelligence enriches · policy decides · consumers present · production-hardened · policy as data · security by design · evidence integrity · no breaking change without an ADR.

---

## 2. Enterprise Architecture

```
Casino Event
  ↓  Identity Resolution        lib/playerIdentity (service)
  ↓  Identity Policy            lib/playerIdentity/policy
  ↓  Identity Provider          lib/playerIdentity/providers (sha256-v2, 96-bit)
  ↓  ENTERPRISE EVENT PLATFORM        lib/eventPlatform        → casino_event_log (append-only, partitioned)
  ↓  ENTERPRISE PROJECTION PLATFORM   lib/projectionPlatform   → projection_* (read models) + 7 views
  ↓  ENTERPRISE CASINO DIGITAL TWIN   lib/digitalTwin          → one live runtime object graph / casino
  ↓  ENTERPRISE DOMAIN INTELLIGENCE   lib/domainIntelligence   → enriches the SAME twin objects
  ↓  ENTERPRISE POLICY & RULES        lib/policyPlatform       → PolicyDecisions (from the policy store)
  ↓  ENTERPRISE CONSUMER PLATFORM     lib/consumerPlatform     → versioned presentation contracts
  ↓  Consumers: casino dashboards · regulator · executive · compliance · mobile · REST · future GraphQL
Cross-cutting: lib/security (verified principals) · lib/observability (telemetry) · lib/operations (modes/monitoring/scheduling)
```

**Why the order matters.** Each stage depends only on the invariants the previous stage guarantees: identity must be resolved before an event is immutable (so history is anonymised and stable); events must be persisted before they are projected (so runtime state is rebuildable); projections must exist before the twin (so runtime is disposable); the twin must exist before intelligence (so analysis enriches ONE model); intelligence must precede policy (so decisions read facts they never recompute); policy must precede consumers (so presentation never re-decides). The event enters once, never forks, never restarts, never bypasses a layer.

---

## 3. Platform Responsibilities

### Identity Resolution / Policy / Provider — `lib/playerIdentity` [Implemented]
- **Purpose:** resolve a casino's player reference to the ONE anonymous SafeBet Player ID (`SB-PLR-…`).
- **Inputs:** casino id + raw player reference. **Outputs:** deterministic 96-bit SB-PLR id. **Interfaces:** `getIdentityService().resolveIdentity()`. **Dependencies:** `safebet_identity_map`, `resolve_player_identity` RPC.
- **Owns:** the SB-PLR namespace, the derivation algorithm (only the provider knows it), identity-policy decisions (permit/provider/federation). **Never owns:** events, sessions, player attributes, PII.

### Enterprise Event Platform — `lib/eventPlatform` [Implemented]
- **Purpose:** the single entry point; turns a validated draft into an immutable, persisted, distributed fact.
- **Lifecycle:** receive → validate (reject, never repair) → enrich (identity once, correlation, trace, tenant, jurisdiction, idempotency key) → version → persist (append-only, idempotent) → distribute (persisting IS publishing).
- **Interfaces:** `getEventPlatform().ingest/ingestBatch`. **Inputs:** `CasinoEventDraft`. **Outputs:** frozen `CasinoEventEnvelope` (18 fields); rows into `casino_event_log`.
- **Owns:** immutable events, the envelope, validation, enrichment, persistence, distribution. **Never owns:** business logic, risk, projections, runtime state, presentation.

### Enterprise Projection Platform — `lib/projectionPlatform` [Implemented]
- **Purpose:** the ONLY producer of persisted runtime state; pure reducers materialise event facts.
- **Interfaces:** `applyEnvelopes` (in-flow), `rebuild` (replay). **Outputs:** `projection_player_state`, `projection_session_state`, `projection_machine_state` + 7 catalogue views.
- **Owns:** persisted read models, rebuild/replay, optimistic-concurrency writes. **Never owns:** events (reads only), business thresholds beyond published view bands, live object graphs, presentation.

### Enterprise Casino Digital Twin — `lib/digitalTwin` [Implemented]
- **Purpose:** the ONLY live runtime model — one object graph per casino, assembled from projections.
- **Interfaces:** `getDigitalTwin(casinoId)`, `snapshot()`, `registerEngine()`. **Inputs:** read-model catalogue. **Outputs:** runtime objects (Player/Session/Machine/GamingFloor/Intervention + aggregates).
- **Owns:** the live object graph, its lifecycle/memory, extension points. **Never owns:** history, persistence, projections, business calculations, decisions.

### Enterprise Domain Intelligence Platform — `lib/domainIntelligence` [Implemented]
- **Purpose:** the ONLY analysis layer; one engine (`domain-intelligence`), seven ordered pipelines enriching the SAME twin instances.
- **Interfaces:** `getIntelligencePlatform().attach(twin)`, `intelligenceOf(object)`. **Outputs:** `enrichments['domain-intelligence']` on each object.
- **Owns:** analysis, inference, classification, scoring, recommendations. **Never owns:** runtime state, persistence, events, decisions, execution, presentation.

### Enterprise Policy & Rules Platform — `lib/policyPlatform` [Implemented]
- **Purpose:** the ONLY decision layer; evaluates configurable declarative rules over the enriched twin.
- **Interfaces:** `getPolicyPlatform().evaluate(twin, {jurisdiction})`, `configure(rules)`; store loader `loadActivePolicyRules`. **Outputs:** `PolicyDecision`s (provenance + confidence read from intelligence).
- **Owns:** policy configuration + evaluation + decisions. **Never owns:** calculations, enrichment, runtime state, execution, storage of decisions.

### Enterprise Consumer Platform — `lib/consumerPlatform` [Implemented]
- **Purpose:** the ONLY presentation gateway; versioned contracts, profiles, authorization, routing, shaping.
- **Interfaces:** `getConsumerGateway().serve(request, sources)` (hosted by `consumer-gateway`). **Outputs:** `ConsumerResponse` envelopes (v1 view models).
- **Owns:** presentation contracts, shaping, authorization grants, routing, versioning. **Never owns:** business logic, runtime state, intelligence, policy evaluation, any write path.

### Cross-cutting [Implemented]
`lib/security` (verified principals, tenant predicate) · `lib/observability` (structured PII-free telemetry) · `lib/operations` (modes, monitoring, scheduled ops). Infrastructure, not enterprise platforms; they strengthen the flow without owning business reality.

---

## 4. Enterprise Event Flow (lifecycle of one casino event)

1. **Identity** — a raw casino reference is resolved to the anonymous SB-PLR id exactly once, during enrichment, through Service → Policy → Provider.
2. **Validation** — the draft is validated against the frozen event vocabulary; invalid drafts are rejected, never repaired.
3. **Enrichment** — identity, correlation (session journey), trace (batch), tenant, jurisdiction, timestamps, `idempotencyKey` are stamped; the envelope is frozen (18 immutable fields).
4. **Persistence** — appended to `casino_event_log` via idempotent upsert (`UNIQUE(casino_id, dedupe_key, occurred_at)`); duplicates (retries) are dropped. The append-only trigger forbids UPDATE/DELETE.
5. **Distribution** — persisting IS publishing: Supabase Realtime on the event log (publish-via-partition-root).
6. **Projection** — only newly-inserted envelopes are reduced (pure functions) and written under optimistic concurrency (`row_version`, per-casino advisory lock) into the read models.
7. **Twin** — the Digital Twin assembles the read models into the one runtime object graph.
8. **Intelligence** — the seven pipelines enrich the SAME objects in order (session→…→compliance).
9. **Policy** — the active policy set (from the store) is evaluated over the enriched twin → decisions.
10. **Consumer shaping** — the gateway authorises the caller, selects a view, and shapes twin + intelligence + decisions + the event feed into a versioned contract.
11. **Presentation** — consumers render the contract; live updates arrive on the published Realtime channels.
12. **Replay** — at any time, `rebuild` disposes and replays the immutable log through the SAME reducers, deterministically reconstructing projections (and thus the twin and everything downstream).

---

## 5. Runtime Architecture

**Digital Twin.** One `CasinoDigitalTwin` per casino per process (`getDigitalTwin`). It holds a registry (identity map) with exactly one instance of each Player, Session, Machine, Gaming Floor, and Intervention, plus casino aggregates.

**Lifecycle:** `created → assembling → live → disposed`. `start()` assembles from projections and (in long-lived hosts) observes projection Realtime; `refresh()` re-assembles; `dispose()` releases everything.

**Reference model.** Updates MUTATE the single instance in place, so references held by intelligence engines, dashboards, and Realtime stay valid and enrichments survive. Gaming floors group the SAME machine instances (references, not copies).

**Object lifecycle.** Ended sessions leave the runtime model (history stays in events); entities the projections no longer contain are reconciled away on refresh; floors with no machines are dropped.

**Memory model.** The twin owns only live state; it is disposable and fully rebuildable from projections. Edge hosts re-assemble per request; long-lived hosts hold one live twin with Realtime observation.

**Update flow:** projection change → registry upsert (same instance) → extension host runs the intelligence engine → enrichment attached. **Replay flow:** rebuild projections from the log → next assemble reflects them — replay-safety is inherited, not reimplemented.

---

## 6. Identity Architecture

- **Resolution** (`IdentityResolutionService`) is the single entry point; **Policy** decides permit/provider/cross-casino/federation (federation denied by default); **Provider** (`SHA256IdentityProvider`) is the only code that knows the algorithm.
- **96-bit deterministic identity [Implemented, ADR-001]:** `SB-PLR-` + first 24 hex of `SHA-256('sbiq-v1:<casino>:<ref>')`, uppercased. Per-casino, anonymous (no PII), deterministic, refresh-stable.
- **Evolution:** `sha256-v1` (32-bit) remains registered for backward-compatible replay; a v1 id is the exact PREFIX of its v2 id (same hash, wider slice). The active provider is configuration-selected.
- **Collision analysis (summary):** at 1 billion identities, collision probability fell from ~2.7×10⁻² (32-bit) to ~6.3×10⁻¹² (96-bit) — practically eliminated across the 20-year target.
- **Future extensibility:** a 128-bit or federated provider is an additive provider under a new ADR — no data migration of v2 ids, no architectural change. There will never be another identity redesign.

---

## 7. Security Architecture

- **Authentication [Implemented, ADR-002]:** every request is cryptographically verified — `verifyPrincipal` (`lib/security/principal.ts`) validates the Supabase JWT and resolves the principal from the `users` registry keyed by the verified subject. Anon keys, tampered tokens, and inactive/unknown users are refused.
- **Authorization:** derived exclusively from verified material — consumer profile from the registry role, casino scope from the principal, jurisdiction from the `casinos` registry. Request parameters select a view/casino within entitlement; they never assert identity.
- **Tenant / casino / jurisdiction isolation:** enforced twice by ONE matrix — at the database via RLS (`app_visible_casinos()`, SECURITY DEFINER, keyed on `auth.uid()`) on the event log + projection tables (catalogue views run `security_invoker`); and at every edge surface via the mirrored `principalMayAccessCasino()`. Realtime inherits the same RLS.
- **RLS matrix:** super_admin → all; casino_admin/compliance_officer → own casino; regulator/national_regulator → jurisdiction; provincial_regulator → jurisdiction + province; else/anon → nothing.
- **Least privilege:** ops surfaces (`platform-ops`, `projection-platform` rebuild, `digital-twin`) are admin/service-role only; producers must be verified principals scoped to the casino; writes are service-role only; the event store is append-only at the database.
- **Secrets / operational security:** service-role key server-side only; anonymous SB-PLR ids keep PII out of events/projections/views/telemetry (telemetry has an additional PII-redaction guard).

---

## 8. Event Store Architecture

- **Append-only model [Implemented]:** `casino_event_log`, one row per immutable envelope; a BEFORE UPDATE/DELETE trigger forbids mutation (verified on partitions). Corrections are new events.
- **Partitioning [Implemented, ADR-003]:** native `RANGE (occurred_at)` monthly partitions; PK `(event_id, occurred_at)`; `sbiq_ensure_event_partition(ts)` creates months idempotently.
- **Replay:** deterministic rebuild through the same reducers as the live path (live-verified: identical rebuild twice on the partitioned store).
- **Retention / archiving:** `sbiq_archive_event_partitions_before(cutoff)` DETACHes cold months to `archive_*` tables — never DELETE, so immutability/audit hold and detached data stays queryable and re-ATTACHable.
- **Idempotency / exactly-once:** `UNIQUE(casino_id, dedupe_key, occurred_at)` + upsert-ignore returns only newly-inserted rows; only those are projected → at-least-once delivery becomes exactly-once processing.
- **Observability:** structured PII-free telemetry on ingest/apply; `sbiq_platform_health(casino)` reports events, distinct players, projections, lag, max row_version.

---

## 9. Enterprise Intelligence

ONE platform, seven pipelines in a fixed, construction-validated dependency chain; each stage may read every earlier stage's output for the same object in the same pass:

```
session → machine → behaviour → risk → ai → intervention → compliance
```

- **Session:** lifecycle, duration, concurrency, player movement. **Machine:** occupancy, idle, hot/warm/cold, floor utilisation. **Behaviour:** velocity, frequency, loss-chasing indicators, play style — indicators only. **Risk:** GRPI, dynamic score, escalation, trend, confidence — consumes behaviour, triggers nothing. **AI:** predictions, recommendations, operational insights — consumes session/machine/behaviour/risk, performs nothing. **Intervention:** recommended/active/pending, effectiveness — consumes risk/ai. **Compliance:** readiness, obligations, outstanding actions, RG evidence — consumes the fully enriched player.

**Why this ordering.** Later stages consume earlier ones: risk needs behaviour indicators; ai needs risk; intervention needs ai+risk; compliance needs the full picture. The chain is validated at construction — a stage cannot consume a stage that runs after it. Each stage enriches the SAME instance; no stage clones, replaces, or persists.

---

## 10. Policy Architecture

- **Policy Store [Implemented, ADR-004]:** versioned, audited repository — `policy_sets` (one active, effective-dated), `policy_rules` (full `PolicyRule` as JSONB + indexed columns), `policy_change_log` (immutable audit).
- **Versioning / lifecycle:** `sbiq_activate_policy_set(version, actor, reason)` promotes or rolls back; exactly one active version (partial-unique enforced); every change is audited (actor/action/from/to/reason).
- **Evaluation:** the platform loads the active set via `loadActivePolicyRules` through its existing `configure()` seam and evaluates it with the UNCHANGED `evaluation.ts` — comparisons only, over the enriched twin, per subject (player/session/machine/floor/casino). Policy LOGIC never moved.
- **Decisions:** `PolicyDecision` with action (7 types), priority, reason, `policyReference`, confidence (read from intelligence), `executionRequired`. Execution always happens outside the platform.
- **Governance:** managed via `platform-ops` (admin/service-role only); a policy change is a data operation with zero deploy; rollback is minutes.

---

## 11. Consumer Architecture

- **Consumer Platform:** ONE gateway (`consumer-gateway`) serving every consumer; no per-consumer APIs.
- **Presentation contracts (v1):** `LiveEventView · LiveKpiView · MachineStatusView · PlayerView · InterventionView · DecisionView` composed into `OperatorLiveFloorView`, `ActivityFeedView`, `RegulatorComplianceView`, `ExecutiveSummaryView`, `ComplianceActionsView`.
- **Authorization:** profile → granted views (`VIEW_GRANTS`); casino/jurisdiction from verified context; field-level filtering is a property of the contracts.
- **Versioning:** explicit `version` parameter; `v1` is current; unknown versions rejected; breaking changes mint a new version while old ones keep serving. Contracts are the future GraphQL type source.
- **Operator views:** live floor (80-position grid, occupancy, hot/cold), players, interventions, KPIs. **Regulator views:** risk tiers, monitoring cohort, regulatory decisions (verbatim), audit evidence. **Executive views:** KPIs, floor utilisation, headline decisions, operational health. **Compliance views:** outstanding actions, alerts, execution-required decisions.
- **API strategy:** REST today via the gateway; the same contracts map 1:1 to a future GraphQL layer resolving through the same `serve()` **[Phase 5]**.
- **Evidence integrity:** presented values are classified — Recorded Fact / Derived Intelligence / Policy Decision / Demonstration Data; no fabricated operational facts (`InterventionView` reports delivery as `unrecorded`/`recorded`, never fabricated).

---

## 12. Operations Architecture

- **Operational modes [Implemented]:** `development | demonstration | staging | production` (env `SAFEBET_OPERATING_MODE`) tune simulator, logging, alert thresholds, retention, demo data — never business rules.
- **Monitoring / alerting:** `platform-ops?action=monitor` evaluates health against mode thresholds → `PROJECTION_LAG_WARNING/CRITICAL`, `PROJECTION_DRIFT`, `INGESTION_STALL`, plus platform severity.
- **Health:** `sbiq_platform_health(casino)` (freshness, lag, projection counts, max row_version).
- **Scheduling:** `ensure-partitions`, `validate-projections` orchestrate existing platform functions (idempotent); managed-cron wiring is **[Phase 5]**.
- **Runbooks / DR / governance:** `docs/OPERATIONS_MANUAL.md` — recovery via deterministic rebuild; retention via DETACH; least-privilege ops (admin/service-role); audited policy governance; daily/weekly/monthly/incident/escalation checklists.

---

## 13. AWS Reference Architecture

Reviewed from repository artifacts; production infrastructure is owner-managed and out of this document's authority (no speculation beyond documented plans).

- **Application tier:** the Next.js app is packaged for **Elastic Beanstalk** (Procfile, RC1 security headers, release scripts). The browser app is a Consumer Platform client only.
- **Data / platform tier:** **Supabase-managed PostgreSQL** hosts the event store, projections, identity map, and policy store; **Supabase Edge Functions** (Deno) host the enterprise operational surfaces: `identity-resolution`, `casino-simulator` (producer), `projection-platform` (ops), `digital-twin` (ops), `consumer-gateway` (presentation), `platform-ops` (operations). **Supabase Realtime** is the distribution channel (publish-via-partition-root).
- **Secrets:** service-role key held server-side in the edge/app environment; anon/publishable key for clients.
- **IAM / networking / logging / monitoring:** managed by Supabase for the data tier; application-tier IAM, VPC, and log shipping are owner-operated. Structured platform telemetry + `sbiq_platform_health` provide application observability.
- **Scaling approach:** stateless edge functions scale horizontally; PostgreSQL scales via managed resources; the event store partitions by time (no per-casino hotspot); casinos are isolated by per-casino locking.
- **Future HA / DR considerations [Phase 5]:** application-tier HA/DR targets (RTO/RPO) against the managed-backup SLA; managed backup restore drills; multi-AZ posture — to be formalised at production onboarding. Recovery of platform state is always by rebuild from the immutable log.

---

## 14. Database Reference Architecture

- **Event store:** `casino_event_log` — append-only, `RANGE(occurred_at)` monthly partitions, PK `(event_id, occurred_at)`, `UNIQUE(casino_id, dedupe_key, occurred_at)`, indexes on (casino,time), (player,time), correlation, trace, type; tenant RLS; immutability trigger; archive_* detached partitions.
- **Projection tables:** `projection_player_state`, `projection_session_state`, `projection_machine_state` — keyed by casino+entity, `row_version` (optimistic concurrency), `projection_version`, tenant RLS.
- **Projection views (7):** casino, risk, behaviour, intervention, compliance, executive, regulator — `security_invoker`, defined over the three tables (no duplicate state).
- **Identity tables:** `safebet_identity_map` — `(casino_id, casino_ref_hash) → safebet_player_id` (unique), SB-PLR format constraint (v1/v2 widths), service-role only, `resolve_player_identity` RPC.
- **Policy tables:** `policy_sets`, `policy_rules`, `policy_change_log` — versioned, one-active, audited; `sbiq_active_policy_rules()`, `sbiq_activate_policy_set()`.
- **Relationships:** projections and the event log reference `casinos(id)`; nothing references the event log (it is the source of record). **Indexes/partitioning/replay/archive:** §8. **Registry:** `casinos.jurisdiction` (policy selector) and `users.{role,casino_id,jurisdiction,province}` drive the authorization matrix.
- **Operational functions:** `sbiq_write_projection_states` (OCC write), `sbiq_platform_health`, `sbiq_ensure_event_partition`, `sbiq_archive_event_partitions_before`.

---

## 15. Governance

- **The Six Constitutions:** (1) One Enterprise Flow, (2) One Runtime Reality, (3) Enterprise Intelligence (enrich only), (4) Enterprise Policy (decide only), (5) Enterprise Consumers (present only), (6) Production Hardening (isolation, verified identity, idempotency, bounded growth, observability, evidence integrity, certification). Full text: `docs/SAFEBET_ENTERPRISE_CONSTITUTION.md`.
- **ADR process:** every breaking architectural change requires an accepted ADR with alternatives, rationale, consequences, and a migration strategy. Register: `docs/ARCHITECTURE_DECISION_RECORD.md` (ADR-001 identity 96-bit; ADR-002 verified authorization; ADR-003 idempotency/concurrency/partitioning; ADR-004 policy store + modes).
- **Evidence Integrity Principle:** every operator/regulator-facing value is classifiable as Recorded Fact, Derived Intelligence, Policy Decision, or Demonstration Data; demonstration data is always identifiable; no component presents simulated/inferred data as operational fact.
- **Architecture Versioning Principle:** backward compatibility preserved unless an ADR approves a breaking change with a migration.
- **Definition of Done:** constitutional compliance, boundary evidence, tests + typecheck + build, live verification, replay safety, versioning, evidence integrity, documentation, demo-only deployment discipline.

---

## 16. Enterprise Operational Lifecycle

- **Development** (`development` mode): full simulator, debug logging, loosest thresholds.
- **Testing:** `node --test tests/*.test.mjs` (152 tests), `tsc --noEmit`, `next build`, in-process benchmark — the regression floor for every change.
- **Demonstration** (`demonstration` mode): live simulator, seeded scenarios; the certified demo environment.
- **Staging** (`staging` mode): production-like thresholds, simulator on for rehearsal.
- **Production** (`production` mode): simulator off, strict alert thresholds, no demo data, tenant-scoped.
- **Maintenance:** scheduled partition maintenance, projection-integrity validation, archive preparation, policy refresh (all idempotent, all via `platform-ops`).
- **Certification:** the Independent Certification Board dossier is re-run before major production changes.
- **Evolution:** additive change is the default; breaking changes go through an ADR; new capability must fit the existing flow or be refactored.

---

## 17. Version History

- **Architecture Programme (Phase 3 — Enterprise Refactor):** 3.1 Identity Resolution → 3.1A abstraction → 3.1B policy → 3.2 Event Platform → 3.3 Projection Platform → 3.4 Digital Twin → 3.5 Domain Intelligence → 3.6 Policy & Rules → 3.7 Consumer Platform. Result: one continuous flow, legacy adapters and browser simulation deleted.
- **Independent Architecture Review:** APPROVED WITH CONDITIONS (7/10); three Critical, five High findings.
- **Phase 4 — Production Readiness:** 4.1 Security & Multi-Tenant Isolation (C1/C2) → 4.2 Identity Integrity 96-bit (C3) → 4.3 Performance, Scalability & Resilience (H3/H4) → 4.4 Operations, Governance & Policy Management (M1/H5) → 4.5 Certification (M4 fixed).
- **Enterprise Certification:** CERTIFIED PRODUCTION-READY, overall 8.7/10 (`docs/ENTERPRISE_READINESS_DOSSIER.md`).
- **This document:** Enterprise Reference Architecture **Version 1.0**.

---

## 18. Future Evolution (approved Phase 5 roadmap)

**Certified implementation (Version 1.0):** the enterprise event flow — Event → Projection → Twin → Intelligence → Policy → Consumer — with security, identity, resilience, operations, governance, and evidence integrity, all live-verified.

**Future enhancements [Phase 5]:** GraphQL layer over the existing contracts; regulator replay/evidence-reconstruction UI; managed cron for maintenance + push/paging alert delivery; controlled 1,000 ev/s end-to-end load test; extend explicit `evidenceClass` labels across all consumer views; narrow edge service-role usage.

**Deferred work:** drop the dead legacy tables (`live_events`, `machine_activity`, `live_kpi_snapshots`) after soak; formalise production HA/DR targets.

**Outside the certified enterprise flow [Out-of-flow]:** the `safeplay-connect` (API onboarding via `api-ingest`) and `wellbeing-games` product surfaces, and the standalone risk functions (`safeplay-ai-risk-engine`, `bri-risk-score`, `wellbeing-risk-calculator`), are NOT part of the certified flow and the flow does not depend on them. Phase 5 must convert `api-ingest` into an Event Platform producer and fold those risk functions into Domain Intelligence stages — or formally retire them — before those surfaces are represented as part of the certified platform.

---

## 19. Architecture Principles (permanent)

1. **One flow** — every capability is a stage inside the single enterprise event flow; nothing forks or bypasses.
2. **Events are truth** — all other state is a disposable, rebuildable view.
3. **One runtime reality** — the Digital Twin is the only runtime model; one instance per entity, mutated in place.
4. **Enrich, decide, present — never blur** — intelligence enriches, policy decides, consumers present; no layer does another's job.
5. **Policy as data** — jurisdiction/operator/tenant behaviour changes by configuration, never code.
6. **Deterministic identity** — anonymous, per-casino, 96-bit, config-evolvable; never redesigned.
7. **Security by design** — verified principals only; tenant isolation enforced at DB and edge; least privilege.
8. **Idempotent + concurrency-safe + replayable** — retries never corrupt; concurrent writes never lose updates; replay is deterministic.
9. **Evidence integrity** — every presented value is classifiable; nothing simulated is shown as fact.
10. **No breaking change without an ADR** — additive by default; backward compatibility preserved.
11. **Prove it, don't assert it** — tests, import direction, grep-verifiable absence, live verification, and certification.

---

## 20. Conclusion

SafeBet IQ Version 1.0 is ONE enterprise, event-sourced casino-intelligence platform: a single continuous flow in which every casino fact enters once, is anonymised and made immutable, projected into disposable runtime state, assembled into one live Digital Twin, enriched once by seven ordered intelligence pipelines, decided upon by a versioned policy layer, and presented truthfully to operators, regulators, executives, and compliance teams through one authorised, versioned gateway. It is tenant-isolated, identity-safe at enterprise scale, idempotent, concurrency-safe, deterministically replayable, operable, governed, and evidence-truthful — certified production-ready at 8.7/10 with the enterprise architecture unchanged since Phase 3 and all six constitutions intact. This document is the authoritative technical blueprint for SafeBet IQ going forward; every future change is measured against it and the governing documents it summarises.

---

## Demonstration Environment

SafeBet IQ ships with a **National Demonstration Dataset** (see `docs/NATIONAL_DEMONSTRATION_DATASET.md`) that presents the six existing ZA casino tenants as a believable national, multi-tenant deployment for regulator, executive and pilot demonstrations.

**Architectural guarantee.** The demonstration dataset injects **fictional seed data exclusively through the certified Event Platform** — via the `casino-simulator` producer (`?action=burst`) and the `workflow` case endpoint. It therefore travels the *same* certified runtime flow as any real casino fact:

```
casino-simulator (producer)
  → Identity Resolution (anonymous SB-PLR, per-casino)
  → Event Platform (validate → enrich → persist append-only → distribute)
  → Projection Platform → Digital Twin → Domain Intelligence → Policy Platform
  → Consumer Platform / Regulator Portal → UI
```

The dataset **preserves the certified enterprise architecture and runtime flow unchanged**: it writes no projection/presentation table directly, creates no casino, alters no ID/relationship/foreign key, and modifies no Consumer Platform contract, Edge Function, schema, or business logic. Tenant isolation holds (per-casino data; the Regulator Portal aggregates by verified jurisdiction). Per-**individual** cross-operator identity correlation remains **denied by default** (ADR-001) — the demonstration exercises only anonymous **aggregate/cohort** cross-operator intelligence. All demonstration records are producer-generated/simulated (demo patron namespace, `is_simulated`) and exist only in the demo project; they must never be promoted to production.

---

## National Identity Federation (v2.0 — PROPOSED, ADR-006 pending)

Version 2.0 proposes an **additive** regulator-plane capability — the **National Identity Federation Service (NIFS)** and the anonymous national identity `SB-NAT` — that lets *authorised regulators only* recognise the same anonymous individual across licensed operators, with **no PII** and **no change** to the certified operator flow. Full design: `docs/NATIONAL_IDENTITY_FEDERATION_DESIGN.md`; decision: ADR-006.

**Extended flow (operator plane unchanged; a regulator plane is added):**
```
                       ┌──────────────── OPERATOR PLANE (unchanged) ────────────────┐
Casino event → Identity Resolution (SB-PLR) → Event Platform → Projection → Digital
   Twin → Domain Intelligence → Policy → Consumer Platform → operator UI
                       └────────────────────────────────────────────────────────────┘
Operator also submits (write-only, own tenant): salted-hashed matching attributes
   → Event Platform (new event IDENTITY_FEDERATION_ATTRIBUTE, hashes only, per-tenant RLS)
        │
        ▼            ┌──────────────── REGULATOR PLANE (new, regulator-only) ─────────┐
   National Identity Federation Service  → national_identity_map (SB-PLR↔SB-NAT,
      confidence, evidence, audit)  → National Player Twin (by reference)
      → national Policy scope (NAT-*)  → Consumer/Regulator Portal national views
      → Regulator UI
                       └────────────────────────────────────────────────────────────┘
```
The regulator plane is formalised (Phase 2.1, **frozen**) as the **Enterprise Correlation Layer** — a regulator-only, **read-only** enterprise layer containing National Identity Federation, the National Player Twin, Cross-Operator Intelligence, National Behaviour Analytics, the National Self-Exclusion Registry and National Investigation Services. National Identity Federation itself separates matching from decision: an **Identity Matching Engine** (deterministic candidate matches only) feeds a **Federation Decision Engine** (governed, versioned, audited acceptance) which writes the **SB-NAT Registry**. The layer consumes the operator plane (hashed-attribute events + reads projections by reference) and **never modifies operational systems**. `SB-NAT` is an **Enterprise Correlation Identity** (not customer/operator/casino/system-of-record/runtime), namespaced per sovereign jurisdiction (`SB-NAT-ZA/NA/BW/KE`), each isolated (own pepper, mapping, jurisdiction profile, policy pack) — sovereign deployments need no redesign. Every `SB-NAT` and decision carries an immutable version stamp (Federation Algorithm / Matching Policy / Jurisdiction / Decision Engine / Rule Set).

**Guarantees:** `SB-PLR` remains the **system of record** for all operational identity; `SB-NAT` is correlation-only and never replaces it. The Event Platform, Projection Platform, Digital Twin, Domain Intelligence, Policy Platform, Consumer Platform and operator UI are unchanged; operators never see another tenant or any `SB-NAT` (write-only contributors; 403 on federation reads); no plaintext PII ever enters the platform (salted-HMAC hashes only, national pepper in HSM/Secrets Manager); every identity link is explainable Derived Intelligence with confidence + evidence + appeal (§8); federation is off by default and enabled per jurisdiction under regulator authority. This section is **proposed** and becomes effective on ADR-006 acceptance.
