// M1B-P1F Correction 1 — deterministic Supabase deployment-derivative generator.
// Static only (no database). Run: node --test tests/pilotSupabaseDerivative.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildDerivative, REMOVAL_ALLOWLIST, CANONICAL_SHA } from '../../deploy/pilot/baseline/generate-supabase-derivative.mjs';

const BASE = '../../deploy/pilot/baseline/';
const rd = (f) => readFileSync(new URL(BASE + f, import.meta.url), 'utf8');
const lf = (s) => s.replace(/\r\n/g, '\n');
const sha = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');

const CANONICAL = rd('pilot_app_schema_baseline.sql');
const DERIVATIVE_SHA = 'c2125accccc133172357a36d96b343f0d42dcc3d07695e56089950dd01512067';
// The ONLY lines the generator may remove: supabase_admin schema default-privilege GRANTs.
const RE = /^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON (?:SEQUENCES|FUNCTIONS|TABLES) TO (?:postgres|anon|authenticated|service_role);$/;

test('allowlist is exactly the 12 supabase_admin default-privilege statements', () => {
  assert.equal(REMOVAL_ALLOWLIST.length, 12);
  for (const s of REMOVAL_ALLOWLIST) assert.match(s, RE);
  assert.equal(new Set(REMOVAL_ALLOWLIST).size, 12, 'no duplicates');
});

test('starts only from the approved canonical SHA; removes exactly the 12 allowlisted statements', () => {
  const r = buildDerivative(CANONICAL);
  assert.equal(r.canonicalSha, CANONICAL_SHA);
  assert.equal(r.removed.length, 12);
  assert.deepEqual([...r.removed.map((x) => x.statement)].sort(), [...REMOVAL_ALLOWLIST].sort());
});

test('derivative contains no supabase_admin default-privilege statement and matches the committed SHA', () => {
  const r = buildDerivative(CANONICAL);
  assert.ok(!/ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin/.test(r.derivative), 'no supabase_admin ALTER DEFAULT remains');
  const fileSha = sha(r.derivative.endsWith('\n') ? r.derivative : r.derivative + '\n');
  assert.equal(fileSha, DERIVATIVE_SHA, 'derivative SHA is deterministic and pinned');
  // Committed artifact equals the generator output (no hand-edit).
  assert.equal(sha(lf(rd('generated/pilot_app_schema_supabase.sql'))), DERIVATIVE_SHA);
});

test('canonical baseline is proven unchanged (530941a5…) and is never rewritten', () => {
  assert.equal(sha(lf(CANONICAL)), CANONICAL_SHA);
});

test('only standalone supabase_admin default-privilege statements match — nothing unexpected is removable', () => {
  // Every line in the canonical that matches the removal regex must be one of the 12 allowlisted
  // statements (proves the generator would never drop a function-body line or any other statement).
  const matches = lf(CANONICAL).split('\n').filter((l) => RE.test(l));
  assert.equal(matches.length, 12);
  for (const m of matches) assert.ok(REMOVAL_ALLOWLIST.includes(m), m);
});

test('rejects any canonical whose SHA differs from the approved value (fail closed)', () => {
  const tampered = '-- tamper\n' + CANONICAL; // guaranteed byte change
  assert.throws(() => buildDerivative(tampered), /canonical baseline SHA mismatch/);
});
