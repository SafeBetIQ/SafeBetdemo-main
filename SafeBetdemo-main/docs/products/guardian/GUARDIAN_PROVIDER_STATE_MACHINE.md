# SafeBet Guardian — Provider State Machine (ARCH-V4-C9)

## States
`AUTHORISED, READY, PUBLISHED, REFERRED, ACKNOWLEDGED, UNDER_REVIEW, MORE_INFO_REQUIRED,
ACTIONED, DECLINED, VERIFIED, CLOSED, EXPIRED, WITHDRAWN` (+ internal `ORCHESTRATION_BLOCKED`).

## Ownership (who may set what)
- **Guardian** sets internal states from its own successful synthetic dispatch: `READY`,
  `PUBLISHED` (block-type actions), `REFERRED` (referral-type actions).
- **Provider-originated** states come ONLY from a `provider_response` row produced by the
  synthetic adapter: `ACKNOWLEDGED, UNDER_REVIEW, MORE_INFO_REQUIRED, ACTIONED, DECLINED`.
  Guardian never fabricates a provider acknowledgement.
- **Verification** sets `VERIFIED` — and only the independent verification step may.

## Key semantics (encoded + tested)
- `ACKNOWLEDGED != ACTIONED` — acknowledgement of receipt is not performance.
- `ACTIONED != VERIFIED` — provider-claimed action is not independently confirmed (verifications=0 at ACTIONED, proven live).
- `PUBLISHED != PROVIDER COMPLIED` — dispatch is not outcome.
- `DECLINED != TECHNICAL FAILURE` — a provider decline is recorded and NOT retried as transport.

## History (append-only)
`orchestration_status_history`, `provider_response`, `enforcement_verification`,
`dispatch_attempt`, `orchestration_withdrawal`, `provider_request` are append-only
(trigger-guarded) — no state transition is rewritten.
