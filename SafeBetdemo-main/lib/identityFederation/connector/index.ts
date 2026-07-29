// ─── Operator Connector Sandbox — public API (Milestone 4.4) ─────────────────
//
// One controlled, vendor-neutral, NON-PRODUCTION operator connector: authenticate
// (one operator/tenant/jurisdiction) → read synthetic source → resolve SB-PLR →
// hash-before-boundary (4.2) → submit hash-only contribution via the certified
// Event Platform (4.3). Write-only w.r.t. federation; cannot read federation data.
// No production casino / credential / endpoint.

export {
  CONNECTOR_STATES, CONNECTOR_TRANSITIONS, canConnectorTransition, ConnectorError,
  SOURCE_STATUSES, CONNECTOR_AUDIT_ACTIONS,
  type ConnectorState, type RateLimit, type RetryPolicy, type ConnectorConfig,
  type ConnectorCheckpoint, type ConnectorHealth, type SourceStatus, type OperatorSourceRecord,
  type SandboxSource, InMemorySandboxSource,
  type ConnectorIdentityBinding, ConnectorAuthenticator,
  type CheckpointStore, InMemoryCheckpointStore,
  type ConnectorAuditAction, type ConnectorAuditRecord, type ConnectorAuditSink,
  InMemoryConnectorAuditSink, sealConnectorAudit,
  type ConnectorDeadLetter, type ConnectorReconciliationReport,
} from './model.ts';

export {
  OperatorConnector, type OperatorConnectorOptions, type ConnectorAdminContext, type SyncSummary,
} from './connector.ts';
