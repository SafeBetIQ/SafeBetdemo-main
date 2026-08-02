// Secure Demo quick-login — slug allowlist + mapping contract.
// Run: node --test tests/demoAuth.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SLUGS, resolveDemoSlug } from '../lib/demoAuthSlugs.ts';

const CASINOS = ['prestige', 'sunbet', 'hollywoodbets', 'goldrush', 'betway', 'royalpalace'];

test('exactly seven allowlisted slugs: six casinos + regulator', () => {
  assert.deepEqual(Object.keys(DEMO_SLUGS).sort(), [...CASINOS, 'regulator'].sort());
});

test('Super Admin is NOT reachable via quick-login', () => {
  for (const bad of ['admin', 'superadmin', 'super_admin', 'demo.admin', 'demo.admin@safebetiq.com']) {
    assert.equal(resolveDemoSlug(bad), null, `${bad} must not resolve`);
  }
});

test('browser-supplied email / arbitrary values are rejected (only slugs resolve)', () => {
  for (const bad of ['demo.prestige@safebetiq.com', 'prestige@x', 'casino_admin', 'a1b2c3d4-0000-0000-0000-000000000001', '', '../regulator', 'PRESTIGE', 'toString', 42, null, undefined, {}]) {
    assert.equal(resolveDemoSlug(bad), null, `${JSON.stringify(bad)} must not resolve`);
  }
});

test('each casino slug maps to casino_admin + a single tenant + /casino/dashboard', () => {
  for (const s of CASINOS) {
    const cfg = resolveDemoSlug(s);
    assert.ok(cfg, `${s} resolves`);
    assert.equal(cfg.role, 'casino_admin');
    assert.ok(/^[a-f0-9-]{36}$/.test(cfg.casino), `${s} has a casino id`);
    assert.equal(cfg.jurisdiction, undefined, `${s} is not jurisdiction-scoped`);
    assert.equal(cfg.redirect, '/casino/dashboard');
  }
  // Distinct tenants — no two casinos share a casino id.
  const ids = CASINOS.map((s) => DEMO_SLUGS[s].casino);
  assert.equal(new Set(ids).size, 6);
});

test('regulator slug maps to regulator + jurisdiction ZA + /regulator/dashboard (no casino)', () => {
  const cfg = resolveDemoSlug('regulator');
  assert.equal(cfg.role, 'regulator');
  assert.equal(cfg.jurisdiction, 'ZA');
  assert.equal(cfg.casino, undefined);
  assert.equal(cfg.redirect, '/regulator/dashboard');
});

test('slug config carries only env-var NAMES — never a literal password/email', () => {
  for (const cfg of Object.values(DEMO_SLUGS)) {
    assert.ok(cfg.pwEnv.endsWith('_PASSWORD') && cfg.pwEnv.startsWith('DEMO_'), 'password is an env name');
    assert.ok(cfg.emailEnv.endsWith('_EMAIL') && cfg.emailEnv.startsWith('DEMO_'), 'email is an env name');
    assert.ok(!/@/.test(cfg.emailEnv), 'no literal email address in config');
    // no NEXT_PUBLIC_ (server-only)
    assert.ok(!cfg.pwEnv.includes('NEXT_PUBLIC') && !cfg.emailEnv.includes('NEXT_PUBLIC'));
  }
});
