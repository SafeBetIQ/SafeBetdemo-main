# SafeBet IQ — Architecture Decision Records

**Status: GOVERNANCE REGISTER** · Governed by `SAFEBET_ENTERPRISE_CONSTITUTION.md` §9–10

This file is the single register of architectural decisions. Per the Architecture Versioning Principle, **no breaking architectural change may be introduced without an accepted ADR** — including changes to: the event envelope/vocabulary, `PROJECTION_VERSION` and read-model shapes, twin object shapes and extension contracts, the intelligence stage catalogue, policy rule/decision schemas, consumer contract versions, the identity formula, and the Constitution itself.

## How to use this register

1. Copy the template below to the end of this file; assign the next sequential number (`ADR-001`, `ADR-002`, …).
2. Complete every field. "Alternatives Considered" must contain at least one genuine alternative with the reason it lost.
3. Status lifecycle: `Proposed → Accepted | Rejected`; later `Superseded by ADR-NNN` or `Deprecated`. Accepted ADRs are never edited — supersede them.
4. Breaking changes MUST include a concrete Migration Strategy (or an explicit declaration of irreversibility) before acceptance.
5. Reference the ADR number in the implementing phase report and in commit messages.

## Index

| ADR | Date | Decision | Status |
|---|---|---|---|
| ADR-001 | 2026-07-12 | SafeBet Player ID widened to the 96-bit deterministic standard (sha256-v2) — Phase 4.2, condition C3 | Accepted |
| ADR-002 | 2026-07-12 | Authorization derives exclusively from verified material (Phase 4.1, conditions C1/C2) | Accepted |
| ADR-003 | 2026-07-13 | Idempotent ingestion, optimistic projection concurrency, and range-partitioned event store (Phase 4.3, condition H3/H4) | Accepted |
| ADR-004 | 2026-07-13 | Externalised versioned policy store + operating modes (Phase 4.4, condition M1/H5) | Accepted |
| ADR-005 | 2026-07-16 | Human-coordination workflow & case management as operational orchestration metadata (v1.5) | Accepted |
| ADR-006 | 2026-07-16 | National Identity Federation Service & the SB-NAT enterprise correlation identity (v2.0) | **Accepted** — Architecture Frozen (Phase 2.1) |

---

## Template

```markdown
## ADR-NNN — <short decision title>

- **Decision Number:** ADR-NNN
- **Date:** YYYY-MM-DD
- **Status:** Proposed | Accepted | Rejected | Superseded by ADR-NNN | Deprecated
- **Future Review Date:** YYYY-MM-DD (or "none")

### Decision
<One paragraph stating exactly what is decided, in the imperative. No ambiguity.>

### Context
<The forces at play: the problem, constraints, certification findings, constitutional
sections involved, and why a decision is required now.>

### Alternatives Considered
1. **<Alternative A>** — <what it is; why rejected>
2. **<Alternative B>** — <what it is; why rejected>
3. **Do nothing** — <consequence of not deciding>

### Decision Rationale
<Why the chosen option wins against the alternatives, tied to the Constitution's
principles (one flow, one runtime reality, policy as data, evidence integrity, …)
and to objective evidence where available.>

### Consequences
- **Positive:** <what this enables>
- **Negative / accepted costs:** <debt, risk, effort taken on knowingly>
- **Constitutional impact:** <none | which sections are touched or amended>

### Migration Strategy
<REQUIRED for breaking changes. Steps, data handling (replay/rebuild/reseed),
backward-compatibility window, version coexistence, rollback or an explicit
irreversibility declaration, and the validation evidence required.>

### Related Components
<Files, platforms, migrations, contracts, tests, phase reports, conditions
(e.g. certification C3) affected.>
```

---

## ADR-002 — Authorization derives exclusively from verified material

- **Decision Number:** ADR-002
- **Date:** 2026-07-12
- **Status:** Accepted
- **Future Review Date:** 2027-01-12

### Decision
Every authorization decision across SafeBet IQ is derived exclusively from cryptographically verified material: the Supabase-verified JWT subject plus the server-side `users` registry keyed by that subject, and the `casinos` registry. Consumer profile is derived from the registry `role`; casino scope from the principal (operators/compliance pinned to their own casino); jurisdiction always from the `casinos` registry row of the resolved casino. Request parameters, headers (beyond the bearer token), and any client-supplied `consumer`/`jurisdiction`/`role` value are never trusted and may only *select a view or request a casino within the principal's existing entitlement* — never widen it. Tenant isolation is enforced twice: at the database via RLS (`app_visible_casinos()`), and at every edge surface via the mirrored `principalMayAccessCasino()` predicate.

### Context
The Independent Architecture Review raised C1 (no tenant isolation: `using (true)` read policies on the event log and projections) and C2 (the consumer-gateway authorized a *claimed* profile/jurisdiction from query parameters — an anon key retrieved regulator views live). Constitution 6 (Production Hardening) forbids both. A decision was required on the single, permanent source of authority for authorization before any production tenant onboards.

### Alternatives Considered
1. **Trust signed JWT custom claims for role/casino/jurisdiction** — rejected: claims can drift from the registry, require a claims-minting pipeline to stay authoritative, and still centralize trust in token contents rather than the source of record. The registry is already the source of truth.
2. **Application-layer filtering only (no RLS)** — rejected: leaves the database open to any bypass (direct client, Realtime, a future consumer), violating defense-in-depth and Constitution 6.1.
3. **RLS only (no edge checks)** — rejected: the gateway uses the service role for platform reads, so RLS does not constrain it; the edge must enforce the same matrix. Both layers are required.
4. **Do nothing** — rejected: C1/C2 are production blockers; G1 cannot pass.

### Decision Rationale
The registry is the existing source of record for principals and tenancy; deriving authority from it (keyed by the verified subject) removes every client-supplied trust vector in one move and keeps a single matrix expressed in two enforcing layers (SQL `app_visible_casinos()` and TS `principalMayAccessCasino()`) that are deliberately identical. This satisfies Security by Design, Least Privilege, and Tenant Isolation without adding a new platform, runtime model, or claims pipeline (no architectural drift).

### Consequences
- **Positive:** cross-tenant reads blocked at the data layer; anon/tampered tokens and claim-spoofing rejected at every surface; jurisdiction can no longer be chosen by the caller; ops/producer surfaces restricted to administrators/verified producers.
- **Negative / accepted costs:** every read path now depends on the `users`/`casinos` registries being correct and on `auth.uid()` being present (service-role internal jobs bypass by design); one extra `app_visible_casinos()` evaluation per statement (measured negligible — evaluated once per query, not per row).
- **Constitutional impact:** directly implements Constitution 6.1 and 6.2; no amendment required.

### Migration Strategy
Additive and reversible. RLS policies replace `using (true)` in one migration; catalogue views set `security_invoker = true` (closing a view-level bypass the review did not catch); a `casinos.jurisdiction` column (default `'ZA'`) and optional `users.jurisdiction` are added and backfilled. The consumer-gateway drops honoring `consumer`/`jurisdiction` parameters — a behavior change to the presentation contract, mitigated because the browser client never relied on them for entitlement (it sent the user's own values). Rollback = restore the prior permissive policies (not advised; documented for completeness). No event, projection, twin, intelligence, policy, or contract *shape* changes — this is not a breaking change under §9.

### Related Components
`lib/security/principal.ts` (new); `lib/consumerPlatform/authorization.ts` (`resolveConsumerScope`); `supabase/functions/{consumer-gateway,digital-twin,projection-platform,casino-simulator}/index.ts`; migration `20260712100000_phase41_tenant_isolation.sql`; `tests/security.test.mjs`; certification conditions C1, C2; Phase 4.1.

---

## ADR-001 — SafeBet Player ID widened to the 96-bit deterministic standard

- **Decision Number:** ADR-001
- **Date:** 2026-07-12
- **Status:** Accepted
- **Future Review Date:** 2028-07-12 (or upon a federation requirement for 128-bit external interop)

### Problem statement
The SafeBet Player ID (SB-PLR) is the anonymous identity binding a player's entire gambling-risk history, interventions, and compliance record across the enterprise flow. The Independent Architecture Review (condition C3) found the identifier was **32 bits** (first 8 hex of SHA-256). At the 20-year target — hundreds of millions to a billion identities across many operators and jurisdictions — the birthday-bound collision probability is unacceptable: a collision silently **merges two distinct humans' risk histories**, a regulatory-grade harm. A permanent identity strategy was required before any production tenant onboards.

### Current implementation (pre-decision)
`id = 'SB-PLR-' + upper(first 8 hex of SHA-256('sbiq-v1:<casino_id>:<lower(ref)>'))`, produced solely by `SHA256IdentityProvider` (`sha256-v1`), reached only through `IdentityResolutionService`. Deterministic, per-casino, anonymous, persisted in `safebet_identity_map` with a runtime collision-probe fallback. 32-bit id space (2^32 = 4.29e9).

### Collision analysis (birthday bound p ~ n^2 / 2^(b+1); computed, not assumed)
| Identities (global) | 32-bit (v1) | 64-bit | 96-bit (chosen) | 128-bit |
|---|---|---|---|---|
| 100,000 | 1.2e-3 | 2.7e-10 | 6.3e-20 | 1.5e-29 |
| 1,000,000 | 1.2e-1 | 2.7e-8 | 6.3e-18 | 1.5e-27 |
| 10,000,000 | ~1 (certain) | 2.7e-6 | 6.3e-16 | 1.5e-25 |
| 100,000,000 | certain | 2.7e-4 | 6.3e-14 | 1.5e-23 |
| 1,000,000,000 | certain | 2.7e-2 | 6.3e-12 | 1.5e-21 |
| 10,000,000,000 | certain | 2.7 (certain) | 6.3e-10 | 1.5e-19 |

### Alternatives considered
1. **Option A - 64-bit (16 hex).** Rejected on evidence: at 1e9 identities collision probability is ~2.7%, and at 1e10 effectively certain. A ~1-in-37 chance of some collision over platform lifetime does not satisfy "practically eliminated" for regulator-grade identity.
2. **Option B - 96-bit (24 hex). CHOSEN.** At 1e9 -> 6.3e-12 (~1 in 160 billion); at 1e10 -> 6.3e-10. Eliminated with >60 bits of margin over the whole growth curve while the id stays compact (31 chars).
3. **Option C - 128-bit (32 hex).** Astronomically safe (1e9 -> 1.5e-21) but over-provisioned; +8 bytes/id and a longer, less legible id for no reachable benefit at the stated scale. Retained as a documented future option.
4. **Option D - random UUIDv4 / opaque id.** Rejected: breaks deterministic derivation (offline/browser resolution, refresh-stability, byte-identical resolution across simulator and edge, deterministic replay). Determinism is non-negotiable.

### Performance analysis
Generation: one SHA-256 over a short preimage — identical cost at any truncation width; negligible. Lookup: `safebet_identity_map` keyed by `(casino_id, casino_ref_hash)` unchanged; the `safebet_player_id` unique key widens 8->24 chars — a trivial B-tree entry. Resolution throughput unchanged. Migration: `truncate` + deterministic reseed, O(events), completed in one burst live.

### Storage analysis
Id string grows 15 -> 31 bytes. At 1e9 identities the map column grows ~16 GB vs 32-bit — immaterial at that scale and offset by removing collision-remediation complexity. Ids are already `text`; no type change.

### Database index implications
`safebet_identity_map (safebet_player_id) unique` and `casino_event_log (safebet_player_id, occurred_at)` carry a wider key; B-tree depth unaffected at realistic cardinalities. Check constraints on the three id-bearing tables accept BOTH widths (`^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$`). Partitioning/archiving (4.3) unaffected — the id is not a partition key.

### Human readability / URL safety / QR suitability
`SB-PLR-707371C39AE04D71BBA3E495` (31 chars): uppercase hex + hyphens -> URL-safe unencoded, trivial high-density QR, human-quotable in support/audit. 128-bit (39 chars) is materially less legible for no scale benefit.

### Replay implications
The hash **preimage domain tag stays `sbiq-v1`** across widths, so v2 is the same hash truncated wider: **a v1 id is the exact prefix of its v2 id** (707371C3 subset of 707371C39AE04D71BBA3E495). Replay stays deterministic; historical v1 events replay unchanged and remain valid. Proven live: two rebuilds of the same 30 v2 events -> identical projections.

### Multi-jurisdiction implications
Jurisdiction-neutral, anonymous — no jurisdiction encoded in the id (jurisdiction lives in the casino registry, ADR-002). 96 bits covers all jurisdictions' combined populations.

### Federation implications
Cross-casino/federation remains **denied by default** at the Identity Policy layer. A future federated or external-128-bit-interop requirement is an **additive new provider** selected by configuration — NOT a redesign. The provider abstraction makes width/strategy a config concern; this guarantees "no second identity redesign."

### Migration strategy
Demonstration data only: (1) widen the three check constraints to accept both widths (additive); (2) `truncate` `safebet_identity_map`, `casino_event_log`, projection tables; (3) reseed deterministically via the casino-simulator producer under `sha256-v2`. Fully repeatable — identical refs reseed to identical v2 ids. Rollback = repoint `defaultProvider` to `sha256-v1` (still registered) + reseed; not advised.

### Backward compatibility strategy
Both providers registered; format contract accepts both widths; v1 ids are prefixes of v2 ids. Historical/external v1 ids continue to validate and render. Additive under Constitution §9 — but identity is ADR-gated, so this ADR is the record.

### Long-term recommendation
96-bit (`sha256-v2`) is the permanent production standard. Federation requiring 128-bit interop would be an additive provider under a new ADR — no migration of existing v2 ids, no architectural change.

### Final decision
Adopt **96-bit deterministic identity (`sha256-v2`, 24 hex)** as the production standard and default provider, with `sha256-v1` retained for backward compatibility and replay.

### Consequences
- **Positive:** collision practically eliminated across the 20-year curve (6.3e-12 at 1e9); determinism, anonymity, per-casino scoping, replay preserved; Identity Resolution architecture untouched; future widening/federation config-only.
- **Negative / accepted:** +16 bytes/id; longer id; one-time synthetic reseed (trivial now, impossible after real players — hence G2's placement).
- **Constitutional impact:** none amended; honors §9 via this ADR.

### Related Components
`lib/playerIdentity/core.ts` (widened pattern, `SAFEBET_ID_HEX_WIDTH`); `providers/sha256.ts` (parameterized width, v1+v2); `config.ts` (`DEFAULT_PROVIDER_NAME='sha256-v2'`); `service.ts` (registers both); migration `20260712140000_phase42_identity_v2_96bit.sql`; `tests/playerIdentity.test.mjs`; certification condition C3; Phase 4.2; gate G2.

---

## ADR-003 — Idempotent ingestion, optimistic projection concurrency, partitioned event store

- **Decision Number:** ADR-003
- **Date:** 2026-07-13
- **Status:** Accepted
- **Future Review Date:** 2027-07-13

### Decision
Harden the enterprise flow for scale and resilience via three coordinated mechanisms, without changing the architecture: (1) **Idempotent ingestion** — the envelope carries a producer `idempotencyKey` (defaulting to `eventId`); the event store enforces `UNIQUE(casino_id, dedupe_key, occurred_at)` and the Event Platform upserts with ignore-duplicates, projecting only the rows actually inserted (at-least-once delivery → exactly-once processing). (2) **Optimistic projection concurrency** — each projection row carries `row_version`; the live apply path writes through `sbiq_write_projection_states`, which under a per-casino advisory lock commits a batch only if every row's stored version still equals the loaded version, with bounded TS-side reload-and-retry. Reduction stays in TypeScript (one source of truth). (3) **Range-partitioned event store** — `casino_event_log` becomes monthly `RANGE (occurred_at)` partitioned, with `publish_via_partition_root` preserving Realtime, monthly partition maintenance, and DETACH-based retention/archival (never DELETE — immutability preserved).

### Context
The Independent Architecture Review raised H3 (no ingestion idempotency; a projection read-modify-write race loses updates under concurrency) and H4 (no event-store partitioning/retention; the append-only log grows unbounded and cannot be archived because DELETE is blocked). Constitution 6.3 (idempotent ingestion) and 6.4 (bounded growth) require both closed before high-volume production. Envelope evolution and the projection-write path are ADR-gated (§9).

### Alternatives Considered
1. **Content-hash idempotency (dedupe on payload).** Rejected: two legitimately-identical events (same bet, same millisecond) would be wrongly dropped. Idempotency must be producer intent — hence an explicit key defaulting to eventId.
2. **Serialize all projection writes globally (single writer).** Rejected: destroys per-casino parallelism and caps throughput. The advisory lock is per-casino, so different casinos still run concurrently.
3. **Move reduction into SQL for transactional load-reduce-write.** Rejected: duplicates the reducer (Constitution — one source of truth) and couples business materialization to the database.
4. **Last-writer-wins (no version guard).** Rejected: that is the lost-update bug itself.
5. **Retention by DELETE of old rows.** Rejected: violates append-only immutability (the trigger blocks it, correctly). Partition DETACH preserves the audit record while removing it from the hot path.
6. **Leave the event log unpartitioned.** Rejected: unbounded single-table growth degrades replay/index performance and precludes archival at enterprise volume.

### Decision Rationale
Each mechanism uses the least-invasive tool that is provably correct: idempotency keys are producer-controlled and default to today's behaviour (additive); OCC with a per-casino advisory lock eliminates lost updates while preserving parallelism and keeping reduction in TS; native range partitioning with publish-via-root keeps Realtime, replay, audit, RLS and immutability all intact while making growth and archival sustainable. No new platform, runtime model, or pipeline — no architectural drift.

### Consequences
- **Positive:** retries are safe (exactly-once processing); concurrent writers cannot lose updates; the event log scales by month and archives by DETACH; observability (structured PII-free telemetry + `sbiq_platform_health`) makes the flow diagnosable; all live-verified.
- **Negative / accepted:** the envelope gains one field (`idempotencyKey`); projection writes take one extra RPC hop (measured negligible; batched); partition maintenance must run monthly (idempotent `sbiq_ensure_event_partition`); OCC adds bounded retries under contention (per-casino, rare at demo scale).
- **Constitutional impact:** implements Constitution 6.3 and 6.4; envelope change is additive and backward-compatible under §9 (default preserves prior behaviour, rebuild inverse handles absent `dedupe_key`).

### Migration Strategy
Synthetic data, deterministic and repeatable. Migration `20260712160000` adds `dedupe_key` + unique, `row_version`, the OCC RPC, and the health function (disposing/reseeding synthetic rows because the append-only trigger forbids backfill UPDATE). Migration `20260712180000` recreates the event log as partitioned (empty; synthetic reseed) with all properties re-applied and `publish_via_partition_root=true`. Rollback: revert `persistEnvelopes` onConflict/return and the apply retry loop; the columns/functions are harmless if left. Replay/audit preserved throughout (live-verified: deterministic rebuild from the partitioned log; DETACH keeps archived data queryable).

### Related Components
`lib/eventPlatform/{envelope,enrichment,persistence,platform}.ts`; `lib/projectionPlatform/{readModels,apply,platform,rebuild}.ts`; `lib/observability/telemetry.ts` (new); migrations `20260712160000_phase43_ingestion_projection_hardening.sql`, `20260712180000_phase43_event_store_partitioning.sql`; `tests/resilience.test.mjs`; `scripts/phase43-benchmark.mjs`; certification conditions H3, H4; Phase 4.3; gate G3.

---

## ADR-004 — Externalised versioned policy store and operating modes

- **Decision Number:** ADR-004
- **Date:** 2026-07-13
- **Status:** Accepted
- **Future Review Date:** 2027-07-13

### Decision
Move policy CONFIGURATION out of code into a versioned, audited database repository (`policy_sets`, `policy_rules`, `policy_change_log`) loaded through the Policy Platform's existing `configure()` seam; and introduce operating modes (development/demonstration/staging/production) that influence OPERATIONS only. Policy evaluation logic stays entirely in `lib/policyPlatform/evaluation.ts`; operating mode never alters identity, projections, intelligence, or policy decisions.

### Context
Certification M1: shipping policy packs in code meant a regulator threshold change was a redeploy. H5: no operating-mode-aware observability/alerting. Constitution 4 requires policy to be data, not code; Constitution 6.5 requires operability. A decision was required on where policy configuration lives and how modes are expressed — without moving decision logic or forking behaviour by mode.

### Alternatives Considered
1. **Keep policy packs in code, deploy to change.** Rejected: violates "policy as data / configuration over code"; slow, risky regulatory changes.
2. **Store policy logic (conditions as executable code) in the DB.** Rejected: moves the decision engine out of the one Policy Platform (Constitution 4) — only the declarative rule DATA belongs in the store.
3. **Feature flags per mode that change business rules.** Rejected: modes must never change business outcomes (one runtime reality). Modes tune operations only.
4. **A separate policy microservice.** Rejected: a new platform / parallel pipeline (architectural drift). The existing `configure()` seam already accepts external configuration.

### Consequences
- **Positive:** policy changes are versioned, effective-dated, audited, and rollback-capable with zero deploy (verified live: rollback 2→1 with audit trail); modes give production-grade alerting thresholds without business impact; operators get one governed ops surface (`platform-ops`).
- **Negative / accepted:** one DB round-trip to load active policies (cached ≤60 s; falls back to current config on failure — availability over freshness); the shipped packs remain the seed source and must be kept in sync via `policy-seed` when intentionally changed.
- **Constitutional impact:** implements Constitution 4 (policy as data) and 6.5 (observability); no logic moved; no amendment.

### Migration Strategy
Additive. Migration `20260713100000` creates the store tables + `sbiq_active_policy_rules()` + `sbiq_activate_policy_set()` (empty). `platform-ops?action=policy-seed` writes the shipped `defaultConfiguration()` as version 1 and activates it. Until seeded, the platform uses its in-code defaults (no behaviour change). Rollback: revert the gateway's `ensurePoliciesLoaded` wiring (platform reverts to in-code defaults); tables are harmless if left. No event/projection/twin/contract changes.

### Related Components
`lib/policyPlatform/store.ts` (loader, config only); `lib/operations/{mode,monitoring,scheduledOps,index}.ts` (new); `supabase/functions/platform-ops/index.ts` (new); `supabase/functions/consumer-gateway/index.ts` (store-load wiring); migration `20260713100000_phase44_policy_store.sql`; `tests/operations.test.mjs`; `docs/OPERATIONS_MANUAL.md`; certification conditions M1, H5; Phase 4.4; gate G4.

## ADR-005 — Human-coordination workflow & case management as operational orchestration metadata

- **Decision Number:** ADR-005
- **Date:** 2026-07-16
- **Status:** Accepted
- **Future Review Date:** 2027-07-16

### Decision
Introduce Enterprise Workflow & Case Management (v1.5) as an **operational orchestration layer that coordinates HUMAN actions** over the certified enterprise flow — never as a new data pipeline, engine, runtime model, or policy engine. Cases, tasks, an append-only audit trail, and notifications are **operational metadata** (the same class as `connector_runs` and `operator_subscriptions`), stored in dedicated tenant-scoped tables and mutated only through the `workflow` edge function after principal verification. A case **references** platform-produced evidence (Recorded Facts, Derived Intelligence, Policy Decisions, Explainable Intelligence) by identifier in `evidence_refs`; it never copies intelligence, never stores risk/policy as authoritative state, and the live value of any referenced evidence is always read back from the Consumer Platform. The workflow layer (`lib/workflow`) is pure and performs no I/O, no analysis, and no policy evaluation; it decides only *what a human may do next* (a strict case/task state machine), never a business outcome.

### Context
v1.5 must let casinos and regulators operationalise SafeBet IQ recommendations — assign, track, resolve and audit them. Constitution 1 forbids "parallel workflows, duplicate event pipelines, feature-specific flows, hidden workflows"; Constitution 2 forbids duplicate runtime state; Constitutions 3–5 reserve analysis to Domain Intelligence, decisions to Policy, and presentation to the Consumer Platform. The word "workflow" brushes directly against Constitution 1, so an explicit decision was required to establish that **human-coordination workflow is not a Constitution-1 data flow** and to fix the boundary that keeps it compliant.

### Alternatives Considered
1. **A workflow/rules ENGINE that reacts to events and auto-triggers interventions.** Rejected: that is a second decision/execution engine (violates Constitutions 1, 4) and would automate interventions — explicitly forbidden ("The platform recommends. The operator decides."). Execution always stays with humans; the platform never auto-acts.
2. **Store live risk/policy state on the case (denormalise intelligence onto cases).** Rejected: duplicates runtime state and intelligence (Constitutions 2, 3); the case's copy would drift from the certified value. Cases reference evidence by id and read the live value from the Consumer Platform instead.
3. **Extend the Digital Twin / Domain Intelligence with case objects.** Rejected: cases are not casino runtime facts derived from events; they are human-coordination metadata with their own lifecycle. Putting them in the twin pollutes the one runtime reality with non-event state.
4. **A separate workflow microservice/database.** Rejected: a new platform / parallel surface (architectural drift). The existing edge + Postgres + tenant-RLS pattern already fits, exactly as commercial metadata did in v1.3.
5. **Do nothing.** Rejected: recommendations remain un-actioned; the product cannot move from "identify & explain" to "manage & resolve."

### Decision Rationale
Coordinating human action is orthogonal to the data flow: no event is produced, enriched, analysed, or decided by the workflow layer, so Constitution 1's prohibition on parallel *data* pipelines is not engaged. The layer is provably a consumer + operational-metadata store — the same compliant shape already accepted for connector telemetry (v1.1) and commercial lifecycle (v1.3). Purity of `lib/workflow`, evidence-by-reference (never by copy), an append-only audit trail mirroring event-log immutability, and "no automatic execution" together keep every Constitution satisfied while delivering the operational capability. Should a recorded human outcome ever need to become part of the certified player journey, it must enter through `getEventPlatform().ingest` like any other fact — the workflow layer never writes runtime state or bypasses the Event Platform.

### Consequences
- **Positive:** every recommendation can become an owned, assignable, traceable, auditable case; a unified per-case timeline (Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution) presents honestly with missing stages marked unavailable; regulators get anonymous investigation workspaces; executives get operational SLA/throughput metrics — all with zero change to the certified flow.
- **Negative / accepted costs:** a new operational-metadata surface (4 tables + 1 edge function) to maintain; evidence references can become stale pointers if the referenced object is archived (mitigated: the live value is always re-read from the Consumer Platform, and archival preserves the record). No business logic or runtime state is added.
- **Constitutional impact:** none amended. Establishes the interpretive boundary that human-coordination workflow metadata is outside Constitution 1's "flow", and is additive under §9 (no event/projection/twin/intelligence/policy/contract shape changed).

### Migration Strategy
Additive and reversible. Migration `20260716120000_v15_workflow.sql` creates `workflow_cases`, `workflow_tasks`, `workflow_audit` (append-only trigger), `workflow_notifications`, a case-number sequence, and `sbiq_workflow_operations()` — all tenant-RLS read, service-role write. No existing table, function, or contract is altered. Rollback = drop the four tables + two functions (harmless; nothing else references them). No replay/rebuild needed (no event, projection, or twin change).

### Related Components
`lib/workflow/{types,caseModel,stateMachine,timeline,notifications,operations,index}.ts`; `lib/workflowClient.ts`; `supabase/functions/workflow/index.ts`; migration `20260716120000_v15_workflow.sql`; `app/casino/{cases,compliance-workflow,operations,notifications}/page.tsx`, `app/regulator/cases/page.tsx`; `tests/workflow.test.mjs`; `docs/RELEASE_NOTES_1.5.md`; v1.5.

---

## ADR-006 — National Identity Federation Service & the SB-NAT national identity layer

- **Decision Number:** ADR-006
- **Date:** 2026-07-16
- **Status:** **Accepted** — Architecture Frozen for Version 2.0 (Phase 2.1, 2026-07-16). Implementation (Phase 3) authorised under controlled governance; any future architectural change requires a new ADR.
- **Future Review Date:** 2027-07-16

### Decision
Introduce a **National Identity Federation Service (NIFS)** as a new first-class enterprise capability and a **second, regulator-plane identity layer** — the anonymous national player id **`SB-NAT-<hex>`** — that lets *authorised regulator roles only* determine that several per-operator `SB-PLR` players are the same anonymous individual, **without any operator seeing another operator's data and without any plaintext PII ever entering the platform.** NIFS is **additive**: the certified `SB-PLR` identity, Event Platform, Projection Platform, Digital Twin, Domain Intelligence, Policy Platform, Consumer Platform and operator UI are **unchanged**. Operators contribute only **cryptographically hashed** matching attributes (a new event type flowing through the existing Event Platform); NIFS clusters those hashes into `SB-NAT` identities with an explainable confidence tier (Confirmed / Probable / Possible / Rejected) and a full audit/appeal trail; the national correlation lives in a **regulator-only** projection plus a **National Player Twin** that references (never duplicates) the per-casino twins. Federation remains **denied by default** and is enabled only by explicit per-jurisdiction configuration under regulator authority.

### Context
- The Commercial Pilot certification confirmed the flagship value — *national* cross-operator RG intelligence — is blocked because `SB-PLR` is **per-casino and federation is denied by default** (ADR-001; Constitution §7). The platform aggregates at cohort level but cannot answer "is this same anonymous person active / self-excluded / escalating across operators?".
- **ADR-001 explicitly reserved this path** ("a future federated requirement is an additive new provider selected by configuration — NOT a redesign… guarantees no second identity redesign," gated by "a new ADR"). This is that ADR.
- Constitution §9 requires an ADR for identity-model changes / new runtime objects; §7 ("federation denied by default") and §2 (One Runtime Reality) are explicitly amended/clarified here and in the Constitution update.

### Alternatives Considered
1. **Federate inside the existing `SB-PLR` provider (one id).** Rejected — a single cross-operator id would surface in operator-visible logs/projections, leaking linkage to operators (breaks §6.1). A separate regulator-plane id is required.
2. **Store plaintext PII / reversible tokens centrally.** Rejected — violates Privacy by Design & Evidence Integrity; a breach magnet. NIFS stores **only** non-reversible salted-HMAC hashes.
3. **Operator-to-operator querying / shared searchable directory.** Rejected — any cross-tenant read breaks isolation (must stay 403). Federation is **operator write-only contribution + regulator read-only**.
4. **Deterministic PII→id derivation for `SB-NAT`.** Rejected — anyone with the PII could compute the national id, defeating anonymity. `SB-NAT` is a **minted anonymous cluster id**.
5. **ML probabilistic entity-resolution as the core matcher.** Deferred — unexplainable scores conflict with §8. v2.0 uses **deterministic salted-HMAC exact-match per attribute + configurable weighted combination** → explainable tiers; privacy-preserving fuzzy matching (Bloom/LSH) is a future ADR.
6. **Bypass the Event Platform (side store).** Rejected — violates §1. Hashed attributes enter as a new **event type through the Event Platform**; NIFS is a downstream engine like Domain Intelligence.
7. **Do nothing.** Rejected — the flagship differentiator and the regulator's core RG mandate remain unmet.

### Decision Rationale
A **two-tier identity model** — per-casino `SB-PLR` (unchanged) + regulator-plane `SB-NAT` (new) — is the only design that delivers national correlation while *strengthening* every existing guarantee: operators still see only their tenant (contribute hashes, cannot query); no PII is ever stored (salted HMAC, national pepper unknown to operators); correlation is regulator-only (RLS + verified regulator JWT, ADR-002 matrix); every link is explainable/auditable (§8). It rides the certified flow (hashed-attribute events → Event Platform → federation projection/engine → Regulator Portal), reuses the identity-provider abstraction (ADR-001), policy-as-data (§4) and consumer-contract patterns, and adds a **National Player Twin** that *references* the per-casino twins (so "one runtime object per identity" holds — one national player per `SB-NAT`, one casino player per `SB-PLR`). No certified platform is redesigned; the architecture is extended.

### Consequences
- **Positive:** enables the flagship national RG questions (multi-operator activity, national self-exclusion, escalating harm, prior interventions, national-investigation triggers) with privacy by design; regulator gains explainable, auditable national identity; operators unaffected/unaware of national linkage; fully additive & backward-compatible.
- **Negative / accepted costs:** a new service, event type, regulator-plane projection, national twin, national policy scope and regulator views to build/secure/operate; a national pepper/keyring to manage & rotate (HSM/Secrets Manager); the immutable log now carries salted-hashed attributes (non-reversible, per-tenant, RLS-scoped); entity-resolution edge cases need confidence tiers + manual regulator override + appeal.
- **Constitutional impact:** amends §7 ("federation denied by default" → "denied by default; permitted only via NIFS under regulator authority + per-jurisdiction config"); clarifies §2 (National Player Twin is reference-aggregation, not duplicate runtime); registers NIFS as a governed capability under §1–§6 and §8.

### Migration Strategy
Additive and reversible. `SB-PLR` ids are **never changed**. `SB-NAT` assignment is opt-in per jurisdiction: operators submit hashed attributes for existing players (or a one-time backfill emits hashed-attribute events); NIFS clusters them into `SB-NAT` ids in the regulator-plane projection. No operator-facing contract changes. Rollback = disable the jurisdiction federation flag (NIFS stops resolving; national-identity views degrade to today's aggregate/cohort views); the regulator-plane store can be truncated without touching any certified operator data. Detail in the Migration & Roadmap document.

### Related Components (Phase 3, after approval — NOT built yet)
`lib/identityFederation/*` (hashing/pepper, matcher, confidence, SB-NAT minting, mapping); Event type `IDENTITY_FEDERATION_ATTRIBUTE` (hashed only); regulator-plane `national_identity_map` + `projection_national_identity` + `federation_audit` (RLS regulator-only); National Player Twin; national policy scope; Regulator Portal views (national-player-summary, cross-operator-timeline, national-self-exclusion); `federation` edge function. Governed by `NATIONAL_IDENTITY_FEDERATION_DESIGN.md`, `PRIVACY_IMPACT_ASSESSMENT_v2.md`, `SECURITY_ARCHITECTURE_THREAT_MODEL_v2.md`, `V2_MIGRATION_AND_ROADMAP.md`.

### Phase 2 Architecture Review refinements (Board-mandated, strengthening — not redesign)
1. **`SB-PLR` is the System of Record; `SB-NAT` is a correlation identity only.** `SB-PLR` remains the **canonical operational identity within every casino** and the identity carried by the Event Platform, Projections, Digital Twin, Domain Intelligence, Policy Platform and Consumer Platform. `SB-NAT` **never replaces** any of these; it is a regulator-plane *correlation overlay* that references `SB-PLR`s. If the National Intelligence Plane were removed, every operator system continues functioning unchanged. NIFS **reads** operator identities; it never writes or mutates them.
2. **National Intelligence Plane (new architecture layer).** NIFS, the National Player Twin, Cross-Operator Intelligence, National Behaviour Analytics, the National Self-Exclusion Registry and National Investigation Services are formalised as **one regulator-only plane** that sits *alongside and downstream of* the certified operator flow (fed by hashed-attribute events, reading operator projections by reference). See the Design doc §12–§13 and the Reference Architecture.
3. **Governed decisions only.** Automatic-federation and manual-review thresholds, rejection criteria, override/appeal workflow, audit retention and the review lifecycle are explicitly defined (Design §14) — no implicit identity decisions.
4. **Jurisdiction profiles.** Matching attribute sets, weights and thresholds are **policy-driven per jurisdiction** (Design §15), not globally hardcoded (e.g. ZA = National ID+Phone+Device; NA = Passport+Phone; BW = National ID+Device).
5. **Multi-country sovereignty.** `SB-NAT` is namespaced per sovereign jurisdiction (`SB-NAT-ZA`, `SB-NAT-NA`, `SB-NAT-BW`, `SB-NAT-KE`) with an isolated pepper/registry per country — future sovereign deployments require **no redesign** (Design §16).
6. **National Player Twin lifecycle** (Created → Updated → Re-evaluated → Split/Merged → Retired → Archived) is a governed state machine (Design §13).
7. **Version 2 certification** is gated by `V2_CERTIFICATION_STRATEGY.md` (Architecture, Security, Privacy, Cross-Operator Intelligence, Consumer Platform Regression, Operational Readiness, Regulator Acceptance) before any production jurisdiction.

**Status after Phase 2:** ADR-006 refined and recommended for acceptance (see `V2_FINAL_ARCHITECTURE_REVIEW.md`).

### Phase 2.1 Final Freeze refinements (Accepted — the architecture is now frozen)
1. **Separation of matching from decision.** NIFS decomposes into two components with a strict boundary: an **Identity Matching Engine** (deterministic only: hash comparison, attribute correlation, candidate generation, confidence calculation, rule evaluation, evidence generation — it **produces candidate matches and never accepts/rejects an identity**) and a **Federation Decision Engine** (the enterprise governance component: applies federation policies, auto-approval & manual-review thresholds, regulator approval workflow, appeals, override management, explainability, audit generation, decision history, version tracking — **every** federation decision passes through it; no direct matching decisions). Chain: Identity Resolution → NIFS → Identity Matching Engine → Federation Decision Engine → SB-NAT Registry → Enterprise Correlation Layer (formerly "National Intelligence Plane") → [reads] Event/Projection/Twin/Intelligence/Policy/Consumer/UI.
2. **Federation versioning (immutable).** Every `SB-NAT` permanently records **Federation Algorithm Version · Matching Policy Version · Jurisdiction Version · Decision Engine Version · Rule Set Version** (e.g. `SB-NAT-ZA-000238` created under Federation Algorithm v2.0 / Decision Engine v2.0 / Policy 1.4 / Jurisdiction ZA-2027 / Rule Set RG-01). Immutable for audit; a decision is reproducible years later.
3. **`SB-NAT` is an *Enterprise Correlation Identity*** (not a "Regulator Identity"). It is **NOT** a customer, operator, casino, system-of-record, or runtime identity. It exists solely for Cross-Operator Intelligence, National Responsible Gambling, Regulatory Oversight, National Behaviour Analytics, and National Investigations.
4. **The National Intelligence Plane is the *Enterprise Correlation Layer*** — **read-only**: correlation, aggregation, federation, national intelligence, regulator analytics. Operational platforms continue to own all runtime behaviour; the layer never modifies operational systems.
5. **Audit architecture (expanded, immutable):** every federation decision records Evidence Used · Evidence Ignored · Matching Rules · Decision Rule · Confidence Score · Decision Engine Version · Federation Algorithm Version · Policy Version · Jurisdiction Version · Reviewer · Timestamp · Override History · Appeal History — fully reproducible.
6. **Constitutional guarantees (§12, Accepted):** SB-PLR operational; SB-NAT correlation-only; operators never query federation / never access another tenant; federation regulator-only; runtime architecture unchanged; event sourcing authoritative; Evidence Integrity preserved; Privacy by Design mandatory.
7. **Implementation governance:** every Phase-3 change references ADR-006; every PR references its affected architectural section, certification requirement, and implementation milestone; no implementation outside the approved architecture.
8. **Certification mapping** (see `V2_CERTIFICATION_STRATEGY.md` §Component Mapping): Matching Engine → Architecture/Security/Privacy; Decision Engine → Explainability/Audit/Regulator Acceptance; SB-NAT Registry → Security/Operational Readiness; Enterprise Correlation Layer → Cross-Operator Intelligence/Consumer Regression.

**Architecture Frozen — Version 2.0 Approved for Controlled Implementation.** The §7/§2 Constitution amendment is **Accepted** concurrently (Constitution §12). Freeze report: `V2_ARCHITECTURE_FREEZE_REPORT.md`.
