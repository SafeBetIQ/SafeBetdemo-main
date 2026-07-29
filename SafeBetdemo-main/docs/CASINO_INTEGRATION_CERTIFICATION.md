# SafeBet IQ — Casino Integration Certification (v1.1)

A casino can **self-certify** its connector integration before production using this process. Consistent with `CASINO_INTEGRATION_GUIDE.md`, `API_REFERENCE.md`, and the Six Constitutions. All events must enter through the certified enterprise flow via `connector-ingest`.

---

## 1. Minimum requirements
- Casino registered with a `jurisdiction` (and `province`); operator accounts bound to the casino.
- A verified operator JWT (Supabase Auth); egress to `connector-ingest` over HTTPS.
- Stable, opaque, non-PII player references (loyalty/account keys).
- A connector profile (built-in `connector_type` or a validated `MappingConfig` override).

## 2. Supported event sequence
A meaningful player journey (built-in profiles map to these):
`CARD_INSERT → MACHINE_ALLOCATED → SESSION_START → BET_PLACED(×n) → SESSION_END → CARD_REMOVED → MACHINE_IDLE`.
High-value optional events: `JACKPOT, CASH_OUT, DEPOSIT, WITHDRAWAL, RISK_ALERT, INTERVENTION_TRIGGERED, VIP_ACTIVITY, SELF_EXCLUSION, MACHINE_FAULT, SECURITY_EVENT`. Full vocabulary: `API_REFERENCE.md` §4.1.

## 3. Required fields (per record, after mapping)
- Identity: `playerRef` (or an already-resolved `safeBetPlayerId`).
- `occurredAt`: ISO-8601 (with offset), epoch seconds/millis, or naive + `offsetMinutes`.
- Event classification: a mapped source type (`eventTypeMap`) or `defaultEventType`.

## 4. Optional fields
`sessionId`, `machineId`/`tableId` (with `machinePrefix`), `payload` values (`bet_amount`, `win_amount`, `game_type`, `balance_after`, …), `metadata` (`machine_type`, `casino_floor_location`), `idempotencyKeyField`.

## 5. Performance expectations
- ≤ 500 records per `connector-ingest` request (batch larger feeds into multiple calls).
- Idempotency keys required for at-least-once safety; retries de-duplicate.
- Accurate `occurredAt` (ordering is by event time; >5-min future skew is rejected by the Event Platform).

## 6. Acceptance tests (self-certification)
Run against the demonstration environment with your operator JWT:
- [ ] **Config validity:** your `MappingConfig` passes `validateMappingConfig` (or use a built-in profile).
- [ ] **Translation:** a representative record produces a valid `CasinoEventDraft` (submitted, 0 diagnostics).
- [ ] **Identity privacy:** after ingest, your raw player reference does NOT appear in any event/response (verify anonymised SB-PLR id).
- [ ] **Data quality:** a deliberately bad record (missing identity / bad timestamp) is rejected with an actionable diagnostic — not silently accepted.
- [ ] **Idempotency:** re-sending the same record (same idempotency key + `occurredAt`) does not create a duplicate event.
- [ ] **Journey:** a full session sequence appears in `consumer-gateway?view=live-floor`.
- [ ] **Isolation:** `connector-ingest` to another casino returns `403`; unauthenticated returns `401`.
- [ ] **Health:** the run appears in `consumer-gateway?view=integration` with correct counts.

## 7. Go-live checklist
- [ ] All §6 acceptance tests pass.
- [ ] Operating mode set (`staging` → `production`).
- [ ] Source system points at `connector-ingest` with retries + idempotency keys.
- [ ] Integration Health monitored; platform alerts reviewed (`OPERATIONS_MANUAL.md`).
- [ ] Production deployment executed per `DEPLOYMENT_RUNBOOK.md` (owner-executed).

**Certification statement.** A casino that passes §6 on the demonstration environment and completes §7 is certified to connect via the Connector Framework, with every event entering the certified enterprise flow, anonymous identity preserved, and no architectural change to SafeBet IQ.
