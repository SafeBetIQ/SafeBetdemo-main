// Milestone 4.1 — Registry Runtime Encapsulation (CERT-L1 / C10) adversarial.
// Run: node --test tests/identityFederation.encapsulation.test.mjs
//
// Verifies ACTUAL RUNTIME behaviour (not TypeScript compile-time restrictions):
// internal Registry state is unreachable, mutation methods are not exposed,
// returned data is immutable, and arbitrary injection / counter / audit mutation
// / bypass attempts all fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine,
  getJurisdictionProfile, InMemoryAuditSink,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const engine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');
const ZA = getJurisdictionProfile('ZA');
const h = (t, x) => ({ attributeType: t, hash: x, pepperKeyVersion: 'v1' });
const contrib = (op, sbPlr, attrs) => ({ jurisdiction: 'ZA', casinoId: op, sbPlr, attributes: attrs, contributedAt: '2026-07-16T00:00:00Z' });
const strong = (a, b, nid = 'N1') => engine.decide(ZA, matcher.generateCandidates(ZA, [contrib('opA', a, [h('national_id', nid)]), contrib('opB', b, [h('national_id', nid)])]).candidates[0]).decision;
const fresh = () => new SbNatRegistry({ now: () => '2026-07-16T00:00:00.000Z', auditSink: new InMemoryAuditSink() });

// ENC-1 — internal state is unreachable at runtime.
test('ENC-1 internal Registry state is not reachable', () => {
  const reg = fresh();
  reg.create(strong('SB-PLR-A', 'SB-PLR-B'));
  for (const k of ['records', 'counters', 'mintedIds', 'assignments', 'auditSink', 'now', 'journal', 'state'])
    assert.equal(reg[k], undefined, `reg.${k} must be unreachable`);
  // no own data properties mirror the state
  assert.deepEqual(Object.getOwnPropertyNames(reg).filter((n) => ['records', 'counters', 'mintedIds', 'assignments'].includes(n)), []);
});

// ENC-2 — mutation internals are not exposed on the instance.
test('ENC-2 mutation internals are not exposed', () => {
  const reg = fresh();
  for (const m of ['mint', 'commit', 'write', 'assign', 'audit', 'linkMember', 'noteDecision', 'requireActive'])
    assert.equal(typeof reg[m], 'undefined', `reg.${m} must not exist`);
});

// ENC-3 — returned records + history are immutable.
test('ENC-3 returned records and history are immutable', () => {
  const reg = fresh();
  const rec = reg.create(strong('SB-PLR-A', 'SB-PLR-B'));
  assert.throws(() => { rec.members.push('SB-PLR-X'); }, TypeError);
  assert.throws(() => { rec.state = 'archived'; }, TypeError);
  assert.throws(() => { rec.history.push({}); }, TypeError);
  assert.throws(() => { rec.history[0].action = 'tampered'; }, TypeError);
});

// ENC-4 — arbitrary record insertion is impossible (only create() from approval).
test('ENC-4 arbitrary Registry insertion is impossible', () => {
  const reg = fresh();
  reg.create(strong('SB-PLR-A', 'SB-PLR-B'));
  const before = reg.list().length;
  // there is no insert/set/put surface
  for (const m of ['set', 'put', 'insert', 'add', 'push'])
    assert.equal(typeof reg[m], 'undefined');
  // mutating the returned list does not affect the registry
  const list = reg.list();
  list.push({ sbNat: 'SB-NAT-ZA-FFFFFF' });
  assert.equal(reg.list().length, before, 'registry membership unaffected by mutating a returned list');
});

// ENC-5 — identifier counter cannot be mutated / reset.
test('ENC-5 identifier counter cannot be reset', () => {
  const reg = fresh();
  const a = reg.create(strong('SB-PLR-A', 'SB-PLR-B', 'N1'));
  assert.equal(typeof reg.counters, 'undefined');
  const c = reg.create(strong('SB-PLR-C', 'SB-PLR-D', 'N2'));
  assert.notEqual(a.sbNat, c.sbNat, 'monotonic minting unaffected — no counter handle to reset');
});

// ENC-6 — audit trail cannot be mutated.
test('ENC-6 audit trail is immutable and cannot be rewritten', () => {
  const reg = fresh();
  reg.create(strong('SB-PLR-A', 'SB-PLR-B'));
  const trail = reg.auditTrail();
  assert.ok(trail.length >= 1);
  assert.throws(() => { trail.push({}); }, TypeError, 'returned trail is frozen');
  assert.throws(() => { trail[0].decisionRule = 'tampered'; }, TypeError, 'audit record is frozen');
});

// ENC-7 — approved-decision validation cannot be bypassed via a hidden path.
test('ENC-7 no path bypasses approved-decision validation', () => {
  const reg = fresh();
  // the ONLY creation method is create(); it rejects a non-approved decision
  const review = engine.decide(ZA, matcher.generateCandidates(ZA, [contrib('opA', 'SB-PLR-A', [h('phone', 'P1')]), contrib('opB', 'SB-PLR-B', [h('phone', 'P1')])]).candidates[0]).decision;
  assert.throws(() => reg.create(review), /not-approved|not approved/);
  assert.equal(typeof reg.commit, 'undefined', 'no commit() to bypass validation');
});
