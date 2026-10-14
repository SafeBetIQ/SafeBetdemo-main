// SafeBet IQ — B12 Operator Notifications: pure projection/identity logic.
//   node --test tests/operatorNotifications.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  B12_PRIORITY, B12_TITLE, B12_TARGET, notificationId, isNotificationId, projectNotifications,
  orderItems, parseEmptyBody, B12_LIST_LIMIT_MAX,
} from '../lib/responsibleProfitability/operatorNotifications.ts';

const C = 'a1b2c3d4-0000-0000-0000-000000000001';
const today = '2026-10-14';

test('priority + title + target maps are locked', () => {
  assert.deepEqual(B12_PRIORITY, { SELF_EXCLUSION_ALERT: 'HIGH', FOLLOW_UP_OVERDUE: 'HIGH', FOLLOW_UP_DUE: 'NORMAL' });
  assert.equal(B12_TITLE.SELF_EXCLUSION_ALERT, 'Protection alert requires review');
  assert.equal(B12_TITLE.FOLLOW_UP_DUE, 'A follow-up is due today');
  assert.equal(B12_TITLE.FOLLOW_UP_OVERDUE, 'A follow-up is overdue');
  assert.match(B12_TARGET.SELF_EXCLUSION_ALERT, /^\/casino\/responsible-profitability\/alerts$/);
  assert.match(B12_TARGET.FOLLOW_UP_DUE, /^\/casino\/responsible-profitability\/interventions$/);
});

test('notificationId is deterministic lowercase 64-hex and input-sensitive', () => {
  const a = notificationId([C, 'SELF_EXCLUSION_ALERT', 'alert1']);
  assert.ok(isNotificationId(a));
  assert.equal(a, notificationId([C, 'SELF_EXCLUSION_ALERT', 'alert1']));           // stable
  assert.notEqual(a, notificationId([C, 'SELF_EXCLUSION_ALERT', 'alert2']));        // resource-sensitive
  assert.notEqual(a, notificationId(['other', 'SELF_EXCLUSION_ALERT', 'alert1']));  // casino-sensitive
});

test('DUE vs OVERDUE and revision token change the id', () => {
  const due = notificationId([C, 'FOLLOW_UP_DUE', 'iv1', '2026-10-14', 'rev1']);
  const over = notificationId([C, 'FOLLOW_UP_OVERDUE', 'iv1', '2026-10-14', 'rev1']);
  assert.notEqual(due, over);                                                       // type-sensitive
  assert.notEqual(due, notificationId([C, 'FOLLOW_UP_DUE', 'iv1', '2026-10-14', 'rev2'])); // revision-sensitive (same-date reschedule)
});

test('self-exclusion: OPEN/ACKNOWLEDGED active, RESOLVED inactive', () => {
  const base = { casinoId: C, interventions: [], revisionByIv: new Map(), readIds: new Set(), today };
  const open = projectNotifications({ ...base, alerts: [{ id: 'al1', generated_at: '2026-10-10T08:00:00Z', status: 'OPEN' }] });
  assert.equal(open.items.length, 1);
  assert.equal(open.items[0].priority, 'HIGH');
  assert.equal(open.items[0].effectiveAt, '2026-10-10T08:00:00Z');
  assert.equal(open.items[0].attentionDate, null);
  assert.equal(projectNotifications({ ...base, alerts: [{ id: 'al1', generated_at: null, status: 'ACKNOWLEDGED' }] }).items.length, 1);
  assert.equal(projectNotifications({ ...base, alerts: [{ id: 'al1', generated_at: null, status: 'RESOLVED' }] }).items.length, 0);
  // ACKNOWLEDGED keeps the same id as OPEN (status not in the identity)
  const idOpen = projectNotifications({ ...base, alerts: [{ id: 'al1', generated_at: null, status: 'OPEN' }] }).items[0].notificationId;
  const idAck = projectNotifications({ ...base, alerts: [{ id: 'al1', generated_at: null, status: 'ACKNOWLEDGED' }] }).items[0].notificationId;
  assert.equal(idOpen, idAck);
});

test('follow-up: due today NORMAL, past HIGH overdue, future excluded, undated/not-required excluded', () => {
  const base = { casinoId: C, alerts: [], revisionByIv: new Map([['iv1', 'rev1']]), readIds: new Set(), today };
  const due = projectNotifications({ ...base, interventions: [{ id: 'iv1', follow_up_required: true, follow_up_date: today }] });
  assert.equal(due.items.length, 1); assert.equal(due.items[0].type, 'FOLLOW_UP_DUE'); assert.equal(due.items[0].priority, 'NORMAL'); assert.equal(due.items[0].attentionDate, today);
  const over = projectNotifications({ ...base, interventions: [{ id: 'iv1', follow_up_required: true, follow_up_date: '2026-10-01' }] });
  assert.equal(over.items[0].type, 'FOLLOW_UP_OVERDUE'); assert.equal(over.items[0].priority, 'HIGH');
  assert.equal(projectNotifications({ ...base, interventions: [{ id: 'iv1', follow_up_required: true, follow_up_date: '2099-01-01' }] }).items.length, 0); // future
  assert.equal(projectNotifications({ ...base, interventions: [{ id: 'iv1', follow_up_required: true, follow_up_date: null }] }).items.length, 0);         // undated
  assert.equal(projectNotifications({ ...base, interventions: [{ id: 'iv1', follow_up_required: false, follow_up_date: today }] }).items.length, 0);       // not required
});

test('read flag + unreadCount per-user', () => {
  const idOpen = notificationId([C, 'SELF_EXCLUSION_ALERT', 'al1']);
  const r = projectNotifications({ casinoId: C, alerts: [{ id: 'al1', generated_at: null, status: 'OPEN' }], interventions: [], revisionByIv: new Map(), readIds: new Set([idOpen]), today });
  assert.equal(r.items[0].read, true); assert.equal(r.unreadCount, 0);
  const r2 = projectNotifications({ casinoId: C, alerts: [{ id: 'al1', generated_at: null, status: 'OPEN' }], interventions: [], revisionByIv: new Map(), readIds: new Set(), today });
  assert.equal(r2.items[0].read, false); assert.equal(r2.unreadCount, 1);
});

test('ordering: HIGH before NORMAL then date desc', () => {
  const items = [
    { notificationId: 'b', type: 'FOLLOW_UP_DUE', priority: 'NORMAL', title: '', effectiveAt: null, attentionDate: '2026-10-14', read: false, targetHref: '' },
    { notificationId: 'a', type: 'FOLLOW_UP_OVERDUE', priority: 'HIGH', title: '', effectiveAt: null, attentionDate: '2026-10-01', read: false, targetHref: '' },
    { notificationId: 'c', type: 'SELF_EXCLUSION_ALERT', priority: 'HIGH', title: '', effectiveAt: '2026-10-12T00:00:00Z', attentionDate: null, read: false, targetHref: '' },
  ];
  orderItems(items);
  assert.equal(items[0].priority, 'HIGH'); assert.equal(items[2].priority, 'NORMAL');     // HIGH first
  assert.equal(items[0].notificationId, 'c');                                              // newer HIGH (Oct 12) before older HIGH (Oct 01)
});

test('parseEmptyBody accepts empty/{}; rejects fields/array/scalar', () => {
  assert.equal(parseEmptyBody(null).ok, true);
  assert.equal(parseEmptyBody({}).ok, true);
  assert.equal(parseEmptyBody({ x: 1 }).code, 'UNEXPECTED_FIELD');
  assert.equal(parseEmptyBody([]).code, 'BODY');
  assert.equal(parseEmptyBody('x').code, 'BODY');
  assert.equal(parseEmptyBody(5).code, 'BODY');
});

test('isNotificationId + list bound', () => {
  assert.ok(isNotificationId('a'.repeat(64)));
  assert.ok(!isNotificationId('A'.repeat(64)));   // uppercase rejected
  assert.ok(!isNotificationId('a'.repeat(63)));
  assert.equal(B12_LIST_LIMIT_MAX, 100);
});
