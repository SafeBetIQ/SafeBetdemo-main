// Milestone 3.4 — SB-NAT Registry (v2.0, ADR-006).
// Run: node --test tests/identityFederation.registry.test.mjs
//
// Proves the FIRST authority that creates an Enterprise Correlation Identity:
// approved-decisions-only creation, permanent/immutable/never-reused identifiers,
// the full lifecycle (created/active/re-evaluated/split/merged/retired/archived),
// split & merge that NEVER modify SB-PLR, historical reconstruction, registry
// integrity verification, jurisdiction isolation, no PII, and immutable audit.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine, isApprovedDecision,
  getJurisdictionProfile, isSbNat, jurisdictionOfSbNat,
  resolveFederationConfig, defaultFederationConfig,
  NationalIdentityFederationService, InMemoryAuditSink,
  FederationNotEnabledError, MilestoneNotImplementedError,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const engine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');

const h = (attributeType, hash) => ({ attributeType, hash, pepperKeyVersion: 'v1' });
const contrib = (casinoId, sbPlr, attributes, jurisdiction = 'ZA') =>
  ({ jurisdiction, casinoId, sbPlr, attributes, contributedAt: '2026-07-16T00:00:00Z' });

// An ordered, deterministic clock so lifecycle timestamps strictly increase.
function orderedClock(startMs = 1_700_000_000_000) {
  let t = 0;
  return () => new Date(startMs + (t++) * 1000).toISOString();
}
const freshRegistry = () => new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });

// Build an APPROVED (auto-approved via strong id) decision linking p1 & p2.
function approvedDecision(p1, p2, { nid = 'N1', jur = 'ZA', attr = 'national_id' } = {}) {
  const profile = getJurisdictionProfile(jur);
  const cands = matcher.generateCandidates(profile, [
    contrib('cA', p1, [h(attr, nid)], jur),
    contrib('cB', p2, [h(attr, nid)], jur),
  ]).candidates;
  return engine.decide(profile, cands[0]).decision;
}
// A manual-review (single medium phone) decision.
function reviewDecision(p1, p2) {
  const profile = getJurisdictionProfile('ZA');
  const cands = matcher.generateCandidates(profile, [contrib('cA', p1, [h('phone', 'P1')]), contrib('cB', p2, [h('phone', 'P1')])]).candidates;
  return engine.decide(profile, cands[0]).decision;
}

// ─── Creation (approved decisions ONLY) ──────────────────────────────────────

test('create mints an immutable Enterprise Correlation Identity from an approved decision', () => {
  const reg = freshRegistry();
  const rec = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B'));
  assert.ok(isSbNat(rec.sbNat));
  assert.equal(jurisdictionOfSbNat(rec.sbNat), 'ZA');
  assert.equal(rec.state, 'active');
  assert.deepEqual(rec.members, ['SB-PLR-A', 'SB-PLR-B']);
  assert.equal(rec.history[0].action, 'created');
  // six-part version stamp, permanently stored
  const v = rec.versions;
  assert.ok(v.federationAlgorithmVersion && v.matchingEngineVersion && v.decisionEngineVersion && v.matchingPolicyVersion && v.ruleSetVersion && v.jurisdictionVersion);
  // identifier + record are immutable
  assert.throws(() => { rec.sbNat = 'SB-NAT-ZA-XXXXXX'; }, TypeError);
  assert.throws(() => { rec.versions.decisionEngineVersion = 'x'; }, TypeError);
  assert.throws(() => { rec.members.push('SB-PLR-Z'); }, TypeError);
  // one immutable audit event
  assert.equal(reg.auditTrail().length, 1);
  assert.equal(reg.auditTrail()[0].subjectSbNat, rec.sbNat);
});

test('a manual-review decision (unapproved) can NEVER create an SB-NAT', () => {
  const reg = freshRegistry();
  assert.throws(() => reg.create(reviewDecision('SB-PLR-A', 'SB-PLR-B')), /not-approved|not approved/);
  assert.equal(reg.list().length, 0);
});

test('a manual-review decision that a regulator APPROVED can create an SB-NAT', () => {
  const reg = freshRegistry();
  const d = engine.applyReview(reviewDecision('SB-PLR-A', 'SB-PLR-B'), 'approve', 'regulator:r1', 'verified').decision;
  assert.ok(isApprovedDecision(d));
  const rec = reg.create(d);
  assert.deepEqual(rec.members, ['SB-PLR-A', 'SB-PLR-B']);
});

test('a decision revoked by an upheld appeal is superseded → cannot create', () => {
  const reg = freshRegistry();
  let d = approvedDecision('SB-PLR-A', 'SB-PLR-B');
  d = engine.openAppeal(d, 'regulator:r1', 'subject disputes').decision;
  d = engine.progressAppeal(d, 'uphold', 'regulator:r2', 'insufficient evidence').decision;
  assert.throws(() => reg.create(d), /superseded|revoked/);
});

test('a decision overridden away from approval cannot create', () => {
  const reg = freshRegistry();
  const overridden = engine.applyOverride(approvedDecision('SB-PLR-A', 'SB-PLR-B'), 'rejected', 'regulator:chief', 'data-entry error').decision;
  assert.throws(() => reg.create(overridden), /not-approved|superseded/);
});

// ─── Duplicate prevention + clustering ───────────────────────────────────────

test('duplicate creation from the same decision is idempotent (no second identity)', () => {
  const reg = freshRegistry();
  const d = approvedDecision('SB-PLR-A', 'SB-PLR-B');
  const first = reg.create(d);
  const second = reg.create(d);
  assert.equal(first.sbNat, second.sbNat);
  assert.equal(reg.list().length, 1);
});

test('linking: an approved decision touching an existing member joins that SB-NAT', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  const r2 = reg.create(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N2' }));
  assert.equal(r1.sbNat, r2.sbNat, 'C joins A/B rather than minting a new identity');
  assert.deepEqual(reg.get(r1.sbNat).members, ['SB-PLR-A', 'SB-PLR-B', 'SB-PLR-C']);
  assert.equal(reg.list().length, 1);
});

test('a decision linking two DIFFERENT existing SB-NATs is rejected (merge is explicit)', () => {
  const reg = freshRegistry();
  reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  reg.create(approvedDecision('SB-PLR-C', 'SB-PLR-D', { nid: 'N2' }));
  assert.throws(() => reg.create(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N3' })), /merge-required/);
});

// ─── Immutable identifiers (never reused) ────────────────────────────────────

test('identifiers are never reused — even after retirement', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  reg.retire(r1.sbNat, 'regulator:r1', 'closed cluster');
  const r2 = reg.create(approvedDecision('SB-PLR-C', 'SB-PLR-D', { nid: 'N2' }));
  assert.notEqual(r2.sbNat, r1.sbNat, 'a retired identifier is never recycled');
  assert.ok(reg.exists(r1.sbNat), 'the retired identifier is retained forever');
});

// ─── Split (never modifies SB-PLR) ───────────────────────────────────────────

test('split extracts members into a NEW SB-NAT without modifying SB-PLR', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  reg.create(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N2' }));   // cluster A,B,C
  const { source, created } = reg.split(r1.sbNat, ['SB-PLR-C'], 'regulator:r1', 'wrong link');
  assert.equal(source.sbNat, r1.sbNat, 'source identifier is unchanged');
  assert.notEqual(created.sbNat, r1.sbNat, 'extracted members get a NEW identifier');
  assert.deepEqual(source.members, ['SB-PLR-A', 'SB-PLR-B']);
  assert.deepEqual(created.members, ['SB-PLR-C']);
  // SB-PLR identities themselves are untouched — only the relationship changed
  assert.equal(reg.findBySbPlr('SB-PLR-C').sbNat, created.sbNat);
  assert.equal(reg.findBySbPlr('SB-PLR-A').sbNat, source.sbNat);
  assert.equal(source.history.at(-1).action, 'split-source');
  assert.equal(created.history[0].action, 'split-out');
});

test('split validation: empty / non-member / whole-cluster splits are rejected', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B'));
  assert.throws(() => reg.split(r1.sbNat, [], 'r', 'x'), /split-empty/);
  assert.throws(() => reg.split(r1.sbNat, ['SB-PLR-Z'], 'r', 'x'), /split-non-member/);
  assert.throws(() => reg.split(r1.sbNat, ['SB-PLR-A', 'SB-PLR-B'], 'r', 'x'), /split-all/);
});

// ─── Merge (never modifies SB-PLR; absorbed id retained forever) ─────────────

test('merge folds one SB-NAT into another without modifying SB-PLR', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  const r2 = reg.create(approvedDecision('SB-PLR-C', 'SB-PLR-D', { nid: 'N2' }));
  const { survivor, absorbed } = reg.merge(r1.sbNat, r2.sbNat, 'regulator:r1', 'same individual');
  assert.equal(survivor.sbNat, r2.sbNat);
  assert.deepEqual(survivor.members, ['SB-PLR-A', 'SB-PLR-B', 'SB-PLR-C', 'SB-PLR-D']);
  assert.equal(absorbed.sbNat, r1.sbNat);
  assert.equal(absorbed.state, 'merged');
  assert.deepEqual(absorbed.members, []);
  assert.ok(reg.exists(r1.sbNat), 'absorbed identifier retained forever');
  assert.equal(reg.findBySbPlr('SB-PLR-A').sbNat, r2.sbNat, 'A now correlates under the survivor');
});

test('merge guards: self-merge and cross-jurisdiction merge are rejected', () => {
  const reg = freshRegistry();
  const za = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1', jur: 'ZA' }));
  const ke = reg.create(approvedDecision('SB-PLR-K1', 'SB-PLR-K2', { nid: 'NK', jur: 'KE' }));
  assert.throws(() => reg.merge(za.sbNat, za.sbNat, 'r', 'x'), /merge-self/);
  assert.throws(() => reg.merge(za.sbNat, ke.sbNat, 'r', 'x'), /cross-jurisdiction/);
});

// ─── Retire / archive / re-evaluate lifecycle ────────────────────────────────

test('retire + archive: inactive but permanently retained; history never deleted', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B'));
  const beforeLen = r1.history.length;
  const retired = reg.retire(r1.sbNat, 'regulator:r1', 'dormant');
  assert.equal(retired.state, 'retired');
  assert.equal(reg.findBySbPlr('SB-PLR-A'), undefined, 'retired identity is no longer active');
  const archived = reg.archive(r1.sbNat, 'regulator:r1', 'cold storage');
  assert.equal(archived.state, 'archived');
  assert.ok(archived.history.length > beforeLen, 'history only grows');
  assert.throws(() => reg.retire(r1.sbNat, 'r', 'x'), /not-active/, 'cannot retire an archived identity');
  assert.throws(() => reg.archive(r1.sbNat, 'r', 'x'), /already-archived/);
});

test('re-evaluate records an immutable event without changing membership', () => {
  const reg = freshRegistry();
  const r1 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B'));
  const re = reg.reEvaluate(r1.sbNat, 'regulator:r1', 'periodic review');
  assert.equal(re.state, 're-evaluated');
  assert.deepEqual(re.members, ['SB-PLR-A', 'SB-PLR-B']);
  assert.equal(re.history.at(-1).action, 're-evaluated');
});

// ─── Historical reconstruction ───────────────────────────────────────────────

test('every historical SB-PLR↔SB-NAT relationship is reconstructable', () => {
  const reg = freshRegistry();
  const t0 = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  const tLink = reg.create(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N2' }));  // C joins
  const { created } = reg.split(t0.sbNat, ['SB-PLR-C'], 'regulator:r1', 'split C out');

  // as of creation: C not yet mapped
  const atCreate = reg.reconstructMappingAt(t0.createdAt);
  assert.equal(atCreate.get('SB-PLR-A'), t0.sbNat);
  assert.equal(atCreate.get('SB-PLR-C'), undefined);
  // as of the link: C mapped to the original cluster
  const atLink = reg.reconstructMappingAt(tLink.updatedAt);
  assert.equal(atLink.get('SB-PLR-C'), t0.sbNat);
  // now: C mapped to the split-out identity, A still in the original
  const now = reg.reconstructMappingAt('2999-01-01T00:00:00.000Z');
  assert.equal(now.get('SB-PLR-C'), created.sbNat);
  assert.equal(now.get('SB-PLR-A'), t0.sbNat);
  // the SB-PLR identifier strings are never altered by any relationship change
  assert.deepEqual(reg.assignmentHistory('SB-PLR-C').map(e => e.action), ['linked', 'split-out']);
});

// ─── Registry integrity ──────────────────────────────────────────────────────

test('integrity verification passes on a healthy registry after many operations', () => {
  const reg = freshRegistry();
  const a = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  reg.create(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N2' }));
  const b = reg.create(approvedDecision('SB-PLR-D', 'SB-PLR-E', { nid: 'N3' }));
  reg.split(a.sbNat, ['SB-PLR-C'], 'r', 'x');
  reg.merge(b.sbNat, a.sbNat, 'r', 'y');
  reg.retire(reg.list().find(r => r.state === 'active').sbNat, 'r', 'z');
  const report = reg.verifyIntegrity();
  assert.equal(report.ok, true, JSON.stringify(report.checks));
  for (const c of report.checks) assert.equal(c.passed, true, `${c.name}: ${c.detail}`);
  assert.deepEqual(report.checks.map(c => c.name).sort(),
    ['historical-consistency', 'immutable-identifiers', 'referential-integrity', 'unique-identifiers', 'version-consistency']);
});

// ─── Jurisdiction isolation + sovereign separation ───────────────────────────

test('jurisdiction isolation: records are namespaced and listable per sovereign plane', () => {
  const reg = freshRegistry();
  const za = reg.create(approvedDecision('SB-PLR-Z1', 'SB-PLR-Z2', { nid: 'NZ', jur: 'ZA' }));
  const ke = reg.create(approvedDecision('SB-PLR-K1', 'SB-PLR-K2', { nid: 'NK', jur: 'KE' }));
  assert.ok(za.sbNat.startsWith('SB-NAT-ZA-'));
  assert.ok(ke.sbNat.startsWith('SB-NAT-KE-'));
  assert.deepEqual(reg.list('ZA').map(r => r.sbNat), [za.sbNat]);
  assert.deepEqual(reg.list('KE').map(r => r.sbNat), [ke.sbNat]);
  assert.equal(reg.diagnostics('ZA').total, 1);
  assert.equal(reg.diagnostics('KE').total, 1);
  assert.equal(reg.diagnostics().total, 2);
});

// ─── Security: no PII stored ─────────────────────────────────────────────────

test('no PII: records store only identifiers + version metadata (never attribute values/hashes)', () => {
  const reg = freshRegistry();
  const rec = reg.create(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'SECRET-NID-VALUE' }));
  const blob = JSON.stringify(rec);
  assert.equal(blob.includes('SECRET-NID-VALUE'), false, 'no raw attribute value is ever stored');
  assert.equal(blob.includes('national_id'), false, 'no attribute hashes/types are stored in the registry');
});

// ─── Service integration + enablement gate + boundary ────────────────────────

test('service: registerDecision is gated by enablement and drives the registry', () => {
  const off = new NationalIdentityFederationService({ config: defaultFederationConfig(), auditSink: new InMemoryAuditSink() });
  assert.throws(() => off.registerDecision(approvedDecision('SB-PLR-A', 'SB-PLR-B')), FederationNotEnabledError);

  const cfg = resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' });
  const sink = new InMemoryAuditSink();
  const svc = new NationalIdentityFederationService({ config: cfg, auditSink: sink });
  const rec = svc.registerDecision(approvedDecision('SB-PLR-A', 'SB-PLR-B'), 'regulator:r1');
  assert.ok(isSbNat(rec.sbNat));
  assert.equal(svc.lookupSbNat(rec.sbNat).sbNat, rec.sbNat);
  assert.equal(svc.lookupSbNatBySbPlr('SB-PLR-A').sbNat, rec.sbNat);
  assert.equal(svc.verifyRegistryIntegrity().ok, true);
  assert.equal(svc.registryDiagnostics('ZA').active, 1);
  assert.ok(sink.count() >= 1, 'registry audit flows to the service regulator-plane sink');
  // full pipeline wired through Milestone 3.6 (policy engine factory present)
  assert.equal(typeof svc.nationalPolicyEngine, 'function');
});

test('service: lifecycle operations are gated by jurisdiction enablement', () => {
  const cfg = resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' });
  const svc = new NationalIdentityFederationService({ config: cfg, auditSink: new InMemoryAuditSink() });
  const r1 = svc.registerDecision(approvedDecision('SB-PLR-A', 'SB-PLR-B', { nid: 'N1' }));
  svc.registerDecision(approvedDecision('SB-PLR-B', 'SB-PLR-C', { nid: 'N2' }));
  const { created } = svc.splitSbNat(r1.sbNat, ['SB-PLR-C'], 'regulator:r1', 'split');
  assert.equal(svc.lookupSbNatBySbPlr('SB-PLR-C').sbNat, created.sbNat);
  const merged = svc.mergeSbNat(created.sbNat, r1.sbNat, 'regulator:r1', 'reunite');
  assert.equal(merged.survivor.sbNat, r1.sbNat);
  assert.equal(svc.verifyRegistryIntegrity().ok, true);
});
