# SafeBet IQ — Milestone 4.1 Implementation Report

**Pilot Persistence & Regulator-Plane Security · 2026-07-16 · ADR-006 (Accepted, frozen).**
**Environment: Demo/pilot branch, non-production · Production: UNCHANGED · Deployment: NOT AUTHORISED · Federation: OFF by default.**
**Milestone status: COMPLETE. STOP — awaiting approval before Milestone 4.2.**

## 1. Executive Summary
Replaced the isolated in-memory regulator-plane storage with a **durable, pilot-only** persistence
foundation while preserving the certified domain behaviour exactly (full regression unchanged at
**375 pass**). Delivered: a durable append-only **RegulatorPlaneStore** (file-backed pilot backend),
**application-enforced deny-by-default RLS**, a **SHA-256 hash-chained append-only audit** with
tamper detection, durable **SB-NAT Registry** persistence via an injected journal with **restart/
recovery reconstruction**, **runtime-private Registry state** (module-closure encapsulation closing
CERT-L1/C10), a **backup** foundation, and pilot-store **migration validation**. No live operators,
no Event Platform wiring, no pepper activation, no production change, no plaintext PII. Condition
outcomes: **C10 CLOSED**; **C2 PARTIALLY CLOSED**; **C3 PARTIALLY CLOSED** (native Postgres RLS on a
managed RDS and DB-permission WORM immutability are documented deployment bindings).

## 2. Exact C2, C3 and C10 Wording (verbatim from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4)
- **C2 — "Durable regulator-plane database + RLS."** Test: *"Regulator-plane data persisted; RLS negative tests (operator denied) pass against the live store."*
- **C3 — "Durable append-only audit storage."** Test: *"Audit persisted append-only; update/delete attempts rejected at the store."*
- **C10 — "Runtime-private internal state (CERT-L1)."** Test: *"Internal registry state unreachable at runtime; adversarial injection attempt fails."*

## 3. Files Added
- `lib/identityFederation/persistence/model.ts` — RLS access guard (deny-by-default), SHA-256 `HashChainedAudit` + tamper detection, migration plan + validation, access-context types.
- `lib/identityFederation/persistence/journal.ts` — `PersistenceBackend` + `InMemoryBackend` + `DurableFileBackend` (append-only JSONL, restart-durable, backup).
- `lib/identityFederation/persistence/store.ts` — `RegulatorPlaneStore` (RegistryJournal port, RLS-guarded reads, chained audit, reconstruction, integrity, diagnostics).
- `lib/identityFederation/persistence/index.ts` — public API.
- `tests/identityFederation.encapsulation.test.mjs` — 7 adversarial encapsulation tests (C10).
- `tests/identityFederation.persistence.test.mjs` — 14 persistence/RLS/audit/backup/migration tests (C2/C3).

## 4. Files Modified
- `lib/identityFederation/registry.ts` — internal state moved to a **non-exported module WeakMap**; all mutation internals converted to **non-exported module functions**; added an optional injected `RegistryJournal`, a `snapshot()` accessor, and `reconstructSbNatRegistry()`. **Public API + domain semantics unchanged** (375/375 regression).
- `lib/identityFederation/index.ts` — re-exports the persistence API + `reconstructSbNatRegistry` (additive).

## 5. Justification for Every File Changed Outside the Regulator Plane
| File | In regulator plane? | Justification |
|---|---|---|
| `registry.ts` | **Yes** (the SB-NAT Registry) | Runtime encapsulation (C10) + durable journal port; domain behaviour unchanged. |
| `index.ts` | federation public entry | Additive re-export only. |
**No operator application path, production config, production credential/endpoint, or migration was changed.** The durable store is a local, non-production, file-backed pilot store.

## 6. Pilot Store Isolation Evidence
The durable backend writes only to a caller-supplied **non-production base directory** (tests use OS temp dirs). Grep confirms **no** production project id / RDS / AWS / secret / password / api-key reference; persistence imports only `node:crypto`, `node:fs`, `node:path` and internal federation modules — **no** operator/app/Supabase path. Federation remains imported by no operator/UI/edge path. Every store file records `target: 'pilot-nonproduction'`.

## 7. Persistence Architecture
Event-sourced regulator-plane persistence: the `SbNatRegistry` emits every append-only mutation
(record write, assignment, audit) through an injected `RegistryJournal`. `RegulatorPlaneStore`
implements that port over a `PersistenceBackend` (`InMemoryBackend` for tests, `DurableFileBackend`
for durability). Reads are RLS-guarded; the audit is SHA-256-chained; `reconstructSbNatRegistry()`
rebuilds the in-process model from durable records + assignments, yielding **identical domain
outcomes**. The domain model stays adapter-agnostic (no DB behaviour leaks into it).

## 8. Schema and Ownership Model
Regulator-plane objects with explicit data disposition + RLS intent (see `pilotMigrationPlan()`):
`sbnat_records` (authoritative), `assignment_events` (append-only), `audit_chain` (append-only, no
update/delete), `decision/review/appeal/override history` (append-only), `policy_outcomes`
(append-only), `correlation_results` (reconstructable), `schema_version` (versioned). Roles:
application (service, jurisdiction-bound writer), migration, regulator reader, auditor, integrity,
backup. The regulator-plane store is **distinct** from operator operational data.

## 9. RLS Implementation Report
Deny-by-default, jurisdiction-bound, enforced at the store boundary: `assertRegulatorRead`
(regulator plane + sovereign jurisdiction + read-capable role), `assertServiceWrite` (authorised
service plane + jurisdiction + writer role), `assertOperatorNeverReads` (structural check of the
future operator boundary — **not enabled** in 4.1). **Enforcement layer:** application-level in this
milestone; **native Postgres RLS on a managed non-production RDS is the documented deployment
binding** (residual mapped to open C2).

## 10. RLS Test Matrix (against the real store)
| Case | Result |
|---|---|
| Correct-jurisdiction regulator read | allowed |
| Authorised service write context | allowed |
| Operator read | denied |
| Casino-admin read | denied |
| Unauthenticated read | denied |
| Wrong-jurisdiction regulator | denied |
| Cross-sovereign regulator (no explicit authorisation) | denied |
| Cross-sovereign regulator (explicit sovereignJurisdictions) | allowed |
| Regulator role-less write | denied |
| ZA context reading NA/BW/KE | denied (each) |
All executed against `RegulatorPlaneStore` / the access guard, not mocked policy logic.

## 11. Durable Registry Validation
Durable write → `reconstructRegistry()` yields the same SB-NAT set; integrity passes. Approved-only
creation, permanent/never-reused identifiers, split/merge (mappings only), lifecycle history, and
cross-jurisdiction-merge prohibition are all preserved (unchanged 21 registry tests + reconstruction
tests).

## 12. Identifier Integrity Validation
Minting stays monotonic and collision-free; after reconstruction the mint counter is **derived from
the persisted identifiers** and `mintedIds` includes every persisted id (retired/merged/archived
remain reserved forever), so a reconstructed registry **never re-mints an existing id** (tested).
Identifier gaps are treated as permanent reservations — integrity over visual consecutiveness.

## 13. Transaction and Idempotency Validation
Each governed operation appends record + assignment + audit through the journal; a duplicate approved
decision is **idempotent** (one SB-NAT, tested). Single-threaded execution plus idempotent create
means repeated/concurrent submission does not create duplicates; reconstruction preserves the
counter so post-restart mints do not collide.

## 14. Split and Merge Persistence Validation
Split/merge persist through the journal and reconstruct identically; SB-PLR identifiers are never
modified; absorbed/merged identifiers are retained. (Covered by the reconstruction + integrity tests
and the unchanged split/merge registry suite.)

## 15. Historical Reconstruction Validation
`reconstructMappingAt` and full-state reconstruction rebuild membership from the persisted assignment
log; the reconstructed registry's clock defaults to the latest persisted timestamp so historical-
consistency verification includes the entire log. Process-restart reconstruction (fresh backend over
the same directory) reproduces records + integrity + audit chain (tested).

## 16. Append-Only Audit Validation
`HashChainedAudit` supports **append + read + verify** only — there is **no** update/delete/replace/
remove surface on the chain, the store, or the backend (asserted `undefined`). A correction must be a
new appended event. Audit entries carry the full reproducibility fields and **no PII**.

## 17. Audit Tamper-Detection Validation
Each entry links `prevHash` and a SHA-256 `hash` over (seq ∥ prevHash ∥ record). `verify()` detects
**modified records**, **broken chains**, and **gaps/reordering** (all three tested). **Honest scope:**
append-only + tamper-evidence are enforced by **application design + a cryptographic SHA-256 chain**;
**database-permission immutability (no UPDATE/DELETE grant) + WORM storage is the deployment binding**
(residual mapped to open C3). No claim of database-permission immutability is made here.

## 18. Runtime Encapsulation Validation (CERT-L1 / C10)
Internal state lives in a **non-exported module `WeakMap`** and all mutation logic in **non-exported
module functions**. At runtime `registry.records/counters/mintedIds/assignments/auditSink` are
`undefined`, and `registry.mint/commit/write/assign/audit` do not exist. No global TypeScript target
change was made; no ECMAScript `#private` was used. `Object.getOwnPropertyNames(registry)` exposes no
state. This is the approved Phase 4.0 recommendation (module-closure + adversarial tests + service-
boundary hardening).

## 19. Adversarial Encapsulation Test Results
7/7 pass: internal state unreachable (ENC-1); mutation internals not exposed (ENC-2); returned
records + history immutable (ENC-3); arbitrary insertion impossible + returned list mutation harmless
(ENC-4); counter cannot be reset (ENC-5); audit trail immutable (ENC-6); approved-decision validation
cannot be bypassed — no `commit()` path (ENC-7). Tests assert **runtime** behaviour, not compile-time.

## 20. Persistence Adapter Validation
Clean domain↔storage separation via `PersistenceBackend`; supports append-only writes, authorised
reads, reconstruction, and backup. The domain remains testable with `InMemoryBackend`; the
`DurableFileBackend` adds durability without leaking DB specifics into the domain model.

## 21. Migration Validation
`pilotMigrationPlan()` (additive, reversible, `target: pilot-nonproduction`) with per-object data
disposition + RLS intent; `validateMigrationPlan()` is the dry-run — it accepts the pilot plan and
**rejects** a non-pilot target or an invalid disposition (tested). No migration is applied to
production.

## 22. Synthetic Dataset Persistence Validation
A seeded synthetic load persists through the store; reconstruction reconciles record counts with the
live registry and passes registry integrity + audit-chain verification (tested). Synthetic records
carry the demo clock + synthetic references only — clearly not real pilot data.

## 23. Backup and Restore Foundation
`DurableFileBackend.backupTo()` copies every store file to a backup directory; a new store over the
backup reconstructs the registry and passes **post-restore integrity** (registry + audit chain)
(tested). A full operational restore drill (RPO/RTO, scheduled) remains mapped to **Phase 4.7** per
the approved roadmap — not claimed here.

## 24. Failure-Mode Validation
Malformed SB-NAT → `AccessDeniedError`; missing context → denied; wrong jurisdiction → denied;
reconstruction without a service/integrity context → denied; duplicate submission → idempotent. Errors
are safe (codes + non-sensitive messages), free of sensitive data.

## 25. Security Validation
Deny-by-default RLS; regulator-only reads; **no operator federation reads** (structural boundary,
not enabled); jurisdiction + sovereign isolation; append-only audit with tamper detection; runtime-
private Registry state; safe errors; no sensitive logging; migration-role separation (in the plan);
**no production credentials or endpoints; production pepper/key-management deliberately not
implemented (Phase 4.2).**

## 26. Privacy and PII Leakage Validation
Only approved hashes, anonymous identifiers, references, version metadata, governance + audit history
are persisted — no plaintext national id/passport/phone/email/payment/name/address. A serialised scan
of persisted records + assignments + diagnostics is clean (email + long-digit + attribute-token
heuristics); the audit scan excludes only the benign `auditId` timestamp integer (documented, not PII).

## 27. Performance Notes (pilot-scale, not production load)
Durable write/reconstruct/integrity/audit-verify/backup all complete sub-second on the seeded pilot
dataset. Dataset volume: a handful of clusters (representative). Environment: local Node + OS temp
directory. This is pilot-scale validation only — **not** production-scale load certification.

## 28. Milestone Test Results
`identityFederation.encapsulation` → **7 pass**; `identityFederation.persistence` → **14 pass**
(durable write/read, restart reconstruction, counter continuity, RLS matrix, service-write, sovereign
separation, reconstruction authorisation, append-only + tamper detection, backup/restore + post-
restore integrity, migration validation, synthetic reconciliation, no-PII, failure modes).

## 29. Full Regression Results
**375 pass / 0 fail** (354 prior + 21 new). The registry encapsulation refactor is behaviourally
transparent (all prior domain tests unchanged).

## 30. TypeScript Validation
`npx tsc --noEmit` → clean.

## 31. Import-Boundary Validation
Federation imported by no operator/UI/edge path; persistence imports only `node:crypto`/`node:fs`/
`node:path` + internal federation modules. No operator-runtime/app/Supabase import.

## 32. Technical Debt Check
**None.** No TODO/stub/placeholder/temporary markers; no mock durable adapter presented as real
persistence (the durable file backend is genuinely durable); RLS not deferred within scope; no mutable
Registry internals exposed; no record/audit update/delete surface; no plaintext PII; no production
config/credential; transactions/idempotency handled; migration validation present; no weakened tests;
no architecture deviation.

## 33. Risks and Limitations (explicit, mapped to open conditions)
- **RLS enforcement layer:** application-level in 4.1; native Postgres RLS on managed RDS is a
  deployment binding → **open C2 residual**.
- **Audit immutability:** application design + SHA-256 tamper-evidence in 4.1; DB-permission WORM is a
  deployment binding → **open C3 residual**.
- **Durable store medium:** a local file-backed pilot store (genuinely durable, non-production), not a
  managed RDS instance — the managed-RDS binding is C2/C6.
- **Full restore drill (RPO/RTO):** foundation implemented + tested; the operational drill maps to
  **Phase 4.7**.

## 34. C2 Closure Assessment → **PARTIALLY CLOSED**
- **Implementation:** durable regulator-plane persistence (`DurableFileBackend`) + application-enforced
  deny-by-default RLS (`assertRegulatorRead`/`assertServiceWrite`).
- **Evidence/tests:** RLS negative matrix (operator/admin/unauth/wrong-jur/cross-sovereign denied) runs
  **against the real store**; durable write + reconstruction verified.
- **Residual:** native Postgres RLS on a managed non-production RDS (deployment binding).
- **Retest:** RLS negatives against the managed store once provisioned. **Status: PARTIALLY CLOSED.**

## 35. C3 Closure Assessment → **PARTIALLY CLOSED**
- **Implementation:** durable append-only audit (JSONL) + SHA-256 hash chain; no update/delete surface.
- **Evidence/tests:** append succeeds; update/delete absent; modified/reordered/broken-chain detected;
  chain intact after restart.
- **Residual:** database-permission WORM immutability (no UPDATE/DELETE grant + immutable storage) is a
  deployment binding.
- **Retest:** store-level mutation-rejection on the managed store. **Status: PARTIALLY CLOSED.**

## 36. C10 Closure Assessment → **CLOSED**
- **Implementation:** runtime-private Registry state (module WeakMap + module functions); service-
  boundary hardening; **no** global TS-target change.
- **Evidence/tests:** 7 adversarial runtime tests (state unreachable, no mutation methods, immutable
  returns, no arbitrary insert, no counter reset, immutable audit, no validation bypass); 375/375
  regression.
- **Residual:** none (LOW finding remediated at the current build target).
- **Retest:** adversarial suite + regression. **Status: CLOSED.**

## 37. Provisional Certification Evidence (no final claim)
Contributes provisional evidence toward **C2-2 Security** (durable RLS + immutable audit + runtime
encapsulation), **C2-1 Architecture** (domain unchanged, additive, isolated), **C2-6 Operational
Readiness** (persistence + backup foundation + integrity checkers). No pilot readiness is claimed;
this is one Phase 4 milestone. Final certification remains reserved.

## 38. Go / No-Go Recommendation for Phase 4.2
**GO to plan-approve Phase 4.2 (Pepper & Cryptographic Operations)** — the persistence + regulator-
plane security foundation is complete, durable, RLS-guarded, tamper-evident, runtime-encapsulated,
integrity-verifiable, and isolated from production. C10 is CLOSED; C2/C3 are PARTIALLY CLOSED with
explicit deployment bindings. Phase 4.2 will add Secrets Manager/HSM pepper management + rotation
(C4) on this foundation.

---
**Phase 4.1 Complete — Awaiting Approval for Phase 4.2 Pepper and Cryptographic Operations.**
