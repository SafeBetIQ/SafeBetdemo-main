// SafeBet Guardian — Multi-Channel Enforcement Orchestration (ARCH-V4-C9). Synthetic providers.
//   node --test tests/guardian/guardianEnforcement.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  orchestrate, selectChannel, guardianDispatchState, revalidateAuthorisation,
  buildProviderPayload, hashProviderPayload, verifyProviderOutcome,
  SyntheticProviderAdapter, SYNTHETIC_PROVIDER_CHANNELS, syntheticAuthorisedAction,
  GuardianEnforcementWorker, OrchestrationPoisonMessageError, buildOrchestrationPersistencePlan,
  resolveGuardianPrincipal, isBoundAuthorisingOfficer,
} from '../../products/guardian/src/index.ts';

const NOW = new Date('2026-09-12T00:00:00Z');
const adapter = new SyntheticProviderAdapter();
function orch(over = {}, scenario = 'ACK_ACTIONED', attemptNo = 1, principalAuthenticated = true) {
  const a = over.authorised === undefined ? syntheticAuthorisedAction(over.authOver ?? {}) : over.authorised;
  const requested = over.requested ?? (a ? { actionType: a.actionType, targetType: a.targetType, targetReference: a.targetReference, jurisdiction: a.jurisdiction } : { actionType: 'DOMAIN_BLOCK', targetType: 'DOMAIN', targetReference: 'x', jurisdiction: 'ZA-GP' });
  return orchestrate({ orchestrationId: 'ORCH-T', authorised: a, requested, channels: SYNTHETIC_PROVIDER_CHANNELS, attemptNo, dispatch: (h, n) => adapter.publishAuthorisedRequest({ requestPayloadHash: h, scenario, attemptNo: n }), principalAuthenticated, now: NOW });
}

test('scenario 1/13: valid AUTHORISED → synthetic ACTIONED (not auto-VERIFIED); then independent VERIFIED', () => {
  const d = orch({}, 'ACK_ACTIONED');
  assert.equal(d.status, 'ACTIONED'); assert.notEqual(d.status, 'VERIFIED');
  assert.equal(d.isRealProvider, false); assert.equal(d.isExternalNetworkCall, false); assert.ok(d.requestPayloadHash);
  const v = verifyProviderOutcome('DOMAIN_BLOCK', true, { observedState: 'UNAVAILABLE', expectedState: 'UNAVAILABLE' });
  assert.equal(v.result, 'VERIFIED');
});
test('scenario 2: expired authorisation → ORCHESTRATION_BLOCKED, no request', () => {
  const d = orch({ authOver: { expiresAt: '2020-01-01T00:00:00Z' } });
  assert.equal(d.status, 'ORCHESTRATION_BLOCKED'); assert.ok(d.reasonCodes.includes('AUTHORISATION_EXPIRED')); assert.equal(d.requestPayloadHash, null);
});
test('scenario 3: withdrawn authorisation → BLOCKED, no dispatch', () => {
  const d = orch({ authOver: { status: 'WITHDRAWN' } });
  assert.ok(d.reasonCodes.includes('AUTHORISATION_WITHDRAWN')); assert.equal(d.status, 'ORCHESTRATION_BLOCKED');
});
test('scenario 4: no valid human authorisation (not AUTHORISED) → denied', () => {
  assert.ok(orch({ authorised: null }).reasonCodes.includes('AUTHORISATION_NOT_FOUND'));
  assert.ok(orch({ authOver: { status: 'PENDING' } }).reasonCodes.includes('AUTHORISATION_NOT_AUTHORISED'));
});
test('scenario 5: caller cannot self-assert AUTHORISING_OFFICER (edge binding closes C8 finding)', () => {
  assert.equal(resolveGuardianPrincipal('attacker-self-asserts-officer'), null);
  assert.equal(isBoundAuthorisingOfficer(resolveGuardianPrincipal('syn-inv-zagp')), false);   // investigator id != officer role
  assert.equal(isBoundAuthorisingOfficer(resolveGuardianPrincipal('syn-auth-zagp')), true);
  assert.equal(orch({}, 'ACK_ACTIONED', 1, false).reasonCodes.includes('PRINCIPAL_NOT_AUTHENTICATED'), true); // unauthenticated → blocked
});
test('scenario 6: wrong jurisdiction → JURISDICTION_INVALID BLOCKED', () => {
  const a = syntheticAuthorisedAction();
  const d = orchestrate({ orchestrationId: 'O', authorised: a, requested: { actionType: a.actionType, targetType: a.targetType, targetReference: a.targetReference, jurisdiction: 'ZA-WC' }, channels: SYNTHETIC_PROVIDER_CHANNELS, attemptNo: 1, dispatch: () => ({ delivered: true, providerState: 'ACTIONED', providerReference: 'x', reasonCode: null, requestPayloadHash: 'h' }), principalAuthenticated: true, now: NOW });
  assert.ok(d.reasonCodes.includes('JURISDICTION_INVALID')); assert.equal(d.status, 'ORCHESTRATION_BLOCKED');
});
test('scenario 9: duplicate orchestration message → one provider request', () => {
  const w = new GuardianEnforcementWorker();
  const m = { product: 'GUARDIAN', schemaVersion: 'c9', eventType: 'guardian.enforcement.orchestrate', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k1', occurredAt: NOW.toISOString(), authorisationReference: 'AUTH-SYNTH-0001', providerScenario: 'ACK_ACTIONED' };
  const a = w.process(m), b = w.process(m);
  assert.equal(a.duplicate, false); assert.equal(b.duplicate, true); assert.equal(w.processedCount(), 1);
});
test('scenario 10: technical delivery failure → retryable READY, then success on retry', () => {
  assert.equal(orch({}, 'TECH_FAIL_THEN_OK', 1).status, 'READY');            // attempt 1 = technical failure
  assert.equal(orch({}, 'TECH_FAIL_THEN_OK', 2).status, 'ACTIONED');          // attempt 2 = delivered
});
test('scenario 11: provider DECLINED → recorded, delivered (not a transport failure)', () => {
  const d = orch({}, 'DECLINED');
  assert.equal(d.status, 'DECLINED'); assert.notEqual(d.status, 'READY');      // decline != technical failure
});
test('scenario 12: MORE_INFO_REQUIRED → follow-up; payload is minimised (no case notes/evidence bodies)', () => {
  const d = orch({}, 'MORE_INFO');
  assert.equal(d.status, 'MORE_INFO_REQUIRED');
  const p = buildProviderPayload(syntheticAuthorisedAction());
  assert.deepEqual(Object.keys(p).sort(), ['actionType', 'authorisationReference', 'authorityReference', 'evidenceManifestHash', 'evidenceManifestReference', 'jurisdiction', 'policyReference', 'requestVersion', 'targetReference', 'targetType']);
});
test('scenario 14: verification fails → NOT_VERIFIED (remains unverified)', () => {
  assert.equal(verifyProviderOutcome('DOMAIN_BLOCK', true, { observedState: 'STILL_AVAILABLE', expectedState: 'UNAVAILABLE' }).result, 'NOT_VERIFIED');
});
test('scenario 15/16: PAYMENT_REFERRAL + APP_PLATFORM_REFERRAL route to synthetic provider only', () => {
  const pay = orch({ authOver: { actionType: 'PAYMENT_REFERRAL', targetType: 'MERCHANT', targetReference: 'MER-REF-0001' } }, 'ACKNOWLEDGED');
  assert.equal(pay.providerChannel, 'PCH-SYNTH-PAY-ZAGP'); assert.equal(pay.isRealProvider, false);
  const app = orch({ authOver: { actionType: 'APP_PLATFORM_REFERRAL', targetType: 'MOBILE_APP', targetReference: 'com.safebet.synthetic.bet003' } }, 'ACKNOWLEDGED');
  assert.equal(app.providerChannel, 'PCH-SYNTH-APP-ZAGP');
});
test('scenario 17: DOMAIN_BLOCK → synthetic request only, no external network call', () => {
  const d = orch({}, 'ACKNOWLEDGED');
  assert.equal(d.providerChannel, 'PCH-SYNTH-DNS-ZAGP'); assert.equal(d.isExternalNetworkCall, false);
});
test('scenario 18: scope mutation after C8 authorisation → SCOPE_MUTATED, requires new authorisation', () => {
  const a = syntheticAuthorisedAction();
  const d = orchestrate({ orchestrationId: 'O', authorised: a, requested: { actionType: a.actionType, targetType: a.targetType, targetReference: 'DIFFERENT-target.test', jurisdiction: a.jurisdiction }, channels: SYNTHETIC_PROVIDER_CHANNELS, attemptNo: 1, dispatch: () => ({ delivered: true, providerState: 'ACTIONED', providerReference: 'x', reasonCode: null, requestPayloadHash: 'h' }), principalAuthenticated: true, now: NOW });
  assert.ok(d.reasonCodes.includes('SCOPE_MUTATED')); assert.equal(d.status, 'ORCHESTRATION_BLOCKED');
});
test('scenario 21: payload hash stable across retries; 22: version change → different hash (governed)', () => {
  const a = syntheticAuthorisedAction();
  const h1 = hashProviderPayload(buildProviderPayload(a, 1));
  const h1b = hashProviderPayload(buildProviderPayload(a, 1));
  const h2 = hashProviderPayload(buildProviderPayload(a, 2));
  assert.equal(h1, h1b); assert.notEqual(h1, h2); assert.equal(h1.length, 64);
});
test('scenario 23/24 + boundary: enforcement module has NO real provider endpoint/credential/outbound', () => {
  for (const dir of ['../../products/guardian/src/enforcement/']) {
    const d = new URL(dir, import.meta.url);
    for (const f of readdirSync(d)) {
      if (!f.endsWith('.ts')) continue;
      const src = readFileSync(new URL(f, d), 'utf8');
      assert.ok(!/\bfetch\s*\(|node:http|node:https|axios|net\.connect|dns\.|nodemailer|https?:\/\/[a-z]/i.test(src), `${f}: no outbound/provider endpoint`);
      assert.ok(!/password|apikey|api_key|secret_key|credential\s*[:=]/i.test(src), `${f}: no provider credential`);
    }
  }
});
test('guardianDispatchState: referral actions → REFERRED; others → PUBLISHED', () => {
  assert.equal(guardianDispatchState('PAYMENT_REFERRAL'), 'REFERRED');
  assert.equal(guardianDispatchState('DOMAIN_BLOCK'), 'PUBLISHED');
});
test('detection→enforcement bypass impossible: no AUTHORISED contract → BLOCKED (must go through C8)', () => {
  assert.equal(orch({ authorised: null }).status, 'ORCHESTRATION_BLOCKED');
});
test('worker: poison message → error (→ DLQ); persistence plan sane', () => {
  const w = new GuardianEnforcementWorker();
  assert.throws(() => w.process({ product: 'GUARDIAN', schemaVersion: 'c9', eventType: 'guardian.enforcement.orchestrate', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'k', occurredAt: NOW.toISOString(), authorisationReference: 'REAL-AUTH-999', providerScenario: 'ACK_ACTIONED' }), OrchestrationPoisonMessageError);
  const out = w.process({ product: 'GUARDIAN', schemaVersion: 'c9', eventType: 'guardian.enforcement.orchestrate', jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk1', occurredAt: NOW.toISOString(), authorisationReference: 'AUTH-SYNTH-0001', providerScenario: 'ACK_ACTIONED' });
  const plan = buildOrchestrationPersistencePlan({ jurisdiction: 'ZA-GP', correlationId: 'c', idempotencyKey: 'pk1', out });
  const tables = plan.rows.map((r) => r.table);
  assert.ok(tables.includes('enforcement_orchestration') && tables.includes('provider_response'));
  const orchRow = plan.rows.find((r) => r.table === 'enforcement_orchestration');
  assert.equal(orchRow.row.is_real_provider, false); assert.equal(orchRow.row.is_external_network_call, false);
});
