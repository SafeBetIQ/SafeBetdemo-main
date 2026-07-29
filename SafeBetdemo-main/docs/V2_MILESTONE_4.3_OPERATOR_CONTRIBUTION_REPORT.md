# SafeBet IQ — Milestone 4.3 Implementation Report

**Operator Contribution & Event Platform Wiring · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: Demo/pilot branch, non-production · Production: UNCHANGED · Federation: OFF by default · Deployment: NOT AUTHORISED.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.4.**

## 1. Executive Summary
Implemented the **hash-only federation contribution path** through a certified **(non-production) Event
Platform boundary**, wired to the Phase 4.2 cryptographic provider and feeding the **certified Matching
Engine** via a deterministic **projector**. The Event Platform is **authoritative** for accepted
contributions and runs the full validation pipeline (schema → auth/attribution → jurisdiction → SB-PLR
→ attribute policy → cryptographic version → idempotency → replay → sequence → PII-leakage →
persistence → audit). It provides **idempotency + replay protection**, **sequencing**, **append-only
accepted records**, **revocation + expiry**, **dead-letter + bounded retry**, **contribution
provenance**, a **secret-free append-only audit**, and **deny-by-default access**. A **synthetic
operator harness** (test/sandbox-only) exercises the path end-to-end through the real boundaries. **No
live operator connector** (Phase 4.4), no casino DB, no live wagering/GGR, no production. Full
regression **400 pass**, `tsc` clean, isolated. **Applicable C1 (contribution wiring): PARTIALLY
CLOSED**; **C2/C3/C4 unchanged; C10 CLOSED.**

## 2. Exact Applicable C1 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C1 — "Live Event Platform contribution wiring + live reconciliation."**
- **Test of satisfaction:** *"Live wager/GGR events flow → certified projections; live operator↔national reconciliation report passes."*
- Phase 4.3 addresses the **operator contribution & Event Platform wiring** portion; **live wagering/GGR reconciliation is Phase 4.5** and the **live operator connector is Phase 4.4**.

## 3. Files Added
Under `lib/identityFederation/contribution/`:
- `model.ts` — `IDENTITY_FEDERATION_ATTRIBUTE` hash-only event contract; strict schema + runtime PII-leakage rejection; digest/version validation; acceptance/rejection/dead-letter records; content-idempotency key; secret-free contribution audit; rejection-reason taxonomy.
- `identity.ts` — `SbPlrResolver` + `InMemorySbPlrDirectory`; `validateContributionSbPlr` (tenant/operator/jurisdiction-scoped; never creates SB-PLR).
- `eventPlatform.ts` — `FederationEventPlatform` (submit pipeline, append-only accepted log, idempotency/replay/sequence, revocation, dead-letter/retry, deny-by-default access).
- `projector.ts` — `ContributionProjector` (→ certified `FederationContribution[]`, version-segregated, provenance) + `candidateProvenance`.
- `harness.ts` — `SyntheticOperatorHarness` (test/sandbox-only).
- `index.ts` — public API.
- `tests/identityFederation.contribution.test.mjs` — 10 tests (incl. end-to-end).

## 4. Files Modified
- `lib/identityFederation/index.ts` — re-exports the contribution API (additive).
**The certified matching/decision/registry/crypto/security modules were NOT changed.**

## 5. Justification for Files Changed Outside the Contribution Layer
| File | Change | Justification |
|---|---|---|
| `index.ts` | additive re-export | single federation public entry point |
**No operator path, no production config/credential/endpoint, no direct downstream insertion, no certified-component change.**

## 6. Event Contract
`FederationContributionEvent` carries only approved fields (event id/type/schema version, timestamps,
source operator, tenant, jurisdiction, SB-PLR, attribute type, **HMAC digest (64-hex)**, HMAC algorithm,
pepper/normalisation/canonical-format/contribution-schema versions, source-system ref, optional source
sequence, idempotency key, trace id, optional expiry/supersession/revocation refs). The event is
append-only and jurisdiction-bound; `eventType = IDENTITY_FEDERATION_ATTRIBUTE` (no duplicate event
types).

## 7. Hash-Only Boundary Validation
`validateEventSchema` enforces at runtime (not just via the interface): **unknown fields rejected**
(disguised-plaintext defence), required fields present, correct event/schema type, **digest must be
64-char HMAC-SHA-256 hex**, size ≤ 4 KB, and a **PII-leakage scan** (email / long-digit) over personal-
risk string fields. Fails closed. Tested: plaintext-in-unknown-field → `unknown-schema-field`; non-hex
value in digest → `invalid-digest`.

## 8. SB-PLR Validation
Every contribution must reference a valid, **Identity-Resolution-active**, tenant-scoped SB-PLR
(`validateContributionSbPlr`): format, existence, `active` status, and tenant + operator + jurisdiction
match **both** the SB-PLR's Identity Resolution record **and** the trusted authenticated context. A
contribution can **never** attach to another tenant's SB-PLR, and the federation path **never creates**
an SB-PLR. Tested (cross-tenant, unknown SB-PLR).

## 9. Operator and Tenant Attribution Validation
Attribution is taken from the **authenticated service context**, not inferred from the untrusted payload
alone; the event's operator/tenant/jurisdiction must equal the context (`unauthorised-operator` /
`tenant-mismatch` / `wrong-jurisdiction` otherwise). Tested.

## 10. Jurisdiction Validation
Jurisdiction must agree across authenticated context, event payload, SB-PLR Identity Resolution record,
and cryptographic metadata; cross-jurisdiction contributions are rejected (not rerouted). Tested.

## 11. Attribute-Policy Validation
Only jurisdiction-approved, enabled attributes may be contributed (`isAttributeEnabled`); others →
`unsupported-attribute-type`. Defence-in-depth: the Phase 4.2 crypto provider **also** refuses to hash a
non-approved attribute. Tested (both layers).

## 12. Cryptographic-Version Validation
Validated per contribution: HMAC algorithm = `HMAC-SHA-256`; canonical-format = `cf-1`; normalisation =
`norm-1`; contribution schema = `contrib-1`; pepper version **recognised** (via the 4.2 provider) and
**not revoked**. Incompatible cryptographic versions are **not** compared as equal — different pepper
versions yield different digests, so the certified Matching Engine never cross-matches them (tested).
The certified engine is unchanged.

## 13. Event Platform Acceptance Validation
`submit()` runs the full ordered pipeline and accepts only after every required validation passes, then
persists (append-only), audits, and makes the contribution eligible for projection. Tested via valid
acceptance + the end-to-end run.

## 14. Event Rejection Validation
Every rejection yields a **safe, structured** `RejectionRecord` (reason from the taxonomy, permanence
flag, jurisdiction/tenant/operator, a **safe** detail string, audit ref) — no sensitive implementation
detail leaks. Tested across schema/PII/digest/attribute/attribution/auth cases.

## 15. Idempotency Validation
A server-derived **content key** (`tenantId ␟ sbPlr ␟ attributeType ␟ pepperVersion ␟ digest`) governs
idempotency — not the operator-supplied key alone. Repeated submissions produce **one authoritative
contribution** and reference the original acceptance. Tested.

## 16. Duplicate Handling Validation
Distinguishes replay (same eventId), content-duplicate (same content, new eventId), and legitimate new
evidence. **Cross-operator evidence is preserved** (different tenant → different content key → not
collapsed even when the digest matches). Tested.

## 17. Replay Protection Validation
Replayed eventIds are detected and return the original acceptance (no duplicate candidates / decisions /
SB-NAT / inflated audit counts). Tested.

## 18. Sequencing Validation
Per (operator, tenant) sequence tracking: **duplicate sequence → `invalid-sequence`** (rejected);
out-of-order/gap → accepted but **audited** (`sequence-violation`, never silently discarded); an approved
connector-restart **sequence reset** is supported + audited. Tested.

## 19. Contribution Persistence Validation
Accepted contributions are **append-only** and reconstructable; records are jurisdiction-bound, tenant-
and operator-attributed, audited, and free of plaintext PII. **C2/C3 remain PARTIALLY CLOSED** — durable
managed-database append-only + RLS binding is unchanged from Phase 4.1 (this milestone did not add new
C2/C3 evidence).

## 20. Contribution Projector Validation
`ContributionProjector.matchingContributions` deterministically transforms accepted contributions into
the certified `FederationContribution[]`, **excluding** rejected (never accepted), revoked, and expired
contributions, avoiding duplicate projection, and **preserving** operator attribution + cryptographic-
version provenance. It makes no decision, mints no SB-NAT, and is **rebuildable from the accepted log**.
Tested.

## 21. Matching Engine Handoff Validation
Only accepted, projected, non-revoked, non-expired, version-compatible contributions reach the
**certified** Matching Engine (candidates only). Same value + same version → one candidate; **cross-
version → no candidate** (segregation via digest). Candidate provenance references the source accepted
events. Tested + end-to-end. No decision thresholds are added to the contribution path.

## 22. Expiry Validation
Already-expired contributions are rejected at submit; future-expiry contributions are projected until
`asOf` passes their expiry, then excluded from new matching — **historical evidence is preserved**
(never deleted). Tested.

## 23. Revocation Validation
`revoke()` appends a governed revocation (reason + actor + timestamp) and **preserves the original
contribution**; revoked contributions are excluded from future projection/matching; audited. Tested.

## 24. Dead-Letter Validation
Transient processing failures (persistence/projector/config/crypto-version/identity-resolution
unavailable) produce a `DeadLetterRecord` with classification, retry status, attempt count, and a **safe**
failure reason — **no plaintext payload** is stored. Permanent rejections are **not** dead-lettered.
Tested.

## 25. Retry Validation
Retries are **bounded** (default 3), audited (`retry-scheduled` / `retry-exhausted`), idempotent, and
restart-safe; only transient failures are retried; a successful retry **resolves** the dead-letter.
Tested.

## 26. Provenance Validation
Every accepted contribution and every matching candidate is traceable: Matching Contribution → accepted
Event → SB-PLR → tenant → operator → authenticated context → cryptographic version → source-system
reference. `candidateProvenance` reconstructs the accepted event ids that formed a candidate's evidence.
Tested + end-to-end.

## 27. Audit Validation
Append-only, deep-frozen, secret-free audit for received / accepted / rejected / duplicate / replay /
sequence-violation / projection / matching-handoff / expiry / revocation / retry / dead-letter events —
**no plaintext identity values**. Tested.

## 28. Access-Control Validation
Deny-by-default: only an authenticated **contribution-service** context (with matching operator/tenant/
jurisdiction) may submit; only a **regulator** or the service may read accepted evidence; operators,
casino-admins, and unauthenticated callers are denied submit and read. Enforced at the service boundary.
Tested.

## 29. Synthetic Operator Harness Validation
`SyntheticOperatorHarness` simulates operators, uses the **real 4.2 crypto provider** to hash synthetic
attributes, and submits through the **actual Event Platform**; it refuses to run unless explicitly
`enabled` (test/sandbox only), performs no external writes, and is **not** a live connector. Tested.

## 30. End-to-End Validation
Tested through the **actual implemented boundaries**: synthetic operator context → active synthetic
SB-PLR → hash-only contribution via the 4.2 provider → Event Platform acceptance + persistence + audit →
deterministic projection → **certified Matching Engine** candidate → provenance verified → **no auto-
decision by the contribution path** → certified Decision Engine (separately) → **SB-NAT registered only
after approval** → registry integrity verified. Downstream Registry state is **not** directly
constructed in the test.

## 31. Security Validation
Plaintext/unknown/oversized/invalid-digest/wrong-version/wrong-jurisdiction/cross-tenant/unauthenticated
all rejected; operator reads denied; replay deduplicated; duplicates don't inflate evidence; sequence
manipulation detected; audit + dead-letter carry no PII; safe error output; no production endpoint/
credential; no direct downstream insertion bypass.

## 32. Privacy and PII Leakage Validation
No plaintext identity attribute crosses the boundary (runtime schema + PII scan); audit/dead-letter/
rejection records are PII-free (scanned); the digest is HMAC hex only. Tested.

## 33. Performance Notes (pilot-scale, not production throughput)
Validation, idempotency/replay lookup, projection, and matching handoff complete sub-millisecond-to-low-
millisecond on synthetic volumes; end-to-end run ≈9 ms. Not live/production throughput certification.

## 34. Milestone Test Results
`identityFederation.contribution` → **10 pass**: contract + hash-only boundary; identity/attribution/
jurisdiction; access; idempotency/replay/duplicate + cross-operator preservation; sequencing;
projection + matching handoff + version segregation + provenance; revocation + expiry; dead-letter +
bounded retry; audit no-PII; end-to-end pipeline.

## 35. Full Regression Results
**400 pass / 0 fail** (390 prior + 10 new). No prior test affected (additive).

## 36. TypeScript Validation
`npx tsc --noEmit` → clean.

## 37. Import-Boundary Validation
Federation imported by no operator/UI/edge path; the contribution layer imports only `../crypto`,
`../types`, `../jurisdictionProfiles` + internal modules — **no** operator-runtime/app/Supabase import,
and **no** direct import of the matching/decision/registry internals for insertion (the projector emits
the certified input model, consumed by the caller).

## 38. Technical Debt Check
**None.** No plaintext PII across the boundary; no direct Matching/Registry insertion bypass; no
fabricated contributions; no unkeyed hashing; no hard-coded pepper; no duplicate-evidence inflation; no
unbounded retry; no silent rejection; no raw payload in dead-letter; no operator federation-read access;
no production credentials/endpoints/config; no live connector claimed; no TODO/stub/temporary schema; no
incomplete validation; no weakened tests; no architecture deviation.

## 39. Risks and Limitations (explicit, mapped)
- **Live operator connector** (authn onboarding, transport) → **Phase 4.4** (not built; not claimed).
- **Live Event Platform transport + live wagering/GGR reconciliation** → **Phase 4.5** (C1 remainder).
- **Durable managed persistence + RLS** for contribution records → **C2/C3** (unchanged deployment bindings).
- The synthetic harness is test/sandbox-only and must never be presented as a live connector.

## 40. Applicable C1 Closure Assessment → **PARTIALLY CLOSED**
- **Implemented scope:** hash-only contribution contract; Event Platform validation/acceptance;
  attribution/jurisdiction/SB-PLR/attribute-policy/crypto-version enforcement; idempotency/replay/
  sequence; append-only accepted records; revocation/expiry; dead-letter/retry; deterministic projector;
  **certified matching handoff**; provenance; deny-by-default access; synthetic harness; end-to-end.
- **Event Platform wiring evidence:** contributions flow through the actual boundary; projection feeds
  the certified engine (tested end-to-end).
- **Missing (OPEN):** **live operator connector** (4.4); **live Event Platform transport + live
  wagering/GGR reconciliation** (4.5); **managed durable persistence/RLS** (C2/C3).
- **Retest to fully close C1:** live wager/GGR events → certified projections + live operator↔national
  reconciliation on the managed environment.
- **Status: PARTIALLY CLOSED** (contribution/Event-Platform portion done; live connector + reconciliation not falsely claimed).

## 41. Confirmation of C2, C3, C4 and C10 Status
- **C2** — PARTIALLY CLOSED (unchanged). **C3** — PARTIALLY CLOSED (unchanged). **C4** — PARTIALLY CLOSED
  (unchanged; managed HSM/Secrets Manager binding still open). **C10** — CLOSED. No status altered without
  new evidence; native RLS / DB append-only / managed secret-store bindings remain open.

## 42. Provisional Certification Evidence (no final claim)
Contributes provisional evidence toward **C2-1 Architecture** (Event Platform authoritative; no bypass;
certified engine unchanged), **C2-2 Security** (deny-by-default, hash-only, no PII, idempotency/replay),
**C2-3 Privacy** (no plaintext across the boundary), **C2-4 Cross-Operator Intelligence** (real
contribution → matching → decision → SB-NAT with provenance). No pilot readiness claimed.

## 43. Go / No-Go Recommendation for Phase 4.4
**GO to plan-approve Phase 4.4 (Live Operator Connector Sandbox)** — the contribution contract, Event
Platform boundary, idempotency/replay/sequence, projection, matching handoff, revocation/expiry, dead-
letter, provenance, and access controls are complete and tested end-to-end through the real boundaries.
Phase 4.4 will add **one** controlled sandbox operator connector (authn, tenant isolation, suspension/
revocation) over this boundary. C1 remains PARTIALLY CLOSED with a clear remaining scope (connector +
live reconciliation).

---
**Phase 4.3 Complete — Awaiting Approval for Phase 4.4 Live Operator Connector Sandbox.**
