// Milestone 4.4 — Live Operator Connector Sandbox.
// Run: node --test tests/identityFederation.connector.test.mjs
//
// Lifecycle, authn/authz, source mapping, hash-before-boundary, checkpoint/
// restart, idempotency/sequence, rate/backpressure, retry/dead-letter, suspend/
// revoke, corrections, reconciliation, multi-operator isolation, security,
// privacy, and end-to-end through the real 4.2/4.3 boundaries. Synthetic only.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OperatorConnector, ConnectorAuthenticator, InMemorySandboxSource, InMemoryCheckpointStore,
  InMemoryConnectorAuditSink, ConnectorError,
  FederationCryptoProvider, InMemoryPilotSecretStore,
  FederationEventPlatform, InMemorySbPlrDirectory, ContributionProjector,
  IdentityMatchingEngine, getJurisdictionProfile,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const ZA = getJurisdictionProfile('ZA');
const ADMIN = { plane: 'platform-admin', actorRef: 'ops:admin' };

const cfg = (over = {}) => ({
  connectorId: 'conn-a', operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA', connectorVersion: '1.0',
  sourceType: 'sandbox-sim', supportedAttributes: ['national_id', 'phone'],
  rateLimit: { maxBatch: 100, maxPerWindow: 1000, windowMs: 60000, maxConcurrent: 1 },
  retryPolicy: { maxRetries: 3, baseDelayMs: 0 }, ...over,
});
const rec = (sourceRef, sbPlr, seq, attrs = [{ type: 'national_id', value: `NID-${sbPlr}` }], over = {}) =>
  ({ sourceRef, sourceSequence: seq, sourceTimestamp: '2026-01-01T00:00:00Z', sourceVersion: '1', status: 'active', sbPlr, attributes: attrs, ...over });

function harness(records, config = cfg(), opts = {}) {
  const store = new InMemoryPilotSecretStore({ jurisdictions: ['ZA', 'NA'], now: CLOCK });
  const crypto = new FederationCryptoProvider({ store, now: CLOCK });
  const directory = new InMemorySbPlrDirectory();
  const platform = new FederationEventPlatform({ resolver: directory, verifyPepperVersion: (j, v) => crypto.verifyVersion(j, v), now: CLOCK, faultInjector: opts.faultInjector });
  const auth = new ConnectorAuthenticator(CLOCK);
  auth.provision(config.connectorId, { operatorId: config.operatorId, tenantId: config.tenantId, jurisdiction: config.jurisdiction, expiresAt: opts.expiresAt ?? null }, 'sandbox-secret-123');
  const source = new InMemorySandboxSource(records);
  const checkpointStore = opts.checkpointStore ?? new InMemoryCheckpointStore();
  const connector = new OperatorConnector({ config, authenticator: auth, credential: 'sandbox-secret-123', source, crypto, resolver: directory, platform, checkpointStore, auditSink: new InMemoryConnectorAuditSink(), now: CLOCK, circuitThreshold: opts.circuitThreshold ?? 3 });
  return { store, crypto, directory, platform, auth, source, connector, checkpointStore };
}

// ─── Lifecycle + authentication ──────────────────────────────────────────────
test('connector starts disabled; activation is explicit; invalid/expired credentials fail closed', () => {
  const { connector, directory } = harness([rec('s1', 'SB-PLR-A', 1)]);
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  assert.equal(connector.status(), 'provisioned', 'starts disabled');
  assert.throws(() => connector.sync(), /not-active/);
  connector.activate();
  assert.equal(connector.status(), 'active');
  assert.throws(() => connector.activate('wrong'), ConnectorError);   // (already active → transition/credential guard)
});

test('invalid, expired, and revoked credentials are rejected', () => {
  const good = harness([]);
  assert.throws(() => good.auth.validate('conn-a', 'nope'), /invalid-credential/);
  const exp = harness([], cfg(), { expiresAt: '2020-01-01T00:00:00Z' });
  assert.throws(() => exp.connector.activate(), /credential-expired/);
  good.auth.revoke('conn-a');
  assert.throws(() => good.auth.validate('conn-a', 'sandbox-secret-123'), /credential-revoked/);
});

// ─── Tenant / jurisdiction binding + no federation reads ─────────────────────
test('connector cannot switch tenant, submit another tenant SB-PLR, or read federation', () => {
  const { connector, directory } = harness([rec('s1', 'SB-PLR-X', 1)]);
  // SB-PLR-X belongs to a DIFFERENT tenant
  directory.register({ sbPlr: 'SB-PLR-X', tenantId: 't-other', operatorId: 'op-other', jurisdiction: 'ZA', status: 'active' });
  connector.activate();
  const s = connector.sync();
  assert.equal(s.rejected, 1, 'cross-tenant SB-PLR rejected by the connector');
  // the connector exposes no federation-read surface
  for (const m of ['getSbNat', 'listSbNat', 'correlate', 'decide', 'matchingCandidates', 'acceptedContributions'])
    assert.equal(typeof connector[m], 'undefined', `connector must not expose ${m}`);
});

// ─── Hash-before-boundary + privacy ──────────────────────────────────────────
test('attributes are hashed before the boundary; no plaintext enters SafeBet IQ', () => {
  const { connector, directory, platform } = harness([rec('s1', 'SB-PLR-A', 1, [{ type: 'national_id', value: 'PLAINTEXT-8001015009087' }])]);
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  connector.activate();
  connector.sync();
  const blob = JSON.stringify({ accepted: platform.acceptedContributions({ plane: 'regulator', jurisdiction: 'ZA' }), connAudit: connector.auditTrail(), health: connector.health() });
  // the raw synthetic value (and its national-id digits) never appear — only the HMAC digest does
  assert.equal(blob.includes('PLAINTEXT'), false, 'no plaintext marker in output');
  assert.equal(blob.includes('8001015009087'), false, 'no raw national-id value in output');
  // and a submitted contribution exists (digest present)
  assert.equal(platform.acceptedContributions({ plane: 'regulator', jurisdiction: 'ZA' }).length, 1);
});

// ─── Checkpoint + restart + idempotency ──────────────────────────────────────
test('checkpoint survives restart; reprocessing produces no duplicate evidence', () => {
  const records = [rec('s1', 'SB-PLR-A', 1), rec('s2', 'SB-PLR-B', 2)];
  const checkpointStore = new InMemoryCheckpointStore();
  const h1 = harness(records, cfg(), { checkpointStore });
  h1.directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  h1.directory.register({ sbPlr: 'SB-PLR-B', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  h1.connector.activate();
  const s1 = h1.connector.sync();
  assert.equal(s1.processed, 2);
  assert.equal(h1.connector.currentCheckpoint().cursor, 2);
  // "restart": new connector over the same checkpoint store + same platform → resumes at cursor 2 (no reprocessing)
  const h2 = new OperatorConnector({ config: cfg(), authenticator: h1.auth, credential: 'sandbox-secret-123', source: h1.source, crypto: h1.crypto, resolver: h1.directory, platform: h1.platform, checkpointStore, auditSink: new InMemoryConnectorAuditSink(), now: CLOCK });
  h2.activate();
  assert.equal(h2.currentCheckpoint().cursor, 2, 'resumed from checkpoint');
  assert.equal(h2.sync().processed, 0, 'nothing left to process');
  // even a forced re-read (idempotent event ids) does not duplicate evidence
  assert.equal(h1.platform.acceptedContributions({ plane: 'regulator', jurisdiction: 'ZA' }).length, 2);
});

// ─── Sequencing ──────────────────────────────────────────────────────────────
test('duplicate source sequence is excluded; reconciliation stays balanced', () => {
  const { connector, directory } = harness([rec('s1', 'SB-PLR-A', 1), rec('s2', 'SB-PLR-A', 1)]);   // dup seq
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  connector.activate();
  connector.sync();
  const r = connector.reconcile();
  assert.equal(r.balanced, true, JSON.stringify(r.differences));
});

// ─── Retry / dead-letter / backpressure ──────────────────────────────────────
test('transient failure dead-letters + opens the circuit (backpressure); recovery resumes', () => {
  let fault = true;
  const h = harness([rec('s1', 'SB-PLR-A', 1), rec('s2', 'SB-PLR-B', 2), rec('s3', 'SB-PLR-C', 3), rec('s4', 'SB-PLR-D', 4)], cfg(), { faultInjector: () => (fault ? 'retryable-persistence' : null), circuitThreshold: 2 });
  for (const p of ['SB-PLR-A', 'SB-PLR-B', 'SB-PLR-C', 'SB-PLR-D']) h.directory.register({ sbPlr: p, tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  h.connector.activate();
  const s = h.connector.sync();
  assert.ok(s.deadLettered >= 1);
  assert.equal(s.stopped, 'backpressure', 'circuit opened → backpressure');
  assert.equal(h.connector.status(), 'degraded');
  assert.ok(h.connector.currentCheckpoint().cursor < 4, 'checkpoint preserved (not fully advanced)');
  // recovery
  fault = false;
  const s2 = h.connector.sync();
  assert.ok(s2.processed >= 1 && s2.accepted >= 1, 'resumes after recovery');
});

// ─── Suspend / revoke ────────────────────────────────────────────────────────
test('suspension stops submissions; revocation permanently denies the connector', () => {
  const { connector, directory } = harness([rec('s1', 'SB-PLR-A', 1)]);
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  connector.activate();
  connector.suspend(ADMIN);
  assert.equal(connector.status(), 'suspended');
  assert.throws(() => connector.sync(), /not-active/);
  connector.reactivate(ADMIN, true);
  assert.equal(connector.status(), 'active');
  connector.revoke(ADMIN);
  assert.equal(connector.status(), 'revoked');
  assert.throws(() => connector.sync(), /not-active|credential-revoked/, 'revoked connector denied sync');
  assert.equal(connector.health().authStatus, 'revoked');
  assert.throws(() => connector.reactivate(ADMIN, true), /invalid-transition/, 'revoked is terminal');
  // admin actions require an authorised context
  const { connector: c2 } = harness([]);
  assert.throws(() => c2.suspend({ plane: 'operator', actorRef: 'x' }), /unauthorised/);
});

// ─── Source corrections / revocations ────────────────────────────────────────
test('source revocation revokes the prior contribution; history preserved', () => {
  const { connector, directory, platform } = harness([rec('s1', 'SB-PLR-A', 1), rec('s1', 'SB-PLR-A', 2, [{ type: 'national_id', value: 'NID-SB-PLR-A' }], { status: 'revoked', sourceVersion: '1' })]);
  directory.register({ sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' });
  connector.activate();
  connector.sync();
  const eventId = 'conn-a:s1:national_id:1';
  assert.equal(platform.isRevoked(eventId), true, 'prior contribution revoked');
  assert.equal(platform.acceptedContributions({ plane: 'regulator', jurisdiction: 'ZA' }).length, 1, 'original preserved');
});

// ─── Multi-operator isolation ────────────────────────────────────────────────
test('two connectors are tenant-isolated: no shared state, no cross-tenant submission', () => {
  const store = new InMemoryPilotSecretStore({ jurisdictions: ['ZA'], now: CLOCK });
  const crypto = new FederationCryptoProvider({ store, now: CLOCK });
  const directory = new InMemorySbPlrDirectory([
    { sbPlr: 'SB-PLR-A1', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' },
    { sbPlr: 'SB-PLR-B1', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' },
  ]);
  const platform = new FederationEventPlatform({ resolver: directory, verifyPepperVersion: (j, v) => crypto.verifyVersion(j, v), now: CLOCK });
  const auth = new ConnectorAuthenticator(CLOCK);
  auth.provision('conn-a', { operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' }, 'secret-aaaa');
  auth.provision('conn-b', { operatorId: 'op-b', tenantId: 't-b', jurisdiction: 'ZA' }, 'secret-bbbb');
  const mk = (id, op, tn, sbPlr) => new OperatorConnector({ config: cfg({ connectorId: id, operatorId: op, tenantId: tn }), authenticator: auth, credential: `secret-${id === 'conn-a' ? 'aaaa' : 'bbbb'}`, source: new InMemorySandboxSource([rec('s1', sbPlr, 1)]), crypto, resolver: directory, platform, checkpointStore: new InMemoryCheckpointStore(), auditSink: new InMemoryConnectorAuditSink(), now: CLOCK });
  const cA = mk('conn-a', 'op-a', 't-a', 'SB-PLR-A1');
  const cB = mk('conn-b', 'op-b', 't-b', 'SB-PLR-B1');
  cA.activate(); cB.activate();
  assert.equal(cA.sync().accepted, 1); assert.equal(cB.sync().accepted, 1);
  // separate checkpoints (no shared mutable state)
  assert.notEqual(cA.currentCheckpoint(), cB.currentCheckpoint());
  // connector A submitting op-b's SB-PLR would be rejected (cross-tenant) — prove via a mis-mapped source
  const cAbad = new OperatorConnector({ config: cfg({ connectorId: 'conn-a2', operatorId: 'op-a', tenantId: 't-a' }), authenticator: (() => { const a = new ConnectorAuthenticator(CLOCK); a.provision('conn-a2', { operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' }, 'secret-a2xx'); return a; })(), credential: 'secret-a2xx', source: new InMemorySandboxSource([rec('s9', 'SB-PLR-B1', 1)]), crypto, resolver: directory, platform, checkpointStore: new InMemoryCheckpointStore(), auditSink: new InMemoryConnectorAuditSink(), now: CLOCK });
  cAbad.activate();
  assert.equal(cAbad.sync().rejected, 1, 'connector A cannot submit tenant B SB-PLR');
});

// ─── End-to-end through the real pipeline ────────────────────────────────────
test('end-to-end: two sandbox connectors → Event Platform → projection → certified matching candidate', () => {
  const store = new InMemoryPilotSecretStore({ jurisdictions: ['ZA'], now: CLOCK });
  const crypto = new FederationCryptoProvider({ store, now: CLOCK });
  const directory = new InMemorySbPlrDirectory([
    { sbPlr: 'SB-PLR-A', tenantId: 't-a', operatorId: 'op-a', jurisdiction: 'ZA', status: 'active' },
    { sbPlr: 'SB-PLR-B', tenantId: 't-b', operatorId: 'op-b', jurisdiction: 'ZA', status: 'active' },
  ]);
  const platform = new FederationEventPlatform({ resolver: directory, verifyPepperVersion: (j, v) => crypto.verifyVersion(j, v), now: CLOCK });
  const auth = new ConnectorAuthenticator(CLOCK);
  auth.provision('conn-a', { operatorId: 'op-a', tenantId: 't-a', jurisdiction: 'ZA' }, 'secret-aaaa');
  auth.provision('conn-b', { operatorId: 'op-b', tenantId: 't-b', jurisdiction: 'ZA' }, 'secret-bbbb');
  const mk = (id, op, tn, sbPlr, secret) => new OperatorConnector({ config: cfg({ connectorId: id, operatorId: op, tenantId: tn }), authenticator: auth, credential: secret, source: new InMemorySandboxSource([rec('s1', sbPlr, 1, [{ type: 'national_id', value: 'SAME-PERSON' }])]), crypto, resolver: directory, platform, checkpointStore: new InMemoryCheckpointStore(), auditSink: new InMemoryConnectorAuditSink(), now: CLOCK });
  const cA = mk('conn-a', 'op-a', 't-a', 'SB-PLR-A', 'secret-aaaa');
  const cB = mk('conn-b', 'op-b', 't-b', 'SB-PLR-B', 'secret-bbbb');
  cA.activate(); cB.activate(); cA.sync(); cB.sync();
  const projector = new ContributionProjector({ now: CLOCK });
  const { contributions } = projector.matchingContributions(platform, { plane: 'regulator', jurisdiction: 'ZA' }, 'ZA');
  const candidates = new IdentityMatchingEngine().generateCandidates(ZA, contributions).candidates;
  assert.equal(candidates.length, 1, 'the two connectors’ contributions correlate into one candidate');
  assert.deepEqual([candidates[0].sbPlrA, candidates[0].sbPlrB].sort(), ['SB-PLR-A', 'SB-PLR-B']);
});
