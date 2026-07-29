// Unit tests for Phase 4.1 — Enterprise Security & Multi-Tenant Isolation.
// Run: node --test tests/security.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bearerToken, verifyPrincipal, principalMayAccessCasino } from '../lib/security/principal.ts';
import { resolveConsumerScope, ConsumerScopeError, profileForRole } from '../lib/consumerPlatform/index.ts';

const CASINO_A = { id: 'casino-a', jurisdiction: 'ZA', province: 'Gauteng' };
const CASINO_B = { id: 'casino-b', jurisdiction: 'ZA', province: 'Western Cape' };
const CASINO_BW = { id: 'casino-bw', jurisdiction: 'BW', province: null };

function principal(overrides = {}) {
  return {
    userId: 'u-1', role: 'casino_admin', casinoId: CASINO_A.id,
    jurisdiction: null, province: null, isServiceRole: false,
    ...overrides,
  };
}

// ─── Token extraction ──────────────────────────────────────────────────────────

test('bearerToken extracts only well-formed bearer credentials', () => {
  assert.equal(bearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(bearerToken('bearer x'), 'x');
  assert.equal(bearerToken('Basic dXNlcg=='), null);
  assert.equal(bearerToken(''), null);
  assert.equal(bearerToken(null), null);
});

// ─── verifyPrincipal: verified material only ───────────────────────────────────

function fakeAuthClient({ user = null, row = null, authError = null } = {}) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from() {
      const q = {
        select: () => q, eq: () => q,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return q;
    },
  };
}

test('missing, invalid, and anon tokens yield NO principal', async () => {
  assert.equal(await verifyPrincipal(fakeAuthClient(), null), null);
  assert.equal(await verifyPrincipal(fakeAuthClient({ authError: new Error('invalid JWT') }), 'Bearer tampered'), null);
  // anon key: auth.getUser returns no user
  assert.equal(await verifyPrincipal(fakeAuthClient({ user: null }), 'Bearer anon-key'), null);
});

test('a verified subject with no registry row (or inactive) yields NO principal', async () => {
  assert.equal(await verifyPrincipal(fakeAuthClient({ user: { id: 'u-9' }, row: null }), 'Bearer ok'), null);
  assert.equal(await verifyPrincipal(fakeAuthClient({
    user: { id: 'u-9' }, row: { role: 'casino_admin', casino_id: 'c', is_active: false },
  }), 'Bearer ok'), null);
});

test('a verified active user resolves to a registry-backed principal', async () => {
  const p = await verifyPrincipal(fakeAuthClient({
    user: { id: 'u-1' },
    row: { role: 'casino_admin', casino_id: CASINO_A.id, jurisdiction: null, province: 'Gauteng', is_active: true },
  }), 'Bearer ok');
  assert.equal(p.userId, 'u-1');
  assert.equal(p.role, 'casino_admin');
  assert.equal(p.casinoId, CASINO_A.id);
  assert.equal(p.isServiceRole, false);
});

test('the service-role key authenticates internal jobs only when it matches exactly', async () => {
  const p = await verifyPrincipal(fakeAuthClient(), 'Bearer service-key-123', 'service-key-123');
  assert.equal(p.isServiceRole, true);
  assert.equal(await verifyPrincipal(fakeAuthClient(), 'Bearer service-key-999', 'service-key-123'), null);
});

// ─── Tenant matrix: principalMayAccessCasino mirrors app_visible_casinos() ────

test('operators and compliance officers reach ONLY their own casino', () => {
  assert.equal(principalMayAccessCasino(principal(), CASINO_A), true);
  assert.equal(principalMayAccessCasino(principal(), CASINO_B), false);
  assert.equal(principalMayAccessCasino(principal({ role: 'compliance_officer' }), CASINO_A), true);
  assert.equal(principalMayAccessCasino(principal({ role: 'compliance_officer' }), CASINO_B), false);
});

test('regulators reach only casinos in their jurisdiction', () => {
  const reg = principal({ role: 'regulator', casinoId: null, jurisdiction: 'ZA' });
  assert.equal(principalMayAccessCasino(reg, CASINO_A), true);
  assert.equal(principalMayAccessCasino(reg, CASINO_B), true);
  assert.equal(principalMayAccessCasino(reg, CASINO_BW), false);
  // a regulator without a jurisdiction reaches NOTHING
  assert.equal(principalMayAccessCasino(principal({ role: 'regulator', jurisdiction: null }), CASINO_A), false);
});

test('provincial regulators are additionally pinned to their province', () => {
  const prov = principal({ role: 'provincial_regulator', casinoId: null, jurisdiction: 'ZA', province: 'Gauteng' });
  assert.equal(principalMayAccessCasino(prov, CASINO_A), true);   // Gauteng
  assert.equal(principalMayAccessCasino(prov, CASINO_B), false);  // Western Cape
});

test('super_admin and service role reach everything; unknown roles reach nothing', () => {
  assert.equal(principalMayAccessCasino(principal({ role: 'super_admin' }), CASINO_BW), true);
  assert.equal(principalMayAccessCasino(principal({ isServiceRole: true, role: 'service_role' }), CASINO_BW), true);
  assert.equal(principalMayAccessCasino(principal({ role: 'intruder' }), CASINO_A), false);
});

// ─── Gateway scope resolution: parameters can never widen entitlement ─────────

test('an operator is pinned to their own casino — a foreign request is refused, never substituted', () => {
  const scope = resolveConsumerScope(principal(), null, CASINO_A);
  assert.deepEqual(scope, { consumer: 'casino-operator', casinoId: CASINO_A.id, jurisdiction: 'ZA' });
  assert.throws(() => resolveConsumerScope(principal(), CASINO_B.id, CASINO_B), ConsumerScopeError);
});

test('jurisdiction comes from the casino REGISTRY, never from the caller', () => {
  const admin = principal({ role: 'super_admin', casinoId: null });
  assert.equal(resolveConsumerScope(admin, CASINO_BW.id, CASINO_BW).jurisdiction, 'BW');
  assert.equal(resolveConsumerScope(admin, CASINO_A.id, CASINO_A).jurisdiction, 'ZA');
});

test('a regulator may request casinos inside their scope only', () => {
  const reg = principal({ role: 'national_regulator', casinoId: null, jurisdiction: 'ZA' });
  assert.equal(resolveConsumerScope(reg, CASINO_B.id, CASINO_B).consumer, 'regulator');
  assert.throws(() => resolveConsumerScope(reg, CASINO_BW.id, CASINO_BW), /outside principal scope/);
});

test('roles without a consumer profile, unassigned operators, unknown casinos are refused', () => {
  assert.throws(() => resolveConsumerScope(principal({ role: 'intruder' }), null, CASINO_A), /no consumer profile/);
  assert.throws(() => resolveConsumerScope(principal({ casinoId: null }), null, CASINO_A), /no casino assignment/);
  assert.throws(() => resolveConsumerScope(principal(), null, null), /unknown casino/);
});

test('all real user_role enum values map to profiles; regulator variants unify', () => {
  assert.equal(profileForRole('national_regulator'), 'regulator');
  assert.equal(profileForRole('provincial_regulator'), 'regulator');
  assert.equal(profileForRole('regulator'), 'regulator');
  assert.equal(profileForRole('casino_admin'), 'casino-operator');
  assert.equal(profileForRole('compliance_officer'), 'compliance-officer');
  assert.equal(profileForRole('super_admin'), 'administrator');
});
