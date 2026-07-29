# Pilot Append-Only Audit (Milestone 4.1)

**ADR-006 (frozen) · Append-only · SHA-256 tamper-evident · No PII.**

## 1. Model
`HashChainedAudit` is an append-only log of `ChainedAuditEntry { seq, prevHash, hash, record }`.
Each entry links the previous entry's hash and a SHA-256 over `(seq ∥ prevHash ∥ canonical record
JSON)`. The chain exposes **append + list + verify** only — there is **no** update / delete / replace
/ remove on the chain, the `RegulatorPlaneStore`, or the `PersistenceBackend`.

## 2. Audit record fields (no plaintext PII)
audit id, event type / decision rule, jurisdiction, subject SB-NAT, affected SB-PLR references,
decision/registry/policy references (as ids), actor role + reference, reason, timestamp, version
stamp, previous-event linkage (prevHash), integrity metadata (hash), provenance references. A
correction is a **new appended event** referencing the prior record — never an in-place edit.

## 3. Tamper detection (`verify()`)
| Tamper | Detected as |
|---|---|
| Modified record | `modified-record` (hash mismatch) |
| Broken link | `broken-chain` (prevHash mismatch) |
| Gap / reordering | `gap-or-reorder` (seq mismatch) |
| Missing record | broken-chain + seq gap |
All three are exercised in `tests/identityFederation.persistence.test.mjs`; the chain also verifies
intact after a process restart (rehydrated from durable storage).

## 4. Enforcement layers (honest — no over-claim)
| Property | Enforced by | In 4.1 | Deployment binding |
|---|---|---|---|
| Append-only | application design (no mutation surface) | ✅ | DB permissions: no `UPDATE`/`DELETE` grant |
| Tamper-evidence | **cryptographic SHA-256 hash chain** | ✅ | same chain + DB constraints |
| Immutability at rest | — | ⚠️ not claimed | **WORM / immutable storage (C3)** |
| Durable persistence | append-only JSONL file | ✅ | managed RDS / durable log |

**This milestone does NOT claim database-permission immutability.** Append-only is enforced by
application design + a cryptographic chain; DB-permission WORM immutability is a documented deployment
binding (open condition C3).
