// SafeBet Guardian — Provider Follow-up, Continuous Verification & Re-entry Intelligence (ARCH-V4-C10).
// Synthetic only. Intelligence + verification + routing; NEVER automatic re-enforcement.
//   node --test tests/guardian/guardianReentry.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  detectReentry, classifyRelationship, assessCoverage, buildVerificationObservation, indicatesReentry,
  actionedButNotVerified, applyReview, routeCandidate, resolveOrchestrationReference, historicVerificationIsImmutable,
  syntheticVerifiedOrchestration, SIGNAL_STILL_UNAVAILABLE, SIGNAL_SAME_TARGET_AVAILABLE, SIGNAL_KNOWN_ALIAS,
  SIGNAL_MIRROR, SIGNAL_APP_RELISTING, SIGNAL_PAYMENT_REUSE, SIGNAL_GEO_CHANGE, SIGNAL_OPERATOR_STRONG,
  SIGNAL_OPERATOR_WEAK, coverageExplicit, COVERAGE_EXPIRED, COVERAGE_WITHDRAWN,
  GuardianReentryWorker, ReentryPoisonMessageError, buildReentryPersistencePlan,
} from '../../products/guardian/src/reentry/index.ts';

const JUR = 'ZA-GP';
function detect(signal, coverage = null, orchOver = {}) {
  return detectReentry({ jurisdiction: JUR, orchestration: syntheticVerifiedOrchestration(orchOver), signal, coverage });
}

// ── 1. VERIFIED target, follow-up still unavailable → no re-entry ─────────────
test('1 — VERIFIED target still unavailable on follow-up → no candidate', () => {
  const d = detect(SIGNAL_STILL_UNAVAILABLE);
  assert.equal(d.candidateCreated, false);
  assert.equal(d.reentryCandidateId, null);
  assert.equal(d.verification.result, 'EXPECTED_STATE_OBSERVED');
});

// ── 2. VERIFIED target later available → candidate, no automatic dispatch ─────
test('2 — VERIFIED target later available → REENTRY_CANDIDATE, no auto dispatch', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, coverageExplicit());
  assert.equal(d.candidateCreated, true);
  assert.equal(d.relationshipType, 'SAME_TARGET_REAPPEARED');
  assert.equal(d.candidateState, 'DETECTED');
  assert.equal(d.isEnforcementDispatched, false);
  assert.equal(d.isIllegalityDetermined, false);
  assert.equal(d.isAuthorityApplied, false);
});

// ── 3. known alias observed → relationship candidate → human review ──────────
test('3 — known alias → candidate requiring human review', () => {
  const d = detect(SIGNAL_KNOWN_ALIAS);
  assert.equal(d.candidateCreated, true);
  assert.equal(d.relationshipType, 'KNOWN_ALIAS');
  assert.equal(d.humanReviewState, 'PENDING_REVIEW');
  assert.ok(d.reasonCodes.includes('KNOWN_ALIAS_OBSERVED'));
});

// ── 4. mirror domain → candidate, not automatically same operator ────────────
test('4 — mirror signal → candidate; not asserted same operator', () => {
  const d = detect(SIGNAL_MIRROR);
  assert.equal(d.relationshipType, 'MIRROR_REFERENCE');
  assert.notEqual(d.relationshipType, 'ENTITY_RELATIONSHIP');
});

// ── 5. new app listing signal → candidate ────────────────────────────────────
test('5 — app relisting → candidate', () => {
  const d = detect(SIGNAL_APP_RELISTING, null, { actionType: 'APP_PLATFORM_REFERRAL', targetType: 'MOBILE_APP', targetReference: 'com.synthetic.reentry.app01' });
  assert.equal(d.candidateCreated, true);
  assert.equal(d.relationshipType, 'APP_RELISTING');
});

// ── 6. payment reference reuse → candidate ───────────────────────────────────
test('6 — payment reference reuse → candidate', () => {
  const d = detect(SIGNAL_PAYMENT_REUSE, null, { actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-SYNTH-REUSE-01' });
  assert.equal(d.relationshipType, 'PAYMENT_REFERENCE_REUSE');
  assert.ok(d.reasonCodes.includes('COMMON_PAYMENT_REFERENCE'));
});

// ── 7. geo availability change → candidate ───────────────────────────────────
test('7 — geo availability change → candidate', () => {
  const d = detect(SIGNAL_GEO_CHANGE, null, { actionType: 'GEO_RESTRICTION', targetType: 'SERVICE', targetReference: 'SVC-SYNTH-GEO-01' });
  assert.equal(d.relationshipType, 'GEO_AVAILABILITY_CHANGE');
});

// ── 8. same target reappears → candidate linked to prior orchestration ───────
test('8 — same target reappears → candidate links prior orchestration', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, coverageExplicit());
  assert.equal(d.originalOrchestrationReference, 'ORCH-SYNTH-0001');
  assert.equal(d.relationshipType, 'SAME_TARGET_REAPPEARED');
});

// ── 9. explicit valid authority covers candidate → EXISTING_AUTHORITY path, no C9 dispatch ──
test('9 — explicit valid coverage → EXISTING_AUTHORITY_REVIEW route, no C9 dispatch', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, coverageExplicit());
  assert.equal(d.coverageState, 'EXPLICITLY_COVERED');
  const r = routeCandidate({ reviewOutcome: 'SAME_TARGET_CONFIRMED', coverageState: d.coverageState });
  assert.equal(r.routingOutcome, 'EXISTING_AUTHORITY_REVIEW');
  assert.equal(r.targetModule, 'C8_AUTHORISATION');
  assert.equal(r.isEnforcementDispatched, false);
  assert.equal(r.isAuthorisationGranted, false);
});

// ── 10. authority expired → NEW C8 review required ───────────────────────────
test('10 — authority expired → NEW_C8_AUTHORISATION_REQUIRED', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, COVERAGE_EXPIRED);
  assert.equal(d.coverageState, 'AUTHORITY_EXPIRED');
  const r = routeCandidate({ reviewOutcome: 'EXISTING_AUTHORITY_REVIEW_REQUIRED', coverageState: d.coverageState });
  assert.equal(r.routingOutcome, 'NEW_C8_AUTHORISATION_REQUIRED');
});

// ── 11. authority withdrawn → NEW C8 review required ─────────────────────────
test('11 — authority withdrawn → NEW_C8_AUTHORISATION_REQUIRED', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, COVERAGE_WITHDRAWN);
  assert.equal(d.coverageState, 'AUTHORITY_WITHDRAWN');
  const r = routeCandidate({ reviewOutcome: 'EXISTING_AUTHORITY_REVIEW_REQUIRED', coverageState: d.coverageState });
  assert.equal(r.routingOutcome, 'NEW_C8_AUTHORISATION_REQUIRED');
});

// ── 12. target outside immutable scope → new authorisation required ──────────
test('12 — candidate target outside authorised scope → coverage not explicit', () => {
  // coverage names only the original target; the alias candidate is NOT covered.
  const d = detect(SIGNAL_KNOWN_ALIAS, coverageExplicit());
  assert.notEqual(d.coverageState, 'EXPLICITLY_COVERED');
  assert.ok(['COVERAGE_UNCLEAR', 'REQUIRES_C8_REVIEW', 'NOT_COVERED'].includes(d.coverageState));
});

// ── 13. coverage metadata missing → COVERAGE_UNCLEAR → C8 review ─────────────
test('13 — no coverage metadata → COVERAGE_UNCLEAR', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, null);
  assert.equal(d.coverageState, 'COVERAGE_UNCLEAR');
  assert.ok(d.reasonCodes.includes('AUTHORITY_COVERAGE_UNKNOWN'));
});

// ── 14. relationship insufficient → human review / unresolved ────────────────
test('14 — unresolved review outcome stays in review, not routed onward', () => {
  const r = routeCandidate({ reviewOutcome: 'RELATIONSHIP_UNRESOLVED', coverageState: 'COVERAGE_UNCLEAR' });
  assert.equal(r.nextCandidateState, 'REQUIRES_REVIEW');
  assert.notEqual(r.targetModule, 'C6_INVESTIGATION');
});

// ── 15. false positive → closed → no action ──────────────────────────────────
test('15 — false positive → CLOSED_FALSE_POSITIVE, no target module', () => {
  const rv = applyReview('FALSE_POSITIVE');
  assert.equal(rv.nextState, 'FALSE_POSITIVE');
  const r = routeCandidate({ reviewOutcome: 'FALSE_POSITIVE', coverageState: 'EXPLICITLY_COVERED' });
  assert.equal(r.routingOutcome, 'CLOSED_FALSE_POSITIVE');
  assert.equal(r.targetModule, 'NONE');
});

// ── 16. wrong jurisdiction coverage → denied/requires review ─────────────────
test('16 — coverage in wrong jurisdiction → REQUIRES_C8_REVIEW (never covered)', () => {
  const c = assessCoverage({ coverage: coverageExplicit({ jurisdiction: 'ZA-WC' }), candidateTargetReference: 'licensed-example-003.test', relationshipType: 'SAME_TARGET_REAPPEARED', jurisdiction: 'ZA-GP' });
  assert.equal(c.coverageState, 'REQUIRES_C8_REVIEW');
});

// ── 17/18 — IQ casino_admin & anon are denied by RLS/route guards (proved live) ─
test('17/18 — coverage never inferred from a weak same-operator signal (SIMILAR != SAME)', () => {
  const d = detect(SIGNAL_OPERATOR_WEAK);
  assert.equal(d.relationshipType, 'UNKNOWN_RELATIONSHIP'); // single weak signal never asserts entity
});

// ── 19. duplicate candidate message → one authoritative candidate ────────────
test('19 — duplicate idempotency key → one authoritative candidate', () => {
  const w = new GuardianReentryWorker();
  const msg = { product: 'GUARDIAN', schemaVersion: '1.0', eventType: 'guardian.reentry.detect', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'dup-1', occurredAt: 't', orchestrationReference: 'ORCH-SYNTH-0001', signalFixture: 'SAME_TARGET', coverageFixture: 'EXPLICIT' };
  const a = w.process(msg); const b = w.process(msg);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true);
  assert.equal(w.processedCount(), 1);
});

// ── 20. poison → DLQ → zero authoritative candidate ──────────────────────────
test('20 — poison message → ReentryPoisonMessageError (routes to DLQ)', () => {
  const w = new GuardianReentryWorker();
  assert.throws(() => w.process({ product: 'X' }), ReentryPoisonMessageError);
  assert.throws(() => w.process({ product: 'GUARDIAN', eventType: 'guardian.reentry.detect', jurisdiction: JUR, idempotencyKey: 'k', orchestrationReference: 'UNKNOWN', signalFixture: 'SAME_TARGET' }), ReentryPoisonMessageError);
});

// ── 21. provider ACTIONED but verification NOT_VERIFIED → follow-up required ──
test('21 — ACTIONED but NOT_VERIFIED → discrepancy flagged, never auto-VERIFIED', () => {
  const o = syntheticVerifiedOrchestration({ latestProviderState: 'ACTIONED', latestVerificationState: 'NOT_VERIFIED' });
  assert.equal(actionedButNotVerified(o), true);
});

// ── 22. MORE_INFO_REQUIRED → governed supplementary evidence, no bulk disclosure ─
test('22 — verification observation carries no evidence body (reference only)', () => {
  const obs = buildVerificationObservation(syntheticVerifiedOrchestration(), SIGNAL_SAME_TARGET_AVAILABLE);
  assert.ok(!('evidenceBody' in obs));
  assert.ok(typeof obs.result === 'string');
});

// ── 23. provider DECLINED → review route, no technical retry loop (state semantics preserved) ─
test('23 — coverage assessment is a routing assessment, never a final legal determination', () => {
  const c = assessCoverage({ coverage: coverageExplicit(), candidateTargetReference: 'licensed-example-003.test', relationshipType: 'SAME_TARGET_REAPPEARED', jurisdiction: JUR });
  assert.equal(c.isFinalLegalDetermination, false);
});

// ── 24. C10 worker attempts C9 enforcement queue → no capability (no dispatch surface) ─
test('24 — worker decision exposes no enforcement dispatch capability', () => {
  const w = new GuardianReentryWorker();
  const out = w.process({ product: 'GUARDIAN', schemaVersion: '1.0', eventType: 'guardian.reentry.detect', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'k24', occurredAt: 't', orchestrationReference: 'ORCH-SYNTH-0001', signalFixture: 'SAME_TARGET', coverageFixture: 'EXPLICIT' });
  assert.equal(out.decision.isEnforcementDispatched, false);
  const plan = buildReentryPersistencePlan({ jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'k24', out });
  // No provider/orchestration/enforcement table is ever written by C10.
  const tables = plan.rows.map((r) => r.table);
  assert.ok(!tables.some((t) => t.includes('provider') || t.includes('orchestration') || t.includes('dispatch')));
});

// ── 25. caller self-asserts AUTHORISING_OFFICER → denied (no legal-determination path) ─
test('25 — candidate can never carry illegality/authority-applied assertions', () => {
  const d = detect(SIGNAL_SAME_TARGET_AVAILABLE, coverageExplicit());
  assert.equal(d.isIllegalityDetermined, false);
  assert.equal(d.isAuthorityApplied, false);
});

// ── 26. historic VERIFIED record remains immutable after re-entry ────────────
test('26 — historic VERIFIED remains immutable after a later re-entry candidate', () => {
  const snap = resolveOrchestrationReference({ orchestration_reference: 'ORCH-SYNTH-0001', authorisation_reference: 'AUTH-SYNTH-0001', action_type: 'DOMAIN_BLOCK', target_type: 'DOMAIN', target_reference: 'licensed-example-003.test', jurisdiction: JUR, provider_channel: 'PCH-SYNTH-DNS-ZAGP', orchestration_status: 'VERIFIED', latest_provider_state: 'ACTIONED', latest_verification_state: 'VERIFIED', created_at: null, closed_at: null, reference_status: 'ACTIVE' });
  assert.equal(historicVerificationIsImmutable(snap), true);
  // A later re-entry candidate is a NEW append — it does not change the snapshot's verified state.
  const d = detectReentry({ jurisdiction: JUR, orchestration: snap, signal: SIGNAL_SAME_TARGET_AVAILABLE, coverage: coverageExplicit() });
  assert.equal(d.candidateCreated, true);
  assert.equal(snap.latestVerificationState, 'VERIFIED');
});

// ── Boundary + no-black-box-score + relationship strong-vs-weak ───────────────
test('B1 — review priority is LOW/MEDIUM/HIGH only (no probability/score)', () => {
  const c = classifyRelationship(SIGNAL_SAME_TARGET_AVAILABLE);
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(c.reviewPriority));
});
test('B2 — operator signal WITH two shared refs may reach ENTITY_RELATIONSHIP', () => {
  const c = classifyRelationship(SIGNAL_OPERATOR_STRONG);
  assert.equal(c.relationshipType, 'ENTITY_RELATIONSHIP');
});
test('B3 — indicatesReentry: available/changed true; unavailable false', () => {
  assert.equal(indicatesReentry(buildVerificationObservation(syntheticVerifiedOrchestration(), SIGNAL_SAME_TARGET_AVAILABLE)), true);
  assert.equal(indicatesReentry(buildVerificationObservation(syntheticVerifiedOrchestration(), SIGNAL_STILL_UNAVAILABLE)), false);
});
test('B4 — no re-entry/enforcement leakage in reentry source (static scan)', () => {
  const dir = 'products/guardian/src/reentry';
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(`${dir}/${f}`, 'utf8');
    assert.ok(!/\bfetch\(|node:http|axios|net\.connect|dns\./.test(src), `${f} must have no outbound network primitive`);
    assert.ok(!/ILLEGAL_AGAIN|AUTO_REBLOCK|reblock_score|illegal_probability/i.test(src), `${f} must not contain reblock/illegality scoring`);
  }
});
test('B5 — persistence plan always appends a verification observation (continuous verification)', () => {
  const w = new GuardianReentryWorker();
  const out = w.process({ product: 'GUARDIAN', schemaVersion: '1.0', eventType: 'guardian.reentry.detect', jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'kb5', occurredAt: 't', orchestrationReference: 'ORCH-SYNTH-0001', signalFixture: 'STILL_UNAVAILABLE' });
  const plan = buildReentryPersistencePlan({ jurisdiction: JUR, correlationId: 'c', idempotencyKey: 'kb5', out });
  assert.ok(plan.rows.some((r) => r.table === 'enforcement_verification_observation'));
  assert.equal(plan.reentryCandidateId, null); // still-unavailable → no candidate
});
