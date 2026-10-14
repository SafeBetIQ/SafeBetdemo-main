// SafeBet IQ — B11 Follow-Up Requirement Closure: pure domain logic.
//   node --test tests/followUpRequirementClosure.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIdempotencyKey, parseEmptyBody, httpForStatus, B11_STATUSES } from '../lib/responsibleProfitability/followUpRequirementClosure.ts';

const KEY = '0a0a0a0a-dead-4bee-8fff-000000000001';

test('parseIdempotencyKey requires a uuid header', () => {
  assert.deepEqual(parseIdempotencyKey(KEY), { ok: true, key: KEY });
  assert.equal(parseIdempotencyKey(null).ok, false);
  assert.equal(parseIdempotencyKey('').ok, false);
  assert.equal(parseIdempotencyKey('not-a-uuid').ok, false);
});

test('parseEmptyBody accepts absent/empty-object only', () => {
  assert.deepEqual(parseEmptyBody(null), { ok: true });
  assert.deepEqual(parseEmptyBody(undefined), { ok: true });
  assert.deepEqual(parseEmptyBody({}), { ok: true });
});

test('parseEmptyBody rejects any fields or non-object JSON', () => {
  assert.equal(parseEmptyBody({ foo: 1 }).code, 'UNEXPECTED_FIELD');
  assert.equal(parseEmptyBody({ follow_up_required: false }).code, 'UNEXPECTED_FIELD');
  assert.equal(parseEmptyBody([]).code, 'BODY');
  assert.equal(parseEmptyBody('x').code, 'BODY');
  assert.equal(parseEmptyBody(5).code, 'BODY');
  assert.equal(parseEmptyBody(true).code, 'BODY');
});

test('httpForStatus mapping', () => {
  assert.deepEqual(httpForStatus('CLOSED'), { status: 200, ok: true });
  assert.deepEqual(httpForStatus('REPLAYED'), { status: 200, ok: true, code: 'REPLAYED' });
  assert.deepEqual(httpForStatus('NOOP'), { status: 200, ok: true, code: 'NOOP' });
  assert.deepEqual(httpForStatus('IDEMPOTENCY_CONFLICT'), { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  assert.deepEqual(httpForStatus('NOT_FOUND'), { status: 404, ok: false });
});

test('status set is exactly the five B11 statuses', () => {
  assert.deepEqual([...B11_STATUSES], ['CLOSED', 'REPLAYED', 'NOOP', 'IDEMPOTENCY_CONFLICT', 'NOT_FOUND']);
});
