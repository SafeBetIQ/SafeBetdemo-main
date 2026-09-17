# ADR-0020 — Guardian Re-entry Intelligence & Continuous Verification (ARCH-V4-C10)

- **Status:** Accepted (Demo, synthetic only)
- **Date:** 2026-09-16
- **Context:** C9 established synthetic multi-channel enforcement orchestration ending at an
  independently VERIFIED outcome. The post-orchestration lifecycle — continuous verification and
  detection of re-entry (a previously-actioned target/entity reappearing) — was unowned. It must
  produce intelligence and route to human/legal review **without** ever re-enforcing automatically,
  determining illegality, applying standing authority by inference, or bypassing C8/C9.

## Decision
Introduce C10 as an intelligence + verification + routing layer:
1. **Continuous / follow-up verification** — append-only `enforcement_verification_observation`, synthetic, bounded scheduling; historic VERIFIED records are immutable.
2. **Re-entry candidate** — `reentry_candidate` (state machine) + append-only history; deterministic, explainable relationship labels (correlation, not legal findings), reason codes, and a `LOW/MEDIUM/HIGH` review priority (no probability/enforcement score).
3. **Authority-coverage assessment** — internal routing assessment; standing authority is never inferred; only explicit C8 coverage metadata (relationship class + exact target + jurisdiction + live authority) supports an expedited `EXISTING_AUTHORITY_REVIEW`.
4. **Human review + routing** — required before any routing; routes to C6 investigation or C8 authority review only. Reviewer role/jurisdiction bound from the authenticated principal.
5. **Consumes the bounded C9 Orchestration Reference Contract** (`guardian.orchestration_reference` view) — never the C9 base tables.
6. **Dedicated least-privilege durable worker** `guardian_reentry_worker` (SELECT/INSERT C10 tables + audit + contract view; no C1–C9 base grant; no UPDATE/DELETE; no BYPASSRLS) with its own secret, SQS + DLQ, and an immutable-alias event-source mapping (C9.1 lesson applied from inception). The worker's IAM role has **no `sqs:SendMessage`**, so it cannot enqueue C9 enforcement.

## Consequences
- Safety identities are encoded as DB CHECKs (`is_illegality_determined=false`, `is_authority_applied=false`, `is_final_legal_determination=false`, `is_authorisation_granted=false`, `is_enforcement_dispatched=false`, `is_real_observation_source=false`, `is_external_network_call=false`) and asserted in tests.
- No detection→enforcement shortcut exists; C9 still runs only on a valid bounded C8 `AuthorisedActionContract`.
- All observation sources are synthetic; privacy operates at operator/brand/service/domain/app/payment-channel/infrastructure reference level (C5 boundary preserved).
- **Rollback:** Guardian runtime rollback target remains C9 `08e99c7`; C10 data/history is retained independently of any runtime rollback.
