# SafeBet IQ — Casino Operator Integration Guide (Version 1.0)

For casino operators, systems integrators, and enterprise technical teams integrating with the certified SafeBet IQ enterprise flow. Consistent with `docs/ENTERPRISE_REFERENCE_ARCHITECTURE.md` and `docs/API_REFERENCE.md`.

Capability tags: **[Implemented]** certified v1.0 · **[Phase 5]** approved future · **[Out-of-flow]** outside the certified flow.

---

## 1. Purpose
Enable a casino to feed its live floor activity into SafeBet IQ and consume real-time operational, wellbeing, and executive intelligence — through ONE enterprise event flow, with audit-grade evidence and responsible-gambling protection.

## 2. Architecture overview
Your casino emits events (card/session/bet/machine lifecycle) → SafeBet IQ resolves an anonymous player identity, validates, and persists each event immutably → projects runtime state → assembles a live Digital Twin → enriches it with intelligence → evaluates policy → serves your dashboards through the Consumer Gateway. You send events; you read shaped views. You never operate the internal platforms. (Full flow: `ENTERPRISE_REFERENCE_ARCHITECTURE.md` §2–4.)

## 3. Supported deployment models
- **[Implemented] Managed (Supabase-hosted) demonstration/pilot:** SafeBet IQ runs as managed edge functions + PostgreSQL; you integrate over HTTPS.
- **[Implemented] Producer-embedded:** a producer component submits `CasinoEventDraft`s through the Event Platform (the certified reference producer is the `casino-simulator`).
- **[Implemented, v1.1] Connector Framework + `connector-ingest` endpoint** — the first-class Event Platform producer for third-party casino systems. A connector is a declarative mapping profile (loyalty, slot/table/casino management, cash desk, RG system, generic API, batch file) that translates your records into the certified `CasinoEventDraft` contract and submits them through the ONE Event Platform. Integration is configuration, not code. See §3a and `API_REFERENCE.md` §6a.
- **[Phase 5]** Streaming/push transports and additional vendor-specific profiles.

### 3a. Connector Framework (v1.1) [Implemented]
1. **Choose a profile** (`connector_type`) matching your source, or supply a full `MappingConfig` override.
2. **Map your field names** onto the profile: `fields.playerRef` (loyalty/account key — non-PII), `fields.machineId`/`tableId`, `fields.sessionId`, `fields.occurredAt` (ISO-8601, epoch seconds/millis, or naive + `offsetMinutes`), and event classification (`fields.eventType` + `eventTypeMap`, or `defaultEventType`); map value fields via `payload`/`metadata`; set `idempotencyKeyField`.
3. **POST to `connector-ingest`** with your records. The framework translates (adapter only — no business logic), submits through the Event Platform (identity resolved once, validated authoritatively, de-duplicated), and returns a run summary + actionable diagnostics.
4. **Monitor** via the Integration Health dashboard (`/casino/integration`) and the onboarding wizard (`/casino/integration/onboarding`).
Compliance guarantees (live-verified): connector events enter the certified event log with anonymous 96-bit identity; the raw casino reference never reaches the store; replay stays deterministic; no duplicate runtime state; the Event Platform remains the single ingestion path.

## 4. Integration prerequisites
- A registered casino (`casinos` row) with `id`, `jurisdiction` (e.g. `ZA`), and `province`.
- Operator user accounts (`users`, role `casino_admin`/`staff`) bound to your `casino_id`.
- Network egress to the SafeBet IQ project over HTTPS.
- A mapping of your player references to be resolved to anonymous SB-PLR ids.

## 5. Authentication [Implemented]
Supabase Auth (email/password → JWT). Send `Authorization: Bearer <JWT>` + `apikey` on every call. Your profile, casino scope, and jurisdiction are derived server-side; you cannot read another casino's data (enforced at DB and edge). See `API_REFERENCE.md` §1.

## 6. Identity mapping [Implemented]
SafeBet IQ never stores player PII. Resolve your player reference to an anonymous 96-bit SB-PLR id:
```
POST /identity-resolution { "casino_id":"<uuid>", "casino_player_ref":"loyalty-1234" }
→ { "safebet_player_id":"SB-PLR-707371C39AE04D71BBA3E495" }
```
Deterministic and per-casino: the same reference always yields the same id; the raw reference is hashed in-process and never stored or echoed. You may either resolve ahead of time and send `safeBetPlayerId`, or send `casinoPlayerRef` on the event and let enrichment resolve it.

### 6.1 Casino player reference requirements
- A **stable, unique-per-casino** string identifying the patron (loyalty id, card id, account id). Stability is essential — the same reference must always mean the same person, or their history/risk will not accumulate correctly.
- References must be non-empty strings; batches ≤ 200 per identity call.
- Do **not** use PII (name/email/phone) as the reference; use an opaque loyalty/account key.

### 6.2 Loyalty system integration
Map your loyalty/CRM member id → `casino_player_ref`. Resolve once at enrolment (or lazily on first event) and cache the SB-PLR id. VIP status is carried as event `payload.metadata` (`VIP_ACTIVITY` events), not as identity.

## 7. Machine & table integration [Implemented]
- **Machines:** emit lifecycle events with `machineId` and `payload.metadata.machine_type` and `casino_floor_location` (zone) — the platform materialises floor location for occupancy/utilisation intelligence.
- **Table games:** model as sessions on a table `machineId` (e.g. `M-040`) with `game_type` in the payload; bets are `BET_PLACED`/`HAND_PLAYED`.

## 8. Required & optional events
**Required for a meaningful session journey [Implemented]:**
`CARD_INSERT` → `MACHINE_ALLOCATED` → `SESSION_START` → `BET_PLACED`(×n) → `SESSION_END` → `CARD_REMOVED` → `MACHINE_IDLE`.
**High-value optional events:** `JACKPOT`, `CASH_OUT`, `DEPOSIT`, `WITHDRAWAL`, `RISK_ALERT`, `INTERVENTION_TRIGGERED`, `VIP_ACTIVITY`, `SELF_EXCLUSION`, `MACHINE_FAULT`, `SECURITY_EVENT`. Full vocabulary: `API_REFERENCE.md` §4.1.

**Event example (bet):**
```json
{ "eventType":"BET_PLACED", "occurredAt":"2026-07-13T18:00:00Z",
  "casinoPlayerRef":"loyalty-1234", "sessionId":"sess-88", "machineId":"M-001",
  "idempotencyKey":"bet-88-000123",
  "payload":{ "bet_amount":50, "win_amount":0, "game_type":"slots",
              "metadata":{ "machine_type":"slot", "casino_floor_location":"Zone A – Slots" } } }
```

## 9. Idempotency [Implemented]
Supply a stable `idempotencyKey` per logical event (e.g. `bet-<session>-<seq>`). Retries reusing the key are de-duplicated — stored once, projected once. This makes at-least-once delivery safe.

## 10. Retry behaviour [Implemented]
On timeout or `5xx`, retry with the **same** `idempotencyKey` (exponential backoff recommended). Retries never double-count. Do **not** change `occurredAt` on retry (it is part of the dedupe key).

## 11. Event ordering [Implemented]
Send `occurredAt` accurately; the platform orders by it and produces the same projected state regardless of arrival order. You do not need to guarantee transport order.

## 12. Validation [Implemented]
Events are validated and **rejected, never repaired**. Ensure: valid `eventType`; ISO-8601 `occurredAt` within 5-min future skew; identity present (`safeBetPlayerId` or `casinoPlayerRef`); `payload` a plain object. Rejections return the full violation list.

## 13. Error handling [Implemented]
| Code | Meaning | Action |
|---|---|---|
| 400 | validation / bad request | fix the event; do not retry unchanged |
| 401 | unauthenticated | refresh JWT |
| 403 | out of scope / not granted | check casino binding & role |
| 5xx | transient | retry with same idempotency key |

## 14. Testing
- **Sandbox:** integrate against the demonstration environment (`demonstration` mode).
- **Identity determinism:** resolve a reference twice → identical SB-PLR id.
- **Idempotency:** submit an event, then resubmit with the same key → single store row, unchanged projection.
- **Journey:** run a full CARD_INSERT→…→MACHINE_IDLE sequence → verify it appears in `consumer-gateway?view=live-floor`.
- **Isolation:** attempt to read another casino → expect `403`.

## 15. Certification checklist (operator)
- [ ] Casino registered with correct `jurisdiction`/`province`.
- [ ] Operator accounts bound to `casino_id`; login yields a JWT.
- [ ] Player references stable, opaque, non-PII; identity resolves deterministically.
- [ ] Required session-journey events emitted with accurate `occurredAt`.
- [ ] `idempotencyKey` present and stable across retries.
- [ ] Machine/table events carry `machine_type` + `casino_floor_location`.
- [ ] Live floor, KPIs, wellbeing, and executive views render from the gateway.
- [ ] Cross-casino access refused (`403`).
- [ ] Evidence integrity understood (recorded vs derived vs decision vs demo).

## 16. Pilot deployment
1. Onboard the casino (registry + users + jurisdiction). 2. Integrate identity resolution. 3. Emit the session-journey events for a subset of machines. 4. Validate the live floor and wellbeing/executive views. 5. Confirm isolation and idempotency. 6. Run in `demonstration` mode; review monitoring/alerts with the SafeBet operations team.

## 17. Go-live checklist
- [ ] Operating mode set appropriately (`staging` → `production`).
- [ ] All certification-checklist items passed.
- [ ] Producer retries + idempotency verified under load.
- [ ] Monitoring/alert thresholds reviewed for production.
- [ ] Operations runbook (`OPERATIONS_MANUAL.md`) shared with your ops team.
- [ ] Deployment executed per `DEPLOYMENT_RUNBOOK.md` (owner-executed).

## 18. Support process
- **Operational issues:** consult `OPERATIONS_MANUAL.md` (alert catalogue, incident response, escalation).
- **Integration issues:** verify against §12–13 (validation/errors) and the API reference.
- **Escalation:** warning → operator; critical (persistent lag/drift, ingestion stall) → SafeBet on-call SRE → platform owner.

---
*Out-of-flow note: the `safeplay-connect` onboarding surface and `wellbeing-games` product are **[Out-of-flow]** — not part of the certified enterprise flow in v1.0. Their integration into the flow is **[Phase 5]**.*
