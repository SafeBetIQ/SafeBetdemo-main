// ─── Pilot Regulator-Plane Persistence — public API (Milestone 4.1) ──────────
//
// Durable, pilot-only regulator-plane persistence with application-enforced
// deny-by-default RLS, SHA-256 hash-chained append-only audit, restart/recovery
// reconstruction, integrity verification, and backup. Non-production only; no
// plaintext PII persisted. Native Postgres RLS + managed RDS + WORM audit are
// documented deployment bindings (conditions C2/C3).

export {
  PERSISTENCE_PLANES, PERSISTENCE_ROLES, PILOT_STORE_SCHEMA_VERSION,
  type PersistencePlane, type PersistenceRole, type RegulatorAccessContext,
  assertRegulatorRead, assertServiceWrite, assertOperatorNeverReads, toRegulatorContext,
  type ChainedAuditEntry, type ChainVerification, HashChainedAudit, chainHash,
  type MigrationPlan, pilotMigrationPlan, validateMigrationPlan,
} from './model.ts';

export {
  type PersistenceBackend, InMemoryBackend, DurableFileBackend, DURABLE_STORE_FILES,
} from './journal.ts';

export {
  RegulatorPlaneStore, type RegulatorPlaneStoreOptions, type StoreDiagnostics,
} from './store.ts';
