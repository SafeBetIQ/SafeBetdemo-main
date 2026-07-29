// Milestone 4.6 — Deployed Runtime & Consumer Platform Regression (in-process).
// Run: node --test tests/identityFederation.runtime.test.mjs
//
// Deployed-runtime composition smoke (full federation + financial pipeline through
// the actual boundaries), feature-flag governance, health/version, access-control
// regression, restart/recovery, rollback, Consumer-Platform non-impact (import
// boundary), and no-PII/secret leakage. Synthetic, non-production, in-process.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  FederationRuntime, DeployedSmokeHarness, InMemoryFeatureFlagStore, FederationFeatureFlags,
} from '../lib/identityFederation/index.ts';

const CLOCK = () => '2026-07-16T00:00:00.000Z';
const makeRuntime = (flagStore) => new FederationRuntime({ approvedTestTenants: ['t-a', 't-b'], now: CLOCK, flagStore, environment: 'in-process-composition' });

// ─── Deployed smoke (full pipeline through the actual boundaries) ────────────
test('deployed smoke: every pipeline step passes end-to-end', () => {
  const report = new DeployedSmokeHarness(makeRuntime(), CLOCK).run();
  for (const s of report.steps) assert.ok(s.ok, `${s.name}: ${s.detail}`);
  assert.equal(report.overall, true);
  assert.ok(/^SB-NAT-ZA-[0-9A-F]{6,}$/.test(report.sbNat ?? ''), 'a real SB-NAT was minted through the deployed pipeline');
  assert.equal(report.ggrMinor, 50, 'GGR reconciled through the deployed financial pipeline');
  const names = report.steps.map((s) => s.name);
  for (const need of ['startup+health+version', 'feature-flags: off by default, approved test-tenant activation, unapproved denied', 'federation pipeline: connector→contribution→matching→decision→registry', 'correlation: national player twin over the SB-NAT (federation enabled)', 'financial pipeline: session→wager→settle→projection→reconcile', 'access-control regression: operator denied SB-NAT / national / financial-national', 'restart+recovery: reconstruct registry from durable persistence', 'rollback simulation: emergency shutdown disables federation reads'])
    assert.ok(names.includes(need), `missing smoke step ${need}`);
});

// ─── Health + version metadata ───────────────────────────────────────────────
test('health distinguishes disabled (federation off) from unhealthy; version carries no secrets', () => {
  const rt = makeRuntime();
  const h = rt.health();
  assert.notEqual(h.overall, 'unavailable');
  const corr = h.components.find((c) => c.component === 'enterprise-correlation-layer');
  assert.equal(corr.state, 'disabled', 'federation off by default → correlation reported disabled, not unhealthy');
  const v = rt.version();
  assert.ok(v.matchingEngineVersion && v.decisionEngineVersion && v.correlationEngineVersion && v.nationalPolicyEngineVersion && v.projectionVersion && v.cryptoAlgorithm);
  assert.equal(v.adr, 'ADR-006');
  const blob = JSON.stringify(v);
  assert.equal(/secret|pepper|password|token|PEPPER/i.test(blob), false, 'no secrets in version metadata');
});

// ─── Feature-flag governance ─────────────────────────────────────────────────
test('federation feature flags: off by default, approved-only, emergency shutdown, restart persistence', () => {
  const store = new InMemoryFeatureFlagStore();
  const flags = new FederationFeatureFlags({ approvedTestTenants: ['t-a'], store });
  assert.equal(flags.isEnabled('ZA'), false, 'off by default');
  assert.throws(() => flags.enableTestTenant('t-x', 'ZA'), /tenant-not-approved/);
  flags.enableTestTenant('t-a', 'ZA');
  assert.equal(flags.isEnabled('ZA', 't-a'), true);
  assert.equal(flags.isEnabled('NA', 't-a'), false, 'jurisdiction not activated');
  // restart persistence: a fresh flags object over the same store restores state
  const flags2 = new FederationFeatureFlags({ approvedTestTenants: ['t-a'], store });
  assert.equal(flags2.isEnabled('ZA', 't-a'), true, 'flag state persisted across restart');
  flags2.emergencyShutdown();
  assert.equal(flags2.isEnabled('ZA', 't-a'), false, 'emergency shutdown disables all');
  assert.equal(new FederationFeatureFlags({ approvedTestTenants: ['t-a'], store }).isEnabled('ZA', 't-a'), false, 'shutdown persisted');
});

// ─── Restart / recovery ──────────────────────────────────────────────────────
test('restart: registry reconstructs from durable persistence with intact integrity', () => {
  const rt = makeRuntime();
  new DeployedSmokeHarness(rt, CLOCK).run();
  const rebuilt = rt.reconstructRegistry();
  assert.equal(rebuilt.verifyIntegrity().ok, true);
  assert.ok(rebuilt.list('ZA').length >= 1, 'SB-NAT survived restart');
});

// ─── Consumer Platform non-impact (import boundary) ──────────────────────────
test('Consumer Platform compatibility: Version 2.0 federation is imported by NO operator/app/edge path', () => {
  const root = process.cwd();
  const dirs = ['app', 'components', 'pages', 'src', 'supabase/functions'].map((d) => join(root, d)).filter((d) => existsSync(d));
  let offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!/node_modules|\.next|dist|build/.test(name)) walk(p); }
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) { if (readFileSync(p, 'utf8').includes('identityFederation')) offenders.push(p); }
    }
  };
  for (const d of dirs) walk(d);
  assert.deepEqual(offenders, [], `Version 2.0 federation must not be imported by operator/consumer code; offenders: ${offenders.join(', ')}`);
});

// ─── No PII / secret leakage across the deployed surfaces ────────────────────
test('no PII or secret leakage in deployed health / version / smoke report', () => {
  const rt = makeRuntime();
  const report = new DeployedSmokeHarness(rt, CLOCK).run();
  const blob = JSON.stringify({ health: rt.health(), version: rt.version(), report });
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(blob), false, 'no email PII');
  assert.equal(/DEMO_PEPPER|PEPPER_|password|secret-conn|bearer /i.test(blob), false, 'no secret material');
  assert.equal(blob.includes('SHARED-PERSON'), false, 'no raw synthetic attribute value');
});
