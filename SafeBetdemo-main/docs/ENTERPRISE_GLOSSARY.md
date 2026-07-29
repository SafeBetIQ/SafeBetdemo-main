# SafeBet IQ — Enterprise Glossary

**Status: CANONICAL TERMINOLOGY** · Governed by `SAFEBET_ENTERPRISE_CONSTITUTION.md`

This glossary is the single shared vocabulary of SafeBet IQ. All documents, code comments, contracts, and communication use these terms with exactly these meanings. New canonical terms are added here as part of the Definition of Done; changed meanings require an ADR.

---

## Platform & flow

- **Enterprise Event Flow** — the ONE continuous path every casino fact travels: Casino Event → Identity Resolution → Identity Policy → Identity Provider → Event Platform → Projection Platform → Digital Twin → Domain Intelligence → Policy & Rules → Consumer Platform → Consumers. The event enters once and never forks.
- **Event** — an immutable fact about something that happened on the casino floor, expressed as a typed envelope (17 fields, `EVENT_TYPES` vocabulary) and persisted append-only in `casino_event_log`. Events are never updated or deleted; corrections are new events.
- **Envelope** — the frozen structure an event travels in: identity (`safeBetPlayerId`), tenancy (`tenantId`, `casinoId`, `jurisdiction`), correlation (`correlationId` = session journey), tracing (`traceId` = ingest batch), versioning (`schemaVersion`, `replayNumber`), timing (`occurredAt`/`receivedAt`/`processedAt`), and `payload`.
- **Producer** — a component that submits event drafts to the Event Platform (`getEventPlatform().ingestBatch`). Producers never write stores directly. Current sole certified producer: the casino-simulator.
- **Projection** — a disposable, persisted read model materialized from events by pure reducers (`projection_player_state`, `projection_session_state`, `projection_machine_state` + the seven catalogue views). Carries no information of its own; always rebuildable from the log.
- **Read-Model Catalogue** — the complete published set of projections (3 tables + 7 SQL views: casino, risk, behaviour, intervention, compliance, executive, regulator) — the ONLY runtime state store.
- **Replay / Rebuild** — reconstructing projections (and therefore the twin and everything downstream) by re-reducing the immutable log through the SAME reducers as the live path. The platform's core guarantee and its most persuasive demonstration.
- **Distribution** — publication of persisted facts via Supabase Realtime on `casino_event_log` and the projection tables ("persisting IS publishing"). Realtime owns distribution only.

## Runtime

- **Digital Twin** — the ONE live runtime model of a casino at this exact moment: an in-memory object graph assembled exclusively from projections, mutated in place, disposable, and rebuildable. Owns runtime only — no history, no persistence, no business logic. One per casino per process via `getDigitalTwin(casinoId)`.
- **Runtime Object** — a twin instance: `PlayerTwin`, `SessionTwin`, `MachineTwin`, `GamingFloorTwin`, `InterventionTwin` (plus casino aggregates). Exactly one instance per identity; every consumer and engine holds the SAME reference.
- **Enrichment (slot)** — the per-engine annotation area on every runtime object (`enrichments[engineId]`), written only through the twin's extension host. Enrichments survive updates because instances are mutated, never replaced.
- **Player** — the anonymous patron runtime object, identified only by SafeBet Player ID; carries projected facts (status, totals, risk score/flags, intervention counters) — never PII.
- **Session** — a continuous play journey (open → active → ended). The twin holds LIVE sessions only; ended sessions leave the runtime model (history stays in events).
- **Machine** — a gaming position (slot/table/live-dealer/RNG) with projected occupancy, type, floor location, and session facts.
- **Gaming Floor** — a zone grouping of the SAME machine instances by materialized `floor_location` (an event fact) — references, never copies.
- **Intervention** — a recorded responsible-gambling action on a player journey (`INTERVENTION_TRIGGERED` events → projected counters → `InterventionTwin`). Distinct from a *recommended* intervention (Derived Intelligence) and an *intervention decision* (Policy Decision).

## Identity

- **Identity Resolution** — deriving the ONE anonymous SafeBet Player ID from a casino's player reference via `getIdentityService()`. Happens exactly once per event, at enrichment.
- **SafeBet Player ID (SB-PLR)** — the platform-wide anonymous player identifier (`SB-PLR-<hex>`). Currently 8 hex chars (32-bit; certification condition C3 mandates widening to ≥64-bit via ADR-001). Contains no PII by construction.
- **Identity Policy** — the pure decision point inside the identity service: is resolution permitted, which provider applies, is cross-casino/federation allowed (denied by default).
- **Identity Provider** — the versioned algorithm module (`sha256-v1`) — the only code that knows how ids are derived.

## Intelligence & decisions

- **Domain Intelligence** — the ONE analysis layer: the `domain-intelligence` engine containing seven ordered pipelines (session → machine → behaviour → risk → ai → intervention → compliance) that enrich the SAME runtime objects. Owns analysis, inference, classification, scoring, recommendations — and nothing else.
- **Intelligence Stage** — one pipeline in the fixed chain; later stages consume earlier stages' output for the same object in the same pass.
- **GRPI** — Gambling Risk Propensity Index: the risk stage's weighted composite of the projected risk score and behavioural indicators. Derived Intelligence, never a Recorded Fact.
- **Escalation Level** — the risk stage's classification of a player (`none | watch | elevated | critical`) from the dynamic risk score bands.
- **Policy** / **Policy Rule** — a JSON-serializable, validated configuration object (`policyId`, scope, optional jurisdiction/casino selectors, declarative `when` condition, decision fields). Policies never calculate — they compare and decide.
- **Policy Decision** — the ONLY output of the Policy & Rules Platform: advice with provenance (`action`, `priority`, `reason`, `policyReference`, `confidence` [read, not computed], `executionRequired`). Execution always occurs outside the platform.
- **Policy Scope** — which authority a rule belongs to: `jurisdiction`, `operator`, `responsible-gambling`, `compliance`, `platform`.

## Presentation

- **Consumer Platform** — the ONE presentation gateway: versioned contracts, consumer profiles, authorization grants, routing, shaping. The only path by which consumers obtain information.
- **Consumer** — anything that presents information to humans or external systems (dashboards, regulator views, executive summaries, compliance workspaces, mobile, REST clients, future GraphQL). Consumers own presentation only.
- **Consumer Profile** — the authorization identity of a consumer (`casino-operator`, `regulator`, `executive`, `compliance-officer`, `administrator`, `api-client`), granted a fixed set of views.
- **Presentation Contract / View** — a frozen, versioned response shape (`v1`: `live-floor`, `activity-feed`, `compliance`, `summary`, `actions`). Breaking changes mint a new version; old versions keep serving.
- **Shaping** — selecting, arranging and labeling platform facts into contracts. Shaping never recalculates.

## Evidence classification (Constitution §8)

- **Recorded Fact** — a value carried on an immutable event or materialized 1:1 by a projection. The only class admissible as regulatory evidence.
- **Derived Intelligence** — a value produced by the Domain Intelligence Platform, labelled with stage and confidence.
- **Policy Decision** — a value produced by the Policy & Rules Platform, carrying policy id and reference.
- **Demonstration Data** — synthetic content (e.g. `demo-patron-*` namespace, `is_simulated`), always identifiable as such, never blended into regulator-facing evidence.

## Business & regulatory

- **Tenant** — the top-level isolation boundary (an operator organisation; `tenantId`, today defaulting to the casino). No data, stream, or view crosses tenants (Constitution 6).
- **Casino Operator** — the licensed business running one or more casinos; consumes operational, wellbeing, and executive views; may define operator-scoped policies.
- **Jurisdiction** — the regulatory territory a casino operates under (e.g. `ZA`, `BW`, `KE`; extension points `NA`, `NG`, `GH`, `MU`). Selects which jurisdiction policy pack evaluates. Must derive from the casino registry, never from a caller's claim.
- **Regulator** — the gaming authority for a jurisdiction (e.g. ZA National Gambling Board, KE BCLB); consumes compliance views, notifications, and replayable evidence.
- **Responsible Gambling (RG)** — the player-protection domain: behavioural indicators, risk scoring, interventions, cooling-off, session limits — implemented as intelligence stages + policy packs, never as feature-owned logic.
- **Compliance** — the obligations-and-evidence domain: monitoring cohorts, outstanding actions, audit readiness, regulator notifications.
- **Audit Evidence** — the reconstructable record a regulator can demand: the immutable event journey (by correlation id), its projections, and the decisions taken — with evidence classification intact.

## Governance

- **Constitution** — `SAFEBET_ENTERPRISE_CONSTITUTION.md`: permanent architectural law; six constitutions plus principles, boundaries, NEVER rules, and the Definition of Done.
- **ADR (Architecture Decision Record)** — the only instrument that authorizes a breaking architectural change or amends the Constitution (`ARCHITECTURE_DECISION_RECORD.md`).
- **Certification** — the independent Architecture Review verdict and conditions (`architecture-review-certification.md`); Phase 4's authoritative input.
- **Definition of Done** — Constitution §11: the ten conditions every implementation must satisfy before completion.

---

*To add a term: append it to the correct section with a one-to-three sentence definition, as part of the implementing change's Definition of Done.*

---

## National Identity Federation (v2.0 — PROPOSED, ADR-006 pending)

- **SB-NAT (`SB-NAT-<CC>-<hex>`)** — an anonymous **Enterprise Correlation Identity**; the canonical cross-operator correlation id. Minted (not derived from PII); visible to **authorised regulators only**; links 1..n per-casino `SB-PLR`s that are the same anonymous individual. It is **NOT** a customer / operator / casino / system-of-record / runtime identity — it exists solely for Cross-Operator Intelligence, National Responsible Gambling, Regulatory Oversight, National Behaviour Analytics and National Investigations. Every `SB-NAT` carries an immutable version stamp (Federation Algorithm / Matching Policy / Jurisdiction / Decision Engine / Rule Set). Contrast `SB-PLR` (per-casino system of record).
- **Identity Matching Engine** — the deterministic NIFS component that produces **candidate** matches only (hash comparison, attribute correlation, candidate generation, confidence calculation, rule evaluation, evidence generation). It never accepts or rejects an identity.
- **Federation Decision Engine** — the enterprise governance component through which **every** federation decision passes (federation policies, auto/manual thresholds, regulator approval, appeals, overrides, explainability, audit generation, decision history, version tracking). No direct matching decisions exist.
- **Enterprise Correlation Layer** — the canonical name (Phase 2.1) for the regulator-only, **read-only** layer (formerly "National Intelligence Plane"): correlation, aggregation, federation, national intelligence, regulator analytics. It never modifies operational systems.
- **National Identity Federation Service (NIFS)** — the new enterprise service that ingests hashed matching attributes (via the Event Platform), clusters them across operators, mints/resolves `SB-NAT`, and maintains the regulator-plane mapping, confidence and audit. Never exposes anything to operators.
- **Attribute hash** — a non-reversible salted keyed hash (`HMAC-SHA256(national_pepper, type:normalised_value)`) of a matching attribute (national id, passport, phone, email, loyalty, device, payment). The **only** matching input; **no plaintext PII** is ever stored or transmitted.
- **National pepper** — a per-jurisdiction secret (HSM/Secrets Manager, versioned, never client-exposed) mixed into attribute hashing to prevent offline correlation/brute-force.
- **Confidence tier** — the explainable strength of an `SB-NAT` link: **Confirmed / Probable / Possible / Rejected**, from configurable weighted attribute evidence; carries evidence (attribute *types*), matching rule, provenance and appeal history (Evidence Integrity §8).
- **National Player Twin** — a regulator-plane Digital-Twin object keyed by `SB-NAT` that assembles operator history, risk evolution and intervention history **by reference** over the per-casino projections (no duplicate runtime state).
- **Regulator plane** — the set of federation artefacts (`national_identity_map`, `projection_national_identity`, `federation_audit`, national twin, national views) accessible to **authorised regulators only**; operators are write-only contributors and receive 403 on any federation read.
- **National policy scope (`NAT-*`)** — additive Policy-Platform rules (national self-exclusion, cooling-off, cross-operator escalation, national intervention thresholds) evaluated over the National Player Twin; declarative data, explainable decisions.
- **National Intelligence Plane (NIP)** — the new **regulator-only** enterprise layer that sits alongside/downstream of the certified operator flow and contains National Identity Federation, the National Player Twin, Cross-Operator Intelligence, National Behaviour Analytics, the National Self-Exclusion Registry and National Investigation Services. It consumes the operator plane (hashed-attribute events + reads projections by reference) and never mutates it.
- **System of Record (identity)** — `SB-PLR` is the canonical operational identity of record within every casino and across the certified operator flow. `SB-NAT` is a **correlation identity only** and never replaces `SB-PLR` in any operator system.
- **Jurisdiction profile** — the per-country, policy-driven configuration of federation (enabled attribute types, weights, tier thresholds, auto/manual boundaries, retention); versioned and audited like a policy pack; changed as data, never code.
- **Sovereign national id (`SB-NAT-<CC>-<hex>`)** — `SB-NAT` namespaced per sovereign jurisdiction (ZA/NA/BW/KE), each with an isolated pepper, mapping store, profile and policy pack; no cross-border correlation by default (data-sovereignty by design).
- **National Player Twin lifecycle** — the governed states of a national identity: Created → Updated → Re-evaluated → Split/Merged → Retired → Archived; every transition audited; splits/merges change only the `SB-PLR↔SB-NAT` mapping, never `SB-PLR`.
