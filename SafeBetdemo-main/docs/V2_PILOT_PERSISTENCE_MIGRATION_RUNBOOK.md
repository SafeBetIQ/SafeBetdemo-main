# Pilot Persistence Migration Runbook (Milestone 4.1)

**ADR-006 (frozen) · Additive · Reversible · PILOT NON-PRODUCTION ONLY. Do NOT apply to production.**

## 1. Scope
The pilot regulator-plane store is a durable, append-only, file-backed store (`DurableFileBackend`)
under a non-production base directory. "Migration" here means **initialising + versioning + validating**
the pilot store schema and confirming its data disposition + RLS intent. At deployment this binds to a
managed non-production RDS schema migration (condition C2) — the same plan drives that binding.

## 2. Migration plan (`pilotMigrationPlan()`)
- `schemaVersion = 4.1.0`, `target = pilot-nonproduction`, `reversible = true`.
- Objects with disposition + RLS intent: `sbnat_records` (authoritative), `assignment_events`,
  `audit_chain`, `decision_history`, `review_appeal_override_history`, `policy_outcomes` (append-only),
  `correlation_results` (reconstructable), `schema_version` (versioned).

## 3. Dry-run / validation
`validateMigrationPlan(plan)` verifies: `target === 'pilot-nonproduction'`, a schema version is present,
and every object has a valid disposition + RLS read/write intent. It **rejects** a non-pilot target or
an invalid disposition (tested). Run the dry-run before initialising any store.

## 4. Procedure (pilot)
1. Confirm the **non-production** base directory (never a production path).
2. `validateMigrationPlan(pilotMigrationPlan())` → must be `ok`.
3. Construct `new DurableFileBackend(baseDir)` — initialises the schema-version file + directory
   layout (idempotent: existing files are preserved; the schema file is written once).
4. Construct `new RegulatorPlaneStore({ backend })` — rehydrates the audit chain from disk.
5. Wire the registry: `new SbNatRegistry({ persistence: store, ... })`.
6. Verify: `store.diagnostics(integrityCtx)` → `registryIntegrityOk` + `auditChainOk` true.

## 5. Reversibility & idempotency
- Store initialisation is **idempotent** — re-running over an existing directory preserves data and
  does not duplicate the schema file.
- Reversal (pilot): remove the non-production base directory (destroys the pilot store only). No
  production object is ever touched.
- Managed-RDS deployment binding: additive, reversible migrations with explicit ownership/RLS/indexes/
  constraints/append-only controls — validated by the same plan; **never executed against production**.

## 6. Guardrails
- No production database, schema, RLS, IAM, networking, credential, or endpoint is modified.
- Migrations target only the approved non-production pilot store.
- A production migration requires a separate, explicitly authorised production readiness process.
