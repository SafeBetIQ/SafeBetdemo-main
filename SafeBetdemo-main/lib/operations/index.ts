// Enterprise Operations — public API (Phase 4.4).
//
// Operational governance ONLY: modes, monitoring, scheduled maintenance.
// Never changes business rules; orchestrates existing platform capabilities.

export {
  OPERATING_MODES, DEFAULT_MODE, type OperatingMode, type OperationalProfile,
  normalizeMode, resolveOperatingMode, operationalProfile,
} from './mode.ts';
export {
  type AlertSeverity, type HealthSnapshot, type OperationalAlert,
  overallSeverity, evaluateHealth,
} from './monitoring.ts';
export {
  type OpsClient, type TaskResult,
  ensurePartitions, verifyHealth, assessProjectionIntegrity, archiveDryRun,
} from './scheduledOps.ts';
