// Demo live-simulator contract: differentiated profiles, required activity bands,
// freshness-respecting clamp, no casino-name conditional. Run:
//   node --test tests/demoSimulator.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SIM_PROFILES, clampActiveTarget } from '../lib/demoSimTargets.ts';

test('six differentiated per-casino profiles (no identical clones)', () => {
  assert.equal(DEMO_SIM_PROFILES.length, 6);
  assert.equal(new Set(DEMO_SIM_PROFILES.map((p) => p.baselineActiveTarget)).size, 6);
  assert.equal(new Set(DEMO_SIM_PROFILES.map((p) => p.showcaseActiveTarget)).size, 6);
  // Hollywoodbets highest, Royal Palace smallest.
  const byBaseline = [...DEMO_SIM_PROFILES].sort((a, b) => b.baselineActiveTarget - a.baselineActiveTarget);
  assert.equal(byBaseline[0].name, 'Hollywoodbets');
  assert.equal(byBaseline.at(-1).name, 'Royal Palace');
});

test('baseline target is 0.1%-0.4% of registered per casino', () => {
  for (const p of DEMO_SIM_PROFILES) {
    const pct = p.baselineActiveTarget / p.registeredApprox;
    assert.ok(pct >= 0.001 && pct <= 0.004, `${p.name} baseline ${(pct * 100).toFixed(3)}% out of band`);
  }
});

test('showcase target is 0.75%-2.0% of registered per casino', () => {
  for (const p of DEMO_SIM_PROFILES) {
    const pct = p.showcaseActiveTarget / p.registeredApprox;
    assert.ok(pct >= 0.0075 && pct <= 0.02, `${p.name} showcase ${(pct * 100).toFixed(3)}% out of band`);
  }
});

test('clamp caps at 20%/40% of observed and floors at min(10, observed)', () => {
  // cap: baseline 20% of observed
  assert.equal(clampActiveTarget(500, 100, false), 20);
  // cap: showcase 40% of observed
  assert.equal(clampActiveTarget(500, 100, true), 40);
  // floor: min 10 when observed >= 10
  assert.equal(clampActiveTarget(1, 50, false), 10);
  // tiny pool: floor is observed, not 10
  assert.equal(clampActiveTarget(100, 6, false), 6);
  // zero observed -> zero (never fabricate active)
  assert.equal(clampActiveTarget(50, 0, true), 0);
});

test('config is data-driven (keyed by casino id, no name conditional needed)', () => {
  // Every profile is addressable by immutable casino id; a new tenant is just a
  // new row — no code branch per casino name.
  for (const p of DEMO_SIM_PROFILES) {
    assert.ok(/^[a-f0-9-]{36}$/.test(p.casinoId), `${p.name} has a casino id`);
  }
  assert.equal(new Set(DEMO_SIM_PROFILES.map((p) => p.casinoId)).size, 6);
});
