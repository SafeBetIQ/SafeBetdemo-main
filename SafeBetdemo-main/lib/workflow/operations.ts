// ─── Workflow — executive operations shaping (pure) ──────────────────────────
//
// Composes operational KPIs from case/task METADATA only (WS5). Every metric
// is a count/ratio over the workflow's own coordination records — it consumes
// no runtime state and recalculates no intelligence. SLA performance is
// measured over cases the humans have already resolved.

import type { WorkflowCase, WorkflowTask, CaseStatus, CaseType } from './types.ts';
import { isOverdue, isTerminal } from './caseModel.ts';

export interface OperationsView {
  openCases: number;
  overdueCases: number;
  resolvedCases: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  /** SLA performance among terminal cases: resolved within due vs breached. */
  slaPerformance: { onTime: number; breached: number; rate: number };
  interventionCompletion: { total: number; completed: number; rate: number };
  complianceCompletion: { total: number; completed: number; rate: number };
  outstandingInvestigations: number;
  /** Operational bottlenecks: non-terminal cases dwelling in a review state. */
  bottlenecks: { status: string; count: number }[];
  note: string;
  evidenceClass: 'recorded-fact';
}

function ratio(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 1000;
}

export function shapeOperations(
  cases: WorkflowCase[],
  tasks: WorkflowTask[],
  now: Date = new Date(),
): OperationsView {
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  let openCases = 0, overdueCases = 0, resolvedCases = 0;
  let slaOnTime = 0, slaBreached = 0;
  let investigations = 0;

  for (const c of cases) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    byType[c.caseType] = (byType[c.caseType] ?? 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] ?? 0) + 1;

    if (!isTerminal(c.status)) openCases++;
    if (isOverdue(c.dueAt, c.status, now)) overdueCases++;
    if (c.status === 'resolved' || c.status === 'closed') resolvedCases++;
    if (c.caseType === 'regulatory-investigation' && !isTerminal(c.status)) investigations++;

    // SLA measured only where we can compare closure against the due date.
    if ((c.status === 'resolved' || c.status === 'closed') && c.dueAt && c.closedAt) {
      if (Date.parse(c.closedAt) <= Date.parse(c.dueAt)) slaOnTime++; else slaBreached++;
    }
  }

  // Intervention completion: intervention-origin cases reaching outcome/resolution.
  const interventionCases = cases.filter((c) => c.caseType === 'rg-recommendation' || c.caseType === 'high-risk-player');
  const interventionDone = interventionCases.filter((c) =>
    ['outcome-recorded', 'resolved', 'closed'].indexOf(c.status) !== -1).length;

  // Compliance completion: over compliance tasks.
  const complianceTasks = tasks.filter((t) => t.taskType === 'compliance-action');
  const complianceDone = complianceTasks.filter((t) => t.status === 'completed').length;

  const bottleneckStatuses: CaseStatus[] = ['in-review', 'accepted', 'action-recorded'];
  const bottlenecks = bottleneckStatuses
    .map((s) => ({ status: s, count: byStatus[s] ?? 0 }))
    .filter((b) => b.count > 0);

  return {
    openCases,
    overdueCases,
    resolvedCases,
    byStatus,
    byType,
    byPriority,
    slaPerformance: { onTime: slaOnTime, breached: slaBreached, rate: ratio(slaOnTime, slaOnTime + slaBreached) },
    interventionCompletion: { total: interventionCases.length, completed: interventionDone, rate: ratio(interventionDone, interventionCases.length) },
    complianceCompletion: { total: complianceTasks.length, completed: complianceDone, rate: ratio(complianceDone, complianceTasks.length) },
    outstandingInvestigations: investigations,
    bottlenecks,
    note: 'Operational metrics composed from workflow case/task metadata only. No runtime state, no intelligence recomputation.',
    evidenceClass: 'recorded-fact',
  };
}

/** Simple case-volume trend by opened-day (for the executive view). */
export function caseTrend(cases: WorkflowCase[]): { day: string; opened: number }[] {
  const byDay: Record<string, number> = {};
  for (const c of cases) {
    const day = (c.openedAt ?? '').slice(0, 10);
    if (day) byDay[day] = (byDay[day] ?? 0) + 1;
  }
  return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, opened]) => ({ day, opened }));
}

export type { CaseType };
