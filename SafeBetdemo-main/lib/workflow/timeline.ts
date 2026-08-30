// ─── Workflow — unified case timeline (pure) ─────────────────────────────────
//
// Composes ONE timeline per case from certified-evidence references + the
// case's own coordination history. The stages mirror the enterprise flow and
// extend it with the human-action stages:
//
//   Recorded Fact → Derived Intelligence → Policy Decision
//     → Workflow Action → Recorded Outcome → Case Resolution
//
// Honesty rule (Constitution §8 / WS6): a stage with no data is reported as
// `available: false`. Nothing is fabricated. Intelligence/policy values are
// NOT recomputed here — the platform stages carry evidence REFERENCES; the
// live value is read from the Consumer Platform when displayed.

import type { WorkflowCase, WorkflowAuditEntry, EvidenceRef } from './types.ts';

export type TimelineStageId =
  | 'recorded-fact' | 'derived-intelligence' | 'policy-decision'
  | 'workflow-action' | 'recorded-outcome' | 'case-resolution';

export interface TimelineStage {
  stage: TimelineStageId;
  label: string;
  available: boolean;
  /** Source classification for the audience (Recorded Fact / Derived Intelligence / …). */
  evidenceClass: string;
  /** Present only when available — references or recorded coordination facts, never recomputed values. */
  entries: { at: string | null; detail: string; ref?: string }[];
  /** Honest explanation shown when the stage has no data (UAT-OP-5 P1-2). */
  unavailableNote?: string;
}

const STAGE_LABEL: Record<TimelineStageId, string> = {
  'recorded-fact': 'Recorded Fact',
  'derived-intelligence': 'Derived Intelligence',
  'policy-decision': 'Policy Decision',
  'workflow-action': 'Workflow Action',
  'recorded-outcome': 'Recorded Outcome',
  'case-resolution': 'Case Resolution',
};

function evidenceOf(refs: EvidenceRef[], cls: string): { at: string | null; detail: string; ref: string }[] {
  return refs
    .filter((r) => r.evidenceClass === cls || (cls === 'derived-intelligence' && r.evidenceClass === 'explainable-intelligence'))
    .map((r) => ({ at: null, detail: r.label, ref: r.ref }));
}

/**
 * Build the unified timeline. Platform stages come from evidence references
 * carried on the case (the operator linked them when opening the case from a
 * certified view); human stages come from the append-only audit trail; the
 * resolution stage from the case's terminal state. Missing stages are honest
 * gaps, never invented.
 */
export function buildCaseTimeline(
  workflowCase: WorkflowCase,
  audit: WorkflowAuditEntry[],
): TimelineStage[] {
  const refs = workflowCase.evidenceRefs ?? [];
  const sorted = [...audit].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const recordedFacts = evidenceOf(refs, 'recorded-fact');
  const derived = evidenceOf(refs, 'derived-intelligence');
  const policy = evidenceOf(refs, 'policy-decision');

  // Workflow actions: review / assignment / action-recorded audit entries.
  const actionActions = sorted
    .filter((a) => ['reviewed', 'accepted', 'rejected', 'action-recorded', 'assigned', 'note'].indexOf(a.action) !== -1)
    .map((a) => ({ at: a.at, detail: describeAudit(a) }));

  // Recorded outcome: the human-recorded result of the action.
  const outcomes = sorted
    .filter((a) => a.action === 'outcome-recorded')
    .map((a) => ({ at: a.at, detail: String(a.detail?.outcome ?? 'Outcome recorded.') }));

  const resolution = workflowCase.closedAt
    ? [{ at: workflowCase.closedAt, detail: workflowCase.resolution ?? `Case ${workflowCase.status}.` }]
    : [];

  // Honest, specific wording for an empty stage — never a bare "unavailable"
  // (UAT-OP-5 P1-2). Platform stages carry evidence REFERENCES linked when the case
  // was opened from a certified view; human stages are recorded as the case progresses.
  const UNAVAILABLE_NOTE: Record<TimelineStageId, string> = {
    'recorded-fact': 'No Recorded Fact evidence is linked to this case.',
    'derived-intelligence': 'No Derived Intelligence evidence is linked to this case.',
    'policy-decision': 'No Policy Decision is linked to this case.',
    'workflow-action': 'No workflow action has been recorded yet.',
    'recorded-outcome': 'No outcome has been recorded yet.',
    'case-resolution': 'The case is not yet resolved.',
  };
  const stage = (id: TimelineStageId, entries: TimelineStage['entries']): TimelineStage => ({
    stage: id, label: STAGE_LABEL[id], available: entries.length > 0,
    evidenceClass: id === 'workflow-action' || id === 'recorded-outcome' || id === 'case-resolution' ? 'recorded-fact' : id,
    entries,
    unavailableNote: entries.length > 0 ? undefined : UNAVAILABLE_NOTE[id],
  });

  return [
    stage('recorded-fact', recordedFacts),
    stage('derived-intelligence', derived),
    stage('policy-decision', policy),
    stage('workflow-action', actionActions),
    stage('recorded-outcome', outcomes),
    stage('case-resolution', resolution),
  ];
}

/** Plain-language description of an audit entry for the timeline. */
export function describeAudit(a: WorkflowAuditEntry): string {
  switch (a.action) {
    case 'opened': return `Case opened${a.detail?.caseType ? ` (${a.detail.caseType})` : ''}.`;
    case 'assigned': return `Assigned to ${a.detail?.assignedTo ?? 'owner'}.`;
    case 'reviewed': return `Reviewed by ${a.actor}.`;
    case 'accepted': return `Recommendation accepted${a.detail?.note ? `: ${a.detail.note}` : ''}.`;
    case 'rejected': return `Recommendation rejected${a.detail?.note ? `: ${a.detail.note}` : ''}.`;
    case 'action-recorded': return `Action recorded${a.detail?.action ? `: ${a.detail.action}` : ''}.`;
    case 'outcome-recorded': return `Outcome recorded${a.detail?.outcome ? `: ${a.detail.outcome}` : ''}.`;
    case 'resolved': return `Case resolved${a.detail?.resolution ? `: ${a.detail.resolution}` : ''}.`;
    case 'closed': return `Case closed.`;
    case 'note': return `Note: ${a.detail?.note ?? ''}`;
    default: return `${a.action}${a.fromStatus ? ` (${a.fromStatus} → ${a.toStatus})` : ''}.`;
  }
}
