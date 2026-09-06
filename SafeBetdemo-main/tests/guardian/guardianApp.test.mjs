// SafeBet Guardian — Mobile App Intelligence (ARCH-V4-C3). Provider-neutral, synthetic.
//   node --test tests/guardian/guardianApp.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_REGISTRY, SYNTHETIC_APP_FIXTURES, SYNTHETIC_DOMAIN_FIXTURES,
  analyseApp, normaliseAppIdentifier, appContentSignals, resolveAppDomainLinks,
  GuardianAppWorker, AppPoisonMessageError, buildAppPersistencePlan, deriveAppIds,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-06T00:00:00Z');
const analyse = (id, obs = 'AOBS-T') => analyseApp(SYNTHETIC_REGISTRY, SYNTHETIC_APP_FIXTURES[id], { observationId: obs, now: NOW });

test('scenario 1/2/11: licensed app + licence + declares known C2 domain → matched, low priority, domain-linked', () => {
  const r = analyse('com.safebet.synthetic.bet003');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.licenceVerificationState, 'LICENSED');
  assert.equal(r.reviewPriority, 'LOW_REVIEW_PRIORITY');
  assert.equal(r.classification, 'REFERENCE_MATCHED');
  assert.equal(r.isIllegalDetermination, false);
  const declared = r.domainReferences.find((d) => d.linkType === 'APP_DECLARED_WEBSITE');
  assert.equal(declared.matchedDomainId, 'DOM-licensed-example-003.test'); // governed app→domain link to known C2 domain
});

test('scenario 3: unknown gambling app, no registry ref → NO_MATCH, high priority, NOT illegal', () => {
  const r = analyse('app.synthetic.unknown004');
  assert.equal(r.registryMatchState, 'NO_MATCH');
  assert.equal(r.reviewRequired, true);
  assert.equal(r.reviewPriority, 'HIGH_REVIEW_PRIORITY');
  assert.ok(r.reasonCodes.includes('NO_AUTHORITATIVE_REGISTRY_MATCH'));
  assert.ok(r.reasonCodes.includes('GAMBLING_CONTENT_SIGNAL'));
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 4: app claims wrong licence/operator → mismatch reasons → review', () => {
  const r = analyse('app.synthetic.mismatch005');
  assert.ok(r.reasonCodes.includes('DECLARED_BRAND_MISMATCH'));
  assert.ok(r.reasonCodes.includes('DECLARED_LICENCE_MISMATCH'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 5: stale licence → LICENCE_RECORD_STALE → review', () => {
  const r = analyse('app.synthetic.stale009');
  assert.ok(r.reasonCodes.includes('LICENCE_RECORD_STALE'));
  assert.equal(r.registryFreshness, 'STALE');
  assert.equal(r.reviewRequired, true);
});

test('scenario 6: source conflict → SOURCE_CONFLICT → review', () => {
  const r = analyse('app.synthetic.conflict002');
  assert.ok(r.reasonCodes.includes('SOURCE_CONFLICT'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isIllegalDetermination, false);
});

test('scenario 7: ZA-WC app analysed under its own jurisdiction only', () => {
  const fx = SYNTHETIC_APP_FIXTURES['za.synthetic.western100'];
  assert.equal(fx.jurisdiction, 'ZA-WC');
  const r = analyseApp(SYNTHETIC_REGISTRY, fx, { observationId: 'AOBS-WC', now: NOW });
  assert.equal(r.jurisdiction, 'ZA-WC');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-WC-0100');
});

test('scenario 8: duplicate app observation → idempotent (no duplicate)', () => {
  const w = new GuardianAppWorker();
  const msg = { product: 'GUARDIAN', schemaVersion: 'c3', eventType: 'guardian.app.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), fixtureAppIdentifier: 'com.safebet.synthetic.bet003' };
  const a = w.process(msg), b = w.process(msg);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});

test('scenario 9: poison/unknown app fixture → AppPoisonMessageError (→ DLQ)', () => {
  const w = new GuardianAppWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c3', eventType: 'guardian.app.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureAppIdentifier: 'com.real.app' }), AppPoisonMessageError);
});

test('scenario 10: different key/hash → distinct observation (history preserved)', () => {
  const w = new GuardianAppWorker();
  const base = { product: 'GUARDIAN', schemaVersion: 'c3', eventType: 'guardian.app.observe', jurisdiction: 'ZA-GP', correlationId: 'c', occurredAt: NOW.toISOString(), fixtureAppIdentifier: 'com.safebet.synthetic.bet003' };
  const o1 = w.process({ ...base, idempotencyKey: 'a-1' }); const o2 = w.process({ ...base, idempotencyKey: 'a-2' });
  assert.notEqual(o1.result.observationId, o2.result.observationId); assert.equal(w.processedCount(), 2);
});

test('scenario 11: app declares KNOWN domain → governed app-domain link', () => {
  const links = resolveAppDomainLinks(SYNTHETIC_APP_FIXTURES['com.safebet.synthetic.bet003']);
  const declared = links.find((l) => l.linkType === 'APP_DECLARED_WEBSITE');
  assert.equal(declared.matchedDomainId, 'DOM-licensed-example-003.test');
});

test('scenario 12: app declares UNKNOWN domain → reference recorded, no match, no illegality', () => {
  const r = analyse('app.synthetic.unknowndomain012');
  const declared = r.domainReferences.find((l) => l.linkType === 'APP_DECLARED_WEBSITE');
  assert.equal(declared.declaredDomain, 'never-seen-999.test');
  assert.equal(declared.matchedDomainId, null);
  assert.equal(r.isIllegalDetermination, false);
});

test('invariant: no app result ever asserts illegality', () => {
  for (const id of Object.keys(SYNTHETIC_APP_FIXTURES)) {
    const r = analyseApp(SYNTHETIC_REGISTRY, SYNTHETIC_APP_FIXTURES[id], { observationId: 'AOBS-INV', now: NOW });
    assert.equal(r.isIllegalDetermination, false);
    assert.notEqual(r.classification, 'ILLEGAL');
  }
});

test('normalisation: provider-neutral app id canonicalisation', () => {
  assert.equal(normaliseAppIdentifier('APP://Com.Example.Bet/path').canonical, 'com.example.bet');
});

test('persistence: deterministic idempotent plan + governed domain-link rows + no illegality', () => {
  const r = analyse('com.safebet.synthetic.bet003', 'AOBS-P');
  const inp = { jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'ak-1', evidenceReference: 'e', contentHash: 'h', metadataHash: 'm', version: '1.0', publisher: 'pub', title: 'App', result: r };
  const a = buildAppPersistencePlan(inp); const b = buildAppPersistencePlan(inp);
  assert.deepEqual(a.rows.map((x) => x.id), b.rows.map((x) => x.id));
  assert.equal(deriveAppIds('ak-1', r.canonicalAppIdentifier).observationId, 'AOBS-ak-1');
  assert.ok(a.rows.some((x) => x.table === 'mobile_app_domain_link'));
  const cmp = a.rows.find((x) => x.table === 'mobile_app_registry_comparison');
  assert.equal(cmp.row.is_illegal_determination, false);
});

test('boundary: app worker rejects non-fixture identifier (no real platform access)', () => {
  const w = new GuardianAppWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c3', eventType: 'guardian.app.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureAppIdentifier: 'https://real.store/app' }), AppPoisonMessageError);
});
