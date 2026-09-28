// SafeBet Guardian — PR2 cutover-readiness regression: the runtime uses the dedicated least-privilege
// guardian_* PostgreSQL roles (direct pg over the pooler), NOT the Supabase `authenticated` role via
// supabase-js/PostgREST. This guards the §3 decision to REVOKE `authenticated` from the guardian schema.
//   node --test tests/guardian/guardianRuntimeRoles.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const SRC = 'products/guardian/src';
const BIN = 'products/guardian/bin';

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('no Guardian runtime file uses supabase-js / PostgREST (no `authenticated`-role data path)', () => {
  const files = [...(existsSync(SRC) ? walk(SRC) : []), ...(existsSync(BIN) ? walk(BIN) : [])];
  assert.ok(files.length > 0, 'expected guardian source files');
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/@supabase\/supabase-js/.test(s), `${f} imports supabase-js`);
    assert.ok(!/\bcreateClient\s*\(/.test(s), `${f} uses supabase createClient()`);
    assert.ok(!/NEXT_PUBLIC_SUPABASE/.test(s), `${f} references NEXT_PUBLIC_SUPABASE`);
  }
});

test('every Guardian DB worker connects via a dedicated guardian_* least-privilege secret (not authenticated)', () => {
  const clients = readdirSync(BIN).filter((f) => f.endsWith('.ts') && readFileSync(`${BIN}/${f}`, 'utf8').includes("from 'pg'"));
  assert.equal(clients.length, 11, `expected 11 pg clients, found ${clients.length}`);
  for (const f of clients) {
    const s = readFileSync(`${BIN}/${f}`, 'utf8');
    // reads a secret id under safebet-guardian/ (per-role least-privilege credential), not an anon/authenticated key
    assert.ok(/safebet-guardian\//.test(s), `${f} does not read a safebet-guardian/* role secret`);
    assert.ok(!/\banon\b|service_role_key|SUPABASE_ANON/.test(s), `${f} references an anon/service_role key`);
  }
});
