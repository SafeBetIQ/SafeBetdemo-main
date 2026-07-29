// Milestone 4.1 — Pilot Regulator-Plane Persistence & Security.
// Run: node --test tests/identityFederation.persistence.test.mjs
//
// Durable write/read, process-restart reconstruction, RLS deny-by-default matrix,
// hash-chained append-only audit + tamper detection, backup/restore + post-restore
// integrity, migration validation, synthetic-load reconciliation, and no PII.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine, InMemoryAuditSink,
  getJurisdictionProfile,
  RegulatorPlaneStore, InMemoryBackend, DurableFileBackend, HashChainedAudit,
  assertRegulatorRead, assertServiceWrite, AccessDeniedError,
  pilotMigrationPlan, validateMigrationPlan, PILOT_STORE_SCHEMA_VERSION,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const engine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');
const ZA = getJurisdictionProfile('ZA');
const KE = getJurisdictionProfile('KE');
const h = (t, x) => ({ attributeType: t, hash: x, pepperKeyVersion: 'v1' });
const contrib = (op, sbPlr, attrs, j = 'ZA') => ({ jurisdiction: j, casinoId: op, sbPlr, attributes: attrs, contributedAt: '2026-07-16T00:00:00Z' });
const strong = (a, b, nid = 'N1', prof = ZA, j = 'ZA') => engine.decide(prof, matcher.generateCandidates(prof, [contrib('opA', a, [h('national_id', nid)], j), contrib('opB', b, [h('national_id', nid)], j)]).candidates[0]).decision;
const CLOCK = () => '2026-07-16T00:00:00.000Z';

const SVC = { plane: 'service', jurisdiction: 'ZA', roles: ['writer'] };
const INTEG = { plane: 'service', jurisdiction: 'ZA' };
const REG_ZA = { plane: 'regulator', jurisdiction: 'ZA', roles: ['reader'] };

function seededRegistry(store) {
  const reg = new SbNatRegistry({ now: CLOCK, auditSink: new InMemoryAuditSink(), persistence: store });
  reg.create(strong('SB-PLR-A', 'SB-PLR-B', 'N1'));
  reg.create(strong('SB-PLR-B', 'SB-PLR-C', 'N2'));   // links C
  reg.create(strong('SB-PLR-D', 'SB-PLR-E', 'N3'));
  return reg;
}

// ── Durable write + read ─────────────────────────────────────────────────────
test('durable write then reconstruct yields the same records', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  const reg = seededRegistry(store);
  const rebuilt = store.reconstructRegistry(INTEG);
  assert.deepEqual(rebuilt.list().map((r) => r.sbNat).sort(), reg.list().map((r) => r.sbNat).sort());
  assert.equal(rebuilt.verifyIntegrity().ok, true);
});

// ── Process-restart reconstruction (durable file backend) ────────────────────
test('state survives a process restart (fresh backend over the same directory)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sbnat-pilot-'));
  try {
    const store1 = new RegulatorPlaneStore({ backend: new DurableFileBackend(dir) });
    const reg1 = seededRegistry(store1);
    const before = reg1.list().map((r) => `${r.sbNat}:${r.members.join(',')}`).sort();
    // "restart": brand-new backend + store over the same directory
    const store2 = new RegulatorPlaneStore({ backend: new DurableFileBackend(dir) });
    const reg2 = store2.reconstructRegistry(INTEG);
    const after = reg2.list().map((r) => `${r.sbNat}:${r.members.join(',')}`).sort();
    assert.deepEqual(after, before, 'records reconstructed after restart');
    assert.equal(reg2.verifyIntegrity().ok, true);
    assert.equal(store2.verifyAuditChain(INTEG).ok, true, 'audit chain intact after restart');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── Idempotency + counter continuity after reconstruction ────────────────────
test('minting stays collision-free after reconstruction (counter derived from ids)', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  const reg = seededRegistry(store);
  const existing = new Set(reg.list().map((r) => r.sbNat));
  const rebuilt = store.reconstructRegistry(INTEG, { now: CLOCK });
  const created = rebuilt.create(strong('SB-PLR-X', 'SB-PLR-Y', 'NX'));
  assert.equal(existing.has(created.sbNat), false, 'a reconstructed registry never re-mints an existing id');
});

// ── RLS deny-by-default matrix (against the real store) ──────────────────────
test('RLS: regulator read allowed; operator/admin/unauth/wrong-jur/cross-sovereign denied', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  const reg = seededRegistry(store);
  const anySbNat = reg.list()[0].sbNat;
  assert.doesNotThrow(() => store.readRecord(REG_ZA, anySbNat));
  assert.doesNotThrow(() => store.listRecords(REG_ZA, 'ZA'));
  assert.throws(() => store.readRecord({ plane: 'operator', jurisdiction: 'ZA' }, anySbNat), AccessDeniedError);
  assert.throws(() => store.readRecord({ plane: 'casino-admin', jurisdiction: 'ZA' }, anySbNat), AccessDeniedError);
  assert.throws(() => store.readRecord({ plane: 'unauthenticated', jurisdiction: null }, anySbNat), AccessDeniedError);
  assert.throws(() => store.listRecords({ plane: 'regulator', jurisdiction: 'NA', roles: ['reader'] }, 'ZA'), AccessDeniedError);
  assert.throws(() => store.listRecords({ plane: 'regulator', jurisdiction: 'NA', sovereignJurisdictions: ['NA'], roles: ['reader'] }, 'ZA'), AccessDeniedError);
  assert.doesNotThrow(() => store.listRecords({ plane: 'regulator', jurisdiction: 'NA', sovereignJurisdictions: ['NA', 'ZA'], roles: ['reader'] }, 'ZA'));
});

test('RLS: governed writes require an authorised service context; operators denied', () => {
  assert.doesNotThrow(() => assertServiceWrite(SVC, 'ZA'));
  assert.throws(() => assertServiceWrite({ plane: 'operator', jurisdiction: 'ZA' }, 'ZA'), AccessDeniedError);
  assert.throws(() => assertServiceWrite({ plane: 'regulator', jurisdiction: 'ZA', roles: ['reader'] }, 'ZA'), AccessDeniedError);
  assert.throws(() => assertRegulatorRead({ plane: 'operator', jurisdiction: 'ZA' }, 'ZA'), AccessDeniedError);
});

test('RLS: sovereign separation — ZA context cannot read NA/BW/KE', () => {
  for (const other of ['NA', 'BW', 'KE'])
    assert.throws(() => assertRegulatorRead({ plane: 'regulator', jurisdiction: 'ZA', roles: ['reader'] }, other), AccessDeniedError);
});

test('reconstruction / integrity require an authorised service or integrity context', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  seededRegistry(store);
  assert.throws(() => store.reconstructRegistry({ plane: 'regulator', jurisdiction: 'ZA', roles: ['reader'] }), AccessDeniedError);
  assert.doesNotThrow(() => store.reconstructRegistry(INTEG));
  assert.doesNotThrow(() => store.reconstructRegistry({ plane: 'regulator', jurisdiction: 'ZA', roles: ['integrity'] }));
});

// ── Append-only audit + tamper detection ─────────────────────────────────────
test('audit chain is append-only with no update/delete surface', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  seededRegistry(store);
  assert.ok(store.verifyAuditChain(INTEG).ok);
  assert.ok(store.auditChainLength() >= 3);
  for (const m of ['update', 'delete', 'replace', 'remove'])
    assert.equal(typeof store[m], 'undefined', `store.${m} must not exist`);
  const chain = new HashChainedAudit();
  for (const m of ['update', 'delete', 'replace']) assert.equal(typeof chain[m], 'undefined');
});

test('audit chain detects modified, reordered, and broken-chain tampering', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  seededRegistry(store);
  assert.equal(store.verifyAuditChain(INTEG).ok, true, 'a healthy persisted chain verifies');
  // Build an explicit chain and corrupt it deterministically.
  const c = new HashChainedAudit();
  const mk = (rule) => ({ auditId: `a-${rule}`, timestamp: '2026-07-16T00:00:00.000Z', jurisdiction: 'ZA', subjectSbNat: 'SB-NAT-ZA-000001', affectedSbPlr: [], evidenceUsed: [], evidenceIgnored: [], matchingRules: [], decisionRule: rule, confidence: { tier: 'confirmed', score: 1 }, versions: {}, reviewer: 'system', overrideHistory: [], appealHistory: [] });
  c.append(mk('one')); c.append(mk('two')); c.append(mk('three'));
  assert.equal(c.verify().ok, true);
  const dump = c.list().map((e) => ({ ...e, record: { ...e.record } }));
  // modified-record
  const modified = new HashChainedAudit(dump.map((e, i) => i === 1 ? { ...e, record: { ...e.record, decisionRule: 'TAMPERED' } } : e));
  const mv = modified.verify(); assert.equal(mv.ok, false); assert.ok(mv.issues.some((x) => x.kind === 'modified-record'));
  // reordered
  const reordered = new HashChainedAudit([dump[0], dump[2], dump[1]]);
  assert.equal(reordered.verify().ok, false);
  // broken chain (drop the middle)
  const broken = new HashChainedAudit([dump[0], dump[2]]);
  assert.equal(broken.verify().ok, false);
});

// ── Backup + restore + post-restore integrity ────────────────────────────────
test('backup then restore reproduces state and passes integrity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sbnat-pilot-'));
  const backupDir = mkdtempSync(join(tmpdir(), 'sbnat-backup-'));
  try {
    const backend = new DurableFileBackend(dir);
    const store = new RegulatorPlaneStore({ backend });
    const reg = seededRegistry(store);
    backend.backupTo(backupDir);
    // restore: new store over the backup directory
    const restored = new RegulatorPlaneStore({ backend: new DurableFileBackend(backupDir) });
    const rebuilt = restored.reconstructRegistry(INTEG);
    assert.deepEqual(rebuilt.list().map((r) => r.sbNat).sort(), reg.list().map((r) => r.sbNat).sort());
    const integrity = restored.verifyStoreIntegrity(INTEG);
    assert.equal(integrity.ok, true, JSON.stringify(integrity));
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(backupDir, { recursive: true, force: true }); }
});

// ── Migration validation (dry-run) ───────────────────────────────────────────
test('pilot migration plan validates (dry-run); a non-pilot target is rejected', () => {
  const plan = pilotMigrationPlan();
  assert.equal(plan.schemaVersion, PILOT_STORE_SCHEMA_VERSION);
  assert.equal(validateMigrationPlan(plan).ok, true);
  assert.equal(validateMigrationPlan({ ...plan, target: 'production' }).ok, false);
  assert.equal(validateMigrationPlan({ ...plan, objects: [{ name: 'x', disposition: 'bogus', rlsRead: '', rlsWrite: '' }] }).ok, false);
});

// ── Synthetic-load reconciliation ────────────────────────────────────────────
test('synthetic persisted load reconciles with the live registry', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  const reg = seededRegistry(store);
  const rebuilt = store.reconstructRegistry(INTEG);
  assert.equal(rebuilt.list().length, reg.list().length, 'persisted record count reconciles');
  assert.equal(store.diagnostics(INTEG).registryIntegrityOk, true);
  assert.equal(store.diagnostics(INTEG).auditChainOk, true);
});

// ── No plaintext PII persisted ───────────────────────────────────────────────
test('no plaintext PII in persisted records, assignments, or audit', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  const reg = seededRegistry(store);
  const snap = reg.snapshot();
  // Regulator-plane domain data (records + assignments + diagnostics): full heuristic.
  const domainBlob = JSON.stringify({ records: snap.records, assignments: snap.assignments, diag: store.diagnostics(INTEG) });
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(domainBlob), false, 'no email-like PII');
  assert.equal(/\d{7,}/.test(domainBlob), false, 'no long digit runs');
  assert.equal(domainBlob.includes('NID-') || domainBlob.includes('PH-'), false, 'no attribute-value tokens');
  // Audit records: no email + no attribute-value tokens (auditId embeds a benign
  // timestamp integer by design — not PII — so the digit-run heuristic is N/A here).
  const auditBlob = JSON.stringify(reg.auditTrail());
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(auditBlob), false, 'no email-like PII in audit');
  assert.equal(auditBlob.includes('NID-') || auditBlob.includes('PH-'), false, 'no attribute tokens in audit');
});

// ── Failure modes ────────────────────────────────────────────────────────────
test('failure modes are safe: malformed id, wrong jurisdiction, missing context', () => {
  const store = new RegulatorPlaneStore({ backend: new InMemoryBackend() });
  seededRegistry(store);
  assert.throws(() => store.readRecord(REG_ZA, 'not-an-sbnat'), AccessDeniedError);
  assert.throws(() => store.readRecord(undefined, 'SB-NAT-ZA-000001'), AccessDeniedError);
  assert.throws(() => assertRegulatorRead(undefined, 'ZA'), AccessDeniedError);
});
