# ADR-0018 — SafeBet Guardian National Enforcement Policy Registry & Authorisation (ARCH-V4-C8)

- **Status:** Accepted (synthetic Demo only; not production)
- **Date:** 2026-09-11
- **Relates:** ADR-0009..0017 (Guardian intelligence/case/evidence domains); C0 identity/SoD.

## Context
Before any future enforcement orchestration (C9), Guardian needs a governed HUMAN legal/
regulatory authority layer: a versioned policy registry + a legal-review + human-authorisation
workflow that produces a bounded AUTHORISED ACTION RECORD — and STOPS, performing no external
action.

## Decision
Add a seventh domain, **Enforcement Policy Registry & Authorisation**, mirroring the Guardian
pattern:

1. **Authority-not-execution invariant** — C8 authorises but NEVER executes/notifies a provider.
   `action_authorisation` DB CHECKs force `is_external_action_executed=false` AND
   `is_provider_notified=false`; no EXECUTED/ACTIONED/PROVIDER_ACKNOWLEDGED state; no
   `/execute`,`/send`,`/block`,`/referral` API; the module has no outbound/provider client
   (boundary-tested).
2. **Human authority, no machine authorisation** — final AUTHORISED requires a synthetic human
   `AUTHORISING_OFFICER`; the deterministic gate returns `AUTHORISER_NOT_PERMITTED` for
   `SYSTEM_SERVICE`; and the `guardian_policy_worker` role has NO INSERT on `action_authorisation`
   (machine authorisation impossible at code AND privilege level — proven live).
3. **12 `guardian`-schema tables** with jurisdiction, synthetic marker, RLS, append-only
   history/review (trigger-guarded).
4. **Deterministic gate** — AUTHORISED requires current+applicable policy, permitted action,
   authority, jurisdiction match, complete legal review, VERIFIED evidence, SoD (3 distinct
   principals), bounded scope, no blocking exception; else `AUTHORIZATION_BLOCKED` + reason codes.
   No AI/black-box decision.
5. **Governed contracts only** — reuse Case Reference Contract; **new Evidence Reference
   Contract** (`guardian.evidence_reference` + `resolveEvidenceReference`, incl. integrity_status)
   for the evidence gate. Worker holds SELECT on the two views only — never C6/C7 base tables.
6. **Dedicated least-privilege role** `guardian_policy_worker` (SELECT the C8 tables + contract
   views; INSERT ONLY `proposed_action`/history/audit). Own secret; SQS+DLQ+worker Lambda + alarm.
7. **C9 handoff** — define (not consume) `AuthorisedActionContract` + `isEligibleForOrchestration`
   (AUTHORISED, not expired, not withdrawn). C8 never invokes C9.

## Consequences
- A human, evidence-gated, SoD-enforced authorisation record exists as the pre-condition for any
  future enforcement — with zero external side effect. Immutable scope, effective-dated/versioned
  policy, expiry/withdrawal all preserved (append-only).
- Strictly synthetic Demo; SafeBet IQ + Production untouched; MFA hard gate intact.

## Carried-forward architectural debt (P1, unresolved)
1. Separate, independently governed Guardian database.
2. MFA before real privileged regulatory roles (esp. real Authorising Officer).
3. Duplicate `safebetiq.com` hosted-zone consolidation.
4. CA-validated PostgreSQL TLS (`ssl.rejectUnauthorized:false`) before real/Production DB traffic.
