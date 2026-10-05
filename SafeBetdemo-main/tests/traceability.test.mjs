// SafeBet IQ — B6 Protection Action Traceability: pure domain logic + wording guards.
//   node --test tests/traceability.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TRACEABILITY_CANDIDATE_LIMIT, FORBIDDEN_LINK_BODY_FIELDS, isUuid, parseLinkBody,
  RECORDED_OUTCOME_PREFIX, recordedOutcomeLabel, assertNoEffectivenessFraming,
  mapLinkableIntervention, mapActiveLink,
} from '../lib/responsibleProfitability/traceability.ts';

const IV = 'b1111111-1111-1111-1111-111111111111';

test('candidate cap is 100', () => {
  assert.equal(TRACEABILITY_CANDIDATE_LIMIT, 100);
});

test('isUuid accepts canonical uuids, rejects junk', () => {
  assert.ok(isUuid(IV));
  for (const v of ['', 'x', '123', IV + 'z', 42, null, undefined, {}]) assert.equal(isUuid(v), false);
});

test('parseLinkBody accepts ONLY intervention_id (a uuid)', () => {
  assert.deepEqual(parseLinkBody({ intervention_id: IV }), { ok: true, interventionId: IV });
  assert.equal(parseLinkBody({ intervention_id: 'nope' }).ok, false);
  assert.equal(parseLinkBody({}).ok, false);
  assert.equal(parseLinkBody(null).ok, false);
});

test('parseLinkBody rejects every caller-forbidden field', () => {
  for (const f of FORBIDDEN_LINK_BODY_FIELDS) {
    const r = parseLinkBody({ intervention_id: IV, [f]: 'x' });
    assert.equal(r.ok, false, `expected rejection for forbidden field ${f}`);
    assert.equal(r.code, 'FORBIDDEN_FIELD');
  }
});

test('parseLinkBody rejects unexpected fields', () => {
  const r = parseLinkBody({ intervention_id: IV, foo: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'UNEXPECTED_FIELD');
});

test('caller can never supply casino_id/player_id/linked_by/linked_at/supersedes_link_id', () => {
  for (const f of ['casino_id', 'player_id', 'linked_by', 'linked_at', 'supersedes_link_id', 'superseded_at', 'superseded_by']) {
    assert.ok(FORBIDDEN_LINK_BODY_FIELDS.includes(f), `${f} must be forbidden`);
  }
});

test('recorded-outcome wording is occurrence-framed, never effectiveness', () => {
  assert.equal(RECORDED_OUTCOME_PREFIX, 'Recorded intervention outcome');
  assert.equal(recordedOutcomeLabel('successful'), 'Recorded intervention outcome: successful');
  assert.equal(recordedOutcomeLabel(null), 'Recorded intervention outcome: —');
  // the enum value itself is allowed WITH the prefix …
  assertNoEffectivenessFraming([recordedOutcomeLabel('successful'), recordedOutcomeLabel('unsuccessful')]);
});

test('assertNoEffectivenessFraming rejects effectiveness/causal/trajectory claims', () => {
  for (const bad of [
    'Successful intervention', 'effective intervention', 'harm reduced', 'harm-reduction achieved',
    'player improved', 'caused improvement', 'reduced risk', 'risk trajectory improved', 'the intervention worked',
    'prevented harm',
  ]) {
    assert.throws(() => assertNoEffectivenessFraming([bad]), /B6 safeguard/, `should reject: ${bad}`);
  }
});

test('mapLinkableIntervention exposes only governed fields (no player_id/casino_id)', () => {
  const dto = mapLinkableIntervention(
    { id: IV, intervention_type: 'helpline_referral', intervention_date: '2026-09-01', outcome: 'successful', follow_up_required: true }, true);
  assert.deepEqual(Object.keys(dto).sort(),
    ['alreadyLinked', 'followUpRequired', 'interventionDate', 'interventionId', 'interventionType', 'recordedOutcome'].sort());
  assert.equal(dto.alreadyLinked, true);
  assert.equal(dto.recordedOutcome, 'successful');
  assert.ok(!('player_id' in dto) && !('casino_id' in dto));
});

test('mapActiveLink exposes only governed fields', () => {
  const dto = mapActiveLink({
    id: 'c1111111-1111-1111-1111-111111111111', intervention_id: IV, linked_at: '2026-09-02T00:00:00Z',
    intervention_type: 'counseling_referral', intervention_date: '2026-09-01', outcome: 'pending', follow_up_required: false });
  assert.deepEqual(Object.keys(dto).sort(),
    ['followUpRequired', 'interventionDate', 'interventionId', 'interventionType', 'linkId', 'linkedAt', 'recordedOutcome'].sort());
  assert.ok(!('player_id' in dto) && !('casino_id' in dto) && !('linked_by' in dto));
});
