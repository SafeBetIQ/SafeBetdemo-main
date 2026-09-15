# ADR-0019 — SafeBet Guardian Multi-Channel Enforcement Orchestration (ARCH-V4-C9)

- **Status:** Accepted (synthetic Demo only; not production)
- **Date:** 2026-09-14
- **Relates:** ADR-0018 (C8 authorisation); C8 `AuthorisedActionContract`.

## Context
C8 produces a human-authorised action record but performs zero external action. A provider-
neutral orchestration lifecycle is needed to REFER/PUBLISH authorised requests to (synthetic)
providers and independently verify outcomes — without Guardian itself performing any provider-
side action and without a detection->enforcement bypass.

## Decision
Add an eighth domain, **Multi-Channel Enforcement Orchestration**:

1. **Guardian orchestrates, providers perform** — `enforcement_orchestration` DB CHECKs force
   `is_real_provider=false` AND `is_external_network_call=false`; no outbound/provider client
   (boundary-tested); synthetic providers only (no real ISP/registrar/host/bank/PSP/mobile/geo);
   no `/block-now`/`/freeze-account`/`/remove-app`/`/seize-domain` API.
2. **Authenticated authorising identity (closes the C8 finding)** — role/jurisdiction are BOUND
   to an authenticated Guardian principal (`resolveGuardianPrincipal`); a caller cannot
   self-assert `AUTHORISING_OFFICER` from the request body/fixture/default. MFA hard gate
   remains for real users.
3. **Consume only revalidated C8 authorisations** — the bounded `guardian.authorised_action`
   view is the data-layer revalidation gate (expired/withdrawn/superseded rows invisible);
   revalidate again before dispatch; expired/withdrawn/superseded/scope-mutated -> BLOCKED. C9
   cannot widen scope.
4. **8 `guardian`-schema tables** with jurisdiction, synthetic marker, RLS, append-only
   history/response/verification (trigger-guarded).
5. **State semantics** — provider-originated states come only from a `provider_response` row;
   `ACKNOWLEDGED != ACTIONED`, `ACTIONED != VERIFIED`; only the independent verification step
   sets VERIFIED (dispatch/verification separated).
6. **Payload hashing + versioning** — canonical SHA-256 `request_payload_hash`; retries reuse
   the immutable payload; material change -> new provider-request version.
7. **Retry** — technical delivery failure is retryable; a provider DECLINE is not retried as
   transport.
8. **Dedicated least-privilege role** `guardian_enforcement_worker` (C9 tables + `authorised_action`
   view only; no C1-C8 base tables; no BYPASSRLS). Own secret; SQS+DLQ+worker Lambda + alarm
   (IAM = logs+SQS+one secret only).
9. **No detection->enforcement** — only a valid C8 AuthorisedActionContract can enter (tested).

## Consequences
- A provider-neutral, human-authorised, independently-verified orchestration lifecycle with zero
  real external side effect. Strictly synthetic Demo; SafeBet IQ + Production untouched; MFA gate
  intact.

## Carried-forward architectural debt (P1, unresolved)
1. Separate independently governed Guardian database.
2. MFA before real privileged regulatory roles.
3. Duplicate `safebetiq.com` hosted-zone consolidation.
4. CA-validated PostgreSQL TLS (`ssl.rejectUnauthorized:false`) before real/Production DB traffic.
