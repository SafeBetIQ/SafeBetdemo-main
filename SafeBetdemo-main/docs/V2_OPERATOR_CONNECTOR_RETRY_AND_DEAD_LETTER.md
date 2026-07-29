# Operator Connector Retry & Dead-Letter (Milestone 4.4)

**ADR-006 (frozen) · No raw source payload stored · Bounded, idempotent retries.**

## 1. Rate limiting
`maxBatch` records per sync; `maxPerWindow` submissions within `windowMs`. Exceeding the window stops the
sync (`rateLimited`) without dropping records (checkpoint preserved). Configurable per connector.

## 2. Backpressure (circuit)
When the Event Platform/persistence is transiently unavailable, submissions dead-letter. After a threshold
of open dead-letters the connector **opens the circuit**, transitions to `degraded`, **stops consuming**,
and **preserves the checkpoint**. On recovery the circuit closes and the connector returns to `active`.

## 3. Retry
Only **transient** failures are retried (temporary Event Platform / persistence / secret-store / network
unavailability). Retries are **bounded** (`retryPolicy.maxRetries`), **audited** (`retry-scheduled` /
`dead-letter-created`), and **idempotent** (a successful retry resolves the dead-letter). **Permanent**
failures (plaintext PII, invalid tenant, wrong jurisdiction, invalid SB-PLR, unsupported attribute, invalid
digest, revoked pepper, unauthorised connector) are **never** retried.

## 4. Dead-letter record (safe)
connectorId · operator · tenant · jurisdiction · sourceRef · eventId · failureCategory · attempts ·
lastAttemptAt · errorCode · resolution (`open`/`resolved`/`exhausted`). **No raw operator source record or
payload.**

## 5. Validation
Tested: transient fault dead-letters + opens circuit (backpressure); checkpoint preserved; recovery resumes
and accepts; retry bound respected; dead-letter carries no PII.

## 6. Deployment binding
Managed DLQ + retry orchestration + monitoring = Phase 4.7; the pilot implements the model + safe records.
