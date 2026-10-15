// SafeBet IQ — B13.1 Governed Player Communication: pure domain logic + sandbox connector.
//   node --test tests/playerCommunications.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  B13_ELIGIBLE_INTERVENTION_TYPES, B13_COMMUNICATION_TYPES, B13_FAILURE_CLASSES,
  B13_PURPOSE, B13_DELIVERY_MODE, B13_CHANNEL_CLASS, B13_TEMPLATE_VERSION, B13_SANDBOX_TEMPLATES, B13_LIST_LIMIT,
  communicationTypeForIntervention, templateKeyForCommunicationType,
  parseIdempotencyKey, parseCreateBody, parseEmptyBody, httpForCreate, httpForSend,
  sandboxTransportToken, sandboxProviderReference, mapCommunicationRow,
} from '../lib/responsibleProfitability/playerCommunications.ts';
import {
  SandboxPlayerCommunicationConnector, resolvePlayerCommunicationConnector,
} from '../lib/responsibleProfitability/playerCommunicationConnector.ts';

const C = 'a1b2c3d4-0000-0000-0000-000000000001';
const COMM = 'c0000000-0000-0000-0000-000000000009';
const KEY = 'd0000000-0000-0000-0000-00000000000a';

test('locked constant surfaces', () => {
  assert.deepEqual([...B13_ELIGIBLE_INTERVENTION_TYPES], ['limit_setting', 'timeout', 'self_exclusion_referral', 'helpline_referral', 'counseling_referral']);
  assert.deepEqual([...B13_COMMUNICATION_TYPES], ['LIMIT_CONFIRMATION', 'TIMEOUT_CONFIRMATION', 'SELF_EXCLUSION_SUPPORT', 'HELPLINE_SUPPORT', 'COUNSELLING_SUPPORT']);
  assert.deepEqual([...B13_FAILURE_CLASSES], ['RECIPIENT_UNAVAILABLE', 'CHANNEL_NOT_AVAILABLE', 'PROVIDER_REJECTED', 'TEMPORARY_FAILURE', 'PERMANENT_FAILURE', 'POLICY_BLOCKED']);
  assert.equal(B13_PURPOSE, 'RESPONSIBLE_GAMBLING');
  assert.equal(B13_DELIVERY_MODE, 'SANDBOX');
  assert.equal(B13_CHANNEL_CLASS, 'OPERATOR_MANAGED');
  assert.equal(B13_TEMPLATE_VERSION, 1);
  assert.equal(B13_LIST_LIMIT, 50);
});

test('intervention → communication type mapping (manual_review/ai_alert excluded)', () => {
  assert.equal(communicationTypeForIntervention('limit_setting'), 'LIMIT_CONFIRMATION');
  assert.equal(communicationTypeForIntervention('timeout'), 'TIMEOUT_CONFIRMATION');
  assert.equal(communicationTypeForIntervention('self_exclusion_referral'), 'SELF_EXCLUSION_SUPPORT');
  assert.equal(communicationTypeForIntervention('helpline_referral'), 'HELPLINE_SUPPORT');
  assert.equal(communicationTypeForIntervention('counseling_referral'), 'COUNSELLING_SUPPORT');
  assert.equal(communicationTypeForIntervention('manual_review'), null);
  assert.equal(communicationTypeForIntervention('ai_alert'), null);
  assert.equal(communicationTypeForIntervention('nonsense'), null);
});

test('communication type → template key mapping', () => {
  assert.equal(templateKeyForCommunicationType('LIMIT_CONFIRMATION'), 'rg.limit_confirmation');
  assert.equal(templateKeyForCommunicationType('TIMEOUT_CONFIRMATION'), 'rg.timeout_confirmation');
  assert.equal(templateKeyForCommunicationType('SELF_EXCLUSION_SUPPORT'), 'rg.self_exclusion_support');
  assert.equal(templateKeyForCommunicationType('HELPLINE_SUPPORT'), 'rg.helpline_support');
  assert.equal(templateKeyForCommunicationType('COUNSELLING_SUPPORT'), 'rg.counselling_support');
  assert.equal(templateKeyForCommunicationType('MARKETING'), null);
});

test('sandbox templates are labelled + carry no PII placeholders for contact', () => {
  assert.equal(Object.keys(B13_SANDBOX_TEMPLATES).length, 5);
  for (const t of Object.values(B13_SANDBOX_TEMPLATES)) {
    assert.match(t.sandboxBody, /SANDBOX TEMPLATE — NOT APPROVED FOR REAL PLAYER DELIVERY\./);
    assert.equal(t.templateVersion, 1);
    // no contact/identity variables
    assert.ok(!t.variables.some((v) => /email|phone|address|id_number|name|recipient/i.test(v)), `no contact var in ${t.templateKey}`);
  }
});

test('parseIdempotencyKey', () => {
  assert.equal(parseIdempotencyKey(null).code, 'IDEMPOTENCY_KEY_REQUIRED');
  assert.equal(parseIdempotencyKey('').code, 'IDEMPOTENCY_KEY_REQUIRED');
  assert.equal(parseIdempotencyKey('not-a-uuid').code, 'IDEMPOTENCY_KEY_INVALID');
  const ok = parseIdempotencyKey(KEY);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.key, KEY);
});

test('parseCreateBody accepts only matching {communicationType, templateKey}', () => {
  const ok = parseCreateBody({ communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation' });
  assert.equal(ok.ok, true);
  assert.equal(parseCreateBody(null).code, 'BODY');
  assert.equal(parseCreateBody([]).code, 'BODY');
  assert.equal(parseCreateBody('x').code, 'BODY');
  assert.equal(parseCreateBody({ communicationType: 'MARKETING', templateKey: 'rg.limit_confirmation' }).code, 'COMMUNICATION_TYPE');
  // mismatched template key for a valid type
  assert.equal(parseCreateBody({ communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.timeout_confirmation' }).code, 'TEMPLATE_KEY');
  // extra/PII fields rejected
  assert.equal(parseCreateBody({ communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation', email: 'x@y.z' }).code, 'UNEXPECTED_FIELD');
  assert.equal(parseCreateBody({ communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation', message: 'hi' }).code, 'UNEXPECTED_FIELD');
});

test('parseEmptyBody accepts empty/{}; rejects fields/array/scalar', () => {
  assert.equal(parseEmptyBody(null).ok, true);
  assert.equal(parseEmptyBody(undefined).ok, true);
  assert.equal(parseEmptyBody({}).ok, true);
  assert.equal(parseEmptyBody({ x: 1 }).code, 'UNEXPECTED_FIELD');
  assert.equal(parseEmptyBody([]).code, 'BODY');
  assert.equal(parseEmptyBody('x').code, 'BODY');
});

test('http mappings for create + send', () => {
  assert.deepEqual(httpForCreate('CREATED'), { status: 201, ok: true });
  assert.deepEqual(httpForCreate('REPLAYED'), { status: 200, ok: true, code: 'REPLAYED' });
  assert.deepEqual(httpForCreate('IDEMPOTENCY_CONFLICT'), { status: 409, ok: false, code: 'IDEMPOTENCY_CONFLICT' });
  assert.deepEqual(httpForCreate('INVALID_STATE'), { status: 409, ok: false, code: 'INVALID_STATE' });
  assert.deepEqual(httpForCreate('NOT_FOUND'), { status: 404, ok: false });
  assert.deepEqual(httpForSend('BEGUN'), { status: 200, ok: true });
  assert.deepEqual(httpForSend('REPLAYED'), { status: 200, ok: true, code: 'REPLAYED' });
  assert.deepEqual(httpForSend('NOT_FOUND'), { status: 404, ok: false });
});

test('sandbox transport token is deterministic + PII-free; provider ref derived', () => {
  const a = sandboxTransportToken(C, COMM, KEY);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, sandboxTransportToken(C, COMM, KEY));                       // deterministic
  assert.notEqual(a, sandboxTransportToken(C, COMM, 'd0000000-0000-0000-0000-00000000000b')); // key-sensitive
  assert.notEqual(a, sandboxTransportToken(C, 'c0000000-0000-0000-0000-000000000010', KEY));  // id-sensitive
  const ref = sandboxProviderReference(a);
  assert.match(ref, /^sandbox:[0-9a-f]{32}$/);
});

test('mapCommunicationRow → safe DTO (no player/contact/body/key fields)', () => {
  const dto = mapCommunicationRow({
    id: COMM, communication_type: 'LIMIT_CONFIRMATION', template_key: 'rg.limit_confirmation', template_version: 1,
    delivery_mode: 'SANDBOX', channel_class: 'OPERATOR_MANAGED', status: 'DELIVERED', sequence: 1,
    requested_at: '2026-10-14T00:00:00Z', send_requested_at: '2026-10-14T00:01:00Z',
    submitted_at: '2026-10-14T00:02:00Z', delivered_at: '2026-10-14T00:03:00Z', failed_at: null, failure_class: null,
  });
  assert.equal(dto.communicationId, COMM);
  assert.equal(dto.sandbox, true);
  assert.equal(dto.deliveryMode, 'SANDBOX');
  const keys = Object.keys(dto);
  for (const forbidden of ['player', 'email', 'phone', 'body', 'requestIdempotencyKey', 'sendIdempotencyKey', 'fingerprint', 'casino']) {
    assert.ok(!keys.some((k) => k.toLowerCase().includes(forbidden)), `DTO must not expose ${forbidden}`);
  }
});

test('sandbox connector: deterministic SUBMITTED receipt; no real send; refuses non-SANDBOX', async () => {
  const conn = new SandboxPlayerCommunicationConnector();
  assert.equal(conn.mode, 'SANDBOX');
  const r = await conn.send({ casinoId: C, communicationId: COMM, sendIdempotencyKey: KEY, deliveryMode: 'SANDBOX', communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation', templateVersion: 1 });
  assert.equal(r.sandbox, true);
  assert.equal(r.status, 'SUBMITTED');
  assert.equal(r.providerReference, sandboxProviderReference(sandboxTransportToken(C, COMM, KEY)));
  assert.equal(r.failureClass, null);
  await assert.rejects(conn.send({ casinoId: C, communicationId: COMM, sendIdempotencyKey: KEY, deliveryMode: 'LIVE', communicationType: 'LIMIT_CONFIRMATION', templateKey: 'rg.limit_confirmation', templateVersion: 1 }), /non-SANDBOX/);
});

test('resolvePlayerCommunicationConnector: SANDBOX default; fail-closed on non-SANDBOX env', () => {
  const prev = process.env.RP_PLAYER_COMMUNICATION_MODE;
  try {
    delete process.env.RP_PLAYER_COMMUNICATION_MODE;
    assert.equal(resolvePlayerCommunicationConnector().mode, 'SANDBOX');
    process.env.RP_PLAYER_COMMUNICATION_MODE = 'SANDBOX';
    assert.equal(resolvePlayerCommunicationConnector().mode, 'SANDBOX');
    process.env.RP_PLAYER_COMMUNICATION_MODE = 'LIVE';
    assert.throws(() => resolvePlayerCommunicationConnector(), /SANDBOX delivery only/);
  } finally {
    if (prev === undefined) delete process.env.RP_PLAYER_COMMUNICATION_MODE; else process.env.RP_PLAYER_COMMUNICATION_MODE = prev;
  }
});
