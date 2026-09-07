// SafeBet Guardian — Geo & Jurisdiction Intelligence (ARCH-V4-C5). Synthetic; privacy-preserving.
//   node --test tests/guardian/guardianGeo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_REGISTRY, SYNTHETIC_GEO_FIXTURES,
  analyseGeo, normaliseGeo, geoSignals,
  GuardianGeoWorker, GeoPoisonMessageError, GeoPersonDataRejectedError, assertNoPersonData,
  buildGeoPersistencePlan, deriveGeoIds, PROHIBITED_PERSON_FIELDS,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-06T00:00:00Z');
const analyse = (ref, obs = 'GOBS-T') => analyseGeo(SYNTHETIC_REGISTRY, SYNTHETIC_GEO_FIXTURES[ref], { observationId: obs, now: NOW });

test('scenario 1/6/7/8: licensed service in matching jurisdiction → matched, low, governed domain+app+payment links', () => {
  const r = analyse('licensed-example-003.test');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.resolutionState, 'MATCHED_AUTHORITATIVE');
  assert.equal(r.reviewPriority, 'LOW_REVIEW_PRIORITY');
  assert.equal(r.classification, 'REGION_REFERENCE_MATCHED');
  assert.equal(r.expectedRegulatoryJurisdiction, 'ZA-GP');
  assert.equal(r.isIllegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
  assert.equal(r.referenceLinks.find((l) => l.linkType === 'DOMAIN').referenceMatchState, 'REFERENCED');   // C2 contract
  assert.equal(r.referenceLinks.find((l) => l.linkType === 'APP').referenceMatchState, 'REFERENCED');       // C3 contract
  assert.equal(r.referenceLinks.find((l) => l.linkType === 'PAYMENT').referenceMatchState, 'REFERENCED');   // C4 contract
});

test('scenario 2: service licensed ZA-GP but declares ZA-WC → jurisdiction mismatch → review, NOT illegal', () => {
  const r = analyse('mismatch-region-005.test');
  assert.ok(r.reasonCodes.includes('LICENCE_JURISDICTION_MISMATCH'));
  assert.ok(r.reasonCodes.includes('DECLARED_REGION_MISMATCH'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
});

test('scenario 3: unknown synthetic service → NO_MATCH → high review → non-legal', () => {
  const r = analyse('unknown-region-004.test');
  assert.equal(r.registryMatchState, 'NO_MATCH');
  assert.ok(r.reasonCodes.includes('NO_AUTHORITATIVE_REGISTRY_MATCH'));
  assert.ok(r.reasonCodes.includes('UNKNOWN_REGION_REFERENCE'));
  assert.equal(r.reviewPriority, 'HIGH_REVIEW_PRIORITY');
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 4: stale licence → REGISTRY_REFERENCE_STALE → review', () => {
  const r = analyse('lapsed-region-009.test');
  assert.ok(r.reasonCodes.includes('REGISTRY_REFERENCE_STALE'));
  assert.equal(r.registryFreshness, 'STALE');
  assert.equal(r.reviewRequired, true);
});

test('scenario 5: conflicting registry source → SOURCE_CONFLICT → review', () => {
  const r = analyse('conflict-region-002.test');
  assert.ok(r.reasonCodes.includes('SOURCE_CONFLICT'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isEnforcementAuthorised, false);
});

test('scenario 9: wrong-jurisdiction geo → worker denies', () => {
  const w = new GuardianGeoWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c5', eventType: 'guardian.geo.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureGeoReference: 'western-region-100.test' }), GeoPoisonMessageError);
});

test('scenario 10: duplicate observation → idempotent', () => {
  const w = new GuardianGeoWorker();
  const msg = { product: 'GUARDIAN', schemaVersion: 'c5', eventType: 'guardian.geo.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'g1', occurredAt: NOW.toISOString(), fixtureGeoReference: 'licensed-example-003.test' };
  const a = w.process(msg), b = w.process(msg);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});

test('scenario 11: poison/unknown fixture → GeoPoisonMessageError (→ DLQ)', () => {
  const w = new GuardianGeoWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c5', eventType: 'guardian.geo.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureGeoReference: 'REAL-SERVICE' }), GeoPoisonMessageError);
});

test('scenario 12: regional availability changed → REGIONAL_AVAILABILITY_CHANGED → append history preserved', () => {
  const r = analyse('changed-region-012.test');
  assert.equal(r.observedAvailabilityState, 'INCONSISTENT');
  assert.ok(r.reasonCodes.includes('REGIONAL_AVAILABILITY_CHANGED'));
  const plan = buildGeoPersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'ch-1', evidenceReference: 'e', contentHash: 'h', result: r });
  assert.ok(plan.rows.some((x) => x.table === 'geo_change_history'));  // history appended, prior preserved
});

test('scenario 13: synthetic AGGREGATE regional visibility signal → accepted (low review)', () => {
  const r = analyse('aggregate-region-013.test');
  assert.equal(r.reviewRequired, false);
  assert.equal(r.classification, 'REGION_REFERENCE_MATCHED');
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 14: person-level location payload → schema/validation rejection (→ DLQ)', () => {
  const w = new GuardianGeoWorker();
  const base = { product: 'GUARDIAN', schemaVersion: 'c5', eventType: 'guardian.geo.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'p', occurredAt: NOW.toISOString(), fixtureGeoReference: 'licensed-example-003.test' };
  assert.throws(() => w.process({ ...base, player_id: 'P-123' }), GeoPersonDataRejectedError);
  assert.throws(() => w.process({ ...base, ip_address: '10.0.0.1' }), GeoPersonDataRejectedError);
  assert.throws(() => w.process({ ...base, precise_location: '-26.2,28.0' }), GeoPersonDataRejectedError);
  assert.throws(() => assertNoPersonData({ subscriber_id: 'S-1' }), GeoPersonDataRejectedError);
});

test('invariant: no geo result asserts illegality OR enforcement', () => {
  for (const ref of Object.keys(SYNTHETIC_GEO_FIXTURES)) {
    const r = analyseGeo(SYNTHETIC_REGISTRY, SYNTHETIC_GEO_FIXTURES[ref], { observationId: 'GOBS-INV', now: NOW });
    assert.equal(r.isIllegalDetermination, false);
    assert.equal(r.isEnforcementAuthorised, false);
    assert.notEqual(r.observedAvailabilityState, 'ILLEGAL_IN_REGION');
  }
});

test('privacy: no fixture carries a person-level field; prohibited list is enforced', () => {
  for (const fx of Object.values(SYNTHETIC_GEO_FIXTURES)) {
    const keys = Object.keys(fx).map((k) => k.toLowerCase());
    for (const f of PROHIBITED_PERSON_FIELDS) assert.ok(!keys.includes(f.toLowerCase()), `fixture must not carry ${f}`);
  }
  assert.ok(PROHIBITED_PERSON_FIELDS.includes('player_id'));
  assert.ok(PROHIBITED_PERSON_FIELDS.includes('browsing_history'));
});

test('persistence: deterministic idempotent plan + governed links + no illegality/enforcement', () => {
  const r = analyse('licensed-example-003.test', 'GOBS-P');
  const inp = { jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'gk-1', evidenceReference: 'e', contentHash: 'h', result: r };
  const a = buildGeoPersistencePlan(inp); const b = buildGeoPersistencePlan(inp);
  assert.deepEqual(a.rows.map((x) => x.id), b.rows.map((x) => x.id));
  assert.equal(deriveGeoIds('gk-1', r.geoSubjectId).observationId, 'GOBS-gk-1');
  assert.ok(a.rows.some((x) => x.table === 'geo_entity_link'));
  const cmp = a.rows.find((x) => x.table === 'geo_registry_comparison');
  assert.equal(cmp.row.is_illegal_determination, false);
  assert.equal(cmp.row.is_enforcement_authorised, false);
});

test('signals + normalisation deterministic (region/service level only)', () => {
  assert.equal(normaliseGeo('Licensed-Example-003.test', 'za-gp').canonicalReference, 'licensed-example-003.test');
  assert.equal(normaliseGeo('x', 'za-gp').canonicalRegionCode, 'ZA-GP');
  assert.ok(geoSignals(SYNTHETIC_GEO_FIXTURES['aggregate-region-013.test']).some((s) => s.signalType === 'AGGREGATE_REGION_VISIBILITY_METRIC'));
});
