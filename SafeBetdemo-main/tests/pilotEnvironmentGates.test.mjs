// M1B-P1F — Pilot environment gating: Demo-only surfaces fail closed outside Demo.
// Run: node --test tests/pilotEnvironmentGates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEMO_ENVIRONMENT, isDemoEnvironment, demoOperatorSelectorEnabled, casinoSimulatorEnabled,
  environmentPresentation,
} from '../lib/environmentGates.ts';
import { normalizeMode, operationalProfile, OPERATING_MODES } from '../lib/operations/index.ts';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const NON_DEMO = ['pilot', 'production', 'staging', 'development', '', undefined, null, 'Demo', 'DEMO', ' demo', 'demo ', 'demo-pilot'];

test('Demo-only gates are true ONLY for the exact value "demo"', () => {
  assert.equal(DEMO_ENVIRONMENT, 'demo');
  for (const fn of [isDemoEnvironment, demoOperatorSelectorEnabled, casinoSimulatorEnabled]) {
    assert.equal(fn('demo'), true, `${fn.name}('demo')`);
    for (const v of NON_DEMO) assert.equal(fn(v), false, `${fn.name}(${JSON.stringify(v)}) must be false`);
  }
});

test('Pilot: DemoOperatorSelector hidden (gate is demo-only, not "everything but production")', () => {
  const s = src('components/DemoOperatorSelector.tsx');
  assert.match(s, /if \(!demoOperatorSelectorEnabled\(process\.env\.NEXT_PUBLIC_ENV\)\) return null;/);
  assert.doesNotMatch(s, /NEXT_PUBLIC_ENV === 'production'\) return null/, 'old production-only gate must be gone');
  assert.equal(demoOperatorSelectorEnabled('pilot'), false);
});

test('Pilot: casino-simulator burst producer disabled (no synthetic event generation)', () => {
  const s = src('contexts/CasinoDataContext.tsx');
  assert.match(s, /const SIMULATOR_ENABLED = casinoSimulatorEnabled\(process\.env\.NEXT_PUBLIC_ENV\);/);
  assert.match(s, /if \(!SIMULATOR_ENABLED \|\| !casinoId\) return;/, 'triggerBurst must be gated');
  // The only setInterval that calls triggerBurst must sit inside the SIMULATOR_ENABLED block.
  const effect = s.slice(s.indexOf('// ─── Main setup effect'));
  const guarded = effect.indexOf('if (SIMULATOR_ENABLED) {');
  const firstBurst = effect.indexOf('triggerBurst(');
  assert.ok(guarded > 0 && firstBurst > guarded, 'burst calls must be inside if (SIMULATOR_ENABLED)');
  assert.match(effect, /isSimulating: SIMULATOR_ENABLED/);
  assert.equal(casinoSimulatorEnabled('pilot'), false);
});

test('Pilot: Demo quick-login route stays closed (requires NEXT_PUBLIC_ENV === demo AND flag)', () => {
  const s = src('app/api/demo-auth/login/route.ts');
  assert.match(s, /process\.env\.NEXT_PUBLIC_ENV === 'demo' && process\.env\.ENABLE_DEMO_QUICK_LOGIN === 'true'/);
  assert.ok(!/APPROVED_HOSTS = new Set\(\[[^\]]*pilot/.test(s), 'pilot host must not be an approved quick-login host');
});

test('Pilot: demo super-admin routes deny (404) unless NEXT_PUBLIC_ENV === demo', () => {
  for (const p of ['app/api/admin/overview/route.ts', 'app/api/admin/simulation-health/route.ts',
    'app/api/admin/overview/refresh-registered-counts/route.ts']) {
    assert.match(src(p), /if \(process\.env\.NEXT_PUBLIC_ENV !== 'demo'\) return deny\(404\);/, p);
  }
});

test('Operating mode: "pilot" is NOT a supported mode and would fail OPEN to demonstration', () => {
  assert.ok(!OPERATING_MODES.includes('pilot'));
  assert.equal(normalizeMode('pilot'), 'demonstration');
  assert.equal(operationalProfile('demonstration').simulatorEnabled, true);
});

test('Operating mode: production is the only profile with simulator OFF and no demo data', () => {
  const off = OPERATING_MODES.filter((m) => !operationalProfile(m).simulatorEnabled && !operationalProfile(m).demoDataAllowed);
  assert.deepEqual(off, ['production']);
});

// ─── Correction 5: explicit environment presentation ────────────────────────
test('environmentPresentation: production shows no banner', () => {
  const p = environmentPresentation('production');
  assert.equal(p.show, false); assert.equal(p.kind, 'production'); assert.equal(p.label, '');
});

test('environmentPresentation: demo keeps the synthetic-data banner', () => {
  const p = environmentPresentation('demo');
  assert.equal(p.show, true); assert.equal(p.kind, 'demo');
  assert.match(p.label, /Demo/); assert.match(p.label, /Synthetic Data/);
});

test('environmentPresentation: pilot identifies as Pilot, with NO Demo/synthetic wording and no real-data claim', () => {
  const p = environmentPresentation('pilot');
  assert.equal(p.show, true); assert.equal(p.kind, 'pilot');
  assert.match(p.label, /Pilot/);
  assert.doesNotMatch(p.label, /Demo/i, 'Pilot banner must not say Demo');
  assert.doesNotMatch(p.label, /synthetic/i, 'Pilot banner must not say synthetic');
  assert.match(p.label, /Not Live Operator Data/, 'Pilot explicitly disclaims live operator data');
});

test('environmentPresentation: unknown/unset fails safe to a neutral non-production banner (never Demo, never hidden)', () => {
  for (const v of ['', undefined, null, 'staging', 'Pilot', 'DEMO']) {
    const p = environmentPresentation(v);
    assert.equal(p.show, true, `${JSON.stringify(v)} must still show a banner`);
    assert.equal(p.kind, 'unknown');
    assert.doesNotMatch(p.label, /Demo|Synthetic/i, `${JSON.stringify(v)} must not claim Demo`);
  }
});

test('DemoBanner renders the explicit presentation keyed off NEXT_PUBLIC_SAFEBET_ENV', () => {
  const s = src('components/DemoBanner.tsx');
  assert.match(s, /environmentPresentation\(process\.env\.NEXT_PUBLIC_SAFEBET_ENV\)/);
  assert.match(s, /if \(!env\.show\) return null;/);
  assert.doesNotMatch(s, /NEXT_PUBLIC_SAFEBET_ENV === 'production'/, 'old production-only gate replaced by explicit presentation');
});
