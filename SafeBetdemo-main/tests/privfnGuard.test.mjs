import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMigrationSql, scanMigrations, loadBaseline } from '../scripts/ci/privfn-guard.mjs';

const allowlist = new Set(['sbiq_may_access_chain_scope']);

test('privfn-guard: flags a new PUBLIC grant on a non-allowlisted function', () => {
  const sql = `grant execute on function public.some_new_fn(uuid) to public;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.equal(v.length, 1);
  assert.match(v[0], /some_new_fn/);
  assert.match(v[0], /PUBLIC/);
});

test('privfn-guard: flags a new anon grant on a non-allowlisted function', () => {
  const sql = `grant execute on function leak_fn(text) to anon;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.equal(v.length, 1);
  assert.match(v[0], /anon/);
});

test('privfn-guard: allows PUBLIC/anon grant on the allowlisted RLS predicate', () => {
  const sql = `grant execute on function public.sbiq_may_access_chain_scope(text) to anon;
               grant execute on function sbiq_may_access_chain_scope(text) to public;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.deepEqual(v, []);
});

test('privfn-guard: allows service_role / authenticated grants (not broad)', () => {
  const sql = `grant execute on function public.fn(uuid) to service_role;
               grant execute on function public.fn(uuid) to authenticated;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.deepEqual(v, []);
});

test('privfn-guard: REVOKE from public/anon is never a violation', () => {
  const sql = `revoke execute on function public.fn(uuid) from public, anon, authenticated;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.deepEqual(v, []);
});

test('privfn-guard: flags a new SECURITY DEFINER function without SET search_path', () => {
  const sql = `create or replace function public.risky() returns void
               language plpgsql security definer as $$ begin end; $$;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.equal(v.length, 1);
  assert.match(v[0], /search_path/);
});

test('privfn-guard: accepts a SECURITY DEFINER function that pins search_path', () => {
  const sql = `create or replace function public.safe() returns void
               language plpgsql security definer set search_path = public, pg_temp
               as $$ begin end; $$;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.deepEqual(v, []);
});

test('privfn-guard: ignores commented-out dangerous SQL', () => {
  const sql = `-- grant execute on function public.commented(uuid) to public;
               /* grant execute on function blocked(uuid) to anon; */
               select 1;`;
  const v = analyzeMigrationSql(sql, { allowlist });
  assert.deepEqual(v, []);
});

test('privfn-guard: baseline file loads with the RLS predicate allowlisted', () => {
  const b = loadBaseline();
  assert.ok(b.allowlist.has('sbiq_may_access_chain_scope'));
  assert.match(b.baselineVersion, /^\d+$/);
});

test('privfn-guard: current repository migrations pass the guard (no post-baseline violations)', () => {
  const { findings } = scanMigrations();
  assert.deepEqual(findings, [], `unexpected privileged-function violations:\n${findings.join('\n')}`);
});
