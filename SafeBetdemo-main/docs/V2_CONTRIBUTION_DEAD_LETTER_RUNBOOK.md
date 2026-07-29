# Contribution Dead-Letter Runbook (Milestone 4.3)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY. No plaintext payload in dead-letter records.**

## 1. Classifications
| Class | Retryable |
|---|---|
| `permanently-rejected` | no |
| `retryable-persistence` | yes |
| `retryable-projector` | yes |
| `config-unavailable` | yes |
| `crypto-version-unavailable` | yes |
| `identity-resolution-unavailable` | yes |

## 2. Record (safe, no PII, no payload)
event id · classification · retryable · attempts · lastAttemptAt · **safe** failureReason · jurisdiction ·
tenant · operator · resolution (`open` / `resolved` / `exhausted`). **No plaintext event payload is
stored.**

## 3. Retry governance
- Only **transient** failures are retried; **permanent rejections** (plaintext PII, invalid tenant, wrong
  jurisdiction, invalid digest, unsupported schema, unauthorised source, cross-tenant identity) are
  **never** retried — they produce a rejection record instead.
- Retries are **bounded** (default 3), **audited** (`retry-scheduled` / `retry-exhausted`), **idempotent**
  (a successful retry resolves the dead-letter via idempotency), and **restart-safe**.

## 4. Procedure
1. Inspect `deadLetterQueue()` — classification + attempts + resolution.
2. If `open` and the transient cause is cleared, re-submit the same event (same idempotency identity) →
   accepted; the dead-letter is **resolved** (removed).
3. If `exhausted`, escalate per incident policy; do not exceed the retry bound.
4. Permanent rejections are handled as rejections, not retries.

## 5. Validation
Tested: a transient persistence fault dead-letters the event (retryable); clearing the fault and
resubmitting accepts it and resolves the dead-letter; the retry bound is enforced.

## 6. Deployment binding
Managed dead-letter storage (queue/DLQ) + retry orchestration + monitoring are Phase 4.7 operational
bindings; the pilot implements the model + safe records in-process.
