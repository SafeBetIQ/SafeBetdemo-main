// SafeBet Guardian — Payment Intelligence (ARCH-V4-C4). Provider-neutral, synthetic.
//   node --test tests/guardian/guardianPayment.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SYNTHETIC_REGISTRY, SYNTHETIC_PAYMENT_FIXTURES,
  analysePayment, normaliseMerchant, paymentSignals,
  GuardianPaymentWorker, PaymentPoisonMessageError, buildPaymentPersistencePlan, derivePaymentIds,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-06T00:00:00Z');
const analyse = (ref, obs = 'POBS-T') => analysePayment(SYNTHETIC_REGISTRY, SYNTHETIC_PAYMENT_FIXTURES[ref], { observationId: obs, now: NOW });

test('scenario 1/2/7: merchant→licensed operator + known domain+app → matched, low, governed links', () => {
  const r = analyse('MER-REF-0001');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-0001');
  assert.equal(r.licenceVerificationState, 'LICENSED');
  assert.equal(r.reviewPriority, 'LOW_REVIEW_PRIORITY');
  assert.equal(r.classification, 'REFERENCE_MATCHED');
  assert.equal(r.isIllegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
  const dom = r.referenceLinks.find((l) => l.linkType === 'DOMAIN');
  const app = r.referenceLinks.find((l) => l.linkType === 'APP');
  assert.equal(dom.referenceMatchState, 'REFERENCED'); // governed Domain Reference Contract
  assert.equal(app.referenceMatchState, 'REFERENCED'); // governed App Reference Contract
});

test('scenario 3: unknown merchant/gambling payment page → NO_MATCH, high review, NOT illegal/enforced', () => {
  const r = analyse('MER-REF-0004');
  assert.equal(r.registryMatchState, 'NO_MATCH');
  assert.equal(r.reviewRequired, true);
  assert.equal(r.reviewPriority, 'HIGH_REVIEW_PRIORITY');
  assert.ok(r.reasonCodes.includes('NO_AUTHORITATIVE_REGISTRY_MATCH'));
  assert.equal(r.isIllegalDetermination, false);
  assert.equal(r.isEnforcementAuthorised, false);
});

test('scenario 4: merchant/operator mismatch → reason codes → review', () => {
  const r = analyse('MER-REF-0005');
  assert.ok(r.reasonCodes.includes('MERCHANT_BRAND_MISMATCH'));
  assert.ok(r.reasonCodes.includes('MERCHANT_OPERATOR_MISMATCH'));
  assert.equal(r.reviewRequired, true);
});

test('scenario 5: stale licence → LICENCE_RECORD_STALE → review', () => {
  const r = analyse('MER-REF-0009');
  assert.ok(r.reasonCodes.includes('LICENCE_RECORD_STALE'));
  assert.equal(r.registryFreshness, 'STALE');
  assert.equal(r.reviewRequired, true);
});

test('scenario 6: source conflict → SOURCE_CONFLICT → review', () => {
  const r = analyse('MER-REF-0002');
  assert.ok(r.reasonCodes.includes('SOURCE_CONFLICT'));
  assert.equal(r.reviewRequired, true);
  assert.equal(r.isEnforcementAuthorised, false);
});

test('scenario 8: ZA-WC merchant analysed under its own jurisdiction only', () => {
  const fx = SYNTHETIC_PAYMENT_FIXTURES['MER-REF-0100'];
  assert.equal(fx.jurisdiction, 'ZA-WC');
  const r = analysePayment(SYNTHETIC_REGISTRY, fx, { observationId: 'POBS-WC', now: NOW });
  assert.equal(r.jurisdiction, 'ZA-WC');
  assert.equal(r.candidateOperatorId, 'OP-SYNTH-WC-0100');
});

test('scenario 9: duplicate observation → idempotent', () => {
  const w = new GuardianPaymentWorker();
  const msg = { product: 'GUARDIAN', schemaVersion: 'c4', eventType: 'guardian.payment.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), fixtureMerchantReference: 'MER-REF-0001' };
  const a = w.process(msg), b = w.process(msg);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});

test('scenario 10: poison/unknown fixture → PaymentPoisonMessageError (→ DLQ)', () => {
  const w = new GuardianPaymentWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c4', eventType: 'guardian.payment.observe', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), fixtureMerchantReference: 'REAL-MERCHANT' }), PaymentPoisonMessageError);
});

test('scenario 11: descriptor change (new key) → distinct observation (history preserved)', () => {
  const w = new GuardianPaymentWorker();
  const base = { product: 'GUARDIAN', schemaVersion: 'c4', eventType: 'guardian.payment.observe', jurisdiction: 'ZA-GP', correlationId: 'c', occurredAt: NOW.toISOString(), fixtureMerchantReference: 'MER-REF-0001' };
  const o1 = w.process({ ...base, idempotencyKey: 'p-1' }); const o2 = w.process({ ...base, idempotencyKey: 'p-2' });
  assert.notEqual(o1.result.observationId, o2.result.observationId); assert.equal(w.processedCount(), 2);
});

test('scenario 12: unknown provider reference → review, no enforcement', () => {
  const r = analyse('MER-REF-0012');
  assert.ok(r.reasonCodes.includes('UNKNOWN_PROVIDER_REFERENCE'));
  assert.equal(r.providerReferenceCategory, 'UNKNOWN');
  assert.equal(r.isEnforcementAuthorised, false);
});

test('invariant: no payment result asserts illegality OR enforcement', () => {
  for (const ref of Object.keys(SYNTHETIC_PAYMENT_FIXTURES)) {
    const r = analysePayment(SYNTHETIC_REGISTRY, SYNTHETIC_PAYMENT_FIXTURES[ref], { observationId: 'POBS-INV', now: NOW });
    assert.equal(r.isIllegalDetermination, false);
    assert.equal(r.isEnforcementAuthorised, false);
  }
});

test('privacy: fixtures + result carry no PAN/CVV/account fields', () => {
  for (const fx of Object.values(SYNTHETIC_PAYMENT_FIXTURES)) {
    const keys = Object.keys(fx).map((k) => k.toLowerCase()).join(',');
    assert.ok(!/pan|cvv|cardnumber|accountnumber|iban/.test(keys));
  }
});

test('persistence: deterministic idempotent plan + governed links + no illegality/enforcement', () => {
  const r = analyse('MER-REF-0001', 'POBS-P');
  const inp = { jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk-1', evidenceReference: 'e', contentHash: 'h', descriptor: 'D', providerReference: 'PSP-SYNTH-001', amountAggregate: 1, currency: 'ZAR', result: r };
  const a = buildPaymentPersistencePlan(inp); const b = buildPaymentPersistencePlan(inp);
  assert.deepEqual(a.rows.map((x) => x.id), b.rows.map((x) => x.id));
  assert.equal(derivePaymentIds('pk-1', r.merchantSubjectId, r.paymentSubjectId).observationId, 'POBS-pk-1');
  assert.ok(a.rows.some((x) => x.table === 'payment_entity_link'));
  const cmp = a.rows.find((x) => x.table === 'payment_registry_comparison');
  assert.equal(cmp.row.is_illegal_determination, false);
  assert.equal(cmp.row.is_enforcement_authorised, false);
});

test('signals + normalisation deterministic', () => {
  assert.equal(normaliseMerchant('MER-REF-0001','Safe Example!!').canonicalDescriptor, 'safe example');
  assert.ok(paymentSignals(SYNTHETIC_PAYMENT_FIXTURES['MER-REF-0001']).some((s) => s.signalType === 'PAYMENT_CHANNEL'));
});
