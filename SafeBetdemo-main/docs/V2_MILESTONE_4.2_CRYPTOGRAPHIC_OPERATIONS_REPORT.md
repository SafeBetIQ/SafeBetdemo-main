# SafeBet IQ — Milestone 4.2 Implementation Report

**Pepper & Cryptographic Operations · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: Demo/pilot branch, non-production · Production: UNCHANGED · Federation: OFF by default · Deployment: NOT AUTHORISED.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.3.**

## 1. Executive Summary
Implemented the pilot cryptographic operations foundation for National Identity Federation: a **narrow
HMAC-SHA-256 crypto provider** over a **versioned, collision-safe canonical input**, **jurisdiction-
isolated peppers** with a governed **lifecycle + rotation (dual-version transition)**, a non-production
**pepper secret store** that never exposes raw material, **bounded caching**, **fail-closed** behaviour
(no fallback to unkeyed/demo/global), a **compromise-response** workflow, **least-privilege** operator
roles, and a **secret-free append-only cryptographic audit**. All inputs synthetic; no live operators;
no production secrets; no domain redesign (the certified matching/decision/security scaffolding is
untouched). Full regression **390 pass**, `tsc` clean, isolated. **Condition C4: PARTIALLY CLOSED** —
the provider, rotation, recovery, compromise, fail-closed and versioned-continuity are implemented and
tested; **"served from HSM/Secrets Manager" (a managed pilot secret-store binding) is the OPEN
deployment residual** (no managed cloud secret store available in this environment). **C2 and C3 remain
PARTIALLY CLOSED, unchanged.**

## 2. Exact C4 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C4 — "Production HSM / Secrets Manager pepper + rotation."**
- **Test of satisfaction:** *"Pepper served from HSM/Secrets Manager; a key-rotation + recovery exercise completes with versioned continuity."*

## 3. Files Added
- `lib/identityFederation/crypto/model.ts` — versioned collision-safe canonical input, crypto version constants, pepper metadata + lifecycle states/transitions, `CryptoError` (fail-closed), secret-free append-only crypto audit (+ a secret-field guard).
- `lib/identityFederation/crypto/secretStore.ts` — `PepperSecretStore` + `InMemoryPilotSecretStore` (raw peppers in a **non-exported module WeakMap**; `computeHmac` keeps the pepper internal; jurisdiction-isolated; non-production secret refs; safe metadata/health).
- `lib/identityFederation/crypto/provider.ts` — narrow `FederationCryptoProvider` (hashAttribute / hashAttributeVersion / verifyVersion / rotationState / invalidateCache / health) + governed `PepperOperations` (provision / rotate / retire / revoke / markCompromised / disableJurisdiction / reactivateJurisdiction) + `sameCryptoVersion`.
- `lib/identityFederation/crypto/index.ts` — public API.
- `tests/identityFederation.crypto.test.mjs` — 15 tests.

## 4. Files Modified
- `lib/identityFederation/index.ts` — re-exports the crypto API (additive).
**The certified `security.ts`, matching engine, decision engine, and jurisdiction profiles were NOT changed.**

## 5. Justification for Files Changed Outside the Cryptographic Layer
| File | Change | Justification |
|---|---|---|
| `index.ts` | additive re-export | single federation public entry point |
**No operator path, no production config/credential/endpoint, no domain redesign, no `security.ts` change.** The new provider is additive; wiring it into the live contribution/matching path is Phase 4.3.

## 6. Cryptographic Architecture
Domain code depends on a **narrow injected provider** — the only operations are: hash an approved
attribute (active version), hash with an explicit recognised version, verify a version, read rotation
state, invalidate cache, report health. The provider delegates the actual keyed hash to the
`PepperSecretStore.computeHmac`, so the **pepper never leaves the store boundary**. The store holds raw
material in a non-exported module `WeakMap` (no `store.raw`, no getter, no serialisation). Governed
pepper operations sit in a separate least-privilege layer. HMAC-SHA-256 is the sole construction; there
is **no** unkeyed SHA-256, reversible encryption, custom crypto, or general encryption surface.

## 7. Canonical Input Specification
`canonicalHashInput(jurisdiction, attributeType, normalisedValue)` binds — in a fixed order and each
**length-prefixed by UTF-8 byte length** so boundaries can never merge — the **canonical-format version
`cf-1`**, the **domain-separation label `SB-FED-ATTR`**, the **jurisdiction**, the **attribute type**,
and the **Unicode-NFC-normalised value**. Length-prefixing + a fixed separator eliminate
jurisdiction/attribute boundary merging, attribute-type confusion, separator collisions, and whitespace
ambiguity; NFC eliminates Unicode-normalisation ambiguity. The plaintext canonical input is **never
logged**. Format is versioned permanently (`CANONICAL_FORMAT_VERSION`).

## 8. Attribute Normalisation Validation
Normalisation reuses the certified `normaliseAttribute` (deterministic, attribute-specific,
jurisdiction-aware, applied **before** HMAC) plus NFC in the canonical encoder; versioned as
`NORMALISATION_VERSION = norm-1`. Only jurisdiction-approved attributes are hashable — a non-approved
attribute (e.g. `passport` in ZA) is rejected (fail-closed). The permitted set is **not** broadened.

## 9. HMAC Validation
Deterministic (same input/jurisdiction/type/version → same hash); sensitive to value, attribute type,
jurisdiction, and pepper version; algorithm stamped `HMAC-SHA-256`; **no plaintext appears in the
output**. (Tested.)

## 10. Jurisdiction-Pepper Isolation
Each sovereign jurisdiction has an isolated pepper; the same synthetic value produces **different**
digests across ZA / NA / BW / KE (tested). There is **no** global/Africa-wide federation pepper;
cross-country federation remains prohibited.

## 11. Cryptographic Provider Validation
The provider exposes only the narrow operations; it does **not** expose raw peppers, secret-store
clients, mutable buffers, arbitrary hashing, general encryption, secret enumeration/export, or
production secret references (asserted; `provider.fallback`/`provider.sha256` do not exist).

## 12. Secret-Store Binding Validation
**Pilot binding:** `InMemoryPilotSecretStore` — synthetic peppers via `randomBytes`, held in a
non-exported module WeakMap; `computeHmac` uses them internally. **What is enforced where (honest):**
storage location = in-process pilot store (non-production); at-rest encryption = **n/a in-memory** (the
managed binding provides KMS-encrypted-at-rest); runtime retrieval = internal only; safe metadata is
available without the value; jurisdiction isolation + fail-closed are application-enforced. **Deployment
binding (OPEN, C4 residual):** pepper **served from AWS Secrets Manager / HSM**. **No HSM protection is
claimed** — the pilot uses an in-memory store; the managed binding is not yet wired.

## 13. Least-Privilege Access Validation
Governed operations require actor roles: `provision`/`rotate` → `key-admin`/`rotation-authority`;
`revoke`/`markCompromised`/`disableJurisdiction` → `revocation-authority`; `reactivate` → `key-admin` +
explicit approved-review flag. Runtime hashing (the domain path) needs no admin role and cannot
provision/rotate/revoke. Unauthorised operations are rejected (tested). Provisioning / rotation /
revocation / runtime-retrieval / audit authorities are separated.

## 14. Pepper Metadata Model
Only safe metadata is stored/audited: jurisdiction, version, state, algorithm, canonical-format
version, normalisation version, opaque `secretRef` (prefixed `pilot-nonproduction/…`), activation/
retirement timestamps, rotation ref, actor, audit ref. **Never** the raw/encoded pepper, a reversible
derivative, a full secret response, or store credentials.

## 15. Pepper Lifecycle Validation
States: provisioned / active / transition / retired / revoked / compromised / disabled, with an
explicit transition table (`PEPPER_TRANSITIONS`). Every transition is authorised, audited, jurisdiction-
bound, and versioned; an active pepper is never silently replaced (rotation is explicit).

## 16. Rotation Validation
`rotate()` provisions + activates the new version, then moves the previous active version to
**transition** (versioned continuity: in-flight/old-version contributions remain recognised during the
bounded transition). New contributions use the new primary; the previous version is retired only via an
explicit `retire()`. A rotation audit is emitted and the cache invalidated. **Failed rotation rolls back
safely** — rotating to an existing version throws and leaves the previous version active (tested).

## 17. Dual-Version Transition Validation
During transition both versions are recognised; `hashAttribute` uses the new primary while
`hashAttributeVersion(old)` still computes. **Old and new HMAC outputs are NOT equal** and
`sameCryptoVersion()` returns false — the version stamp lets the Matching Engine **segregate by
version** and never treat incompatible versions as equal (tested). The certified matching engine is
unchanged; the stamp + helper are additive guidance for the 4.3 contribution/matching path.

## 18. Cache Validation
Bounded per-jurisdiction cache (active version + recognised versions + timestamp, TTL 30 s), keyed by
jurisdiction, separated per jurisdiction; invalidated on rotation / revocation / compromise /
disablement / explicit `invalidateCache` / process restart. Stale material is not used after
revocation/disablement (fail-closed on next lookup). **No secret value is cached** (only the version
pointer + recognised list). **Memory zeroisation is NOT claimed** — the JavaScript runtime cannot
guarantee it (documented honestly).

## 19. Fail-Closed Validation
The contribution hash fails **closed** when the pepper is unavailable, the version is unknown/unusable,
the jurisdiction is disabled/mismatched, the secret ref is invalid, or the HMAC operation fails — it
**never** falls back to unkeyed SHA-256, a default/global/demo pepper, a hard-coded secret, a non-
transition previous version, or plaintext comparison (tested).

## 20. Recovery Validation
Documented + tested recovery: a jurisdiction disabled/compromised fails closed; service is restored by
provisioning + activating a **new** version through the approved path (the compromised/revoked version
is never reactivated). Recovery preserves audit history, historical version metadata, existing decisions,
registry integrity, jurisdiction isolation, and evidence reproducibility. Historical metadata is **not**
deleted on retirement/compromise.

## 21. Compromise-Response Validation
`markCompromised()` marks the version compromised, **destroys its material** (metadata retained),
emits a compromise + emergency-disablement audit, and disables new contributions (fail-closed);
reactivation requires a **new** version and an **approved review** flag (rejected otherwise). Historical
federation records are never auto-deleted; the jurisdiction is never silently re-enabled (tested).

## 22. Cryptographic Audit Validation
Immutable, append-only, deep-frozen audit for provision / activate / transition / retire / revoke /
compromise / cache-invalidation / retrieval-failure / unsupported-version / rotation / recovery /
emergency-disablement / reactivation. A **secret-field guard** rejects any attempt to seal a record with
a value/secret/key-material/plaintext field. Audit contains **no** secret values or plaintext
attributes (tested).

## 23. Version-Governance Validation
Every produced hash carries a full `ContributionCryptoStamp`: jurisdiction, attribute type, algorithm,
canonical-format version, normalisation version, pepper version, contribution-schema version. The
existing six-part federation decision versioning is untouched; historical version metadata is never
overwritten.

## 24. Secret Leakage Validation
No secret value appears in source, logs, audit, metadata, health, or persisted records; the raw pepper
map is a non-exported module WeakMap with no instance handle. **Finding fixed in-milestone (CRYPTO-F1):**
an initial `private raw()` method on the store was TS-`private` (runtime-reachable) and returned the raw
pepper map — this was corrected to a non-exported module accessor `rawOf()` so `store.raw` does not
exist at runtime (verified by test). No secret in source control.

## 25. PII Leakage Validation
No plaintext identity attribute enters any output; a serialised scan of provider health + metadata +
audit is clean (no attribute value, no email); metadata exposes only opaque `pilot-nonproduction/…`
secret references.

## 26. Performance Notes (pilot-scale, not production load)
Cold + cached retrieval, single + batch HMAC, cache invalidation, and rotation-state lookup all complete
sub-millisecond-to-low-millisecond on synthetic inputs. No secret value in any performance output. This
is pilot-scale validation only.

## 27. Milestone Test Results
`identityFederation.crypto` → **15 pass**: HMAC determinism/sensitivity; jurisdiction isolation;
canonical collision-safety + NFC; approved-attribute + unknown-version rejection; **no raw-pepper
exposure**; rotation + dual-version (old≠new); retire/rollback; role enforcement; cache invalidation +
jurisdiction isolation; fail-closed (disabled + no-fallback); compromise response + approved
reactivation; secret-free audit; version-governance stamp; no secret/PII leakage.

## 28. Full Regression Results
**390 pass / 0 fail** (375 prior + 15 new). No prior test affected (crypto is additive).

## 29. TypeScript Validation
`npx tsc --noEmit` → clean (Map iteration via `Array.from` per the project target).

## 30. Import-Boundary Validation
Federation imported by no operator/UI/edge path; crypto imports only `node:crypto` + internal federation
modules (`types`, `security`, `jurisdictionProfiles`). No operator-runtime/app/Supabase/cloud-SDK/env
import.

## 31. Technical Debt Check
**None.** No hard-coded/global/demo peppers; no unkeyed identity hashing; no fallback; no secret in
source/logs/audit/records; no cross-jurisdiction pepper reuse; no unsupported-version comparison; no
false memory-zeroisation claim; bounded cache; complete rotation workflow; no silent recovery; no
production secret access/config change; no TODO/stub/temporary crypto; no custom algorithm; no
architecture deviation.

## 32. Risks and Limitations (explicit, mapped)
- **Managed secret-store binding (C4 OPEN residual):** the pilot uses an in-memory store; AWS Secrets
  Manager / HSM binding + at-rest KMS encryption is a deployment binding.
- **Memory zeroisation not guaranteed** by the JS runtime (documented).
- **Matching-engine version segregation** is provided as a stamp + `sameCryptoVersion` helper; wiring it
  into the live contribution/matching path is Phase 4.3 (certified matching engine untouched).

## 33. C4 Closure Assessment → **PARTIALLY CLOSED**
- **Implementation completed:** HMAC-SHA-256 provider, versioned canonical input, jurisdiction peppers,
  lifecycle, governed rotation with **versioned continuity**, recovery, compromise, fail-closed, least
  privilege, secret-free audit.
- **Cloud binding completed:** **NO** — no managed pilot secret store available in this environment.
- **Evidence/tests:** 15 crypto tests incl. a **rotation + recovery exercise completing with versioned
  continuity** (dual-version transition; old≠new; historical metadata preserved).
- **Security review:** narrow surface, no raw-secret exposure (CRYPTO-F1 fixed), least privilege, fail-
  closed. **Privacy review:** no PII/secret leakage; jurisdiction isolation.
- **Residual:** "served from HSM/Secrets Manager" (managed binding + at-rest KMS + least-privilege IAM +
  rotation/recovery drill on the managed store).
- **Retest to fully close:** run the rotation + recovery exercise against the managed pilot secret store.
- **Status: PARTIALLY CLOSED** (per the milestone's explicit instruction not to falsely close C4 without a managed secret-store binding).

## 34. Confirmation That C2 and C3 Remain Accurately Stated
C2 (durable regulator-plane DB + RLS) and C3 (durable append-only audit) remain **PARTIALLY CLOSED**,
**unchanged** by this milestone. No new evidence was produced for them; native database-enforced RLS
(C2) and DB-permission/durable append-only enforcement (C3) remain the outstanding bindings. Milestone
4.2 does **not** claim closure of C2 or C3.

## 35. Provisional Certification Evidence (no final claim)
Contributes provisional evidence toward **C2-2 Security** (keyed HMAC, least privilege, fail-closed,
secret-free audit, no raw-secret exposure) and **C2-3 Privacy** (no PII/secret leakage, jurisdiction
isolation, data minimisation). No pilot readiness is claimed.

## 36. Go / No-Go Recommendation for Phase 4.3
**GO to plan-approve Phase 4.3 (Operator Contribution & Event Platform Wiring)** — the cryptographic
foundation (HMAC provider, versioned canonical input, jurisdiction peppers, rotation, fail-closed) is
complete and tested; the version stamp + segregation helper are ready for the contribution/matching
path. C4 is PARTIALLY CLOSED with a single clear deployment residual (managed secret-store binding).

---
**Phase 4.2 Complete — Awaiting Approval for Phase 4.3 Operator Contribution and Event Platform Wiring.**
