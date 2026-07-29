# SafeBet IQ Enterprise Constitution

**Status: GOVERNING STANDARD — permanent architectural law**
**Version 1.0 · Ratified 2026-07-12 · Amendable only by Architecture Decision Record (see §10)**

Every implementation, feature, fix, integration, and phase — beginning with Phase 4 — must comply with this document. If a requested change conflicts with it: **stop, state the conflict, and propose a compliant alternative before writing code.**

---

## 1. Purpose

### Mission
SafeBet IQ is the Enterprise Casino Intelligence Platform for African gaming: one continuous, event-sourced platform that gives casino operators live operational intelligence, gives players measurable wellbeing protection, and gives regulators verifiable evidence — across multiple operators, jurisdictions, and regulators, from configuration rather than code.

### Vision
A single enterprise event flow through which every casino fact travels exactly once, is analysed exactly once, is decided upon exactly once, and is presented to every audience — operator, executive, compliance officer, regulator, API, mobile — through one governed gateway, at any scale from one demo floor to a continent of operators.

### Enterprise Architecture Principles (summary)
One flow. One runtime reality. Intelligence enriches. Policy decides. Consumers present. Everything else is forbidden.

### Design Philosophy
- **Events are the truth; everything else is a disposable view.** Any state that cannot be rebuilt from the immutable event log is architectural debt.
- **Capabilities are stages, not modules.** Every capability answers ONE question before it exists: *"Where does this fit inside the existing enterprise event flow?"* If it needs its own workflow, state, calculations, events, or pipeline — the design is wrong; refactor it.
- **A capability may ONLY: validate an event · enrich an event · analyse an event · decide · project an event · present information.** Nothing else.
- **Prove it, don't assert it.** Boundaries are enforced by tests, import direction, grep-verifiable absence of forbidden references, and live replay — not by documentation alone.

### Long-term Architectural Goals
Multiple jurisdictions and regulators from policy configuration; thousands of machines and millions of events per casino; identity integrity at tens of millions of players; hard tenant isolation; regulator-grade replay and evidence; mobile/REST/GraphQL/external integrations added as consumers, never as new pipelines.

---

## 2. The Enterprise Architecture

```
Casino Event
  ↓ Identity Resolution        (lib/playerIdentity — service)
  ↓ Identity Policy            (lib/playerIdentity/policy — decision point)
  ↓ Identity Provider          (lib/playerIdentity/providers — algorithm)
  ↓ ENTERPRISE EVENT PLATFORM        lib/eventPlatform
  ↓ ENTERPRISE PROJECTION PLATFORM   lib/projectionPlatform
  ↓ ENTERPRISE CASINO DIGITAL TWIN   lib/digitalTwin
  ↓ ENTERPRISE DOMAIN INTELLIGENCE   lib/domainIntelligence
  ↓ ENTERPRISE POLICY & RULES        lib/policyPlatform
  ↓ ENTERPRISE CONSUMER PLATFORM     lib/consumerPlatform (+ consumer-gateway)
  ↓ Consumers: casino dashboards · regulator views · executive summaries ·
               compliance workspaces · mobile · REST · future GraphQL · integrations
```

The event enters once. It never forks, never restarts, never bypasses a layer. Realtime owns distribution only (publication of the event log and read models). Dashboards and reports own presentation only.

### Layer responsibilities

| Layer | Responsibility (ONLY this) |
|---|---|
| **Identity Resolution / Policy / Provider** | Resolve a casino's player reference to the ONE anonymous SafeBet player id (`SB-PLR-…`); decide whether resolution is permitted, which provider applies, and whether cross-casino/federation is allowed. The provider module is the only code that knows the algorithm. |
| **Event Platform** | The single entry point (`getEventPlatform().ingest/ingestBatch`). Lifecycle: validate (reject, never repair) → enrich (identity exactly once, correlation, trace, tenant, jurisdiction) → version → persist append-only (`casino_event_log`) → distribute (persisting IS publishing via Realtime). Infrastructure only — never business logic. |
| **Projection Platform** | The ONLY producer of persisted runtime state. Pure reducers materialize event facts into the read-model catalogue (3 tables + 7 SQL views). Disposable by design; rebuildable from the log through the same reducers as the live path. |
| **Digital Twin** | The ONLY live runtime model: one object graph per casino (Player, Session, Machine, Gaming Floor, Intervention, Casino aggregates), assembled from projections, mutated in place, observed by everything downstream. Owns no history, no persistence, no business logic. |
| **Domain Intelligence** | The ONLY analysis layer: ONE platform, seven ordered pipelines (session → machine → behaviour → risk → ai → intervention → compliance) enriching the SAME twin instances via `enrichments['domain-intelligence']`. Owns analysis, inference, classification, scoring, recommendations — nothing else. |
| **Policy & Rules** | The ONLY decision layer: declarative JSON-serializable rules (jurisdiction/operator/RG/compliance/platform scopes) evaluated by ONE evaluator over the enriched twin. Returns `PolicyDecision`s with provenance. Comparisons only; execution always happens outside. |
| **Consumer Platform** | The ONLY presentation gateway: versioned contracts, consumer profiles, authorization grants, routing, shaping. Consumers never see platform internals; live updates arrive on the published Realtime channels shaped by the Consumer Platform's own shapers. |

---

## 3. The Six Constitutions

### Constitution 1 — One Enterprise Flow
Every capability is one stage inside ONE continuous enterprise event flow. No parallel workflows, no duplicate event pipelines, no feature-specific flows, no hidden workflows, no second ingestion path. A producer that writes any store directly (rather than through `getEventPlatform()`) violates this constitution — known violators (`api-ingest`, `simulate_live_feed`, standalone risk functions) are scheduled for remediation in Phase 4.4 and no new ones may be created.

### Constitution 2 — One Runtime Reality
The Enterprise Casino Digital Twin is the ONLY runtime representation of the casino. There is exactly one runtime Player, Session, Machine, Gaming Floor, Risk view, Behaviour view, Intervention view, and Casino per identity. No component may create replacement or duplicate runtime objects; updates mutate the same instance so references and enrichments survive. Any second runtime model must be identified, documented, and removed.

### Constitution 3 — Enterprise Intelligence
The Domain Intelligence Platform never owns runtime state, never persists, never replaces or clones objects. It consumes the twin, analyses the twin, enriches the SAME twin instances, and returns control to the flow. All analysis, inference, classification, scoring and recommendation logic lives here and only here.

### Constitution 4 — Enterprise Policy
Policies never calculate, never enrich, never own runtime state, never perform AI/behaviour/risk analysis, never trigger workflows. Policies consume the enriched twin, evaluate configurable rules (data, not code), and return decisions only. Absent intelligence, a policy is silent — it never re-derives evidence. Execution always occurs outside the Policy Platform.

### Constitution 5 — Enterprise Consumers
Consumers never own business logic, runtime state, or calculations, and never query internal platform layers directly. All information reaches consumers through the Enterprise Consumer Platform (gateway views + published Realtime distribution shaped by Consumer Platform shapers). The gateway shapes, filters, authorizes, versions — it never recalculates or owns information.

### Constitution 6 — Production Hardening
No capability is production-ready until it satisfies ALL of:
1. **Tenant isolation** — every read path (tables, views, Realtime) enforces casino/tenant scope at the data layer; `using (true)` policies are forbidden in production.
2. **Verified identity** — authorization derives from the verified JWT and the casino registry; claimed profiles, claimed casinos, and claimed jurisdictions from request parameters are forbidden.
3. **Idempotent ingestion** — producers supply idempotency keys; retries never duplicate events; projection application is safe under concurrency.
4. **Bounded growth** — the event store has a partitioning, retention, and archive strategy before it holds production volume.
5. **Observability** — projection lag, ingestion failures, and rebuild outcomes are measured and alarmed; silent degradation is a defect.
6. **Evidence integrity** — §8 is enforced end-to-end.
7. **Certification** — production onboarding requires passing the Architecture Review conditions (see `PHASE_4_PRODUCTION_ROADMAP.md` gates).

---

## 4. Architectural Boundaries — owns / does NOT own

| Platform | Owns | Does NOT own |
|---|---|---|
| Identity | The SB-PLR namespace, resolution algorithm, identity policy decisions | Events, sessions, any player attributes, PII |
| Event Platform | Immutable events, the envelope, validation, enrichment, persistence, distribution | Business logic, risk, projections, runtime state, presentation |
| Projection Platform | Persisted runtime projections (read-model catalogue), rebuild/replay | Events (reads only), business thresholds beyond the published view bands, live object graphs, presentation |
| Digital Twin | The live runtime object graph, its lifecycle and memory, extension points | History, persistence, projections, business calculations, analysis, decisions |
| Domain Intelligence | Analysis, inference, classification, scoring, recommendations (the enrichment slot) | Runtime state, persistence, events, decisions, execution, presentation |
| Policy & Rules | Policy configuration, evaluation, decisions | Calculations, enrichment, runtime state, execution, storage of decisions |
| Consumer Platform | Presentation contracts, shaping, authorization grants, routing, versioning | Business logic, runtime state, intelligence, policy evaluation, any write path |
| Consumers | Rendering and user interaction | Everything else |

---

## 5. Enterprise Design Principles

**Single Responsibility / Separation of Concerns** — each layer has exactly one verb (§2 table). **Event Sourcing / Immutable Events** — `casino_event_log` is append-only (DB trigger enforced); facts are never updated, corrections are new events. **Replayability** — projections (and therefore the twin and everything downstream) must always be reconstructable from the log through the SAME reducers as the live path. **Runtime Consistency** — one instance per entity; in-place mutation; reference integrity is test-enforced. **Policy as Data / Configuration over Code** — jurisdiction, operator, tenant and platform behaviour change through validated configuration; a policy change requiring a code change is a design failure. **Consumer Isolation** — versioned contracts; a consumer can never observe an internal refactor. **Layer Independence / Loose Coupling / High Cohesion** — imports point strictly upstream (verified by the dependency graph in the certification); shared knowledge lives in the owning layer's public `index.ts` only. **Backward Compatibility** — see §9. **Security by Design / Least Privilege / Tenant Isolation** — Constitution 6. **Observability, Scalability, Maintainability** — measured, not asserted: tests, typecheck, build, live verification are part of done (§11).

---

## 6. Enterprise Naming Standards

- **Platforms:** `lib/<domain>Platform` or the established names (`playerIdentity`, `eventPlatform`, `projectionPlatform`, `digitalTwin`, `domainIntelligence`, `policyPlatform`, `consumerPlatform`). Public API only via `index.ts`; singleton accessors `get<Name>()` (e.g. `getEventPlatform()`, `getDigitalTwin(casinoId)`, `getPolicyPlatform()`, `getConsumerGateway()`).
- **Pipelines / stages:** kebab/lower-case stage ids in fixed catalogues (`session`, `machine`, `behaviour`, `risk`, `ai`, `intervention`, `compliance`); intelligence engine id `domain-intelligence`.
- **Runtime objects:** `<Entity>Twin` (`PlayerTwin`, `SessionTwin`, `MachineTwin`, `GamingFloorTwin`, `InterventionTwin`); enrichment slots keyed by engine id.
- **Events:** SCREAMING_SNAKE types from the frozen `EVENT_TYPES` vocabulary; envelope fields camelCase; store columns snake_case.
- **Projections:** tables `projection_<entity>_state`; views complete the read-model catalogue; `PROJECTION_VERSION` integer, bumped on any reducer change (with rebuild).
- **Policies:** `<SCOPE|JURISDICTION>-<AREA>-<NNN>` (e.g. `ZA-RG-001`, `CMP-002`, `OP-004`); every rule carries `policyReference` citing its source document/regulation.
- **Identity:** `SB-PLR-<hex>` anonymous player ids; provider ids versioned (`sha256-v1`).
- **Consumers:** profile ids kebab-case (`casino-operator`, `compliance-officer`); views kebab-case (`live-floor`, `activity-feed`); contract versions `v1`, `v2`, …
- **Edge functions:** kebab-case operational surfaces of exactly one platform (`consumer-gateway`, `projection-platform`, `digital-twin`, `identity-resolution`).
- **Docs:** phase reports `docs/phase-<n>-<name>.md`; governance documents UPPER_SNAKE in `docs/`.

---

## 7. NEVER Rules

Never duplicate runtime state. Never create parallel workflows or a second event pipeline. Never create feature-owned calculations — analysis belongs to Domain Intelligence, decisions to Policy. Never bypass an enterprise platform (no direct store writes by producers; no direct internal reads by consumers). Never expose internal layers directly — consumers see contracts only. Never repair invalid input — reject it. Never mutate or delete an event — append a new one. Never compute state a projection should materialize. Never let a twin object be replaced — mutate the single instance. Never let an engine register twice or a second gateway/platform instance exist per scope. Never put thresholds in consumers. Never take a shortcut that "will be temporary" without a marked removal phase — and never let a removal phase pass without removing it. Never introduce architectural drift: new capability outside the flow is rejected at review, not accommodated. Never modify the production environment without explicit per-session instruction (standing project rule).

---

## 8. Evidence Integrity Principle (permanent)

No component may present simulated, inferred, or estimated information as factual operational evidence.

Every value exposed to casino operators, regulators, or executives must be classifiable as exactly one of:
- **Recorded Fact** — carried on an immutable event or materialized 1:1 by a projection (e.g. wagered amounts, intervention occurrences, timestamps).
- **Derived Intelligence** — produced by the Domain Intelligence Platform, labelled with its stage and confidence (e.g. GRPI, escalation level, predicted risk).
- **Policy Decision** — produced by the Policy & Rules Platform, carrying policy id, reference and `executionRequired`.
- **Demonstration Data** — synthetic content, which must always be identifiable as such (e.g. `is_simulated`, demo patron namespace) and must never be blended into regulator-facing evidence.

No regulator-facing functionality may blur these distinctions. Presentation code that fabricates attributes (channels, delivery statuses, names) that no event recorded violates this principle — the one known instance (`InterventionView` channel/status fields) is scheduled for remediation in Phase 4.5 and no new instances may be introduced.

---

## 9. Architecture Versioning Principle (permanent)

Every architectural change must preserve backward compatibility unless an Architecture Decision Record explicitly approves the breaking change together with a documented migration strategy. **No breaking architectural change without an ADR.** This applies to: the event envelope and vocabulary, `PROJECTION_VERSION` and read-model shapes, twin object shapes and extension contracts, intelligence stage catalogue and output shapes, policy rule/decision schemas, consumer contract versions, and the identity formula (already flagged: widening SB-PLR entropy is a breaking identity migration requiring an ADR). Additive change is the default; contract-breaking change mints a new version and keeps the old one serving until an ADR retires it.

---

## 10. Amendment

This Constitution changes only through an accepted ADR in `ARCHITECTURE_DECISION_RECORD.md` that names the affected section, the rationale, and the migration/communication plan. Phase reports document compliance; they never amend law.

---

## 11. Definition of Done

An implementation is complete ONLY when all of the following hold:

1. **Constitutional compliance** — it exists inside the flow; all six constitutions verified; no NEVER rule broken; conflicts were surfaced before coding.
2. **Boundary evidence** — imports point upstream only; grep-verifiable absence of forbidden references (stores, bypasses) in the layer; public API via `index.ts`.
3. **Tests** — new behaviour covered by `tests/*.test.mjs` (node --test); the FULL suite passes with zero regressions; constitution guarantees (purity, no-persistence, single-instance, untouched-twin) asserted where applicable.
4. **Typecheck & build** — `tsc --noEmit` clean; `next build` succeeds when app code changed.
5. **Live verification** — the change demonstrated end-to-end on the demo environment (never production) with captured evidence.
6. **Replay safety** — if reducers or read models changed: `PROJECTION_VERSION` bumped, migration additive, rebuild executed and verified.
7. **Versioning** — contracts evolved additively, or a new version minted; breaking changes carry an accepted ADR (§9).
8. **Evidence integrity** — every new presented value classified per §8.
9. **Documentation** — phase/feature report in `docs/`; glossary updated for new canonical terms; memory/index updated.
10. **Deployment discipline** — demo project only; production untouched; uncommitted work flagged to the owner.

---

## 12. Amendment — National Identity Federation (ADR-006, **ACCEPTED** — Architecture Frozen 2026-07-16)

> **Status: ACCEPTED and in force.** ADR-006 was accepted at the Phase 2.1 Final Architecture Freeze; per §10 this amendment is now ratified law. It governs the Version 2.0 Enterprise Correlation Layer.

**§7 amendment (NEVER Rules):** the rule "cross-casino/federation remains denied by default" is amended to: *"Cross-casino identity federation remains **denied by default** and may be enabled **only** through the certified **National Identity Federation Service (NIFS)**, under regulator authority, per-jurisdiction configuration, and privacy-by-design (salted-HMAC hashes only, no PII). Operators never gain cross-tenant visibility; national correlation is a regulator-plane authority."*

**§2 clarification (One Runtime Reality):** the **National Player Twin** (keyed by the new regulator-plane id `SB-NAT`) is a **reference-aggregation** over the certified per-casino twins/projections — it holds no duplicate runtime state and creates no second player instance. "Exactly one runtime object per identity" holds across **two identity tiers**: one casino player per `SB-PLR`, one national player per `SB-NAT`.

**New capability registration:** NIFS is governed by all Six Constitutions — it exists inside the one flow (hashed-attribute events via the Event Platform → federation projection/engine → Consumer Platform), owns only national identity resolution/correlation, recalculates no operator intelligence or policy, adds a regulator-plane runtime by reference only, presents solely through the Consumer/Regulator Platform, and satisfies §6 (verified regulator identity, regulator-only RLS, idempotent contribution, append-only federation audit) and §8 (every identity link is Derived Intelligence with confidence, evidence, provenance and appeal). Design: `docs/NATIONAL_IDENTITY_FEDERATION_DESIGN.md`.

**System of Record (Phase 2 clarification):** `SB-PLR` remains the **canonical operational identity of record** in every casino and across the certified operator flow (Event/Projection/Twin/Intelligence/Policy/Consumer). `SB-NAT` is a **regulator-plane correlation identity only** and **never replaces** `SB-PLR` in any operator system; removing the National Intelligence Plane leaves every operator system functioning unchanged.

**Enterprise Correlation Identity (Phase 2.1):** `SB-NAT` is an **Enterprise Correlation Identity** — it is **NOT** a customer, operator, casino, system-of-record, or runtime identity. It exists solely for Cross-Operator Intelligence, National Responsible Gambling, Regulatory Oversight, National Behaviour Analytics and National Investigations.

**Enterprise Correlation Layer (Phase 2.1):** the federation capabilities are formalised as **one regulator-only, read-only Enterprise Correlation Layer** (National Identity Federation — comprising an **Identity Matching Engine** that only produces candidate matches and a **Federation Decision Engine** through which every governed, versioned, audited decision passes — plus the National Player Twin, Cross-Operator Intelligence, National Behaviour Analytics, National Self-Exclusion Registry and National Investigation Services). Its responsibilities are correlation, aggregation, federation, national intelligence and regulator analytics; it consumes the operator plane by reference and **never modifies operational systems**. It is jurisdiction-scoped and sovereign-namespaced (`SB-NAT-<CC>`); matching is policy-driven per jurisdiction (data, not code); every `SB-NAT` and decision carries an immutable version stamp (Federation Algorithm / Matching Policy / Jurisdiction / Decision Engine / Rule Set) and a fully reproducible audit record. Governed by ADR-006 (frozen) and `docs/NATIONAL_IDENTITY_FEDERATION_DESIGN.md`.

**Version 2.0 constitutional guarantees (permanent):**
1. `SB-PLR` remains the operational identity (system of record).
2. `SB-NAT` remains correlation-only (Enterprise Correlation Identity).
3. Operators never query federation.
4. Operators never access another tenant.
5. Federation remains regulator-only.
6. The certified runtime architecture remains unchanged.
7. Event sourcing remains authoritative.
8. Evidence Integrity remains preserved (§8).
9. Privacy by Design remains mandatory (no PII; salted-HMAC hashes only).
