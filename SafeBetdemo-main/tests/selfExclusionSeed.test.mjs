// UAT-OP-5 — synthetic Self-Exclusion seed is idempotent, Demo-scoped, safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const file = readdirSync(migDir).find((f) => f.includes('seed_demo_self_exclusions'));
const sql = file ? readFileSync(join(migDir, file), 'utf8') : '';

test('seed migration exists', () => assert.ok(file, 'seed_demo_self_exclusions migration present'));

test('idempotent (ON CONFLICT DO NOTHING on fixed ids)', () => {
  assert.match(sql.toLowerCase(), /on conflict \(id\) do nothing/);
});

test('inserts only into self_exclusions (no schema/RLS/other-table change, no write feature)', () => {
  assert.match(sql.toLowerCase(), /insert into public\.self_exclusions/);
  assert.doesNotMatch(sql.toLowerCase(), /alter table|create policy|drop policy|update public|delete from/);
});

test('Demo-scoped: only Demo casino ids (cc0000..), and a second casino to prove cross-casino scoping', () => {
  assert.match(sql, /cc000003-0000-0000-0000-000000000003/); // Betway
  assert.match(sql, /cc000001-0000-0000-0000-000000000001/); // SunBet (different operator)
});

test('clearly synthetic: SB-DEMO-SEXCL references + "synthetic demo" reasons, no real PII', () => {
  assert.match(sql, /SB-DEMO-SEXCL-/);
  assert.match(sql.toLowerCase(), /synthetic demo/);
  assert.doesNotMatch(sql, /@/); // no email addresses
});

test('covers the four supported statuses', () => {
  for (const s of ['active', 'expired', 'lifted', 'breached']) {
    assert.ok(sql.includes(`'${s}'`), `status ${s} seeded`);
  }
});

test('no Production seed path (migration is Demo-lineage; casino FK is the guard)', () => {
  // The self-exclusion page is read-only; the seed is the only data path and it
  // targets Demo casinos that do not exist in the unrelated Production DB.
  assert.doesNotMatch(sql.toLowerCase(), /ilibvipqbkugqkppzdmh/); // never references prod ref
});
