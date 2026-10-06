// SafeBet IQ — B7 Intervention Workload & Follow-Up Assurance: pure domain logic.
//   node --test tests/workload.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKLOAD_MAX_RANGE_DAYS, WORKLOAD_TIMEZONE, WORKLOAD_LINK_DENOMINATOR, OUTCOME_CATEGORIES,
  sastToday, sastDateOf, dayDiff, validateWorkloadPeriod, isWorkloadPeriodError,
  classifyFollowUp, buildInterventionCurrent, buildOutcomeDistribution,
  assertNoProhibitedWorkloadClaims, WORKLOAD_SEMANTICS, WORKLOAD_LINK_NEUTRAL_NOTE,
} from '../lib/responsibleProfitability/workload.ts';

test('constants locked', () => {
  assert.equal(WORKLOAD_MAX_RANGE_DAYS, 366);
  assert.equal(WORKLOAD_TIMEZONE, 'Africa/Johannesburg');
  assert.equal(WORKLOAD_LINK_DENOMINATOR, 'OPEN_ACKNOWLEDGED');
  assert.deepEqual([...OUTCOME_CATEGORIES], ['accepted', 'declined', 'pending', 'successful', 'unsuccessful']);
});

// ── period validation ──
test('period requires start+end', () => {
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod(null, '2026-02-01')), true);
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-02-01', null)), true);
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod(null, null)), true);
});
test('period rejects malformed/impossible/order/too-long; accepts valid', () => {
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-2-1', '2026-02-02')), true);   // format
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-02-30', '2026-03-01')), true); // impossible
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-02-01', '2026-02-01')), true); // end<=start
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-02-02', '2026-02-01')), true); // reversed
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2025-01-01', '2026-02-01')), true); // >366d
  const ok = validateWorkloadPeriod('2026-05-01', '2026-07-01');
  assert.equal(isWorkloadPeriodError(ok), false);
  assert.equal(ok.startIso, '2026-05-01T00:00:00+02:00');
  assert.equal(ok.endIsoExclusive, '2026-07-01T00:00:00+02:00');
});
test('exactly 366 days accepted, 367 rejected', () => {
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-01-01', '2027-01-02')), false); // 366 days — allowed
  assert.equal(isWorkloadPeriodError(validateWorkloadPeriod('2026-01-01', '2027-01-03')), true);  // 367 days — rejected
});

// ── SAST helpers ──
test('sastToday returns YYYY-MM-DD', () => assert.match(sastToday(), /^\d{4}-\d{2}-\d{2}$/));
test('sastDateOf converts an instant to SAST date', () => {
  assert.equal(sastDateOf('2026-06-01T21:30:00Z'), '2026-06-01');  // 23:30 SAST
  assert.equal(sastDateOf('2026-06-01T22:30:00Z'), '2026-06-02');  // 00:30 SAST next day
  assert.equal(sastDateOf(null), null);
});
test('dayDiff counts whole SAST days', () => {
  assert.equal(dayDiff('2026-06-01', '2026-06-10'), 9);
  assert.equal(dayDiff('2026-06-10', '2026-06-10'), 0);
  assert.equal(dayDiff(null, '2026-06-10'), null);
});

// ── follow-up classification (mirrors B4.1 overdue) ──
test('classifyFollowUp exact rules', () => {
  const today = '2026-06-10';
  assert.equal(classifyFollowUp({ follow_up_required: false, follow_up_date: null }, today), 'not_required');
  assert.equal(classifyFollowUp({ follow_up_required: null, follow_up_date: null }, today), 'requirement_not_recorded');
  assert.equal(classifyFollowUp({ follow_up_required: true, follow_up_date: null }, today), 'undated');
  assert.equal(classifyFollowUp({ follow_up_required: true, follow_up_date: '2026-06-10' }, today), 'due_today');
  assert.equal(classifyFollowUp({ follow_up_required: true, follow_up_date: '2026-06-09' }, today), 'overdue');
  assert.equal(classifyFollowUp({ follow_up_required: true, follow_up_date: '2026-06-11' }, today), 'future');
});

// ── partition invariant + maxDaysOverdue ──
test('buildInterventionCurrent partition invariant: required = undated+due+overdue+future', () => {
  const r = buildInterventionCurrent({ followUpRequiredButUndated: 279, followUpDueToday: 0, followUpOverdue: 0, followUpFuture: 0, maxDaysOverdue: null });
  assert.equal(r.followUpRequiredCurrent, 279);
  assert.equal(r.followUpRequiredButUndated + r.followUpDueToday + r.followUpOverdue + r.followUpFuture, r.followUpRequiredCurrent);
  assert.equal(r.maxDaysOverdue, null);   // no overdue ⇒ null
});
test('maxDaysOverdue only present when overdue>0', () => {
  const r = buildInterventionCurrent({ followUpRequiredButUndated: 1, followUpDueToday: 2, followUpOverdue: 3, followUpFuture: 4, maxDaysOverdue: 12 });
  assert.equal(r.followUpRequiredCurrent, 10);
  assert.equal(r.maxDaysOverdue, 12);
  const z = buildInterventionCurrent({ followUpRequiredButUndated: 1, followUpDueToday: 0, followUpOverdue: 0, followUpFuture: 0, maxDaysOverdue: 99 });
  assert.equal(z.maxDaysOverdue, null);   // forced null when none overdue even if a value leaks in
});

// ── outcome distribution ──
test('buildOutcomeDistribution includes all enums + notRecorded; never drops nulls', () => {
  const d = buildOutcomeDistribution({ accepted: 111, declined: 178, successful: 102 }, 5);
  assert.deepEqual(d, { accepted: 111, declined: 178, pending: 0, successful: 102, unsuccessful: 0, notRecorded: 5 });
  assert.deepEqual(Object.keys(d).sort(), ['accepted', 'declined', 'notRecorded', 'pending', 'successful', 'unsuccessful']);
});

// ── honesty / claims guard ──
test('semantics declare completion unavailable + no-SLA note', () => {
  assert.equal(WORKLOAD_SEMANTICS.followUpCompletionAvailable, false);
  assert.match(WORKLOAD_SEMANTICS.slaNote, /no safebet iq responsible-gambling sla/i);
  assert.match(WORKLOAD_SEMANTICS.currentVsPeriodNote, /not affected by the selected historical period/i);
});
test('assertNoProhibitedWorkloadClaims rejects completion/effectiveness/SLA/"all on time"/"all players safe"', () => {
  for (const bad of [
    'Follow-up completed', 'completion rate 80%', 'closure rate', 'successful intervention',
    'effective intervention', 'success rate', 'harm reduced', 'risk improved',
    'SLA breach', 'regulatory breach', 'non-compliant operator',
    'All follow-ups are on time', 'All players safe',
  ]) assert.throws(() => assertNoProhibitedWorkloadClaims([bad]), /B7 safeguard/, `should reject: ${bad}`);
});
test('allows "Recorded intervention outcome: successful" and the neutral link note', () => {
  assert.doesNotThrow(() => assertNoProhibitedWorkloadClaims([
    'Recorded intervention outcome: successful',
    'Recorded outcome: unsuccessful',
    WORKLOAD_LINK_NEUTRAL_NOTE,
    WORKLOAD_SEMANTICS.outcomeNote,
  ]));
});
