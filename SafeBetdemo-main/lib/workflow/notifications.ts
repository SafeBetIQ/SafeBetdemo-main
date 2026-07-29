// ─── Workflow — notifications & task surfacing (pure) ────────────────────────
//
// Notifications INFORM humans; they never trigger business logic (WS7). These
// helpers derive what a user should be told from case state — the edge
// function persists the rows; nothing here mutates the platform or a case.

import type { WorkflowCase, WorkflowTask, WorkflowNotification } from './types.ts';
import { isOverdue, hoursToDue, isTerminal } from './caseModel.ts';

export type NotificationKind =
  | 'case-assigned' | 'case-overdue' | 'case-due-soon'
  | 'awaiting-review' | 'investigation-updated' | 'compliance-deadline-approaching';

/** Compose a notification message for a case event (informational only). */
export function notificationMessage(kind: NotificationKind, c: WorkflowCase): string {
  switch (kind) {
    case 'case-assigned': return `Case ${c.caseNumber} assigned to you — ${c.title}.`;
    case 'case-overdue': return `Case ${c.caseNumber} is overdue (${c.priority} priority).`;
    case 'case-due-soon': return `Case ${c.caseNumber} is due soon.`;
    case 'awaiting-review': return `Case ${c.caseNumber} is awaiting your review.`;
    case 'investigation-updated': return `Investigation ${c.caseNumber} was updated.`;
    case 'compliance-deadline-approaching': return `Compliance case ${c.caseNumber} deadline is approaching.`;
  }
}

/**
 * Derive attention items across a set of cases: overdue, due-soon (< 12h), and
 * awaiting-review. Pure — used by the edge function to raise notifications and
 * by the operations view to surface bottlenecks. Never mutates.
 */
export function attentionItems(
  cases: WorkflowCase[],
  now: Date = new Date(),
  dueSoonHours = 12,
): { case: WorkflowCase; kind: NotificationKind; reason: string }[] {
  const out: { case: WorkflowCase; kind: NotificationKind; reason: string }[] = [];
  for (const c of cases) {
    if (isTerminal(c.status)) continue;
    if (isOverdue(c.dueAt, c.status, now)) {
      out.push({ case: c, kind: 'case-overdue', reason: `overdue since ${c.dueAt}` });
      continue;
    }
    const h = hoursToDue(c.dueAt, now);
    if (h !== null && h >= 0 && h <= dueSoonHours) {
      out.push({ case: c, kind: 'case-due-soon', reason: `due in ${h}h` });
    } else if (c.status === 'open' || c.status === 'in-review') {
      out.push({ case: c, kind: 'awaiting-review', reason: `status ${c.status}` });
    }
  }
  return out;
}

/** Unread notifications first, newest first. */
export function sortNotifications(ns: WorkflowNotification[]): WorkflowNotification[] {
  return [...ns].sort((a, b) => {
    if (!!a.readAt !== !!b.readAt) return a.readAt ? 1 : -1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

/** Open compliance/intervention tasks that are overdue or escalated. */
export function outstandingTasks(tasks: WorkflowTask[], now: Date = new Date()): WorkflowTask[] {
  return tasks.filter((t) =>
    t.status !== 'completed' &&
    (t.status === 'escalated' || (t.dueAt !== null && Date.parse(t.dueAt) < now.getTime())),
  );
}
