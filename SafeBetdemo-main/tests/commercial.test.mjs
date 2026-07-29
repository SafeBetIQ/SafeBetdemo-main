// Tests for the commercial enablement libs (v1.3).
// Run: node --test tests/commercial.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_CATALOGUE, evaluateLicence, hasEntitlement, newTrialSubscription,
  shapeOnboarding, shapePilot, ONBOARDING_STEPS, PILOT_CHECKLIST,
  shapeCustomerSuccessRow, buildCustomerReport,
} from '../lib/commercial/index.ts';

const CASINO = 'a1b2c3d4-0000-0000-0000-000000000001';
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

// ─── Licensing: entitlements, trial/expiry, status ────────────────────────────

test('an active pilot subscription grants its plan entitlements', () => {
  const sub = { casinoId: CASINO, plan: 'pilot', status: 'trial', trialEndsAt: new Date(NOW + 60 * DAY).toISOString(), currentPeriodEnd: null, createdAt: '' };
  const lic = evaluateLicence(sub, NOW);
  assert.equal(lic.active, true);
  assert.deepEqual(lic.entitlements, PLAN_CATALOGUE.pilot.entitlements);
  assert.equal(hasEntitlement(lic, 'regulator-portal'), true);
  assert.equal(hasEntitlement(lic, 'report-export'), false); // not in pilot
  assert.equal(lic.warnings.length, 0);
});

test('a trial ending within 7 days raises TRIAL_ENDING but stays active', () => {
  const sub = { casinoId: CASINO, plan: 'trial', status: 'trial', trialEndsAt: new Date(NOW + 3 * DAY).toISOString(), currentPeriodEnd: null, createdAt: '' };
  const lic = evaluateLicence(sub, NOW);
  assert.equal(lic.active, true);
  assert.equal(lic.daysToExpiry, 3);
  assert.equal(lic.warnings[0].code, 'TRIAL_ENDING');
});

test('an expired subscription is inactive with no entitlements', () => {
  const sub = { casinoId: CASINO, plan: 'standard', status: 'active', trialEndsAt: null, currentPeriodEnd: new Date(NOW - DAY).toISOString(), createdAt: '' };
  const lic = evaluateLicence(sub, NOW);
  assert.equal(lic.active, false);
  assert.equal(lic.warnings.some(w => w.code === 'EXPIRED'), true);
  assert.deepEqual(lic.entitlements, []);
  assert.equal(hasEntitlement(lic, 'casino-portal'), false);
});

test('suspended and cancelled are inactive', () => {
  const base = { casinoId: CASINO, plan: 'standard', trialEndsAt: null, currentPeriodEnd: new Date(NOW + 30 * DAY).toISOString(), createdAt: '' };
  assert.equal(evaluateLicence({ ...base, status: 'suspended' }, NOW).active, false);
  assert.equal(evaluateLicence({ ...base, status: 'cancelled' }, NOW).active, false);
  assert.equal(evaluateLicence({ ...base, status: 'suspended' }, NOW).warnings[0].code, 'SUSPENDED');
});

test('newTrialSubscription starts a dated trial for a trial plan', () => {
  const sub = newTrialSubscription(CASINO, NOW, 'trial');
  assert.equal(sub.status, 'trial');
  assert.equal(sub.trialEndsAt, new Date(NOW + 30 * DAY).toISOString());
  assert.equal(evaluateLicence(sub, NOW).active, true);
  // enterprise plan is active immediately (no trial)
  assert.equal(newTrialSubscription(CASINO, NOW, 'enterprise').status, 'active');
});

// ─── Onboarding progress (WS1) ────────────────────────────────────────────────

test('onboarding progress computes percent, current step, and activation', () => {
  const v = shapeOnboarding({ casinoId: CASINO, completed: ['register-operator', 'configure-jurisdiction', 'select-connector'], startedAt: '', activatedAt: null });
  assert.equal(v.totalSteps, ONBOARDING_STEPS.length);
  assert.equal(v.completedCount, 3);
  assert.equal(v.percent, Math.round((3 / ONBOARDING_STEPS.length) * 100));
  assert.equal(v.currentStep, 'configure-auth'); // next incomplete step
  assert.equal(v.activated, false);
  assert.equal(v.steps.find(s => s.key === 'configure-auth').current, true);
});

test('a fully-onboarded activated operator shows 100% and no current step', () => {
  const all = ONBOARDING_STEPS.map(s => s.key);
  const v = shapeOnboarding({ casinoId: CASINO, completed: all, startedAt: '', activatedAt: new Date(NOW).toISOString() });
  assert.equal(v.percent, 100);
  assert.equal(v.currentStep, null);
  assert.equal(v.activated, true);
});

// ─── Pilot readiness (WS2) ────────────────────────────────────────────────────

test('pilot readiness score + go-live recommendation', () => {
  const partial = shapePilot({ casinoId: CASINO, status: 'in-progress', checklist: ['operator-onboarded', 'connector-certified', 'events-flowing'], startedAt: '', goLiveAt: null, notes: null });
  assert.equal(partial.completedCount, 3);
  assert.equal(partial.goLiveRecommended, false);
  assert.ok(partial.outstanding.includes('Go-live approved'));

  const complete = shapePilot({ casinoId: CASINO, status: 'ready', checklist: PILOT_CHECKLIST.map(i => i.key), startedAt: '', goLiveAt: null, notes: null });
  assert.equal(complete.readinessScore, 100);
  assert.equal(complete.goLiveRecommended, true);
  assert.deepEqual(complete.outstanding, []);
});

test('a rolled-back pilot never recommends go-live even at 100%', () => {
  const v = shapePilot({ casinoId: CASINO, status: 'rolled-back', checklist: PILOT_CHECKLIST.map(i => i.key), startedAt: '', goLiveAt: null, notes: null });
  assert.equal(v.goLiveRecommended, false);
});

// ─── Customer Success rollup (WS3) — composition of commercial + platform ─────

test('customer-success row composes licence + onboarding + pilot + platform health', () => {
  const row = shapeCustomerSuccessRow({
    casino: { id: CASINO, name: 'Prestige Casino', jurisdiction: 'ZA' },
    subscription: { casinoId: CASINO, plan: 'pilot', status: 'trial', trialEndsAt: new Date(NOW + 5 * DAY).toISOString(), currentPeriodEnd: null, createdAt: '' },
    onboarding: { casinoId: CASINO, completed: ['register-operator'], startedAt: '', activatedAt: null },
    pilot: { casinoId: CASINO, status: 'in-progress', checklist: ['operator-onboarded'], startedAt: '', goLiveAt: null, notes: null },
    connectorHealth: { runs: 3, failed: 1 },
    platformHealth: { events_in_log: 168, projection_lag_seconds: 20 },
    now: NOW,
  });
  assert.equal(row.name, 'Prestige Casino');
  assert.equal(row.plan, 'pilot');
  assert.equal(row.licenceActive, true);
  assert.equal(row.daysToExpiry, 5);
  assert.equal(row.eventsInLog, 168);
  assert.equal(row.connectorFailed, 1);
  assert.equal(row.healthState, 'attention');         // failed events
  assert.ok(row.warnings.some(w => /Trial ends/.test(w)));
  assert.ok(row.warnings.some(w => /failed connector/.test(w)));
});

test('a healthy operator with no failures reads as ok', () => {
  const row = shapeCustomerSuccessRow({
    casino: { id: CASINO, name: 'X', jurisdiction: 'ZA' },
    subscription: { casinoId: CASINO, plan: 'standard', status: 'active', trialEndsAt: null, currentPeriodEnd: new Date(NOW + 300 * DAY).toISOString(), createdAt: '' },
    onboarding: null, pilot: null,
    connectorHealth: { runs: 5, failed: 0 },
    platformHealth: { events_in_log: 500, projection_lag_seconds: 10 },
    now: NOW,
  });
  assert.equal(row.healthState, 'ok');
  assert.deepEqual(row.warnings, []);
});

// ─── Customer reports (WS6) — compose certified views, no recalculation ───────

test('customer reports compose certified Consumer Platform view data', () => {
  const r = buildCustomerReport('connector-performance', CASINO, { integration: { runs: 3, submitted: 40 } });
  assert.equal(r.title, 'Connector Performance');
  assert.equal(r.sections[0].heading, 'Connector Health');
  assert.deepEqual(r.sections[0].data, { runs: 3, submitted: 40 });

  const rg = buildCustomerReport('responsible-gambling-summary', CASINO, { summary: { kpi: {} }, compliance: { riskTiers: {} } });
  assert.equal(rg.title, 'Monthly Responsible Gambling Summary');
  assert.equal(rg.sections.length, 2);
  assert.ok(rg.sections.every(s => s.evidenceClass === 'recorded-fact'));
});
