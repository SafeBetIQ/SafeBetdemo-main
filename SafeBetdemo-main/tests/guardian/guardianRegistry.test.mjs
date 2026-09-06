// SafeBet Guardian — Legal Operator Registry (ARCH-V4-C1). Synthetic only.
// Proves the entity model, deterministic matching, resolveLegalReference contract,
// the NO_MATCH != ILLEGAL invariant, conflict->review, freshness, and publication SoD.
//   node --test tests/guardian/guardianRegistry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_REGISTRY, matchOperator, normalise, resolveLegalReference,
  detectConflict, freshness, authorisePublication, makeGuardianPrincipal,
} from '../../products/guardian/src/index.ts';

const GP = 'ZA-GP';
const NOW = new Date('2026-09-06T00:00:00Z');
const syn = (id, role, jur = GP) => makeGuardianPrincipal({ principalId: id, jurisdiction: jur, role, authAssurance: 'SYNTHETIC_TEST', purpose: 'demo', isSynthetic: true });

// ── Scenario 1: licensed synthetic operator → exact registry match ────────────
test('scenario 1: licensed operator resolves EXACT_MATCH + LICENSED', () => {
  const r = resolveLegalReference(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'Synthetic Gaming Holdings (Pty) Ltd' }, NOW);
  assert.equal(r.matchState, 'EXACT_MATCH');
  assert.equal(r.resolvedOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.legalStanding, 'LICENSED');
  assert.equal(r.resolutionState, 'MATCHED_AUTHORITATIVE');
  assert.equal(r.isIllegalDetermination, false);
  assert.ok(r.provenance.sourceRecordIds.includes('REC-SYNTH-0001'));
});

test('scenario 1b: match by licence reference (strongest signal)', () => {
  const m = matchOperator(SYNTHETIC_REGISTRY, { jurisdiction: GP, licenceReference: 'LIC-ZA-GP-TEST-0001' });
  assert.equal(m.matchState, 'EXACT_MATCH');
  assert.equal(m.resolvedOperatorId, 'OP-SYNTH-0001');
  assert.equal(m.signal, 'licence_reference');
});

// ── Scenario 2: known brand → parent legal entity + licence ───────────────────
test('scenario 2: brand resolves to parent operator + its licence', () => {
  const r = resolveLegalReference(SYNTHETIC_REGISTRY, { jurisdiction: GP, brandName: 'Safe Example Betting' }, NOW);
  assert.equal(r.resolvedOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.matchState, 'KNOWN_ALIAS_MATCH');
  assert.equal(r.licenceId, 'LIC-SYNTH-0001');
  assert.equal(r.legalStanding, 'LICENSED');
});

test('scenario 2b: alias resolves to operator', () => {
  const m = matchOperator(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'SGH Betting' });
  assert.equal(m.matchState, 'KNOWN_ALIAS_MATCH');
  assert.equal(m.resolvedOperatorId, 'OP-SYNTH-0001');
});

// ── Scenario 3: expired synthetic licence → historical standing ───────────────
test('scenario 3: expired licence resolves EXPIRED (authoritative), not illegal', () => {
  const r = resolveLegalReference(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'Lapsed Play Synthetic Ltd' }, NOW);
  assert.equal(r.legalStanding, 'EXPIRED');
  assert.equal(r.isIllegalDetermination, false);
  // last verified 2024-01-15 vs now 2026 → STALE
  assert.equal(r.freshness, 'STALE');
  assert.equal(r.resolutionState, 'MATCHED_BUT_STALE');
});

// ── Scenario 4: unknown subject → NO_MATCH → NOT illegal ──────────────────────
test('scenario 4: unknown subject → NO_MATCH and explicitly NOT illegal', () => {
  const r = resolveLegalReference(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'Totally Unknown Synthetic Thing' }, NOW);
  assert.equal(r.matchState, 'NO_MATCH');
  assert.equal(r.legalStanding, 'NO_MATCH');
  assert.equal(r.resolutionState, 'NO_MATCH');
  assert.equal(r.isIllegalDetermination, false);
  assert.match(r.note, /NOT a determination of illegality/i);
});

test('invariant: no result path ever yields an ILLEGAL standing', () => {
  const subjects = [
    { jurisdiction: GP, legalName: 'Synthetic Gaming Holdings (Pty) Ltd' },
    { jurisdiction: GP, legalName: 'Lapsed Play Synthetic Ltd' },
    { jurisdiction: GP, legalName: 'Conflicted Operator Synthetic (Pty) Ltd' },
    { jurisdiction: GP, legalName: 'Totally Unknown Synthetic Thing' },
  ];
  for (const s of subjects) {
    const r = resolveLegalReference(SYNTHETIC_REGISTRY, s, NOW);
    assert.notEqual(r.legalStanding, 'ILLEGAL');
    assert.equal(r.isIllegalDetermination, false);
  }
});

// ── Scenario 5: conflicting synthetic source records → REQUIRES_HUMAN_REVIEW ───
test('scenario 5: conflicting sources → REQUIRES_HUMAN_REVIEW, not silent pick', () => {
  const r = resolveLegalReference(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'Conflicted Operator Synthetic (Pty) Ltd' }, NOW);
  assert.equal(r.requiresHumanReview, true);
  assert.equal(r.legalStanding, 'REQUIRES_HUMAN_REVIEW');
  assert.equal(r.resolutionState, 'REQUIRES_REVIEW');
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 5b: detectConflict flags equal-authority disagreement for human review', () => {
  const recs = SYNTHETIC_REGISTRY.sourceRecords.filter((x) => x.subjectReference === 'LIC-ZA-GP-TEST-0002');
  const c = detectConflict(recs);
  assert.equal(c.conflict, true);
  assert.equal(c.requiresHumanReview, true);
  assert.deepEqual(c.assertedStates.sort(), ['EXPIRED', 'LICENSED']);
});

// ── Scenario 6: wrong jurisdiction → no cross-jurisdiction match ───────────────
test('scenario 6: ZA-GP query cannot match a ZA-WC operator', () => {
  const m = matchOperator(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'Western Synthetic Betting (Pty) Ltd' });
  assert.equal(m.matchState, 'NO_MATCH');
  // but the same subject IS matchable in its own jurisdiction
  const m2 = matchOperator(SYNTHETIC_REGISTRY, { jurisdiction: 'ZA-WC', legalName: 'Western Synthetic Betting (Pty) Ltd' });
  assert.equal(m2.resolvedOperatorId, 'OP-SYNTH-WC-0100');
});

// ── Scenario 7: same synthetic person cannot stage AND authorise publication ───
test('scenario 7: publication SoD denies same-principal stage+authorise', () => {
  const analyst = syn('syn-analyst', 'INVESTIGATOR');
  const officer = syn('syn-officer', 'AUTHORISING_OFFICER');
  assert.equal(authorisePublication({ batchId: 'B1', jurisdiction: GP, stagedBy: analyst, authorisedBy: officer }).ok, true);
  // same principal in both roles → denied
  const dual = { ...analyst };
  const dualOfficer = { ...analyst, role: 'AUTHORISING_OFFICER' };
  const r = authorisePublication({ batchId: 'B1', jurisdiction: GP, stagedBy: dual, authorisedBy: dualOfficer });
  assert.equal(r.ok, false);
  assert.match(r.violations.join(';'), /separation of duties/);
});

// ── Matching states + freshness ───────────────────────────────────────────────
test('normalise strips suffixes/punctuation deterministically', () => {
  assert.equal(normalise('Synthetic Gaming Holdings (Pty) Ltd'), 'synthetic gaming');
  assert.equal(normalise('Western Synthetic Betting (Pty) Ltd'), 'western synthetic betting');
});

test('freshness: fresh / aging / stale / unknown', () => {
  assert.equal(freshness('2026-09-01T00:00:00Z', NOW), 'FRESH');
  assert.equal(freshness('2026-05-01T00:00:00Z', NOW), 'AGING');
  assert.equal(freshness('2024-01-01T00:00:00Z', NOW), 'STALE');
  assert.equal(freshness(null, NOW), 'UNKNOWN');
});

test('no-match safety: NO_MATCH candidate set is empty and review not required', () => {
  const m = matchOperator(SYNTHETIC_REGISTRY, { jurisdiction: GP, legalName: 'nope nope nope' });
  assert.equal(m.matchState, 'NO_MATCH');
  assert.deepEqual(m.candidateOperatorIds, []);
  assert.equal(m.requiresReview, false);
});
