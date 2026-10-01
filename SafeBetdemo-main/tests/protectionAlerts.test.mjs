// SafeBet IQ — Responsible Profitability B4.1 (Operator-Local Protection Alerts): domain logic.
//   node --test tests/protectionAlerts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERT_RULE_VERSION, ALERT_TYPES, ALERT_RULES, EXCLUDED_ALERT_RULES, EXCLUDED_ALERT_TYPES,
  sastBusinessDate, isSelfExclusionBreachEligible, isInterventionFollowUpOverdue,
  buildBreachCandidate, buildFollowUpCandidate, bodyHasForbiddenField, FORBIDDEN_ALERT_BODY_FIELDS,
  isAlertOperatorRole, alertScopeProfile, emptyEvaluateSummary, assertNoProhibitedAlertFraming,
} from '../lib/responsibleProfitability/index.ts';

const CASINO = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const PLAYER = '33333333-3333-3333-3333-333333333333';
const ACTOR = '44444444-4444-4444-4444-444444444444';

// ── taxonomy ──
test('exactly two persisted v1 rules; three excluded; version v1.0.0', () => {
  assert.deepEqual(ALERT_TYPES, ['SELF_EXCLUSION_BREACH_REVIEW', 'INTERVENTION_FOLLOW_UP_OVERDUE']);
  assert.equal(ALERT_RULE_VERSION, 'v1.0.0');
  assert.deepEqual(EXCLUDED_ALERT_TYPES.sort(), ['CURRENT_HIGHER_RISK_REVIEW', 'INTERVENTION_COMPLETENESS_REVIEW', 'SELF_EXCLUSION_EXPIRY_REVIEW']);
  assert.equal(EXCLUDED_ALERT_RULES.length, 3);
  for (const r of EXCLUDED_ALERT_RULES) assert.ok(r.reason.length > 20);
  assert.equal(ALERT_RULES.SELF_EXCLUSION_BREACH_REVIEW.identityColumn, 'self_exclusion_id');
  assert.equal(ALERT_RULES.INTERVENTION_FOLLOW_UP_OVERDUE.identityColumn, 'intervention_id');
  assert.equal(ALERT_RULES.SELF_EXCLUSION_BREACH_REVIEW.sourceTable, 'self_exclusions');
  assert.equal(ALERT_RULES.INTERVENTION_FOLLOW_UP_OVERDUE.sourceTable, 'player_protection_interventions');
});

test('operator-facing labels carry no diagnosis/probability/causal/effectiveness framing', () => {
  assert.doesNotThrow(() => assertNoProhibitedAlertFraming(Object.values(ALERT_RULES).map((r) => r.label)));
  // the safeguard itself must catch a prohibited phrase
  assert.throws(() => assertNoProhibitedAlertFraming(['likely to become a problem gambler']));
});

// ── SAST business date (Africa/Johannesburg = UTC+2, no DST) ──
test('sastBusinessDate uses the South African business calendar (UTC+2)', () => {
  assert.equal(sastBusinessDate(new Date('2026-10-01T21:00:00Z')), '2026-10-01'); // 23:00 SAST same day
  assert.equal(sastBusinessDate(new Date('2026-10-01T23:30:00Z')), '2026-10-02'); // 01:30 SAST next day
  assert.match(sastBusinessDate(new Date('2026-02-03T10:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});

// ── Rule A eligibility ──
test('Rule A: breached + non-null player + same casino is eligible; others are not', () => {
  const base = { id: 's1', casino_id: CASINO, player_id: PLAYER, status: 'breached', breach_count: 2 };
  assert.equal(isSelfExclusionBreachEligible(base, CASINO), true);
  assert.equal(isSelfExclusionBreachEligible({ ...base, status: 'active' }, CASINO), false);
  assert.equal(isSelfExclusionBreachEligible({ ...base, status: 'expired' }, CASINO), false);
  assert.equal(isSelfExclusionBreachEligible({ ...base, status: 'lifted' }, CASINO), false);
  assert.equal(isSelfExclusionBreachEligible({ ...base, player_id: null }, CASINO), false);
  assert.equal(isSelfExclusionBreachEligible(base, OTHER), false);
});

// ── Rule C eligibility (strict overdue, SAST) ──
test('Rule C: required follow-up strictly before SAST today is overdue; today is NOT', () => {
  const today = '2026-10-01';
  const base = { id: 'i1', casino_id: CASINO, player_id: PLAYER, follow_up_required: true, follow_up_date: '2026-09-30' };
  assert.equal(isInterventionFollowUpOverdue(base, CASINO, today), true);              // yesterday → overdue
  assert.equal(isInterventionFollowUpOverdue({ ...base, follow_up_date: today }, CASINO, today), false); // today → not overdue (strict <)
  assert.equal(isInterventionFollowUpOverdue({ ...base, follow_up_date: '2026-10-05' }, CASINO, today), false); // future
  assert.equal(isInterventionFollowUpOverdue({ ...base, follow_up_required: false }, CASINO, today), false);
  assert.equal(isInterventionFollowUpOverdue({ ...base, follow_up_required: null }, CASINO, today), false);
  assert.equal(isInterventionFollowUpOverdue({ ...base, follow_up_date: null }, CASINO, today), false);
  assert.equal(isInterventionFollowUpOverdue(base, OTHER, today), false);
});

// ── candidate construction: no evidence/status/timestamps/fingerprint; actor + source id only ──
test('candidates carry only governed insert fields (no evidence/status/timestamps/fingerprint)', () => {
  const se = { id: 's1', casino_id: CASINO, player_id: PLAYER, status: 'breached', breach_count: null };
  const c = buildBreachCandidate(se, CASINO, ACTOR);
  assert.deepEqual(Object.keys(c).sort(), ['alert_type', 'casino_id', 'generated_by', 'player_id', 'rule_version', 'self_exclusion_id'].sort());
  assert.equal(c.alert_type, 'SELF_EXCLUSION_BREACH_REVIEW');
  assert.equal(c.rule_version, 'v1.0.0');
  assert.equal(c.generated_by, ACTOR);
  assert.equal(c.self_exclusion_id, 's1');
  for (const banned of ['evidence', 'status', 'generated_at', 'created_at', 'updated_at', 'acknowledged_at', 'resolved_at', 'source_fingerprint', 'fingerprint', 'id', 'intervention_id']) {
    assert.ok(!(banned in c), `candidate must not carry ${banned}`);
  }
  const iv = { id: 'i1', casino_id: CASINO, player_id: PLAYER, follow_up_required: true, follow_up_date: '2026-09-30' };
  const f = buildFollowUpCandidate(iv, CASINO, '2026-10-01', ACTOR);
  assert.equal(f.intervention_id, 'i1');
  assert.ok(!('self_exclusion_id' in f));
});

test('candidate builders refuse ineligible rows (fail closed)', () => {
  assert.throws(() => buildBreachCandidate({ id: 's', casino_id: CASINO, player_id: PLAYER, status: 'active', breach_count: 0 }, CASINO, ACTOR));
  assert.throws(() => buildFollowUpCandidate({ id: 'i', casino_id: CASINO, player_id: PLAYER, follow_up_required: true, follow_up_date: '2026-10-01' }, CASINO, '2026-10-01', ACTOR));
});

// ── request-body guards ──
test('server/DB-derived fields are forbidden in request bodies; casino_id alone is fine', () => {
  for (const f of ['id', 'generated_by', 'acknowledged_by', 'resolved_by', 'evidence', 'rule_version', 'status',
    'generated_at', 'created_at', 'updated_at', 'acknowledged_at', 'resolved_at', 'player_id', 'alert_type',
    'self_exclusion_id', 'intervention_id', 'breach_count', 'follow_up_date', 'source_fingerprint', 'fingerprint']) {
    assert.ok(FORBIDDEN_ALERT_BODY_FIELDS.includes(f), `${f} must be forbidden`);
    assert.equal(bodyHasForbiddenField({ [f]: 'x' }), f);
  }
  assert.equal(bodyHasForbiddenField({ casino_id: CASINO }), null);
  assert.equal(bodyHasForbiddenField(null), null);
  assert.equal(bodyHasForbiddenField('nope'), null);
});

// ── roles / scope mapping (reuses resolveRpScope profiles) ──
test('operator-role gate + scope-profile mapping', () => {
  for (const r of ['casino_admin', 'compliance_officer', 'super_admin']) assert.equal(isAlertOperatorRole(r), true);
  for (const r of ['regulator', 'national_regulator', 'provincial_regulator', 'staff', 'executive', null, undefined]) assert.equal(isAlertOperatorRole(r), false);
  assert.equal(alertScopeProfile('super_admin'), 'administrator');
  assert.equal(alertScopeProfile('casino_admin'), 'casino-operator');
  assert.equal(alertScopeProfile('compliance_officer'), 'casino-operator');
  assert.equal(alertScopeProfile('regulator'), null);
});

// ── evaluate summary shape ──
test('empty evaluate summary lists the two run rules and three excluded rules', () => {
  const s = emptyEvaluateSummary(CASINO);
  assert.equal(s.casinoId, CASINO);
  assert.deepEqual(s.rulesRun, ['SELF_EXCLUSION_BREACH_REVIEW', 'INTERVENTION_FOLLOW_UP_OVERDUE']);
  assert.equal(s.rulesExcluded.length, 3);
  assert.equal(s.evaluated, 0); assert.equal(s.created, 0); assert.equal(s.alreadyPresent, 0);
});
