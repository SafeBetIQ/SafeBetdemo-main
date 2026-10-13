// SafeBet IQ — B10 Follow-Up Occurrence: pure domain logic.
//   node --test tests/followUpOccurrence.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  B10_FORBIDDEN_BODY_FIELDS, parseIdempotencyKey, parseOccurrenceBody, classifyTiming,
  httpForStatus, mapOccurrenceRow, buildFollowUpPeriodActivity, FOLLOW_UP_OCCURRENCE_LIST_LIMIT,
} from '../lib/responsibleProfitability/followUpOccurrence.ts';

const KEY = '0a0a0a0a-dead-4bee-8fff-000000000001';
const TODAY = '2026-10-13';

test('parseIdempotencyKey requires a uuid header', () => {
  assert.deepEqual(parseIdempotencyKey(KEY), { ok: true, key: KEY });
  assert.equal(parseIdempotencyKey(null).ok, false);
  assert.equal(parseIdempotencyKey('').ok, false);
  assert.equal(parseIdempotencyKey('not-a-uuid').ok, false);
});

test('parseOccurrenceBody accepts only occurred_on', () => {
  assert.deepEqual(parseOccurrenceBody({ occurred_on: '2026-06-10' }, TODAY), { ok: true, occurredOn: '2026-06-10' });
  assert.deepEqual(parseOccurrenceBody({ occurred_on: TODAY }, TODAY), { ok: true, occurredOn: TODAY });
});

test('parseOccurrenceBody date validation', () => {
  assert.equal(parseOccurrenceBody({}, TODAY).code, 'DATE_FORMAT');
  assert.equal(parseOccurrenceBody({ occurred_on: '2026-6-1' }, TODAY).code, 'DATE_FORMAT');
  assert.equal(parseOccurrenceBody({ occurred_on: '2026-02-30' }, TODAY).code, 'DATE_INVALID');
  assert.equal(parseOccurrenceBody({ occurred_on: '2026-10-14' }, TODAY).code, 'DATE_FUTURE');  // future rejected at the pure layer
});

test('every forbidden caller field is rejected; unexpected field rejected', () => {
  for (const f of B10_FORBIDDEN_BODY_FIELDS) {
    const r = parseOccurrenceBody({ occurred_on: TODAY, [f]: 'x' }, TODAY);
    assert.equal(r.ok, false, `expected rejection for ${f}`);
    assert.equal(r.code, 'FORBIDDEN_FIELD');
  }
  for (const f of ['casino_id', 'player_id', 'intervention_id', 'recorded_by', 'recorded_at', 'follow_up_date', 'follow_up_required', 'outcome', 'completed', 'notes', 'idempotency_key', 'b10_request_fingerprint']) {
    assert.ok(B10_FORBIDDEN_BODY_FIELDS.includes(f), `${f} must be forbidden`);
  }
  assert.equal(parseOccurrenceBody({ occurred_on: TODAY, foo: 1 }, TODAY).code, 'UNEXPECTED_FIELD');
});

test('classifyTiming is factual date comparison only', () => {
  assert.equal(classifyTiming(null, '2026-06-10'), 'NOT_APPLICABLE');
  assert.equal(classifyTiming('2026-06-10', '2026-06-09'), 'EARLY');
  assert.equal(classifyTiming('2026-06-10', '2026-06-10'), 'ON_DATE');
  assert.equal(classifyTiming('2026-06-10', '2026-06-11'), 'LATE');
});

test('httpForStatus mapping', () => {
  assert.deepEqual(httpForStatus('CREATED'), { status: 201, ok: true });
  assert.deepEqual(httpForStatus('REPLAYED'), { status: 200, ok: true, code: 'REPLAYED' });
  assert.deepEqual(httpForStatus('IDEMPOTENCY_CONFLICT'), { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  assert.deepEqual(httpForStatus('INVALID_STATE'), { status: 409, ok: false, code: 'INVALID_STATE' });
  assert.deepEqual(httpForStatus('NOT_FOUND'), { status: 404, ok: false });
});

test('mapOccurrenceRow produces a safe DTO with derived timing', () => {
  assert.deepEqual(
    mapOccurrenceRow({ id: 'occ1', occurred_on: '2026-06-11', recorded_at: '2026-06-11T08:00:00Z', scheduled_follow_up_date: '2026-06-10' }),
    { occurrenceId: 'occ1', occurredOn: '2026-06-11', recordedAt: '2026-06-11T08:00:00Z', scheduledFollowUpDate: '2026-06-10', timingClassification: 'LATE' },
  );
  // no recorded_by / key / fingerprint / player identity in the DTO
  const dto = mapOccurrenceRow({ id: 'x', occurred_on: '2026-01-01', recorded_at: 't', scheduled_follow_up_date: null });
  assert.deepEqual(Object.keys(dto).sort(), ['occurredOn', 'occurrenceId', 'recordedAt', 'scheduledFollowUpDate', 'timingClassification'].sort());
  assert.equal(dto.timingClassification, 'NOT_APPLICABLE');
});

test('buildFollowUpPeriodActivity counts + timing distribution', () => {
  const rows = [
    { scheduled_follow_up_date: '2026-06-10', occurred_on: '2026-06-09' }, // EARLY
    { scheduled_follow_up_date: '2026-06-10', occurred_on: '2026-06-10' }, // ON_DATE
    { scheduled_follow_up_date: '2026-06-10', occurred_on: '2026-06-12' }, // LATE
    { scheduled_follow_up_date: null,         occurred_on: '2026-06-12' }, // NOT_APPLICABLE
  ];
  assert.deepEqual(buildFollowUpPeriodActivity(rows), {
    followUpOccurrencesRecorded: 4,
    followUpOccurrenceTiming: { early: 1, onDate: 1, late: 1, notApplicable: 1 },
  });
  assert.deepEqual(buildFollowUpPeriodActivity([]), { followUpOccurrencesRecorded: 0, followUpOccurrenceTiming: { early: 0, onDate: 0, late: 0, notApplicable: 0 } });
});

test('list limit is bounded at 50', () => {
  assert.equal(FOLLOW_UP_OCCURRENCE_LIST_LIMIT, 50);
});
