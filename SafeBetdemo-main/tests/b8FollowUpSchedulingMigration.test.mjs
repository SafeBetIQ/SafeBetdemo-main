// SafeBet IQ — B8: STATIC assertions over the migration SQL (always run; no DB).
//   node --test tests/b8FollowUpSchedulingMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'supabase', 'migrations', '20261006120000_b8_follow_up_scheduling.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');          // comment-stripped for "absent" checks
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('removes the legacy authenticated ALL write policy', () => {
  has(/drop policy if exists "casino admins can manage their casino interventions" on public\.player_protection_interventions/);
});

test('revokes authenticated write privileges (keeps SELECT)', () => {
  has(/revoke insert, update, delete, truncate, references, trigger, maintain\s+on table public\.player_protection_interventions from authenticated/);
  absent(/grant[^;]*(insert|update|delete)[^;]*to authenticated/);
});

test('service_role REVOKE ALL then SELECT/INSERT/DELETE only (no UPDATE/TRUNCATE)', () => {
  has(/revoke all privileges on table public\.player_protection_interventions from service_role/);
  has(/grant select, insert, delete on table public\.player_protection_interventions to service_role/);
  absent(/grant[^;]*update[^;]*to service_role/);
  absent(/grant[^;]*truncate[^;]*to service_role/);
});

test('enables + forces RLS', () => {
  has(/enable row level security/);
  has(/force\s+row level security/);
});

test('adds the follow-up consistency CHECK', () => {
  has(/check \(follow_up_required is true or follow_up_date is null\)/);
});

test('creates the SECURITY DEFINER scheduling function with safe search_path, no dynamic SQL', () => {
  has(/create function public\.sbiq_b8_set_follow_up\(/);
  has(/security definer/);
  has(/set search_path = pg_catalog, public/);
  absent(/execute\s+format|execute\s+'|execute\s+"/);   // no dynamic SQL
});

test('function EXECUTE: service_role only; revoked from public/anon/authenticated', () => {
  has(/revoke all on function public\.sbiq_b8_set_follow_up\([^)]*\) from public/);
  has(/revoke execute on function public\.sbiq_b8_set_follow_up\([^)]*\) from anon/);
  has(/revoke execute on function public\.sbiq_b8_set_follow_up\([^)]*\) from authenticated/);
  has(/grant  ?execute on function public\.sbiq_b8_set_follow_up\([^)]*\) to service_role/);
});

test('emits the three locked audit actions; safe metadata only', () => {
  has(/intervention\.follow_up_scheduled/);
  has(/intervention\.follow_up_rescheduled/);
  has(/intervention\.follow_up_unscheduled/);
  has(/old_follow_up_date/); has(/new_follow_up_date/);
  absent(/jsonb_build_object\([^)]*player_id/);
});

test('only follow_up_date is updated (no other column in the UPDATE SET)', () => {
  has(/set follow_up_date = v_new/);
  // an UPDATE … SET assigning any of these columns would read "set <col>" — WHERE predicates
  // like "casino_id =" are not preceded by SET, so these literal checks are precise.
  absent(/set\s+follow_up_required\b/);
  absent(/set\s+casino_id\b/);
  absent(/set\s+player_id\b/);
  absent(/set\s+outcome\b/);
});

test('no new table/view/enum/cron; no TO-postgres policy; no unrelated mutation', () => {
  absent(/create table/);
  absent(/create view|create materialized view/);
  absent(/create type/);
  absent(/cron\./);
  absent(/create policy[^;]*to postgres/);          // postgres bypasses RLS — no owner policy needed
  absent(/schema_migrations/);
  absent(/federation|federated/);
  absent(/projection_financial_posture|sbiq_certified_financial/);
  absent(/sbiq_ppa_|alert_intervention_links|governance_evidence/);   // no B4.1/B6/B5 object mutation
});
