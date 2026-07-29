# SafeBet IQ — API Reference (Version 1.0)

Authoritative reference for the **implemented** Version 1.0 interfaces. Consistent with `docs/ENTERPRISE_REFERENCE_ARCHITECTURE.md`. Only implemented endpoints are documented; no future endpoints are invented.

Capability tags: **[Implemented]** certified in v1.0 · **[Phase 5]** approved future · **[Out-of-flow]** outside the certified enterprise flow.

Base URL (edge functions): `https://<project-ref>.supabase.co/functions/v1`

---

## 1. Authentication

All enterprise endpoints require a **Supabase-verified JWT** and the project `apikey`.

**Obtain a token** (Supabase Auth, email/password):
```
POST https://<project-ref>.supabase.co/auth/v1/token?grant_type=password
apikey: <anon-or-publishable-key>
Content-Type: application/json

{ "email": "user@operator.com", "password": "•••" }
→ 200 { "access_token": "<JWT>", "expires_in": 3600, ... }
```

**Request headers (all enterprise endpoints):**
| Header | Required | Notes |
|---|---|---|
| `Authorization: Bearer <JWT>` | yes | verified server-side; identity is derived from it |
| `apikey: <anon/publishable key>` | yes | project key |
| `Content-Type: application/json` | for POST bodies | |

**Authorization model.** Consumer profile (operator/regulator/executive/compliance/administrator/api-client), casino scope, and jurisdiction are derived **server-side** from the verified JWT + the `users`/`casinos` registries. Query parameters may select a view or request a casino **within** the caller's entitlement — they never assert identity (ADR-002). The service-role key authenticates internal jobs/schedulers only.

---

## 2. Consumer Gateway — presentation [Implemented]

THE presentation gateway. One endpoint serves every consumer; the granted views depend on the caller's profile.

```
GET /consumer-gateway?view=<view>&casino_id=<uuid>[&version=v1]
Authorization: Bearer <JWT>   apikey: <key>
```

| Parameter | Required | Values |
|---|---|---|
| `view` | yes | `live-floor` · `activity-feed` · `compliance` · `summary` · `actions` |
| `casino_id` | yes* | must be within the caller's scope; operators are pinned to their own casino (*defaults to the caller's casino if omitted) |
| `version` | no | contract version; default `v1` |

**View → profile grants:** casino-operator → live-floor/activity-feed/summary · regulator → compliance · executive → summary · compliance-officer → compliance/actions · administrator → all · api-client → activity-feed/summary.

**Response envelope:**
```json
{
  "success": true,
  "contractVersion": "v1",
  "consumer": "casino-operator",
  "view": "live-floor",
  "casinoId": "<uuid>",
  "generatedAt": "2026-07-13T18:00:00.000Z",
  "data": { /* view-specific contract */ }
}
```

**`data` shapes (v1):**
- `live-floor` → `{ kpi, machines[], players[], interventions[], floors[] }`
- `activity-feed` → `{ events[] }` (recent event log rows, shaped)
- `compliance` → `{ riskTiers, activePlayers, playersRequiringMonitoring[], regulatoryDecisions[], auditEvidence }`
- `summary` → `{ kpi, floors[], headlineDecisions[], operationalHealth }`
- `actions` → `{ outstanding[], alerts[], executionRequired[] }`

**Evidence classification** (Constitution §8): recorded facts (KPIs, wagered, intervention counts), derived intelligence (GRPI/escalation/trigger type — labelled), policy decisions (with `policyReference`). `InterventionView` reports delivery as `channel:"unrecorded"`, `status:"recorded"` — never fabricated.

**Response codes:** `200` ok · `400` unknown view / unsupported version · `401` missing/invalid/anon/tampered token · `403` view not granted / cross-casino / cross-jurisdiction · `404` unknown casino · `500` internal.

---

## 3. Identity Resolution [Implemented]

Resolve casino player reference(s) to the anonymous 96-bit SafeBet Player ID. The raw reference is hashed in-process and never stored, logged, or echoed.

```
POST /identity-resolution
Authorization: Bearer <JWT>   apikey: <key>   Content-Type: application/json

{ "casino_id": "<uuid>", "casino_player_ref": "loyalty-1234" }
→ 200 { "safebet_player_id": "SB-PLR-707371C39AE04D71BBA3E495" }

{ "casino_id": "<uuid>", "casino_player_refs": ["ref-a","ref-b"] }   // batch ≤ 200
→ 200 { "safebet_player_ids": ["SB-PLR-…","SB-PLR-…"] }
```
**Codes:** `200` · `400` casino_id/refs missing, non-string refs, or batch > 200 · `405` non-POST · `500`.
**Determinism:** the same `(casino_id, ref)` always yields the same id; per-casino; anonymous.

---

## 4. Event schema — the enterprise event contract [Implemented]

Casino events enter the platform as **`CasinoEventDraft`** objects through an Event Platform producer (the certified producer in v1.0 is the `casino-simulator`; an external HTTP ingestion endpoint for third-party casinos is **[Phase 5]** — see the Casino Integration Guide). The draft contract, validation, idempotency, and ordering below are fully implemented.

**Draft fields:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `eventType` | string | yes | must be in the event vocabulary (§4.1) |
| `occurredAt` | ISO-8601 string | yes | not more than 5 min in the future |
| `safeBetPlayerId` | string | one of these two | a canonical `SB-PLR-…` id (already resolved) |
| `casinoPlayerRef` | string | one of these two | raw casino ref (resolved to SB-PLR during enrichment) |
| `sessionId` | string \| null | no | session journey id |
| `machineId` | string \| null | no | machine/position id |
| `correlationId` | string | no | defaults to `sessionId` |
| `idempotencyKey` | string | no | supply a stable value for safe retries; defaults to the event id |
| `payload` | object | no | plain object (e.g. `bet_amount`, `win_amount`, `risk_score`, `game_type`, `metadata`) |

**Enriched envelope (18 immutable fields, produced by the platform):** `eventId, correlationId, traceId, tenantId, casinoId, jurisdiction, safeBetPlayerId, sessionId, machineId, producer, schemaVersion, eventType, occurredAt, receivedAt, processedAt, replayNumber, idempotencyKey, payload`. Envelopes are frozen and immutable.

### 4.1 Event vocabulary [Implemented]
`BET_PLACED, BET_RESULT, SESSION_START, SESSION_END, GAME_SPIN, HAND_PLAYED, DEPOSIT, WITHDRAWAL, TIME_SPENT_UPDATE, MACHINE_ACTIVITY, RISK_FLAG, CARD_INSERT, MACHINE_ALLOCATED, CASH_OUT, CARD_REMOVED, MACHINE_IDLE, RISK_ALERT, INTERVENTION_TRIGGERED, JACKPOT, MACHINE_FAULT, VIP_ACTIVITY, SELF_EXCLUSION, SECURITY_EVENT`.

### 4.2 Validation rules [Implemented] (reject, never repair)
- `eventType` must be in the vocabulary; `occurredAt` a valid ISO-8601 timestamp not beyond 5-minute future skew; `casinoId` a UUID; identity present (`safeBetPlayerId` **or** `casinoPlayerRef`); a supplied `safeBetPlayerId` must be a canonical SB-PLR id; `payload` (if present) a plain object. Invalid drafts are rejected with the full list of violations (`EventValidationError`).

### 4.3 Idempotency & retry [Implemented]
Supply a stable `idempotencyKey`. The store enforces `UNIQUE(casino_id, dedupe_key, occurred_at)`; a retried event is not re-appended and not re-projected (at-least-once delivery → exactly-once processing). Safe to retry on timeout/5xx.

### 4.4 Event ordering [Implemented]
Reduction is order-independent within a batch (sorted by `occurredAt`); the final projected state is identical regardless of arrival order. Preserve `occurredAt` accuracy for correct ordering.

---

## 5. Operations API — `platform-ops` [Implemented, admin/service-role only]
```
POST /platform-ops?action=policy-seed
POST /platform-ops?action=policy-activate&version=<n>&reason=<text>
GET  /platform-ops?action=policy-list
POST /platform-ops?action=ensure-partitions[&months=2]
POST /platform-ops?action=validate-projections&casino_id=<uuid>
GET  /platform-ops?action=monitor[&casino_id=<uuid>]
```
`monitor` → `{ operating_mode, thresholds, casinos:[{casino_id, severity, alerts[], health}], platform_severity }`. Non-admin → `403`; unauthenticated → `401`.

## 6. Operations API — projections & twin [Implemented, admin/service-role only]
```
POST /projection-platform?action=rebuild&casino_id=<uuid>   // deterministic replay/rebuild
GET  /projection-platform?action=status&casino_id=<uuid>
GET  /digital-twin?action=snapshot|health|intelligence|decisions&casino_id=<uuid>[&jurisdiction=ZA]
```
Ops surfaces; consumers use the gateway. Non-admin → `403`.

## 6a. Connector ingestion — `connector-ingest` [Implemented, v1.1]
The certified producer endpoint for casino connectors. Translates external records into `CasinoEventDraft`s (via a connector profile) and submits them through the ONE Event Platform. Introduces no parallel pipeline and no business logic.
```
POST /connector-ingest
Authorization: Bearer <JWT>   apikey: <key>   Content-Type: application/json
{ "casino_id":"<uuid>",
  "connector_type":"slot-management",           // a built-in profile, OR:
  "config": <MappingConfig override>,           // optional full mapping override
  "records":[ { …external record… }, … ] }      // ≤ 500 records
→ 200 { "success":true, "connectorType","connectorName","received","translated",
        "rejected","submitted","failed","diagnostics":[…], "startedAt","finishedAt" }
```
**Auth/scope:** verified principal whose scope includes the casino (operators pinned to their own casino → `403` otherwise; anon → `401`). **Built-in `connector_type`s:** `loyalty · slot-management · table-management · casino-management · cash-desk · rg-system · generic-api · batch-file`. **Data quality:** `diagnostics[]` carry `severity/code/field/message/hint` (`MISSING_IDENTITY`, `TIMESTAMP_ANOMALY`, `UNMAPPED_EVENT_TYPE`, `UNKNOWN_MACHINE`, …); fatal (`error`) records are rejected pre-flight; the Event Platform remains the authoritative validator. **Identity:** send the raw loyalty/account key as the profile's `playerRef` — it is resolved to an anonymous SB-PLR id and never stored raw. **Idempotency:** map a stable per-event id to the profile's `idempotencyKeyField`; retries de-duplicate.

## 6b. Integration Health — Consumer Gateway view [Implemented, v1.1]
```
GET /consumer-gateway?view=integration&casino_id=<uuid>   (operator/administrator)
→ data: { runs, received, submitted, rejected, failed, lastRunAt,
          connectors:[{ connectorType, connectorName, submitted, rejected, failed, lastRunAt }],
          recentDiagnostics:[{ connectorName, finishedAt, diagnostics[] }] }
```
Served by the existing Consumer Platform (no parallel management app).

## 6c. Regulator Intelligence Portal — `regulator-portal` [Implemented, v1.2]
The regulator's consumer surface. Composes anonymous read-model rollups + policy decisions through the Consumer Platform (`serveRegulator`) — recalculating nothing, exposing no PII. **Jurisdiction is derived from the verified regulator JWT** (never a caller claim); a regulator sees only their jurisdiction's operators.
```
GET /regulator-portal?view=<view>[&kind=<report-kind>][&player_id=SB-PLR-…&casino_id=<uuid>]
Authorization: Bearer <regulator JWT>   apikey: <key>
```
| view | Returns |
|---|---|
| `national-overview` | operators, anonymous active players, risk tiers, monitored, interventions, operator health, emerging risks |
| `cross-operator` | aggregate per-operator risk distribution + intervention rates (per-player linkage is `not-available-by-design`) |
| `operator-compliance` | per-operator compliance status (from projected tiers/monitoring) |
| `regulatory-report` (+`kind`) | export-ready report; kinds: `responsible-gambling · operator-compliance · intervention-statistics · cross-operator · national-trend · policy-effectiveness · regulatory-risk` |
| `investigation` (+`player_id`,`casino_id`) | anonymous player timeline (recorded fact) + intelligence (derived) + policy decisions + replay reference |
| `evidence-package` (+`player_id`,`casino_id`) | classified evidence package with attestation |
Every value carries an `evidence`/`evidenceClass` field (Recorded Fact / Derived Intelligence / Policy Decision / Demonstration Data). **Codes:** `200` · `401` unauthenticated · `403` non-regulator or casino outside jurisdiction · `400` unknown/ungranted view.

## 6d. Explainable Intelligence — Consumer Gateway views [Implemented, v1.4]
Explains the **existing** Domain Intelligence output through the Consumer Platform — the same gateway, no new API and no new engine. Nothing is recalculated: every field is composed from `intelligenceOf(object)` plus projected recorded facts and Policy Platform decisions, and carries an evidence classification (Recorded Fact / Derived Intelligence / Policy Decision). *The platform recommends; the operator decides — interventions are never executed automatically.*
```
GET /consumer-gateway?view=explanation&casino_id=<uuid>&player_id=SB-PLR-…   (operator/compliance/regulator/admin)
GET /consumer-gateway?view=ai-performance&casino_id=<uuid>                    (operator/executive/admin)
GET /consumer-gateway?view=executive-intelligence&casino_id=<uuid>           (operator/executive/admin)
Authorization: Bearer <JWT>   apikey: <key>
```
| view | Returns |
|---|---|
| `explanation` | `summary{headline,riskLevel,dynamicRiskScore,confidence,trend}` (derived) · `contributingIndicators{behavioural,session,machine}` (derived, plain-language) · `triggerSequence` · `supportingEvidence` (recorded fact) · `decisionTimeline` (Recorded Fact → Derived Intelligence → Policy Decision → Recommended Intervention → Recorded Outcome) · `recommendation{action,reason,confidence,expectedBenefit,historicalEffectiveness,note}` · `source:"domain-intelligence"` |
| `ai-performance` | evaluation dashboard: `riskDistribution` · `interventions{recorded,playersMonitored}` · `confidenceCalibration{averageConfidence,sampleSize}` · `predictionTrend`. Composes existing outputs — **no model training, no recalculation** |
| `executive-intelligence` | `strategicRisks` (derived) · `wellbeingIndicators` · `operationalPerformance` · `emergingTrends`, composed from certified twin aggregates |
Only present, honest values appear — timeline stages with no recorded data are omitted rather than fabricated. **Codes:** `200` · `401` unauthenticated · `403` ungranted view/role · `400` missing `player_id` (explanation) or `casino_id`.

## 6e. Enterprise Workflow & Case Management — `workflow` [Implemented, v1.5, ADR-005]
Operational ORCHESTRATION of human actions over the certified flow. Manages cases, tasks, an **append-only** audit trail and notifications — all operational metadata (like `connector_runs`). It **references** platform evidence (Recorded Fact / Derived Intelligence / Policy Decision / Explainable Intelligence) by identifier; it **never** recalculates intelligence, re-derives policy, creates runtime state, bypasses the Event Platform, or auto-executes interventions (*the platform recommends; the operator decides*). Authorization is the verified principal (ADR-002); every mutation writes an immutable audit entry. Anonymous throughout (SB-PLR ids only, never PII).
```
GET  /workflow?action=cases&casino_id=<uuid>[&status=&type=&assignee=]   (scoped list + attention flags)
GET  /workflow?action=case&id=<uuid>                                     (case + tasks + audit + unified timeline)
GET  /workflow?action=operations[&casino_id=&jurisdiction=]              (executive ops rollup)
GET  /workflow?action=notifications[&casino_id=]                         (recipient's notifications)
POST /workflow?action=create-case   {casino_id, case_type, title, priority?, subject_ref?, evidence_refs?, assigned_to?, escalation_level?}
POST /workflow?action=transition    {id, to_status, note?, resolution?}   POST ?action=review {id, decision:'accept'|'reject', note?}
POST /workflow?action=record-action {id, action}   POST ?action=record-outcome {id, outcome}   POST ?action=assign {id, assigned_to}
POST /workflow?action=add-task {id, description, task_type?, evidence_ref?}   POST ?action=complete-task {task_id, note?}
POST /workflow?action=note {id, note}   POST ?action=mark-read {notification_id}
Authorization: Bearer <JWT>   apikey: <key>
```
**Case lifecycle** (strict state machine; illegal transitions → `409`): `open → in-review → accepted/rejected → action-recorded → outcome-recorded → resolved → closed`. **Unified timeline:** Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution — stages with no data are returned `available:false` (never fabricated). **Codes:** `200` · `401` unauthenticated · `403` cross-tenant / outside jurisdiction · `404` unknown casino/case · `409` illegal transition · `400` bad request.

## 7. Producer API — `casino-simulator` [Implemented, demonstration producer]
```
POST /casino-simulator?action=burst&casino_id=<uuid>&count=<n≤100>   // verified principal, casino in scope
POST /casino-simulator?action=tick                                    // admin only
GET  /casino-simulator?action=stats
```
The certified demonstration producer. Requires a verified principal whose scope includes the casino. External third-party casino ingestion is **[Phase 5]**.

---

## 8. Rate limiting
No enterprise-endpoint rate limiting is enforced at the platform layer in v1.0 (managed edge/CDN limits apply). Producer bursts are capped at `count ≤ 100`; identity batches at `≤ 200`. Application-level rate limiting is **[Phase 5 / infrastructure]**.

## 9. Response codes (summary)
`200` ok · `400` bad request/validation · `401` unauthenticated (missing/invalid/anon/tampered) · `403` unauthorized (scope/view/role) · `404` unknown casino · `405` method · `500` internal. Error bodies: `{ "error": "<message>" }`; validation errors list all violations.

## 10. Security considerations
Verified JWT only; identity/scope/jurisdiction server-derived; tenant isolation enforced at DB (RLS) and edge; anonymous SB-PLR ids (no PII in requests/responses/logs); event store append-only; ops/producer surfaces admin/scope-gated. Never send raw PII in `payload`.

## 11. Versioning strategy
Presentation contracts are explicitly versioned (`version=v1`); unknown versions are rejected. Breaking changes mint a new version while `v1` keeps serving. The event envelope is `schemaVersion`-stamped; changes go through an ADR. GraphQL over the same contracts is **[Phase 5]**.

## 12. Examples
**Operator live floor:**
```
GET /consumer-gateway?view=live-floor&casino_id=a1b2… → 200
{ "success": true, "contractVersion": "v1", "consumer": "casino-operator",
  "view": "live-floor", "data": { "kpi": {...}, "machines": [...], "players": [...],
  "interventions": [...], "floors": [...] } }
```
**Regulator compliance:** `GET /consumer-gateway?view=compliance&casino_id=…` (regulator JWT) → risk tiers, monitoring cohort, regulatory decisions, audit evidence.
**Cross-casino attempt (operator):** `GET /consumer-gateway?view=live-floor&casino_id=<other>` → `403`.
