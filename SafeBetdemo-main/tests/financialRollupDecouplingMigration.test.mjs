// SafeBet IQ — B-COUPLE-1: STATIC assertions over the financial-rollup ops decoupling migration.
//   node --test tests/financialRollupDecouplingMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'supabase', 'migrations', '20261018120000_financial_rollup_ops_decoupling.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');      // strip comments (header legitimately names the removed objects)
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const codeHas = (re) => assert.ok(re.test(code), `expected CODE match ${re}`);
const codeAbsent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('creates the generic ops objects', () => {
  codeHas(/create table if not exists public\.sbiq_financial_rollup_ops_state/);
  codeHas(/create table if not exists public\.sbiq_financial_rollup_ops_alerts/);
  codeHas(/create or replace function public\.sbiq_financial_rollup_raise_alert\(/);
});

test('generic ops_state is fail-safe disabled by default + single static config row', () => {
  codeHas(/enabled\s+boolean\s+not null default false/);
  codeHas(/insert into public\.sbiq_financial_rollup_ops_state \(id, enabled\) values \(1, false\)/);
});

test('the three generic functions are re-pointed to the generic ops objects', () => {
  for (const fn of ['sbiq_financial_rollup_refresh', 'sbiq_financial_rollup_watchdog', 'sbiq_financial_rollup_status']) {
    codeHas(new RegExp(`create or replace function public\\.${fn}\\(`));
  }
  codeHas(/enabled from sbiq_financial_rollup_ops_state where id=1/);
  codeHas(/sbiq_financial_rollup_raise_alert\('financial_rollup_late'/);
  codeHas(/sbiq_financial_rollup_raise_alert\('financial_rollup_failed'/);
  codeHas(/from sbiq_financial_rollup_ops_alerts where not resolved and category like 'financial_rollup%'/);
});

test('NO demo-sim coupling remains in executable SQL (decoupling proof)', () => {
  codeAbsent(/sbiq_demo_sim_flags/);
  codeAbsent(/sbiq_demo_raise_alert/);
  codeAbsent(/sbiq_demo_sim_alerts/);
  codeAbsent(/safebet-demo/);
  codeAbsent(/enable_financial_rollup/);     // the old demo flag key is gone
});

test('certified financial model + cron state untouched', () => {
  codeAbsent(/create or replace function public\.sbiq_certified_financial_posture_v2/);
  codeAbsent(/create or replace view public\.projection_financial_posture|create view public\.projection_financial_posture/);
  codeAbsent(/sbiq_financial_rollup_hourly\s*\(/);   // not redefining the rollup table
  codeAbsent(/cron\.schedule|alter job|update cron\.job set active|jobname='sbiq-financial-rollup-refresh'\s*,?\s*active\s*=\s*true/);
  // status() may READ cron.job.active (reporting only) — that is allowed:
  has(/exists\(select 1 from cron\.job where jobname='sbiq-financial-rollup-refresh' and active\)/);
});

test('security posture: forced RLS + service_role SELECT-only + definer emitter service_role EXECUTE-only', () => {
  codeHas(/alter table public\.sbiq_financial_rollup_ops_state\s+force\s+row level security/);
  codeHas(/alter table public\.sbiq_financial_rollup_ops_alerts\s+force\s+row level security/);
  codeHas(/grant select on table public\.sbiq_financial_rollup_ops_state\s+to service_role/);
  codeHas(/grant select on table public\.sbiq_financial_rollup_ops_alerts to service_role/);
  codeAbsent(/grant[^;]*insert[^;]*to (anon|authenticated|service_role)/);
  codeHas(/security definer/);
  codeHas(/grant\s+execute on function public\.sbiq_financial_rollup_raise_alert\([^)]*\) to service_role/);
  codeAbsent(/grant[^;]*\bto (public|anon|authenticated)\b/);   // no grant to public/anon/authenticated
});

test('does not drop the Demo simulator subsystem (Demo must keep functioning)', () => {
  codeAbsent(/drop (table|function|view)\b/);
});
