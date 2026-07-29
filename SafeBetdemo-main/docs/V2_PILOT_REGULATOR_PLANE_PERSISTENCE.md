# Pilot Regulator-Plane Persistence (Milestone 4.1)

**ADR-006 (frozen) · Non-production pilot only · No plaintext PII.**

## 1. Overview
Durable, pilot-only persistence for the regulator plane, event-sourced from the certified SB-NAT
Registry. The registry emits every append-only mutation through an injected `RegistryJournal`;
`RegulatorPlaneStore` persists it over a `PersistenceBackend`. Reads are RLS-guarded; audit is
SHA-256-chained; state reconstructs from durable storage. The domain model is unchanged and adapter-
agnostic.

## 2. Modules (`lib/identityFederation/persistence/`)
- `model.ts` — RLS access guard, `HashChainedAudit`, migration plan/validation, access types.
- `journal.ts` — `PersistenceBackend`, `InMemoryBackend`, `DurableFileBackend` (append-only JSONL).
- `store.ts` — `RegulatorPlaneStore` (RegistryJournal port + RLS reads + chained audit + reconstruction + integrity + diagnostics).

## 3. Data disposition (per object)
| Object | Disposition | RLS read | RLS write |
|---|---|---|---|
| `sbnat_records` | authoritative | regulator+jurisdiction | service+jurisdiction |
| `assignment_events` | append-only | regulator+jurisdiction | service+jurisdiction |
| `audit_chain` | append-only (no update/delete) | regulator/auditor+jurisdiction | service (append-only) |
| `decision_history` | append-only | regulator+jurisdiction | service+jurisdiction |
| `review/appeal/override_history` | append-only | regulator+jurisdiction | service+jurisdiction |
| `policy_outcomes` | append-only | regulator+jurisdiction | service+jurisdiction |
| `correlation_results` | reconstructable | regulator+jurisdiction | service / reconstructed |
| `schema_version` | versioned | service | migration-role |

**Reconstructable vs persisted:** correlation results are deterministically reconstructable from
records + provenance references, so they are not duplicated unnecessarily. Authoritative records +
append-only logs are persisted; derived/cached views are reconstructed on demand.

## 4. Durability & reconstruction
`DurableFileBackend` appends JSONL to a non-production base directory; a fresh backend over the same
directory reads all prior state (restart-durable). `reconstructSbNatRegistry(snapshot)` rebuilds the
in-process model: records, minted-id reservations, per-jurisdiction mint counter (derived from
identifiers), and the assignment log — yielding identical domain outcomes and passing integrity.

## 5. Preserved guarantees
Approved-decision-only creation; permanent/never-reused identifiers; split/merge alter mappings only
(SB-PLR unchanged); complete historical reconstruction; cross-jurisdiction merge prohibited; six-part
version metadata immutable; append-only audit; no PII.

## 6. Deployment binding (open residuals)
The pilot store here is a durable file-backed store with application-enforced RLS. At deployment this
binds to a **managed non-production RDS (Postgres) with native RLS** (condition C2) and **durable
WORM audit storage** (condition C3). Both remain OPEN residuals with explicit closure tests.
