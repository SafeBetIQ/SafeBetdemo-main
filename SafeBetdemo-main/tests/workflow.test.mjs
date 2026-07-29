// Tests for the Enterprise Workflow & Case Management libs (v1.5).
// Run: node --test tests/workflow.test.mjs
//
// These prove the workflow layer ORCHESTRATES and never recalculates: pure
// case model, a strict state machine, honest timelines (no fabricated stages),
// evidence references (never copied intelligence), and operations metrics
// composed from metadata only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CASE_TYPES, CASE_STATUSES, PRIORITIES,
  formatCaseNumber, computeDueAt, SLA_HOURS, isTerminal, isOverdue, hoursToDue, triagePriority,
  canTransition, allowedTransitions, assertTransition, reviewOutcomeStatus, canTransitionTask,
  WorkflowTransitionError,
  buildCaseTimeline, describeAudit,
  notificationMessage, attentionItems, sortNotifications, outstandingTasks,
  shapeOperations, caseTrend,
} from '../lib/workflow/index.ts';

const CASINO = 'a1b2c3d4-0000-0000-0000-000000000001';
const NOW = new Date('2026-07-16T12:00:00.000Z');

function mkCase(over = {}) {
  return {
    id: over.id ?? 'c1', caseNumber: over.caseNumber ?? 'HRP-2026-001000', casinoId: CASINO,
    caseType: over.caseType ?? 'high-risk-player', status: over.status ?? 'open',
    priority: over.priority ?? 'high', title: over.title ?? 'Test case', summary: null,
    subjectKind: 'player', subjectRef: over.subjectRef ?? 'SB-PLR-ABCDEF0123456789ABCDEF01',
    assignedTo: over.assignedTo ?? null, dueAt: over.dueAt ?? null,
    openedAt: over.openedAt ?? NOW.toISOString(), closedAt: over.closedAt ?? null,
    resolution: over.resolution ?? null, evidenceRefs: over.evidenceRefs ?? [],
    createdBy: 'user:x', updatedAt: NOW.toISOString(),
  };
}
function mkAudit(over = {}) {
  return { id: over.id ?? 'a1', caseId: 'c1', casinoId: CASINO, at: over.at ?? NOW.toISOString(),
    actor: over.actor ?? 'user:x', action: over.action ?? 'opened', fromStatus: over.fromStatus ?? null,
    toStatus: over.toStatus ?? null, detail: over.detail ?? {} };
}

// ─── Case model (pure) ───────────────────────────────────────────────────────

test('case numbers are human-readable, type-prefixed and zero-padded', () => {
  assert.equal(formatCaseNumber('high-risk-player', 1000, NOW), 'HRP-2026-001000');
  assert.equal(formatCaseNumber('compliance-finding', 42, NOW), 'CMP-2026-000042');
  assert.equal(formatCaseNumber('regulatory-investigation', 7, NOW), 'REG-2026-000007');
});

test('due date derives from priority SLA', () => {
  const opened = '2026-07-16T00:00:00.000Z';
  assert.equal(computeDueAt(opened, 'critical'), new Date(Date.parse(opened) + SLA_HOURS.critical * 3600000).toISOString());
  assert.ok(Date.parse(computeDueAt(opened, 'low')) > Date.parse(computeDueAt(opened, 'critical')));
});

test('overdue respects terminal states (no SLA once closed)', () => {
  const past = new Date(NOW.getTime() - 3600000).toISOString();
  assert.equal(isOverdue(past, 'open', NOW), true);
  assert.equal(isOverdue(past, 'closed', NOW), false, 'closed cases are never overdue');
  assert.equal(isOverdue(null, 'open', NOW), false, 'no due date → not overdue');
  assert.equal(isTerminal('resolved'), true);
  assert.equal(isTerminal('in-review'), false);
});

test('triagePriority reads an ALREADY-COMPUTED escalation level (never computes risk)', () => {
  assert.equal(triagePriority('critical'), 'critical');
  assert.equal(triagePriority('high'), 'high');
  assert.equal(triagePriority('watch'), 'medium');
  assert.equal(triagePriority(undefined), 'low', 'absent intelligence → lowest triage, nothing invented');
});

// ─── State machine (pure) ────────────────────────────────────────────────────

test('the intervention lifecycle follows the mandated path', () => {
  // Recommendation(open) → Review → Accept → Action → Outcome → Resolve → Close
  assert.ok(canTransition('open', 'in-review'));
  assert.ok(canTransition('in-review', 'accepted'));
  assert.ok(canTransition('accepted', 'action-recorded'));
  assert.ok(canTransition('action-recorded', 'outcome-recorded'));
  assert.ok(canTransition('outcome-recorded', 'resolved'));
  assert.ok(canTransition('resolved', 'closed'));
});

test('illegal transitions are rejected, never repaired', () => {
  assert.equal(canTransition('open', 'resolved'), false);
  assert.equal(canTransition('accepted', 'outcome-recorded'), false);
  assert.equal(canTransition('closed', 'open'), false, 'closed is terminal');
  assert.throws(() => assertTransition('open', 'resolved'), WorkflowTransitionError);
});

test('review maps accept/reject to the correct next status', () => {
  assert.equal(reviewOutcomeStatus('accept'), 'accepted');
  assert.equal(reviewOutcomeStatus('reject'), 'rejected');
  assert.deepEqual(allowedTransitions('in-review').sort(), ['accepted', 'closed', 'rejected']);
});

test('a rejected recommendation may only close (no auto-execution path)', () => {
  assert.deepEqual(allowedTransitions('rejected'), ['closed']);
});

test('task lifecycle transitions are enforced', () => {
  assert.ok(canTransitionTask('open', 'in-progress'));
  assert.ok(canTransitionTask('in-progress', 'completed'));
  assert.equal(canTransitionTask('completed', 'open'), false);
});

// ─── Timeline (pure) — honest, never fabricated ──────────────────────────────

test('timeline traces Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution', () => {
  const c = mkCase({
    status: 'closed', closedAt: NOW.toISOString(), resolution: 'Player self-excluded voluntarily.',
    evidenceRefs: [
      { evidenceClass: 'recorded-fact', kind: 'event', ref: 'evt-1', label: '3 interventions recorded' },
      { evidenceClass: 'derived-intelligence', kind: 'risk-assessment', ref: 'SB-PLR-X', label: 'Risk escalation: high' },
      { evidenceClass: 'policy-decision', kind: 'policy-decision', ref: 'dec-1', label: 'ZA-RG-001 monitor' },
    ],
  });
  const audit = [
    mkAudit({ action: 'opened', toStatus: 'open' }),
    mkAudit({ action: 'accepted', detail: { note: 'valid' } }),
    mkAudit({ action: 'action-recorded', detail: { action: 'Contacted player' } }),
    mkAudit({ action: 'outcome-recorded', detail: { outcome: 'Player agreed to cool-off' } }),
  ];
  const t = buildCaseTimeline(c, audit);
  const byStage = Object.fromEntries(t.map((s) => [s.stage, s]));
  assert.equal(byStage['recorded-fact'].available, true);
  assert.equal(byStage['derived-intelligence'].available, true);
  assert.equal(byStage['policy-decision'].available, true);
  assert.equal(byStage['workflow-action'].available, true);
  assert.equal(byStage['recorded-outcome'].available, true);
  assert.equal(byStage['case-resolution'].available, true);
  assert.equal(byStage['case-resolution'].entries[0].detail, 'Player self-excluded voluntarily.');
});

test('timeline reports missing stages as unavailable — nothing is fabricated', () => {
  const c = mkCase({ status: 'open', evidenceRefs: [] });
  const t = buildCaseTimeline(c, [mkAudit({ action: 'opened' })]);
  const byStage = Object.fromEntries(t.map((s) => [s.stage, s]));
  assert.equal(byStage['recorded-fact'].available, false);
  assert.equal(byStage['derived-intelligence'].available, false);
  assert.equal(byStage['policy-decision'].available, false);
  assert.equal(byStage['recorded-outcome'].available, false);
  assert.equal(byStage['case-resolution'].available, false);
  // and unavailable stages carry no invented entries
  assert.equal(byStage['policy-decision'].entries.length, 0);
});

test('timeline references evidence — it never copies intelligence values', () => {
  const c = mkCase({ evidenceRefs: [{ evidenceClass: 'derived-intelligence', kind: 'risk', ref: 'SB-PLR-X', label: 'Risk escalation: high' }] });
  const di = buildCaseTimeline(c, []).find((s) => s.stage === 'derived-intelligence');
  assert.equal(di.entries[0].ref, 'SB-PLR-X', 'stores a reference');
  // No numeric risk score is present on the timeline entry — only a reference + label.
  assert.ok(!('score' in di.entries[0]));
});

test('explainable-intelligence references fold into the Derived Intelligence stage', () => {
  const c = mkCase({ evidenceRefs: [{ evidenceClass: 'explainable-intelligence', kind: 'explanation', ref: 'SB-PLR-X', label: 'Explanation' }] });
  const di = buildCaseTimeline(c, []).find((s) => s.stage === 'derived-intelligence');
  assert.equal(di.available, true);
});

test('describeAudit renders plain operational language', () => {
  assert.match(describeAudit(mkAudit({ action: 'accepted', detail: { note: 'ok' } })), /accepted/i);
  assert.match(describeAudit(mkAudit({ action: 'outcome-recorded', detail: { outcome: 'cool-off' } })), /cool-off/);
});

// ─── Notifications (pure) — inform only ──────────────────────────────────────

test('notifications produce human messages and never carry business logic', () => {
  const c = mkCase({ caseNumber: 'HRP-2026-001000' });
  assert.match(notificationMessage('case-assigned', c), /assigned/i);
  assert.match(notificationMessage('case-overdue', c), /overdue/i);
});

test('attention items surface overdue, due-soon and awaiting-review', () => {
  const overdue = mkCase({ id: 'o', dueAt: new Date(NOW.getTime() - 3600000).toISOString(), status: 'in-review' });
  const soon = mkCase({ id: 's', dueAt: new Date(NOW.getTime() + 3 * 3600000).toISOString(), status: 'accepted' });
  const waiting = mkCase({ id: 'w', dueAt: null, status: 'open' });
  const done = mkCase({ id: 'd', status: 'closed', dueAt: new Date(NOW.getTime() - 3600000).toISOString() });
  const items = attentionItems([overdue, soon, waiting, done], NOW);
  const kinds = Object.fromEntries(items.map((i) => [i.case.id, i.kind]));
  assert.equal(kinds['o'], 'case-overdue');
  assert.equal(kinds['s'], 'case-due-soon');
  assert.equal(kinds['w'], 'awaiting-review');
  assert.equal(kinds['d'], undefined, 'terminal cases raise no attention');
});

test('notifications sort unread-first then newest-first', () => {
  const ns = [
    { id: '1', casinoId: CASINO, caseId: null, recipient: 'r', kind: 'k', message: 'm', createdAt: '2026-07-16T10:00:00Z', readAt: '2026-07-16T11:00:00Z' },
    { id: '2', casinoId: CASINO, caseId: null, recipient: 'r', kind: 'k', message: 'm', createdAt: '2026-07-16T09:00:00Z', readAt: null },
    { id: '3', casinoId: CASINO, caseId: null, recipient: 'r', kind: 'k', message: 'm', createdAt: '2026-07-16T11:00:00Z', readAt: null },
  ];
  assert.deepEqual(sortNotifications(ns).map((n) => n.id), ['3', '2', '1']);
});

test('outstanding tasks are overdue or escalated open tasks', () => {
  const t1 = { id: 't1', caseId: 'c', casinoId: CASINO, taskType: 'compliance-action', description: 'x', status: 'open', assignedTo: null, dueAt: new Date(NOW.getTime() - 3600000).toISOString(), completedAt: null, notes: null, evidenceRef: null };
  const t2 = { id: 't2', caseId: 'c', casinoId: CASINO, taskType: 'compliance-action', description: 'y', status: 'escalated', assignedTo: null, dueAt: null, completedAt: null, notes: null, evidenceRef: null };
  const t3 = { id: 't3', caseId: 'c', casinoId: CASINO, taskType: 'compliance-action', description: 'z', status: 'completed', assignedTo: null, dueAt: new Date(NOW.getTime() - 3600000).toISOString(), completedAt: null, notes: null, evidenceRef: null };
  const out = outstandingTasks([t1, t2, t3], NOW).map((t) => t.id);
  assert.deepEqual(out.sort(), ['t1', 't2']);
});

// ─── Operations (pure) — metadata composition only ───────────────────────────

test('operations metrics compose from case/task metadata (no runtime state, no recomputation)', () => {
  const cases = [
    mkCase({ id: '1', caseType: 'rg-recommendation', status: 'open', dueAt: new Date(NOW.getTime() - 3600000).toISOString() }),
    mkCase({ id: '2', caseType: 'rg-recommendation', status: 'outcome-recorded' }),
    mkCase({ id: '3', caseType: 'regulatory-investigation', status: 'in-review' }),
    mkCase({ id: '4', caseType: 'compliance-finding', status: 'closed', dueAt: new Date(NOW.getTime() - 3600000).toISOString(), closedAt: new Date(NOW.getTime() - 7200000).toISOString() }),
  ];
  const tasks = [
    { id: 't1', caseId: '4', casinoId: CASINO, taskType: 'compliance-action', description: 'x', status: 'completed', assignedTo: null, dueAt: null, completedAt: null, notes: null, evidenceRef: 'dec-1' },
    { id: 't2', caseId: '4', casinoId: CASINO, taskType: 'compliance-action', description: 'y', status: 'open', assignedTo: null, dueAt: null, completedAt: null, notes: null, evidenceRef: 'dec-2' },
  ];
  const ops = shapeOperations(cases, tasks, NOW);
  assert.equal(ops.openCases, 3);
  assert.equal(ops.overdueCases, 1, 'only the non-terminal overdue rg case');
  assert.equal(ops.outstandingInvestigations, 1);
  assert.equal(ops.interventionCompletion.total, 2);
  assert.equal(ops.interventionCompletion.completed, 1);
  assert.equal(ops.complianceCompletion.total, 2);
  assert.equal(ops.complianceCompletion.completed, 1);
  assert.equal(ops.complianceCompletion.rate, 0.5);
  assert.equal(ops.slaPerformance.onTime, 1, 'case 4 closed before its due date');
  assert.equal(ops.evidenceClass, 'recorded-fact');
});

test('case trend groups by opened day', () => {
  const cases = [
    mkCase({ id: '1', openedAt: '2026-07-16T01:00:00Z' }),
    mkCase({ id: '2', openedAt: '2026-07-16T05:00:00Z' }),
    mkCase({ id: '3', openedAt: '2026-07-15T05:00:00Z' }),
  ];
  const trend = caseTrend(cases);
  assert.deepEqual(trend, [{ day: '2026-07-15', opened: 1 }, { day: '2026-07-16', opened: 2 }]);
});

// ─── Catalogue integrity ─────────────────────────────────────────────────────

test('catalogues are stable and complete', () => {
  assert.equal(CASE_TYPES.length, 5);
  assert.equal(CASE_STATUSES.length, 8);
  assert.deepEqual([...PRIORITIES], ['low', 'medium', 'high', 'critical']);
});
