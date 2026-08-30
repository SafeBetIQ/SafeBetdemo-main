// UAT-OP-5S — all-casino synthetic Self-Exclusion seed: registry-driven, safe, idempotent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const file = readdirSync(migDir).find((f) => f.includes('seed_all_demo_self_exclusions'));
const sql = file ? readFileSync(join(migDir, file), 'utf8') : '';
const low = sql.toLowerCase();

test('all-casino seed migration exists', () => assert.ok(file));

test('registry-driven: seeds for EVERY casino (not a hard-coded subset)', () => {
  assert.match(low, /from public\.casinos/);
  assert.match(low, /cross join tpl/);
});

test('5 record templates covering the four statuses', () => {
  for (const s of ['active', 'expired', 'lifted', 'breached']) assert.ok(low.includes(`'${s}'`), `status ${s}`);
  // two active templates (2 active per casino)
  const activeCount = (low.match(/'active'/g) || []).length;
  assert.ok(activeCount >= 2, 'at least two active templates');
});

test('idempotent + deterministic ids (ON CONFLICT DO NOTHING, computed uuid)', () => {
  assert.match(low, /on conflict \(id\) do nothing/);
  assert.match(low, /to_hex\(c\.ord\)/);
  assert.match(low, /5eb0/); // id namespace distinct from 20260830100000 (5e000001…)
});

test('new-seed INSERT ids do not collide with the first seed (5e000001…) namespace', () => {
  // first-seed ids appear ONLY in the reconciliation DELETE, never in the INSERT
  const insertPart = low.slice(low.indexOf('insert into public.self_exclusions'));
  assert.doesNotMatch(insertPart, /5e000001-0000-4000-a000/);
  assert.match(insertPart, /5eb0/);
});

test('Demo-environment guard aborts outside Demo (known Demo casinos must exist)', () => {
  assert.match(low, /raise exception/);
  assert.match(sql, /cc000003-0000-0000-0000-000000000003/);
  assert.match(sql, /a1b2c3d4-0000-0000-0000-000000000001/); // Prestige
});

test('post-seed coverage flag for casinos below 4 records', () => {
  assert.match(low, /< 4/);
  assert.match(low, /raise notice/);
});

test('clearly synthetic; no real PII', () => {
  assert.match(sql, /SB-DEMO-SEXCL-C/);
  assert.match(low, /synthetic demo/);
  assert.doesNotMatch(sql, /@/); // no emails
  // non-clinical wording
  assert.doesNotMatch(low, /addict|diagnos|mental illness/);
});

test('no RLS / schema / grant / ownership change; only insert + the exact-id reconciliation delete', () => {
  assert.match(low, /insert into public\.self_exclusions/);
  assert.doesNotMatch(low, /alter table|create policy|drop policy|alter function|grant |revoke |security definer|create table|drop table/);
  // no UPDATE at all; the only DELETE is the exact-id reconciliation (asserted elsewhere)
  assert.doesNotMatch(low, /update public\.self_exclusions/);
});

test('no Production seed path (never references the prod project ref)', () => {
  assert.doesNotMatch(low, /ilibvipqbkugqkppzdmh/);
});

test('player/casino alignment: casino_id comes from the registry row, token is per-casino', () => {
  assert.match(low, /c\.casino_id/);
  assert.match(sql, /'SB-DEMO-SEXCL-C' \|\| c\.ord/);
});

// ── UAT-OP-5S2 reconciliation with the first (merged) seed 20260830100000 ──
test('reconciles the first seed by its SIX EXACT ids (so the sequence yields 5/casino, not 10/6)', () => {
  assert.match(low, /delete from public\.self_exclusions/);
  for (let i = 1; i <= 6; i++) {
    assert.ok(sql.includes(`'5e000001-0000-4000-a000-00000000000${i}'`), `deletes exact first-seed id ${i}`);
  }
});

test('reconciliation delete is EXACT-ID only — never a broad predicate (no non-seed row can be hit)', () => {
  const deletes = (low.match(/delete from/g) || []).length;
  assert.equal(deletes, 1, 'exactly one delete');
  // isolate the DELETE statement (delete … ;) and assert on it alone
  const stmt = (low.match(/delete from public\.self_exclusions[\s\S]*?;/) || [''])[0];
  assert.match(stmt, /where id in \(/);
  assert.doesNotMatch(stmt, /\blike\b|\breason\b|casino_id\s*=|status\s*=|where true|duration_type/);
  assert.doesNotMatch(stmt, /5eb0/); // does not touch the new-seed rows
  // exactly six exact ids targeted
  assert.equal((stmt.match(/5e000001-0000-4000-a000-0000000000/g) || []).length, 6);
});

test('reconciliation delete is harmless if the first-seed rows are absent (idempotent)', () => {
  // exact-id delete + ON CONFLICT insert => re-runnable to the same 30-row state
  assert.match(low, /on conflict \(id\) do nothing/);
});
