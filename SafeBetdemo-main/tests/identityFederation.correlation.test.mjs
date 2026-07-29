// Milestone 3.5 — Enterprise Correlation Layer (v2.0, ADR-006).
// Run: node --test tests/identityFederation.correlation.test.mjs
//
// Proves the regulator-plane, READ-ONLY national intelligence layer: National
// Player Twin, cross-operator timeline, cross-operator intelligence, national
// behaviour analytics, national self-exclusion view, investigation services,
// deny-by-default access + jurisdiction sovereignty, complete provenance,
// reproducibility, correlation integrity, no PII, and performance — while
// creating no identity, performing no matching/decision, and mutating nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SbNatRegistry, IdentityMatchingEngine, FederationDecisionEngine,
  getJurisdictionProfile, resolveFederationConfig, defaultFederationConfig,
  NationalIdentityFederationService, InMemoryAuditSink,
  EnterpriseCorrelationLayer, InMemoryCorrelationProvider, AccessDeniedError,
  CORRELATION_ENGINE_VERSION,
} from '../lib/identityFederation/index.ts';

const matcher = new IdentityMatchingEngine();
const decisionEngine = new FederationDecisionEngine(() => '2026-07-16T00:00:00.000Z');
const FIXED = () => '2026-07-16T00:00:00.000Z';
const REG = { plane: 'regulator', jurisdiction: 'ZA' };

const h = (attributeType, hash) => ({ attributeType, hash, pepperKeyVersion: 'v1' });
const contrib = (casinoId, sbPlr, attributes, jurisdiction = 'ZA') =>
  ({ jurisdiction, casinoId, sbPlr, attributes, contributedAt: '2026-07-16T00:00:00Z' });
function orderedClock(startMs = 1_700_000_000_000) { let t = 0; return () => new Date(startMs + (t++) * 1000).toISOString(); }

// Approved decision linking p1@opA and p2@opB (auto-approved via strong id).
function approved(p1, opA, p2, opB, nid = 'N1', jur = 'ZA', attr = 'national_id') {
  const profile = getJurisdictionProfile(jur);
  const cands = matcher.generateCandidates(profile, [
    contrib(opA, p1, [h(attr, nid)], jur),
    contrib(opB, p2, [h(attr, nid)], jur),
  ]).candidates;
  return decisionEngine.decide(profile, cands[0]).decision;
}

// A two-operator ZA scenario with references across every domain.
function scenario(extra = {}) {
  const registry = new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });
  const rec = registry.create(approved('SB-PLR-A', 'op-A', 'SB-PLR-B', 'op-B'));
  const provider = new InMemoryCorrelationProvider({
    operators: [
      { operatorId: 'op-A', jurisdiction: 'ZA' }, { operatorId: 'op-B', jurisdiction: 'ZA' },
      { operatorId: 'op-KE', jurisdiction: 'KE' },
      ...(extra.operators ?? []),
    ],
    players: [
      { sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-03-01T00:00:00Z' },
      { sbPlr: 'SB-PLR-B', operatorId: 'op-B', jurisdiction: 'ZA', firstObservedAt: '2026-02-01T00:00:00Z', lastObservedAt: '2026-04-01T00:00:00Z' },
      ...(extra.players ?? []),
    ],
    events: [
      { eventId: 'e1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'session', at: '2026-01-05T10:00:00Z' },
      { eventId: 'e2', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'deposit', at: '2026-01-05T11:00:00Z', magnitudeBand: 'medium' },
      { eventId: 'e3', sbPlr: 'SB-PLR-B', operatorId: 'op-B', category: 'wager', at: '2026-02-10T09:00:00Z' },
      { eventId: 'e4', sbPlr: 'SB-PLR-B', operatorId: 'op-B', category: 'loss', at: '2026-02-10T09:30:00Z', magnitudeBand: 'high' },
      // out-of-jurisdiction reference — must be excluded (sovereign separation)
      { eventId: 'e-ke', sbPlr: 'SB-PLR-A', operatorId: 'op-KE', category: 'session', at: '2026-01-06T10:00:00Z' },
      ...(extra.events ?? []),
    ],
    risks: [
      { riskId: 'r1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', at: '2026-01-05T12:00:00Z', tier: 'low' },
      { riskId: 'r2', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-10T10:00:00Z', tier: 'high' },
      ...(extra.risks ?? []),
    ],
    interventions: [
      { interventionId: 'i1', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-11T00:00:00Z', type: 'reality-check', outcome: 'acknowledged' },
      ...(extra.interventions ?? []),
    ],
    selfExclusions: [
      { exclusionId: 'x1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', kind: 'self-exclusion', startAt: '2026-01-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z', status: 'active' },
      ...(extra.selfExclusions ?? []),
    ],
    compliance: [{ recordId: 'c1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', at: '2026-01-02T00:00:00Z', type: 'kyc', status: 'verified' }],
    investigations: [{ investigationId: 'v1', sbPlr: 'SB-PLR-B', operatorId: 'op-B', at: '2026-02-12T00:00:00Z', ref: 'INV-9' }],
    twins: [{ twinId: 't1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', at: '2026-03-01T00:00:00Z', riskTier: 'low', wellbeingRef: 'wb-A' }],
  });
  const layer = new EnterpriseCorrelationLayer({ registry, provider, now: FIXED });
  return { registry, provider, layer, rec, sbNat: rec.sbNat };
}

// ─── Architecture boundaries (read-only; no identity/matching/decision) ──────

test('the correlation layer creates no identity and mutates nothing', () => {
  const { registry, layer, sbNat } = scenario();
  const before = JSON.stringify(registry.diagnostics());
  const membersBefore = registry.get(sbNat).members.slice();
  layer.getNationalPlayerTwin(REG, sbNat);
  layer.getCrossOperatorTimeline(REG, sbNat);
  layer.getCrossOperatorIntelligence(REG, sbNat);
  layer.getNationalSelfExclusionView(REG, sbNat);
  assert.equal(JSON.stringify(registry.diagnostics()), before, 'registry state unchanged (read-only)');
  assert.deepEqual(registry.get(sbNat).members, membersBefore, 'SB-PLR membership unchanged');
  // the layer exposes no matching / decision / mint surface
  for (const m of ['create', 'mint', 'generateCandidates', 'decide', 'split', 'merge'])
    assert.equal(typeof layer[m], 'undefined', `layer must not expose ${m}()`);
});

// ─── National Player Twin ────────────────────────────────────────────────────

test('National Player Twin assembles a multi-operator view with full provenance', () => {
  const { layer, sbNat } = scenario();
  const twin = layer.getNationalPlayerTwin(REG, sbNat);
  assert.deepEqual(twin.participatingOperators, ['op-A', 'op-B']);
  assert.deepEqual(twin.sbPlrRefs, ['SB-PLR-A', 'SB-PLR-B']);
  assert.equal(twin.activityTimeline.length, 4, 'the KE event is excluded (sovereign separation)');
  assert.equal(twin.riskEvolution.length, 2);
  assert.equal(twin.interventionHistory.length, 1);
  assert.equal(twin.selfExclusionHistory.length, 1);
  assert.equal(twin.complianceHistory.length, 1);
  assert.deepEqual(twin.investigationRefs, ['INV-9']);
  assert.equal(twin.wellbeingSummary.currentRiskTier, 'high');
  assert.equal(twin.wellbeingSummary.riskEscalating, true);
  assert.equal(twin.dataFreshness, '2026-03-01T00:00:00Z');
  // provenance chain present
  const p = twin.provenance;
  assert.ok(p.federationDecisionRefs.length >= 1 && p.matchingCandidateRefs.length >= 1);
  assert.deepEqual(p.sbPlrRefs, ['SB-PLR-A', 'SB-PLR-B']);
  assert.deepEqual(p.sourceOperators, ['op-A', 'op-B']);
  assert.ok(p.excludedSources.some((e) => e.ref === 'event:e-ke'), 'out-of-jurisdiction source is recorded as excluded');
  assert.equal(p.correlationEngineVersion, CORRELATION_ENGINE_VERSION);
  // immutable
  assert.throws(() => { twin.participatingOperators.push('x'); }, TypeError);
});

test('National Player Twin single-operator view + missing source handling', () => {
  const registry = new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });
  const rec = registry.create(approved('SB-PLR-A', 'op-A', 'SB-PLR-B', 'op-B'));
  const provider = new InMemoryCorrelationProvider({
    operators: [{ operatorId: 'op-A', jurisdiction: 'ZA' }],
    players: [{ sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-02-01T00:00:00Z' }],
    events: [{ eventId: 'e1', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'session', at: '2026-01-05T10:00:00Z' }],
  });
  const layer = new EnterpriseCorrelationLayer({ registry, provider, now: FIXED });
  const twin = layer.getNationalPlayerTwin(REG, rec.sbNat);
  assert.deepEqual(twin.participatingOperators, ['op-A']);
  assert.ok(twin.provenance.limitations.some((l) => /unavailable at correlation time/.test(l)));
});

test('National Player Twin is deterministically reproducible from source references', () => {
  const { layer, sbNat } = scenario();
  assert.equal(JSON.stringify(layer.getNationalPlayerTwin(REG, sbNat)), JSON.stringify(layer.getNationalPlayerTwin(REG, sbNat)));
});

// ─── Cross-operator timeline (deterministic ordering) ────────────────────────

test('cross-operator timeline is chronologically ordered across operators', () => {
  const { layer, sbNat } = scenario();
  const tl = layer.getCrossOperatorTimeline(REG, sbNat);
  const ats = tl.entries.map((e) => e.at);
  assert.deepEqual(ats, [...ats].sort());
  assert.ok(new Set(tl.entries.map((e) => e.operatorId)).size >= 2);
  assert.equal(tl.entries.find((e) => e.sourceRef === 'event:e-ke'), undefined, 'excluded source not in timeline');
});

test('same-timestamp entries use a deterministic secondary ordering (operator, then category)', () => {
  const { layer, sbNat } = scenario({
    events: [
      { eventId: 'z1', sbPlr: 'SB-PLR-B', operatorId: 'op-B', category: 'wager', at: '2026-05-01T00:00:00Z' },
      { eventId: 'z2', sbPlr: 'SB-PLR-A', operatorId: 'op-A', category: 'session', at: '2026-05-01T00:00:00Z' },
    ],
  });
  const tl = layer.getCrossOperatorTimeline(REG, sbNat);
  const tie = tl.entries.filter((e) => e.at === '2026-05-01T00:00:00Z');
  assert.deepEqual(tie.map((e) => e.operatorId), ['op-A', 'op-B'], 'operator is the deterministic tiebreak');
});

// ─── Cross-operator intelligence + national behaviour analytics ──────────────

test('cross-operator intelligence is explainable and deterministic', () => {
  const { layer, sbNat } = scenario();
  const intel = layer.getCrossOperatorIntelligence(REG, sbNat);
  assert.equal(intel.participatingOperatorCount, 2);
  assert.equal(intel.activityFrequency, 4);
  assert.equal(intel.riskEscalating, true);
  assert.equal(intel.repeatedHarmIndicators, 1);           // one loss event
  assert.ok(intel.selfExclusionConflicts.length >= 1, 'activity during an active self-exclusion is flagged');
  assert.equal(intel.behaviourEscalation, true);
  // every metric is fully explained (no hidden scoring)
  for (const m of intel.metrics) {
    assert.ok(m.name && m.definition && m.method && m.version && m.timestamp);
  }
});

test('national behaviour analytics: every metric states definition + method + limitations', () => {
  const { layer, sbNat } = scenario();
  const metrics = layer.getNationalBehaviourAnalytics(REG, sbNat);
  assert.ok(metrics.length >= 5);
  const names = metrics.map((m) => m.name);
  assert.ok(names.includes('participating_operators') && names.includes('risk_escalation'));
  for (const m of metrics) assert.ok(m.definition.length > 0 && m.method.length > 0 && Array.isArray(m.limitations));
});

// ─── National self-exclusion view ────────────────────────────────────────────

test('national self-exclusion view aggregates exclusions, cooling-off, and conflicts (no enforcement)', () => {
  const { layer, sbNat } = scenario({
    selfExclusions: [
      { exclusionId: 'x2', sbPlr: 'SB-PLR-B', operatorId: 'op-B', jurisdiction: 'ZA', kind: 'cooling-off', startAt: '2026-02-01T00:00:00Z', endAt: '2026-02-15T00:00:00Z', status: 'active' },
      { exclusionId: 'x3', sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', kind: 'self-exclusion', startAt: '2025-01-01T00:00:00Z', endAt: '2025-06-01T00:00:00Z', status: 'expired' },
    ],
  });
  const view = layer.getNationalSelfExclusionView(REG, sbNat);
  assert.equal(view.activeExclusions.length, 1);           // x1
  assert.equal(view.historicalExclusions.length, 1);       // x3 expired
  assert.equal(view.coolingOffPeriods.length, 1);          // x2
  assert.ok(view.conflictingActivity.length >= 1);
  assert.ok(view.provenance.limitations.some((l) => /does not enforce or propagate/.test(l)));
});

// ─── Investigation services ──────────────────────────────────────────────────

test('investigation view is derived, explainable, and read-only', () => {
  const { registry, layer, sbNat } = scenario();
  const before = JSON.stringify(registry.diagnostics());
  const view = layer.createInvestigationView(REG, sbNat, 'CASE-42', ['manual observation A']);
  assert.equal(view.investigationRef, 'CASE-42');
  assert.deepEqual(view.linkedSbPlr, ['SB-PLR-A', 'SB-PLR-B']);
  assert.deepEqual(view.linkedOperators, ['op-A', 'op-B']);
  assert.ok(view.timeline.length >= 1 && view.summary.length > 0);
  assert.ok(view.findings.some((f) => /INV-9/.test(f.note)));
  assert.deepEqual(view.observations, ['manual observation A']);
  assert.equal(JSON.stringify(registry.diagnostics()), before, 'no operator/registry mutation');
});

// ─── Security: deny-by-default access + jurisdiction sovereignty ─────────────

test('access control: only a sovereign-authorised regulator may query', () => {
  const { layer, sbNat } = scenario();
  assert.doesNotThrow(() => layer.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'ZA' }, sbNat));
  assert.throws(() => layer.getNationalPlayerTwin({ plane: 'operator', jurisdiction: 'ZA' }, sbNat), AccessDeniedError);
  assert.throws(() => layer.getNationalPlayerTwin({ plane: 'casino-admin', jurisdiction: 'ZA' }, sbNat), AccessDeniedError);
  assert.throws(() => layer.getNationalPlayerTwin({ plane: 'unauthenticated', jurisdiction: null }, sbNat), AccessDeniedError);
  assert.throws(() => layer.getNationalPlayerTwin(undefined, sbNat), AccessDeniedError);
  // wrong jurisdiction regulator denied
  assert.throws(() => layer.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'NA' }, sbNat), AccessDeniedError);
  // cross-jurisdiction regulator denied unless explicitly sovereign-authorised
  assert.throws(() => layer.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'NA', sovereignJurisdictions: ['NA'] }, sbNat), AccessDeniedError);
  assert.doesNotThrow(() => layer.getNationalPlayerTwin({ plane: 'regulator', jurisdiction: 'NA', sovereignJurisdictions: ['NA', 'ZA'] }, sbNat));
});

test('no plaintext PII appears in serialised correlation output', () => {
  const { layer, sbNat } = scenario();
  for (const out of [
    layer.getNationalPlayerTwin(REG, sbNat),
    layer.getCrossOperatorTimeline(REG, sbNat),
    layer.getCrossOperatorIntelligence(REG, sbNat),
    layer.createInvestigationView(REG, sbNat, 'CASE-1'),
  ]) {
    const blob = JSON.stringify(out);
    assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false, 'no email-like PII');
    assert.equal(/\d{7,}/.test(blob), false, 'no long digit runs (phone/id-like)');
  }
});

// ─── Correlation integrity ───────────────────────────────────────────────────

test('correlation integrity passes on a valid correlation and is reproducible', () => {
  const { layer, sbNat } = scenario();
  const report = layer.verifyCorrelationIntegrity(REG, sbNat, { asOf: '2026-07-16T00:00:00.000Z' });
  assert.equal(report.ok, true, JSON.stringify(report.checks.filter((c) => !c.passed)));
  assert.equal(report.reproducible, true);
  for (const c of report.checks) assert.equal(c.passed, true, `${c.name}: ${c.detail}`);
});

test('correlation integrity fails when a referenced SB-PLR record is missing', () => {
  const registry = new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });
  const rec = registry.create(approved('SB-PLR-A', 'op-A', 'SB-PLR-B', 'op-B'));
  const provider = new InMemoryCorrelationProvider({
    operators: [{ operatorId: 'op-A', jurisdiction: 'ZA' }],
    players: [{ sbPlr: 'SB-PLR-A', operatorId: 'op-A', jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-02-01T00:00:00Z' }],
    // SB-PLR-B has no player reference → referential gap
  });
  const layer = new EnterpriseCorrelationLayer({ registry, provider, now: FIXED });
  const report = layer.verifyCorrelationIntegrity(REG, rec.sbNat);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((c) => c.name === 'referenced-sbplr-exist').passed, false);
});

test('correlation integrity flags stale sources against a caller-supplied freshness horizon', () => {
  const { layer, sbNat } = scenario();
  const report = layer.verifyCorrelationIntegrity(REG, sbNat, { asOf: '2026-07-16T00:00:00.000Z', freshnessHorizonMs: 24 * 60 * 60 * 1000 });
  const fresh = report.checks.find((c) => c.name === 'within-freshness-horizon');
  assert.ok(fresh && fresh.passed === false, 'sources older than the 1-day horizon are flagged');
});

// ─── Service integration + enablement gate ───────────────────────────────────

test('service.correlationLayer is enablement-gated and denies a disabled jurisdiction', () => {
  const { provider, registry } = scenario();
  const off = new NationalIdentityFederationService({ config: defaultFederationConfig(), auditSink: new InMemoryAuditSink(), registry });
  const offLayer = off.correlationLayer(provider, FIXED);
  assert.throws(() => offLayer.getNationalPlayerTwin(REG, registry.list()[0].sbNat), AccessDeniedError);

  const cfg = resolveFederationConfig({ SAFEBET_FEDERATION_ENABLED: 'true', SAFEBET_FEDERATION_JURISDICTIONS: 'ZA' });
  const on = new NationalIdentityFederationService({ config: cfg, auditSink: new InMemoryAuditSink(), registry });
  const onLayer = on.correlationLayer(provider, FIXED);
  assert.doesNotThrow(() => onLayer.getNationalPlayerTwin(REG, registry.list()[0].sbNat));
  assert.throws(() => on.executeNationalPolicy());   // Milestone 3.6 boundary
});

// ─── Performance sanity (deterministic, large dataset) ───────────────────────

test('performance: 5-operator cluster with 2000 event references correlates fast + deterministically', () => {
  const registry = new SbNatRegistry({ now: orderedClock(), auditSink: new InMemoryAuditSink() });
  const members = ['SB-PLR-1', 'SB-PLR-2', 'SB-PLR-3', 'SB-PLR-4', 'SB-PLR-5'];
  const ops = ['op1', 'op2', 'op3', 'op4', 'op5'];
  // link the five into one cluster via four approved decisions
  registry.create(approved('SB-PLR-1', 'op1', 'SB-PLR-2', 'op2', 'N1'));
  registry.create(approved('SB-PLR-2', 'op2', 'SB-PLR-3', 'op3', 'N2'));
  registry.create(approved('SB-PLR-3', 'op3', 'SB-PLR-4', 'op4', 'N3'));
  registry.create(approved('SB-PLR-4', 'op4', 'SB-PLR-5', 'op5', 'N4'));
  const sbNat = registry.list()[0].sbNat;
  const players = members.map((m, i) => ({ sbPlr: m, operatorId: ops[i], jurisdiction: 'ZA', firstObservedAt: '2026-01-01T00:00:00Z', lastObservedAt: '2026-12-01T00:00:00Z' }));
  const events = [];
  for (let i = 0; i < 2000; i++) {
    const idx = i % 5;
    events.push({ eventId: `ev-${i}`, sbPlr: members[idx], operatorId: ops[idx], category: 'session', at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() });
  }
  const provider = new InMemoryCorrelationProvider({ operators: ops.map((o) => ({ operatorId: o, jurisdiction: 'ZA' })), players, events });
  const layer = new EnterpriseCorrelationLayer({ registry, provider, now: FIXED });
  const t0 = Date.now();
  const tl = layer.getCrossOperatorTimeline(REG, sbNat);
  const ms = Date.now() - t0;
  assert.equal(tl.entries.length, 2000);
  assert.ok(ms < 2000, `correlation should be fast (was ${ms}ms)`);
  assert.equal(JSON.stringify(layer.getCrossOperatorTimeline(REG, sbNat)), JSON.stringify(tl), 'deterministic repeated execution');
});
