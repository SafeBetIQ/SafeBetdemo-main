// Milestone 3.8 — Version 2.0 Enterprise Certification: END-TO-END harness.
// Run: node --test tests/identityFederation.certification.e2e.test.mjs
//
// Independent clean-state execution of the full 3.2–3.6 pipeline via the National
// Demonstration Dataset v2.0, from TWO clean states, comparing determinism and
// independently re-verifying reconciliation, scenarios, isolation, access, PII,
// and integrity. Collects and prints certification evidence (counts + timings).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateNationalDemonstrationDataset, resetAndReseedDemonstrationDataset } from '../lib/identityFederation/index.ts';

// ── Clean-state execution ×2 + timing evidence ───────────────────────────────
const t0 = Date.now();
const RUN_A = generateNationalDemonstrationDataset();
const tA = Date.now() - t0;
const t1 = Date.now();
const RUN_B = resetAndReseedDemonstrationDataset();
const tB = Date.now() - t1;

test('E2E-1 two clean-state executions are deterministically identical', () => {
  // Full structural equality across every certified surface.
  assert.equal(JSON.stringify(RUN_A.metrics), JSON.stringify(RUN_B.metrics), 'metrics identical');
  assert.equal(JSON.stringify(RUN_A.operators), JSON.stringify(RUN_B.operators), 'operator metrics identical');
  assert.equal(JSON.stringify(RUN_A.federation), JSON.stringify(RUN_B.federation), 'federation identical');
  assert.equal(JSON.stringify(RUN_A.sbNats), JSON.stringify(RUN_B.sbNats), 'SB-NAT set identical');
  assert.equal(JSON.stringify(RUN_A.policy), JSON.stringify(RUN_B.policy), 'policy summary identical');
  assert.equal(JSON.stringify(RUN_A.ledger), JSON.stringify(RUN_B.ledger), 'ledger identical');
  assert.equal(JSON.stringify(RUN_A.reconciliation), JSON.stringify(RUN_B.reconciliation), 'reconciliation identical');
  assert.equal(JSON.stringify(RUN_A.scenarios), JSON.stringify(RUN_B.scenarios), 'scenarios identical');
});

test('E2E-2 independent reconciliation passes (all categories)', () => {
  assert.equal(RUN_A.reconciliation.ok, true, JSON.stringify(RUN_A.reconciliation.checks.filter((c) => !c.passed)));
  // Independently recompute the key reconciliations rather than trusting the flags.
  assert.equal(RUN_A.operators.reduce((n, o) => n + o.players, 0), RUN_A.federation.contributions, 'operator SB-PLR ↔ contributions');
  assert.equal(Object.values(RUN_A.federation.decisionsByOutcome).reduce((n, c) => n + c, 0), RUN_A.federation.candidates, 'decisions ↔ candidates');
  assert.equal(RUN_A.operators.reduce((n, o) => n + o.ggr, 0), RUN_A.ledger.nationalGgr, 'Σ operator GGR ↔ national GGR');
  assert.equal(RUN_A.registry.integrityOk, true, 'registry integrity');
  for (const t of RUN_A.twins) assert.ok(t.sbPlrRefs.length >= 1 && t.provenance.federationDecisionRefs.length > 0, 'every twin has members + provenance');
});

test('E2E-3 every named scenario re-asserts correctly (14 + override + appeal)', () => {
  assert.ok(RUN_A.scenarios.length >= 16);
  for (const s of RUN_A.scenarios) for (const a of s.assertions) assert.ok(a.passed, `${s.id}: ${a.name}`);
});

test('E2E-4 cross-operator intelligence: legitimate correlation, false-positive protection', () => {
  assert.ok(RUN_A.metrics.multiOperatorIdentities > 0, 'same anonymous person correlated across operators');
  const fp = RUN_A.scenarios.find((s) => s.id === 'S7-false-positive');
  assert.equal(fp.sbNat, null, 'false positive not linked');
  // benign multi-operator behaviour does not automatically escalate
  const low = RUN_A.scenarios.find((s) => s.id === 'S14-low-risk-control');
  assert.ok(low.assertions.every((a) => a.passed));
});

test('E2E-5 isolation + deny-by-default access re-verified', () => {
  assert.equal(RUN_A.crossJurisdiction.isolated, true);
  assert.equal(RUN_A.access.operatorDenied, true);
  assert.equal(RUN_A.access.wrongJurisdictionDenied, true);
  assert.equal(RUN_A.access.regulatorAllowed, true);
});

test('E2E-6 no plaintext PII across all pipeline outputs', () => {
  const blob = JSON.stringify({ twins: RUN_A.twins, policy: RUN_A.policyEvaluations, scenarios: RUN_A.scenarios, sbNats: RUN_A.sbNats });
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false);
  assert.equal(/\d{7,}/.test(blob), false);
  assert.equal(blob.includes('NID-') || blob.includes('PH-'), false, 'synthetic tokens never leak');
});

test('E2E-7 controlled integrity-failure scenario is detected, not silently passed', () => {
  const s12 = RUN_A.scenarios.find((s) => s.id === 'S12-data-integrity');
  assert.ok(s12.policyOutcomes.includes('Data Integrity Failure') || s12.policyOutcomes.includes('Insufficient Evidence'));
  assert.ok(RUN_A.policy.byOutcome['Data Integrity Failure'] > 0);
});

test('E2E-EVIDENCE performance + counts (informational, printed)', () => {
  const ev = {
    datasetVersion: RUN_A.datasetVersion, seedVersion: RUN_A.seedVersion,
    genMsRunA: tA, genMsRunB: tB,
    contributions: RUN_A.federation.contributions, candidates: RUN_A.federation.candidates,
    decisions: RUN_A.federation.decisionsByOutcome, manualApproved: RUN_A.federation.manualApproved, manualRejected: RUN_A.federation.manualRejected,
    sbNats: RUN_A.registry.sbNats, splits: RUN_A.registry.splits, merges: RUN_A.registry.merges, registryIntegrityOk: RUN_A.registry.integrityOk,
    twins: RUN_A.twins.length, policyEvaluations: RUN_A.policy.evaluations, policyOutcomes: RUN_A.policy.byOutcome, policyConflicts: RUN_A.policy.conflicts,
    nationalGgr: RUN_A.ledger.nationalGgr, reconciliationOk: RUN_A.reconciliation.ok,
    multiOperatorIdentities: RUN_A.metrics.multiOperatorIdentities, highInterest: RUN_A.metrics.highInterestIdentities,
  };
  console.log('CERT-EVIDENCE ' + JSON.stringify(ev));
  assert.ok(tA < 5000 && tB < 5000, 'demonstration generation within sane bounds');
});
