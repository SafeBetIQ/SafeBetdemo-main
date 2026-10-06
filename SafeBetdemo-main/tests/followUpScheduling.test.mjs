// SafeBet IQ — B8 Follow-Up Scheduling: pure domain logic.
//   node --test tests/followUpScheduling.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLLOW_UP_LIST_LIMIT, parseFollowUpDate, parseEmptyBody, opaquePlayerRef,
  toFollowUpState, mapFollowUpRow, orderFollowUps, httpForResult,
} from '../lib/responsibleProfitability/followUpScheduling.ts';

test('list limit is 100', () => assert.equal(FOLLOW_UP_LIST_LIMIT, 100));

test('parseFollowUpDate accepts strict YYYY-MM-DD only', () => {
  assert.deepEqual(parseFollowUpDate({ follow_up_date: '2026-06-10' }), { ok: true, date: '2026-06-10' });
  for (const [b, code] of [
    [{ follow_up_date: '2026-6-1' }, 'DATE_FORMAT'],
    [{ follow_up_date: '2026-02-30' }, 'DATE_INVALID'],
    [{ follow_up_date: '2026-06-10T00:00:00Z' }, 'DATE_FORMAT'],
    [{ follow_up_date: 42 }, 'DATE_FORMAT'],
    [{}, 'DATE_FORMAT'],
    [{ follow_up_date: '2026-06-10', casino_id: 'x' }, 'UNEXPECTED_FIELD'],
    [null, 'BODY'],
  ]) { const r = parseFollowUpDate(b); assert.equal(r.ok, false); assert.equal(r.code, code); }
});

test('parseFollowUpDate allows past/today/future (no lower bound)', () => {
  for (const d of ['2000-01-01', '2099-12-31', '2026-10-06']) assert.equal(parseFollowUpDate({ follow_up_date: d }).ok, true);
});

test('parseEmptyBody accepts empty/none, rejects any field', () => {
  assert.equal(parseEmptyBody(null).ok, true);
  assert.equal(parseEmptyBody({}).ok, true);
  assert.equal(parseEmptyBody({ follow_up_date: '2026-06-10' }).ok, false);
});

test('opaquePlayerRef exposes only last-8, never full id', () => {
  const pid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeee1234';
  assert.equal(opaquePlayerRef(pid), '…eeee1234');
  assert.ok(!opaquePlayerRef(pid).includes(pid));
});

test('toFollowUpState classifies via SAST', () => {
  const today = '2026-06-10';
  assert.equal(toFollowUpState(null, today), 'UNSCHEDULED');
  assert.equal(toFollowUpState('2026-06-10', today), 'DUE_TODAY');
  assert.equal(toFollowUpState('2026-06-09', today), 'OVERDUE');
  assert.equal(toFollowUpState('2026-06-11', today), 'FUTURE');
});

test('mapFollowUpRow exposes only governed fields + opaque ref (no PII)', () => {
  const dto = mapFollowUpRow({ id: 'iv1', player_id: '11112222-3333-4444-5555-666677778888', intervention_type: 'helpline_referral', intervention_date: '2026-06-01', follow_up_date: '2026-06-05' }, '2026-06-10');
  assert.deepEqual(Object.keys(dto).sort(),
    ['daysOverdue', 'followUpDate', 'followUpState', 'interventionDate', 'interventionId', 'interventionType', 'opaquePlayerRef'].sort());
  assert.equal(dto.followUpState, 'OVERDUE');
  assert.equal(dto.daysOverdue, 5);
  assert.equal(dto.opaquePlayerRef, '…77778888');
  assert.ok(!('player_id' in dto) && !('casino_id' in dto) && !('staff_id' in dto));
});

test('daysOverdue is null unless OVERDUE', () => {
  assert.equal(mapFollowUpRow({ id: 'a', player_id: 'p', intervention_type: null, intervention_date: null, follow_up_date: null }, '2026-06-10').daysOverdue, null);
  assert.equal(mapFollowUpRow({ id: 'a', player_id: 'p', intervention_type: null, intervention_date: null, follow_up_date: '2026-06-20' }, '2026-06-10').daysOverdue, null);
});

test('orderFollowUps groups UNSCHEDULED, OVERDUE(oldest), DUE_TODAY, FUTURE(earliest)', () => {
  const today = '2026-06-10';
  const mk = (id, d) => mapFollowUpRow({ id, player_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp', intervention_type: null, intervention_date: null, follow_up_date: d }, today);
  const ordered = orderFollowUps([
    mk('future', '2026-07-01'), mk('due', '2026-06-10'), mk('overdueNew', '2026-06-09'),
    mk('overdueOld', '2026-06-01'), mk('unsched', null),
  ]);
  assert.deepEqual(ordered.map((x) => x.interventionId), ['unsched', 'overdueOld', 'overdueNew', 'due', 'future']);
});

test('httpForResult mapping', () => {
  assert.deepEqual(httpForResult('APPLIED'), { status: 200, ok: true });
  assert.deepEqual(httpForResult('NOOP'), { status: 200, ok: true, code: 'NOOP' });
  assert.deepEqual(httpForResult('INVALID_STATE'), { status: 409, ok: false, code: 'INVALID_STATE' });
  assert.deepEqual(httpForResult('NOT_FOUND'), { status: 404, ok: false });
});
