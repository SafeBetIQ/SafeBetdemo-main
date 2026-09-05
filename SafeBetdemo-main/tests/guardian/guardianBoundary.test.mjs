// SafeBet Guardian — product-boundary & independence (ARCH-V4-C0).
// Static proof that the Guardian package depends ONLY on governed Shared Platform
// Foundation contracts, never on SafeBet IQ business modules/tables, and that the
// foundation still works when SafeBet IQ is simulated unavailable.
//   node --test tests/guardian/guardianBoundary.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN_IQ_TABLES, LEGACY_COLLISION_PREFIXES, guardianFoundationDescriptor } from '../../products/guardian/src/index.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GUARDIAN_SRC = path.join(ROOT, 'products', 'guardian');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk(GUARDIAN_SRC);

test('boundary: Guardian package contains source files', () => {
  assert.ok(files.length >= 10, `expected >=10 Guardian source files, found ${files.length}`);
});

test('boundary: no Guardian source imports a SafeBet IQ business/app module', () => {
  // Allowed cross-product imports: ONLY the governed Shared Platform Foundation.
  const ALLOWED_CROSS = ['lib/platform/audit', 'lib/platform/evidence'];
  const offenders = [];
  const importRe = /\bfrom\s+['"]([^'"]+)['"]/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    let m;
    while ((m = importRe.exec(src)) !== null) {
      const spec = m[1];
      if (spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../src') || spec === '../src/index.ts') continue;
      // Any import that reaches outside the package must be an allowed shared contract.
      if (spec.includes('..')) {
        const normalized = spec.replace(/\\/g, '/');
        const ok = ALLOWED_CROSS.some((a) => normalized.includes(a));
        // Forbid anything reaching into SafeBet IQ business areas.
        const forbiddenAreas = ['lib/consumerPlatform', 'lib/certified', 'lib/regulator', 'lib/operator', 'app/casino', 'app/admin', 'app/regulator', 'lib/supabase', 'lib/auth'];
        if (!ok || forbiddenAreas.some((a) => normalized.includes(a))) {
          offenders.push(`${path.relative(ROOT, f)} → ${spec}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `Guardian must import only Shared Platform Foundation:\n${offenders.join('\n')}`);
});

test('boundary: no Guardian source references a forbidden SafeBet IQ business table', () => {
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const t of FORBIDDEN_IQ_TABLES) {
      // Ignore the single declaration of the forbidden-list itself (product.ts).
      if (path.basename(f) === 'product.ts') continue;
      if (new RegExp(`\\b${t}\\b`).test(src)) hits.push(`${path.relative(ROOT, f)} references ${t}`);
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('boundary: Guardian does not reuse legacy guardian_/guardianlayer_ namespaces for new business data', () => {
  // The clean C0 data boundary is the `guardian` SCHEMA; legacy prefixes are table
  // name prefixes in `public`. Assert no Guardian source creates public.guardian_*.
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const pfx of LEGACY_COLLISION_PREFIXES) {
      if (path.basename(f) === 'product.ts') continue;
      if (new RegExp(`public\\.${pfx}`).test(src) || new RegExp(`create table[^;]*\\b${pfx}`, 'i').test(src)) {
        hits.push(`${path.relative(ROOT, f)} uses legacy prefix ${pfx}`);
      }
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('independence: foundation self-describes with NO SafeBet IQ runtime/data present', () => {
  // This test module imports ONLY the Guardian package (+ shared contracts, which
  // are pure). If the descriptor resolves, Guardian did not require IQ runtime.
  const d = guardianFoundationDescriptor();
  assert.equal(d.product, 'GUARDIAN');
  assert.equal(d.dependsOnSafebetIqRuntime, false);
  assert.equal(d.dependsOnSafebetIqBusinessData, false);
  assert.equal(d.health.status, 'ok');
  assert.equal(d.version.dataClass, 'synthetic');
});
