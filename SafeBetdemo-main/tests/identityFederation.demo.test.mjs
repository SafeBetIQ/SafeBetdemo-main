// Milestone 3.7 — National Demonstration Dataset v2.0 (ADR-006).
// Run: node --test tests/identityFederation.demo.test.mjs
//
// Proves the deterministic, fully-synthetic dataset drives the REAL Version 2.0
// pipeline: six distinct populated operators, legitimately-produced SB-NAT (never
// fabricated), federation outcome spread, split/merge/override/appeal, correlation
// twins, all policy families + outcome variety + conflict + integrity failure,
// cross-jurisdiction + tenant isolation, no PII, and full reconciliation — with
// deterministic reset/reseed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateNationalDemonstrationDataset, resetAndReseedDemonstrationDataset,
  DATASET_VERSION, SEED_VERSION, DEMO_OPERATORS,
} from '../lib/identityFederation/index.ts';

const D = generateNationalDemonstrationDataset();

// ─── Determinism / reset-reseed ──────────────────────────────────────────────

test('generation is deterministic; reset+reseed reproduces functionally identical data', () => {
  const a = generateNationalDemonstrationDataset();
  const b = resetAndReseedDemonstrationDataset();
  assert.equal(JSON.stringify(a.metrics), JSON.stringify(b.metrics));
  assert.equal(JSON.stringify(a.operators), JSON.stringify(b.operators));
  assert.equal(JSON.stringify(a.federation), JSON.stringify(b.federation));
  assert.equal(a.ledger.nationalGgr, b.ledger.nationalGgr);
  assert.equal(a.datasetVersion, DATASET_VERSION);
  assert.equal(a.seedVersion, SEED_VERSION);
});

// ─── Six distinct, populated operators ───────────────────────────────────────

test('all six existing operators are populated and distinct (no duplicates)', () => {
  assert.equal(D.operators.length, 6);
  assert.deepEqual(D.operators.map((o) => o.name), ['Prestige', 'SunBet', 'Hollywoodbets', 'Gold Rush', 'Betway', 'Royal Palace']);
  assert.equal(new Set(D.operators.map((o) => o.operatorId)).size, 6, 'no duplicate tenants');
  for (const o of D.operators) { assert.ok(o.players > 0 && o.sessions > 0 && o.wagers > 0, `${o.name} populated`); assert.ok(o.ggr !== 0, `${o.name} non-zero GGR`); }
  // distinct profiles: GGR and session totals are not all equal
  assert.ok(new Set(D.operators.map((o) => o.ggr)).size >= 5, 'operator GGR differs');
  assert.ok(new Set(D.operators.map((o) => o.sessions)).size >= 5, 'operator session totals differ');
});

// ─── Federation: legitimate SB-NAT, realistic outcome spread ─────────────────

test('SB-NAT identities are produced legitimately with a realistic outcome spread', () => {
  assert.ok(D.federation.candidates > 0);
  assert.ok(D.federation.decisionsByOutcome['auto-approved'] > 0, 'auto-approved present');
  assert.ok((D.federation.decisionsByOutcome['manual-review'] ?? 0) > 0, 'manual-review present');
  assert.ok(D.federation.manualApproved > 0 && D.federation.manualRejected > 0, 'both manual approve + reject occur');
  assert.ok(D.registry.sbNats > 0 && D.registry.integrityOk, 'registry integrity holds');
  assert.equal(D.metrics.multiOperatorIdentities > 0, true);
  // every SB-NAT is ZA-sovereign and well-formed (not fabricated)
  for (const s of D.sbNats) assert.ok(/^SB-NAT-ZA-[0-9A-F]{6,}$/.test(s.sbNat));
});

// ─── Registry lifecycle: split + merge ───────────────────────────────────────

test('governed split and merge are exercised', () => {
  assert.equal(D.registry.splits, 1);
  assert.equal(D.registry.merges, 1);
  const split = D.scenarios.find((s) => s.id === 'S9-split');
  const merge = D.scenarios.find((s) => s.id === 'S10-merge');
  assert.ok(split.assertions.every((a) => a.passed), 'split assertions pass (SB-PLR unchanged, reconstructable)');
  assert.ok(merge.assertions.every((a) => a.passed), 'merge survivor holds all members');
});

// ─── Correlation: twins populated with provenance ────────────────────────────

test('national player twins are populated and provenance-complete', () => {
  assert.ok(D.twins.length > 0);
  for (const t of D.twins) {
    assert.ok(t.participatingOperators.length >= 1);
    assert.ok(t.provenance.federationDecisionRefs.length > 0, 'provenance carries federation decision refs');
  }
  assert.equal(D.metrics.provenanceComplete, true);
});

// ─── Policy: families + outcome variety + conflict + integrity failure ───────

test('all six policy families evaluate with realistic outcome variety', () => {
  assert.ok(D.policy.evaluations > 0);
  const outcomes = Object.keys(D.policy.byOutcome);
  // a spread across several outcome families (not all identical)
  assert.ok(outcomes.length >= 5, `outcome variety (${outcomes.join(', ')})`);
  assert.ok(D.policy.byOutcome['Cross-Operator Escalation Required'] > 0);
  assert.ok(D.policy.byOutcome['National Investigation Recommended'] > 0);
  assert.ok((D.policy.byOutcome['No Action'] ?? 0) + (D.policy.byOutcome['Continue Monitoring'] ?? 0) > 0, 'benign outcomes exist (no high-risk bias)');
  assert.ok(D.policy.byOutcome['Data Integrity Failure'] > 0, 'controlled integrity-failure scenario present');
  assert.ok(D.policy.conflicts > 0, 'policy conflicts detected, not silently resolved');
});

// ─── Scenario catalogue (all 14 + governance) ────────────────────────────────

test('every named scenario asserts correctly', () => {
  const ids = D.scenarios.map((s) => s.id);
  for (const need of ['S1-self-exclusion', 'S2-harm-escalation', 'S3-repeated-interventions', 'S4-cooling-off', 'S5-national-investigation', 'S6-insufficient-evidence', 'S7-false-positive', 'S8-manual-review', 'S9-split', 'S10-merge', 'S11-policy-conflict', 'S12-data-integrity', 'S13-cross-jurisdiction', 'S14-low-risk-control', 'G09-appeal', 'G10-override'])
    assert.ok(ids.includes(need), `scenario ${need} present`);
  for (const s of D.scenarios) for (const a of s.assertions) assert.ok(a.passed, `${s.id}: ${a.name}`);
});

test('false-positive protection: two people sharing a weak attribute get no shared SB-NAT', () => {
  const fp = D.scenarios.find((s) => s.id === 'S7-false-positive');
  assert.equal(fp.sbNat, null);
  assert.equal(fp.federationOutcome, 'rejected');
});

// ─── Isolation + access control ──────────────────────────────────────────────

test('cross-jurisdiction and tenant isolation + deny-by-default access hold', () => {
  assert.equal(D.crossJurisdiction.isolated, true);
  assert.equal(D.access.operatorDenied, true, 'operator cannot query national intelligence');
  assert.equal(D.access.wrongJurisdictionDenied, true);
  assert.equal(D.access.regulatorAllowed, true);
});

// ─── No plaintext PII in pipeline outputs ────────────────────────────────────

test('no plaintext PII appears in twins, policy evaluations, or scenarios', () => {
  const blob = JSON.stringify({ twins: D.twins, policy: D.policyEvaluations, scenarios: D.scenarios, sbNats: D.sbNats });
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false, 'no email-like PII');
  assert.equal(/\d{7,}/.test(blob), false, 'no long digit runs (id/phone-like)');
  // the synthetic attribute tokens never leak into outputs
  assert.equal(blob.includes('NID-'), false, 'no national-id tokens');
  assert.equal(blob.includes('PH-'), false, 'no phone tokens');
});

// ─── Reconciliation ──────────────────────────────────────────────────────────

test('operator-to-national and pipeline reconciliation all pass', () => {
  assert.equal(D.reconciliation.ok, true, JSON.stringify(D.reconciliation.checks.filter((c) => !c.passed)));
  const names = D.reconciliation.checks.map((c) => c.name);
  for (const need of ['operator-players-reconcile-to-contributions', 'decisions-reconcile-to-candidates', 'sbnat-count-reconciles-with-registry', 'registry-to-twin-mappings-reconcile', 'operator-ggr-reconciles-to-national', 'registry-integrity-ok', 'no-cross-jurisdiction-sbnat'])
    assert.ok(names.includes(need), `reconciliation check ${need}`);
  // GGR is meaningful (non-zero) and reconciles
  assert.ok(D.ledger.nationalGgr > 0);
  assert.equal(D.ledger.operators.reduce((n, o) => n + o.ggr, 0), D.ledger.nationalGgr);
});
