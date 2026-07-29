// ─── Workflow — case state machine (pure) ────────────────────────────────────
//
// The allowed lifecycle transitions. This encodes the intervention workflow
// (Recommendation → Operator Review → Accept/Reject → Action Recorded →
// Outcome Recorded → Case Closed) and the generic case lifecycle. It is pure
// policy-of-coordination — it decides what a HUMAN may do next, never a
// business/policy outcome (which belongs to the Policy Platform).

import type { CaseStatus, TaskStatus } from './types.ts';

/** Permitted next states for each case status. */
const CASE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  'open':             ['in-review', 'rejected', 'closed'],
  'in-review':        ['accepted', 'rejected', 'closed'],
  'accepted':         ['action-recorded', 'closed'],
  'action-recorded':  ['outcome-recorded', 'closed'],
  'outcome-recorded': ['resolved', 'closed'],
  'resolved':         ['closed'],
  'rejected':         ['closed'],
  'closed':           [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return (CASE_TRANSITIONS[from] ?? []).indexOf(to) !== -1;
}

export function allowedTransitions(from: CaseStatus): CaseStatus[] {
  return [...(CASE_TRANSITIONS[from] ?? [])];
}

export class WorkflowTransitionError extends Error {
  readonly status = 409;
  constructor(from: CaseStatus, to: CaseStatus) {
    super(`illegal case transition: '${from}' → '${to}'`);
    this.name = 'WorkflowTransitionError';
  }
}

/** Assert a transition or throw. Rejecting an illegal move — never repairing it. */
export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransition(from, to)) throw new WorkflowTransitionError(from, to);
}

/**
 * The intervention-review decision maps an accept/reject to the next status.
 * Accepting a recommendation moves the case to 'accepted' (an action is now
 * expected); rejecting records the reason and moves to 'rejected'. No
 * intervention is ever executed by the platform — a human records what they
 * did next.
 */
export function reviewOutcomeStatus(decision: 'accept' | 'reject'): CaseStatus {
  return decision === 'accept' ? 'accepted' : 'rejected';
}

// ─── Compliance task lifecycle ───────────────────────────────────────────────

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'open':        ['in-progress', 'escalated', 'completed'],
  'in-progress': ['completed', 'escalated'],
  'escalated':   ['in-progress', 'completed'],
  'completed':   [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (TASK_TRANSITIONS[from] ?? []).indexOf(to) !== -1;
}
