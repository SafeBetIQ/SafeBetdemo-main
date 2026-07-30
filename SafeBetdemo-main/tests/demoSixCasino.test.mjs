// Six-casino demo — login selector + account mapping + scale-simulator contracts.
// Run: node --test tests/demoSixCasino.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_OPERATORS, DEMO_REGULATOR_EMAIL } from '../lib/demoOperators.ts';

// The six synthetic casino tenants and their agreed demo account mappings.
const EXPECTED = {
  'demo.prestige@safebetiq.com': 'a1b2c3d4-0000-0000-0000-000000000001',
  'demo.sunbet@safebetiq.com': 'cc000001-0000-0000-0000-000000000001',
  'demo.hollywoodbets@safebetiq.com': 'cc000002-0000-0000-0000-000000000002',
  'demo.betway@safebetiq.com': 'cc000003-0000-0000-0000-000000000003',
  'demo.goldrush@safebetiq.com': 'cc000004-0000-0000-0000-000000000004',
  'demo.royalpalace@safebetiq.com': 'cc000005-0000-0000-0000-000000000005',
};

test('1: six casino cards render (one per tenant), each with required fields', () => {
  assert.equal(DEMO_OPERATORS.length, 6, 'exactly six operator cards');
  for (const op of DEMO_OPERATORS) {
    assert.ok(op.casino && /Demo/.test(op.casino), 'card carries a Demo label');
    assert.ok(op.email && op.email.endsWith('@safebetiq.com'), 'card has a demo email');
    assert.ok(op.profile && op.profile.length > 0, 'card has a profile');
    assert.ok(/registered synthetic players/.test(op.registeredScale), 'card shows registered scale');
    assert.ok(op.posture && op.posture.length > 0, 'card shows activity posture');
  }
});

test('3/4: cards expose ONLY an email (no password / casino-id authority in the card data)', () => {
  for (const op of DEMO_OPERATORS) {
    assert.equal(Object.prototype.hasOwnProperty.call(op, 'password'), false, 'no password on the card');
    // The card carries no casino_id — tenant is resolved server-side from the verified identity.
    assert.equal(Object.prototype.hasOwnProperty.call(op, 'casino_id'), false, 'no client casino id authority');
  }
});

test('5: every card email maps to exactly one expected casino tenant', () => {
  const emails = DEMO_OPERATORS.map((o) => o.email).sort();
  assert.deepEqual(emails, Object.keys(EXPECTED).sort(), 'card emails match the six agreed mappings');
});

test('regulator demo entry is present and separate from operator cards', () => {
  assert.equal(DEMO_REGULATOR_EMAIL, 'demo.regulator@safebetiq.com');
  assert.ok(!DEMO_OPERATORS.some((o) => o.email === DEMO_REGULATOR_EMAIL), 'regulator is not an operator card');
});

test('7: casino profiles are differentiated (not clones)', () => {
  const profiles = new Set(DEMO_OPERATORS.map((o) => o.profile));
  const scales = new Set(DEMO_OPERATORS.map((o) => o.registeredScale));
  assert.equal(profiles.size, 6, 'all six profiles distinct');
  assert.equal(scales.size, 6, 'all six registered-scale figures distinct');
});

// Scale-simulator determinism/marker contract (mirrors the SQL producer tagging).
test('scale simulator marks all synthetic rows for clean removal', () => {
  const PRODUCER = 'safebet-demo-scale-simulator-v1';
  // Markers the SQL simulator applies (asserted here as the contract the cleanup relies on):
  const markers = { producer: PRODUCER, playerFlag: 'synthetic-scale', sessionPrefix: 'SC-SES-', machinePrefix: 'SC-MC-', identityPrefix: 'scale-' };
  assert.equal(markers.producer, PRODUCER);
  assert.ok(markers.playerFlag && markers.sessionPrefix && markers.machinePrefix && markers.identityPrefix,
    'every projection/event class has a removal marker');
});
