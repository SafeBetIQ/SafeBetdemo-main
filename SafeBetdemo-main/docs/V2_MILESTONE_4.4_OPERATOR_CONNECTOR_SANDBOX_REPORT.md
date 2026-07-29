# SafeBet IQ — Milestone 4.4 Implementation Report

**Live Operator Connector Sandbox · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: Demo/pilot branch, non-production · Production: UNCHANGED · Federation: OFF by default · Deployment: NOT AUTHORISED.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.5.**

## 1. Executive Summary
Implemented one controlled, **vendor-neutral operator connector** for a **non-production sandbox**. It
authenticates (bound to **one** operator/tenant/jurisdiction), reads synthetic operator source records,
resolves the tenant-scoped **SB-PLR**, **hashes approved attributes before the SafeBet IQ boundary**
(Phase 4.2), and submits hash-only contributions through the certified **Event Platform** (Phase 4.3).
It is **write-only** w.r.t. federation and holds **no handle** to the Registry/Correlation/Policy — it
cannot read federation data. It **starts disabled**; activation is explicit + audited. It provides the
full **lifecycle**, **durable checkpointing + restart**, **idempotency/sequencing**, **rate limiting +
backpressure (circuit)**, **retry + dead-letter (no payload)**, **suspension + revocation**, **source
corrections/revocations**, **health**, **reconciliation**, a **secret/PII-free audit**, and proven
**multi-operator tenant isolation**. No production casino / credential / endpoint. Full regression **411
pass**, `tsc` clean, isolated. **C5: PARTIALLY CLOSED** (connector implemented + integration-tested vs a
controlled sandbox; **external-vendor + deployed-runtime evidence OPEN**). **C1/C2/C3/C4 unchanged; C10
CLOSED.**

## 2. Exact C5 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C5 — "Live operator connector validation."**
- **Test of satisfaction:** *"Each operator connector ingests hash-only contributions; isolation negative tests pass."*

## 3. Files Added
Under `lib/identityFederation/connector/`:
- `model.ts` — connector contract; lifecycle states + transition table; `ConnectorAuthenticator` (secrets in a non-exported module WeakMap; one operator/tenant/jurisdiction binding; revoke/expiry; no tenant-switch); `SandboxSource` + `InMemorySandboxSource`; checkpoint store; connector audit (secret/PII-free); dead-letter + reconciliation types; errors.
- `connector.ts` — `OperatorConnector` (lifecycle/activate/suspend/reactivate/revoke/retire; `sync`; checkpoint; idempotency/sequencing; rate limit + backpressure/circuit; retry/dead-letter; source corrections; health; reconciliation).
- `index.ts` — public API.
- `tests/identityFederation.connector.test.mjs` — 11 tests (incl. multi-operator + end-to-end).

## 4. Files Modified
- `lib/identityFederation/index.ts` — re-exports the connector API (additive).
**Certified components + 4.1/4.2/4.3 layers unchanged.**

## 5. Justification for Files Changed Outside the Connector Layer
| File | Change | Justification |
|---|---|---|
| `index.ts` | additive re-export | single federation public entry point |
**No operator path, no production config/credential/endpoint, no direct downstream insertion, no change to certified or prior-milestone components.**

## 6. Sandbox Boundary
The connector runs against a **local operator-system simulator** (`InMemorySandboxSource`) reproducing
the expected operator schema with deterministic synthetic records. **No** production casino DB/API,
credentials, real player PII, loyalty/payment/wagering data, or production network routes. **External
vendor connectivity is unproven** and stated as such (see §45).

## 7. Connector Architecture
Operator Sandbox Source → **Operator Connector** → local attribute normalisation → **hash-before-boundary
HMAC** (4.2) → hash-only contribution → **certified Event Platform** (4.3) → projection → Matching Engine.
The connector never bypasses the Event Platform and never inserts downstream.

## 8. Connector Contract
`ConnectorConfig` (connectorId, operatorId, tenantId, jurisdiction, connectorVersion, sourceType,
supportedAttributes, rateLimit, retryPolicy) + runtime state (status, checkpoint, sequence state, health,
suspension, last success/failure, audit). **No credential/secret is exposed** through the interface.

## 9. Connector Lifecycle Validation
States: provisioned → validating → active → degraded → suspended → revoked/failed/retired, with an
explicit transition table. The connector **starts `provisioned` (disabled)**; `sync` throws until
activation; invalid transitions are rejected; revoked/retired are terminal. Tested.

## 10. Authentication Validation
`ConnectorAuthenticator` provisions a credential bound to one operator/tenant/jurisdiction (secrets in a
non-exported WeakMap — no getter/log/serialisation). `validate` fails closed on **invalid**, **expired**,
and **revoked** credentials; activation re-validates and rejects a binding mismatch. Tested.

## 11. Authorisation Validation
The connector may only resolve its own SB-PLR, generate hash-only contributions, submit, and read its own
acknowledgements + safe health. It exposes **no** federation-read surface (`getSbNat` / `listSbNat` /
`correlate` / `decide` / `matchingCandidates` / `acceptedContributions` are `undefined`); it cannot read
federation records, SB-NAT, decisions, correlation, or policy. Tested.

## 12. Tenant-Binding Validation
Authentication binds exactly one tenant; the connector submits with its **config-bound** tenant context
and **cannot switch tenant**. A source record referencing another tenant's SB-PLR is rejected. Tested.

## 13. Jurisdiction-Binding Validation
The connector is bound to one jurisdiction; SB-PLR resolution + Event Platform validation reject cross-
jurisdiction contributions. Tested (multi-operator + isolation).

## 14. Source Data Contract
`OperatorSourceRecord` carries only source ref, sequence, timestamp, version, status, SB-PLR, and the
approved synthetic attributes (+ optional supersession). The full operator source record is **not** sent
into SafeBet IQ — only the derived hash-only contribution.

## 15. Hash-Before-Boundary Validation
Approved attributes are normalised + HMAC-hashed (via the 4.2 provider) **inside the connector**; the
plaintext value stays local and is **discarded** after hashing. No plaintext appears in the contribution
event, Event Platform, connector logs/audit/health, dead-letter, or diagnostics (tested — the raw
national-id value never appears; only the HMAC digest does).

## 16. Attribute-Allowlist Validation
The connector contributes only attributes in `supportedAttributes` ∩ the jurisdiction profile
(`isAttributeEnabled`); unapproved/excess attributes are excluded. Arbitrary mapping cannot broaden the
jurisdiction policy.

## 17. SB-PLR Resolution Validation
Each source player maps to a valid, **active**, tenant/operator/jurisdiction-owned SB-PLR (via the
Identity Resolution resolver); missing/invalid/inactive/cross-tenant mappings are rejected. The connector
**never creates** an SB-PLR or SB-NAT. Tested.

## 18. Checkpoint Validation
Durable checkpoint (cursor, last sequence/timestamp, last accepted event, connector + dataset version).
Checkpoint advances **only after safe processing** of a record. Tested.

## 19. Restart and Recovery Validation
A fresh connector over the same checkpoint store resumes at the saved cursor — no lost records, no
uncontrolled duplicates, no skipped records. Reprocessing yields **no duplicate evidence** (deterministic
event ids → Event Platform replay dedup). Tested.

## 20. Idempotency Validation
Deterministic event id = `connectorId:sourceRef:attributeType:sourceVersion` → the same source record
processed repeatedly produces **one** authoritative contribution, one projection, no duplicate matching
evidence, and safe duplicate acknowledgement. Tested.

## 21. Sequencing Validation
Per-connector sequence tracking: **duplicate source sequence is excluded**; out-of-order is handled
without silent loss; reconciliation stays balanced. Tested.

## 22. Rate-Limit Validation
`maxBatch` per sync + `maxPerWindow` within `windowMs`; exceeding the window stops the sync (`rateLimited`)
without dropping records (checkpoint preserved). Implemented + configurable per connector.

## 23. Backpressure Validation
When the Event Platform/persistence is unavailable (transient), the connector **opens a circuit** after a
threshold of dead-letters, transitions to `degraded`, **stops consuming**, and **preserves the checkpoint**;
it resumes deterministically after recovery. Tested.

## 24. Retry Validation
Only transient failures are retried; retries are **bounded** (`maxRetries`), audited, and idempotent; a
successful retry **resolves** the dead-letter. Permanent rejections are not retried. Tested.

## 25. Dead-Letter Validation
Dead-letter records carry only safe references + metadata (connector, operator, tenant, jurisdiction,
source ref, event ref, category, attempts, resolution) — **no raw source record/payload**. Tested.

## 26. Suspension Validation
An authorised admin/regulator suspends the connector → new source processing stops, submissions are
prevented, checkpoints + accepted contributions are preserved, an audit is emitted; reactivation requires
an **approved review** flag. Admin actions require an authorised context. Tested.

## 27. Revocation Validation
Revocation **permanently denies** the connector identity (credential revoked; state terminal), preserves
historical contributions + audit, and requires a **new** connector identity for future onboarding. Tested.

## 28. Source-Correction Validation
A source record marked `revoked` triggers a **governed revocation** of the prior contribution (original
**preserved**, excluded from future matching, audited); a `corrected` record supersedes with a new version.
Tested.

## 29. Connector Health Validation
`health()` exposes only safe diagnostics (lifecycle, last read/submit/ack, checkpoint cursor, pending
retries, dead-letters, rejections, auth status, rate-limited, circuit-open, last error code) — **never**
credentials, peppers, plaintext identity, raw payloads, or stack traces.

## 30. Audit Validation
Append-only, deep-frozen, secret/PII-free audit across the full connector lifecycle (provisioned →
authentication-validated → activated → source-read → sbplr-resolved → generated → submitted → accepted/
rejected → checkpoint-advanced → retry/dead-letter → degraded/suspended/reactivated/revoked/retired →
source-correction). Tested (no PII in output).

## 31. Reconciliation Validation
`reconcile()` accounts for every source record (discovered = eligible + excluded + revoked) and every
contribution (submitted = accepted + deduplicated + rejected + open dead-letters), reporting `balanced`
and explaining any difference — **no source record silently disappears**. Tested.

## 32. End-to-End Sandbox Validation
Two sandbox connectors (separate operators/tenants) each: provision → validate auth → activate → read
synthetic records → resolve SB-PLR → hash → submit → Event Platform accept → projection → **certified
Matching Engine** produces **one** correct candidate for the shared synthetic person. Restart/duplicate/
suspend/reactivate/revoke exercised across the suite. Tested.

## 33. Multi-Operator Isolation Validation
Two connectors have separate authentication identities, tenants, checkpoints, audit trails, and rate
limits, with **no shared mutable state**; a connector submitting another tenant's SB-PLR is rejected;
matching evidence preserves operator distinction. No global shared connector identity. Tested.

## 34. Security Validation
Invalid/expired/revoked credentials rejected; tenant/jurisdiction switching impossible; cross-operator
SB-PLR rejected; plaintext/unsupported attributes rejected; federation/SB-NAT/policy reads structurally
impossible; replay deduplicated; sequence manipulation detected; retry bounded; dead-letter + diagnostics
PII-free; no production endpoint/credential.

## 35. Privacy and PII Leakage Validation
Plaintext attributes stay inside the sandbox source + connector, are **discarded after HMAC**, and never
enter SafeBet IQ, logs, audit, checkpoints, retries, dead-letter, or diagnostics (scanned with synthetic
markers). Data minimisation + jurisdiction-driven allowlist enforced.

## 36. Failure-Mode Validation
Sandbox/auth/secret/SB-PLR/Event-Platform/persistence unavailability, partial batch failure, restart,
duplicate batch, out-of-order records, suspended/revoked connector, and dead-letter backlog are all handled
without corrupting downstream federation state (fail closed; checkpoint preserved). Tested (representative).

## 37. Performance Notes (pilot-scale)
Source read, SB-PLR lookup, HMAC, submission, batch, duplicate handling, checkpoint, restart, and
reconciliation all complete sub-millisecond-to-low-millisecond on synthetic volumes. Not production
throughput certification.

## 38. Deployment-Model Evidence
The sandbox connector runs as a **local in-process component** (test/sandbox). Runtime identity =
authenticated connector id; configuration = injected `ConnectorConfig`; secret = via the authenticator
(non-production); health = `health()`; disablement = suspend/revoke. **No deployed sandbox runtime** was
provisioned — the connector is **integration-tested but not deployed** (see §45; C5 residual).

## 39. Milestone Test Results
`identityFederation.connector` → **11 pass**: lifecycle/activation; credential invalid/expired/revoked;
tenant binding + no-federation-read; hash-before-boundary/privacy; checkpoint/restart/idempotency;
sequencing + reconciliation; retry/dead-letter/backpressure + recovery; suspend/revoke + admin auth;
source revocation; multi-operator isolation; end-to-end two-connector correlation.

## 40. Full Regression Results
**411 pass / 0 fail** (400 prior + 11 new). No prior test affected (additive).

## 41. TypeScript Validation
`npx tsc --noEmit` → clean.

## 42. Import-Boundary Validation
Federation imported by no operator/UI/edge path; the connector imports only `../contribution`, `../crypto`,
`../types`, `../jurisdictionProfiles` + internal — **no** Registry/Correlation/Policy handle (cannot read
federation), and **no** operator-runtime/app/Supabase/cloud-SDK/env import.

## 43. Technical Debt Check
**None.** No production connector/casino connection; no real player data; no plaintext PII across the
boundary; no raw payload in Event Platform/dead-letter; no hard-coded/shared credentials; no tenant
switching; no federation read; no direct downstream insertion; no uncontrolled retries/unbounded queue;
checkpoint recovery present; reconciliation balanced; no silent record loss; no production endpoints/config;
no TODO/stub/temporary connector logic; no weakened tests; no architecture deviation.

## 44. Risks and Limitations (explicit, mapped)
- **External vendor sandbox connectivity unproven** — only a controlled in-process simulator was used → C5 residual.
- **No deployed sandbox runtime** — integration-tested, not deployed → C5 residual.
- **Live wagering/GGR reconciliation** → Phase 4.5. **Managed durable checkpoint/persistence + secret store** → C2/C3/C4 bindings.

## 45. C5 Closure Assessment → **PARTIALLY CLOSED**
- **Connector implementation completed:** yes (lifecycle, authn/authz, hash-before-boundary, SB-PLR
  resolution, checkpoint/restart, idempotency/sequence, rate/backpressure, retry/dead-letter, suspend/
  revoke, corrections, health, reconciliation, multi-operator isolation, end-to-end).
- **Sandbox source used:** local operator-system simulator (synthetic).
- **Authentication / tenant / jurisdiction binding evidence:** yes (tested, isolation negatives pass).
- **Hash-before-boundary / Event Platform / checkpoint / retry / dead-letter / reconciliation evidence:** yes (tested).
- **Security / privacy evidence:** yes (tested).
- **Deployment evidence:** **MISSING** (integration-tested, not deployed).
- **External operator sandbox evidence:** **MISSING** (no external vendor connectivity).
- **Residual:** external + deployed connector validation.
- **Retest to fully close:** run the connector against an external/approved operator sandbox in a deployed
  non-production runtime; re-run isolation negatives there.
- **Status: PARTIALLY CLOSED** (per the milestone's instruction not to close C5 when only an in-process simulator was tested).

## 46. Confirmation of Existing Condition Status
- **C1** PARTIALLY CLOSED · **C2** PARTIALLY CLOSED · **C3** PARTIALLY CLOSED · **C4** PARTIALLY CLOSED ·
  **C10** CLOSED. No status altered without new evidence; live wager/GGR reconciliation, native RLS, DB
  append-only, and managed Secrets Manager/HSM bindings remain open.

## 47. Provisional Certification Evidence (no final claim)
Contributes provisional evidence toward **C2-1 Architecture** (Event-Platform-authoritative; no bypass;
write-only connector), **C2-2 Security** (bound auth, least privilege, no federation read, fail-closed),
**C2-3 Privacy** (hash-before-boundary; no PII into SafeBet IQ), **C2-4 Cross-Operator Intelligence**
(two connectors → one candidate). No pilot readiness claimed.

## 48. Go / No-Go Recommendation for Phase 4.5
**GO to plan-approve Phase 4.5 (Live Wagering & GGR Reconciliation)** — the operator connector boundary,
hash-before-boundary flow, checkpointing, idempotency, backpressure, dead-letter, suspension/revocation,
and multi-operator isolation are complete and tested end-to-end. Phase 4.5 will add live/sandbox wagering +
GGR ingestion + operator↔national reconciliation (the "live reconciliation" half of C1). C5 remains
PARTIALLY CLOSED with a clear external + deployed residual.

---
**Phase 4.4 Complete — Awaiting Approval for Phase 4.5 Live Wagering and GGR Reconciliation.**
