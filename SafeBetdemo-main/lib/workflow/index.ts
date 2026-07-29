// ─── Enterprise Workflow & Case Management — public API (v1.5) ───────────────
//
// Workflow is ORCHESTRATION, not intelligence (ADR-005). It coordinates human
// actions AFTER the certified enterprise flow has produced its Recorded Facts,
// Derived Intelligence and Policy Decisions. It consumes and references that
// evidence — it never recalculates intelligence, never re-derives policy,
// never creates runtime state, and never bypasses the Event Platform. Case /
// task / audit / notification records are operational metadata, in the same
// class as connector_runs and operator_subscriptions.
//
// This module is PURE: no I/O, no platform reads. The `workflow` edge function
// is the only operational surface; the Consumer Platform remains the only
// presentation gateway for certified intelligence.

export {
  CASE_TYPES, CASE_STATUSES, PRIORITIES, TASK_STATUSES, EVIDENCE_CLASSES,
  type CaseType, type CaseStatus, type Priority, type TaskStatus, type EvidenceClass,
  type EvidenceRef, type WorkflowCase, type WorkflowTask,
  type WorkflowAuditEntry, type WorkflowNotification,
} from './types.ts';

export {
  formatCaseNumber, SLA_HOURS, computeDueAt, TERMINAL_STATUSES,
  isTerminal, isOverdue, hoursToDue, triagePriority,
} from './caseModel.ts';

export {
  canTransition, allowedTransitions, assertTransition, reviewOutcomeStatus,
  canTransitionTask, WorkflowTransitionError,
} from './stateMachine.ts';

export {
  buildCaseTimeline, describeAudit,
  type TimelineStage, type TimelineStageId,
} from './timeline.ts';

export {
  notificationMessage, attentionItems, sortNotifications, outstandingTasks,
  type NotificationKind,
} from './notifications.ts';

export {
  shapeOperations, caseTrend, type OperationsView,
} from './operations.ts';
