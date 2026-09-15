# SafeBet Guardian — Enforcement Retry Policy (ARCH-V4-C9)

## Technical failure vs provider decline (§33)
- A **technical delivery failure** (adapter `delivered=false`) is retryable: the orchestration
  stays `READY`, a `dispatch_attempt` with outcome `TECHNICAL_FAILURE` is recorded, and a later
  attempt may succeed (proven: attempt 1 technical failure -> READY; attempt 2 -> ACTIONED).
- A **provider DECLINED** is a provider decision, NOT a transport failure. It is recorded
  (`provider_response` DECLINED with a reason code) and is **not** retried as a technical
  failure.

## Retry semantics
Retries reuse the exact immutable authorised payload (same `request_payload_hash`). Retry only
technical failures per policy; never re-send a declined/legal outcome as though it were a
network error.

## MORE_INFO_REQUIRED (§32)
A provider `MORE_INFO_REQUIRED` creates a follow-up state. Guardian does not automatically send
arbitrary additional evidence — a human/governed process determines any supplementary package.

## Idempotency (§27)
Same `(authorisation_reference, provider_channel, action_scope, idempotency_key)` does not
create duplicate provider requests (unique `(jurisdiction, idempotency_key)`; proven: duplicate
delivery -> one provider request).
