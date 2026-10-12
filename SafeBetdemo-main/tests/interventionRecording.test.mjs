// SafeBet IQ — B9 Governed Intervention Recording: pure domain logic.
//   node --test tests/interventionRecording.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  B9_INTERVENTION_TYPES, B9_OUTCOMES, B9_FORBIDDEN_BODY_FIELDS,
  parseIdempotencyKey, parseRecordBody, httpForStatus,
} from '../lib/responsibleProfitability/interventionRecording.ts';

const KEY = '0a0a0a0a-dead-4bee-8fff-000000000001';

test('six operator types; ai_alert excluded', () => {
  assert.deepEqual([...B9_INTERVENTION_TYPES], ['manual_review', 'limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral']);
  assert.ok(!B9_INTERVENTION_TYPES.includes('ai_alert'));
  assert.deepEqual([...B9_OUTCOMES], ['accepted', 'declined', 'pending', 'successful', 'unsuccessful']);
});

test('parseIdempotencyKey requires a uuid header', () => {
  assert.deepEqual(parseIdempotencyKey(KEY), { ok: true, key: KEY });
  assert.equal(parseIdempotencyKey(null).ok, false);
  assert.equal(parseIdempotencyKey('').ok, false);
  assert.equal(parseIdempotencyKey('not-a-uuid').ok, false);
});

test('parseRecordBody accepts the governed minimum', () => {
  assert.deepEqual(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false }),
    { ok: true, fields: { intervention_type: 'manual_review', outcome: null, follow_up_required: false, follow_up_date: null } });
  assert.deepEqual(parseRecordBody({ intervention_type: 'timeout', outcome: 'pending', follow_up_required: true, follow_up_date: '2026-06-10' }),
    { ok: true, fields: { intervention_type: 'timeout', outcome: 'pending', follow_up_required: true, follow_up_date: '2026-06-10' } });
});

test('parseRecordBody rejects ai_alert + invalid type', () => {
  assert.equal(parseRecordBody({ intervention_type: 'ai_alert', follow_up_required: false }).code, 'INTERVENTION_TYPE');
  assert.equal(parseRecordBody({ intervention_type: 'nope', follow_up_required: false }).code, 'INTERVENTION_TYPE');
});

test('outcome optional; invalid rejected', () => {
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false, outcome: null }).ok, true);
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false, outcome: 'great' }).code, 'OUTCOME');
});

test('follow_up_required mandatory boolean; date strict; false+date rejected', () => {
  assert.equal(parseRecordBody({ intervention_type: 'manual_review' }).code, 'FOLLOW_UP_REQUIRED');
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: 'yes' }).code, 'FOLLOW_UP_REQUIRED');
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: true, follow_up_date: '2026-6-1' }).code, 'DATE_FORMAT');
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: true, follow_up_date: '2026-02-30' }).code, 'DATE_INVALID');
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false, follow_up_date: '2026-06-10' }).code, 'FOLLOW_UP_INCONSISTENT');
});

test('past/today/future follow_up dates accepted', () => {
  for (const d of ['2000-01-01', '2099-12-31', '2026-10-11']) {
    assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: true, follow_up_date: d }).ok, true);
  }
});

test('every forbidden caller field is rejected', () => {
  for (const f of B9_FORBIDDEN_BODY_FIELDS) {
    const r = parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false, [f]: 'x' });
    assert.equal(r.ok, false, `expected rejection for ${f}`);
    assert.equal(r.code, 'FORBIDDEN_FIELD');
  }
  // critical ones explicitly
  for (const f of ['casino_id', 'player_id', 'staff_id', 'source', 'intervention_date', 'trigger_reason', 'action_taken', 'notes', 'idempotency_key', 'intervention_successful', 'auto_triggered']) {
    assert.ok(B9_FORBIDDEN_BODY_FIELDS.includes(f), `${f} must be forbidden`);
  }
});

test('unexpected (non-forbidden) field rejected', () => {
  assert.equal(parseRecordBody({ intervention_type: 'manual_review', follow_up_required: false, foo: 1 }).code, 'UNEXPECTED_FIELD');
});

test('httpForStatus mapping', () => {
  assert.deepEqual(httpForStatus('CREATED'), { status: 201, ok: true });
  assert.deepEqual(httpForStatus('REPLAYED'), { status: 200, ok: true, code: 'REPLAYED' });
  assert.deepEqual(httpForStatus('IDEMPOTENCY_CONFLICT'), { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  assert.deepEqual(httpForStatus('NOT_FOUND'), { status: 404, ok: false });
});
