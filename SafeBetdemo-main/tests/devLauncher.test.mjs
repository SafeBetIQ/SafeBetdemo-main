// Tests for the demo launcher pure helpers (v1.2.1 DX).
// Run: node --test tests/devLauncher.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEnv, major, versionOk, redact, classifyHttp,
  localUrls, renderDashboard, allReady, diagnostic,
  PLATFORM_LAYERS, REQUIRED_NODE_MAJOR,
} from '../scripts/dev/checks.mjs';

// ─── Env parsing (never leaks values) ─────────────────────────────────────────

test('parseEnv reads KEY=VALUE, ignores comments/blanks, strips quotes', () => {
  const env = parseEnv([
    '# comment', '', 'NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co',
    'ANON="abc123"', "MODE='demonstration'", 'MALFORMED_LINE', 'K = spaced ',
  ].join('\n'));
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://x.supabase.co');
  assert.equal(env.ANON, 'abc123');
  assert.equal(env.MODE, 'demonstration');
  assert.equal(env.K, 'spaced');
  assert.equal('MALFORMED_LINE' in env, false);
});

// ─── Version checks ───────────────────────────────────────────────────────────

test('version parsing + comparison', () => {
  assert.equal(major('v24.14.1'), 24);
  assert.equal(major('11.11.0'), 11);
  assert.equal(major('garbage'), 0);
  assert.equal(versionOk('v24.14.1', REQUIRED_NODE_MAJOR), true);
  assert.equal(versionOk('v18.0.0', 20), false);
});

// ─── Secret redaction ─────────────────────────────────────────────────────────

test('redact never reveals the value, only presence + length', () => {
  assert.equal(redact('super-secret-key-123'), 'set (20 chars)');
  assert.equal(redact(''), '(missing)');
  assert.equal(redact(undefined), '(missing)');
  assert.ok(!redact('abc').includes('abc'));
});

// ─── HTTP classification (reachability semantics) ─────────────────────────────

test('classifyHttp: 200 ok, 401/403 reachable (auth-enforcing), 5xx/0 down', () => {
  assert.equal(classifyHttp(200), 'ok');
  assert.equal(classifyHttp(401), 'reachable');
  assert.equal(classifyHttp(403), 'reachable');
  assert.equal(classifyHttp(400), 'reachable');
  assert.equal(classifyHttp(500), 'down');
  assert.equal(classifyHttp(0), 'down');
  assert.equal(classifyHttp(undefined), 'down');
});

// ─── URL catalogue (WS5) ──────────────────────────────────────────────────────

test('localUrls lists every portal + API endpoint against the given bases', () => {
  const u = localUrls('http://localhost:3000', 'https://p/functions/v1');
  assert.equal(u['Application']['Login'], 'http://localhost:3000/login');
  assert.equal(u['Casino Portal']['Integration (Connector Health)'], 'http://localhost:3000/casino/integration');
  assert.equal(u['Regulator Portal']['Investigation Workspace'], 'http://localhost:3000/regulator/intelligence/investigation');
  assert.equal(u['Enterprise API (Supabase-hosted)']['Connector Ingest'], 'https://p/functions/v1/connector-ingest');
  // covers casino, regulator, integration, admin, and API groups
  assert.ok(Object.keys(u).length >= 5);
});

// ─── Dashboard + readiness gate (WS6) ─────────────────────────────────────────

test('renderDashboard renders meta + rows without throwing', () => {
  const out = renderDashboard({ Version: 'SafeBet IQ 1.2.1' }, [{ label: 'Node v24', state: 'pass' }]);
  assert.ok(out.includes('SafeBet IQ'));
  assert.ok(out.includes('Node v24'));
});

test('allReady requires every REQUIRED row to pass; optional rows do not block', () => {
  assert.equal(allReady([{ label: 'a', state: 'pass' }, { label: 'b', state: 'reachable' }]), true);
  assert.equal(allReady([{ label: 'a', state: 'pass' }, { label: 'b', state: 'fail' }]), false);
  // an optional (required:false) warning does NOT block readiness
  assert.equal(allReady([{ label: 'a', state: 'pass' }, { label: 'demo data', state: 'warn', required: false }]), true);
});

test('the certified layers are all represented in the health catalogue', () => {
  for (const layer of ['Identity Resolution', 'Event Platform', 'Projection Platform', 'Digital Twin',
    'Domain Intelligence', 'Policy Platform', 'Consumer Platform', 'Connector Framework']) {
    assert.ok(PLATFORM_LAYERS.includes(layer), `${layer} must be checked`);
  }
});

// ─── Diagnostics (WS7) ────────────────────────────────────────────────────────

test('diagnostic renders what / why / fix', () => {
  const d = diagnostic('X failed', 'because Y', 'do Z');
  assert.match(d, /X failed/);
  assert.match(d, /Why:\s+because Y/);
  assert.match(d, /Fix:\s+do Z/);
});
