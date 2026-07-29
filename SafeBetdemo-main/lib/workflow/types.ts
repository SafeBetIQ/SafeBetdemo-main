// ─── Enterprise Workflow & Case Management — domain types (v1.5) ─────────────
//
// Workflow is ORCHESTRATION, not intelligence. These types describe the
// coordination of HUMAN actions after the certified enterprise flow has
// already produced its Recorded Facts, Derived Intelligence and Policy
// Decisions. A case REFERENCES that evidence by identifier — it never copies
// intelligence, never stores risk scores as authoritative state, and never
// re-derives anything. This is operational metadata (like connector_runs /
// operator_subscriptions), not casino runtime state (Constitution 2).

/** Where a case came from. */
export const CASE_TYPES = [
  'high-risk-player',        // a player the Domain Intelligence Platform flagged
  'rg-recommendation',       // a responsible-gambling recommendation to action
  'compliance-finding',      // a compliance obligation / finding to resolve
  'regulatory-investigation',// a regulator-opened investigation
  'manual',                  // operator-created
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

/**
 * Case lifecycle. Mirrors the intervention workflow:
 * open → in-review → accepted/rejected → action-recorded → outcome-recorded
 * → resolved → closed. `closed` is the only fully terminal state.
 */
export const CASE_STATUSES = [
  'open', 'in-review', 'accepted', 'rejected',
  'action-recorded', 'outcome-recorded', 'resolved', 'closed',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STATUSES = ['open', 'in-progress', 'completed', 'escalated'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Evidence classification (Constitution §8). A case links to evidence the
 * platform already produced; it never re-represents it. `ref` is an
 * identifier into the certified flow (event id, SB-PLR player id, policy
 * decision id, explanation reference) — the live value is always read back
 * from the Consumer Platform, never trusted from the case row.
 */
export const EVIDENCE_CLASSES = [
  'recorded-fact', 'derived-intelligence', 'policy-decision', 'explainable-intelligence',
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export interface EvidenceRef {
  evidenceClass: EvidenceClass;
  kind: string;   // e.g. 'player', 'policy-decision', 'event', 'risk-assessment'
  ref: string;    // identifier into the certified flow (never a copied value)
  label: string;  // human label for display
}

export interface WorkflowCase {
  id: string;
  caseNumber: string;
  casinoId: string;
  caseType: CaseType;
  status: CaseStatus;
  priority: Priority;
  title: string;
  summary: string | null;
  /** Anonymous subject reference — SB-PLR player id, or a decision/obligation id. Never PII. */
  subjectKind: string;
  subjectRef: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  openedAt: string;
  closedAt: string | null;
  resolution: string | null;
  evidenceRefs: EvidenceRef[];
  createdBy: string;
  updatedAt: string;
}

export interface WorkflowTask {
  id: string;
  caseId: string;
  casinoId: string;
  taskType: string;              // 'compliance-action' | 'intervention-step' | …
  description: string;
  status: TaskStatus;
  assignedTo: string | null;
  dueAt: string | null;
  completedAt: string | null;
  notes: string | null;
  evidenceRef: string | null;    // reference to an existing Policy Decision / fact
}

/** Append-only audit entry — the case's immutable coordination history. */
export interface WorkflowAuditEntry {
  id: string;
  caseId: string;
  casinoId: string;
  at: string;
  actor: string;
  action: string;                // 'opened' | 'assigned' | 'reviewed' | 'action-recorded' | …
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus | null;
  detail: Record<string, unknown>;
}

export interface WorkflowNotification {
  id: string;
  casinoId: string;
  caseId: string | null;
  recipient: string;             // user id or role
  kind: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}
