// SafeBet IQ — B9: STATIC assertions over the migration SQL (always run; no DB).
//   node --test tests/b9InterventionRecordingMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'supabase', 'migrations', '20261011120000_b9_governed_intervention_recording.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('relaxes trigger_reason + action_taken NOT NULL', () => {
  has(/alter column trigger_reason drop not null/);
  has(/alter column action_taken\s+drop not null/);
});

test('adds idempotency key + fingerprint columns', () => {
  has(/add column b9_idempotency_key\s+uuid/);
  has(/add column b9_request_fingerprint text/);
});

test('pairing CHECK + casino-scoped UNIQUE', () => {
  has(/check \(\(b9_idempotency_key is null\) = \(b9_request_fingerprint is null\)\)/);
  has(/unique \(casino_id, b9_idempotency_key\)/);
});

test('SECURITY DEFINER fn with pinned search_path, no dynamic SQL, DB-side digest', () => {
  has(/create function public\.sbiq_b9_record_alert_intervention\(/);
  has(/security definer/);
  has(/set search_path = pg_catalog, public/);
  has(/extensions\.digest\(/);                         // DB-computed fingerprint (fully-qualified)
  absent(/execute\s+format|execute\s+'|execute\s+"/);  // no dynamic SQL
});

test('fingerprint is NOT an RPC parameter', () => {
  // parameter list must not contain a fingerprint argument
  const params = (SQL.match(/sbiq_b9_record_alert_intervention\(([\s\S]*?)\)\s*returns/i) || [])[1] || '';
  assert.ok(!/fingerprint/i.test(params), 'fingerprint must be computed in-DB, not passed in');
  assert.ok(/p_idempotency_key\s+uuid/i.test(params));
});

test('EXECUTE: service_role only; revoked from public/anon/authenticated', () => {
  has(/revoke all on function public\.sbiq_b9_record_alert_intervention\([^)]*\) from public/);
  has(/revoke execute on function public\.sbiq_b9_record_alert_intervention\([^)]*\) from anon/);
  has(/revoke execute on function public\.sbiq_b9_record_alert_intervention\([^)]*\) from authenticated/);
  has(/grant  ?execute on function public\.sbiq_b9_record_alert_intervention\([^)]*\) to service_role/);
});

test('honest insert profile literals present', () => {
  has(/source[\s\S]*'manual'/);
  has(/'manual'/);                                     // channel + source both manual
  has(/auto_triggered/); has(/false/);
  // intervention_successful neutralised to NULL (not default true): the values list sets it null
  has(/intervention_successful, auto_triggered, channel/);
});

test('alert-derived: no caller player/casino write; recorded audit + B6 link', () => {
  has(/from public\.player_protection_alerts/);
  has(/intervention\.recorded/);
  has(/insert into public\.alert_intervention_links/);
  // audit metadata carries no player_id
  absent(/jsonb_build_object\([^)]*player_id/);
});

test('does NOT widen global type CHECK / weaken B8 / touch other milestones', () => {
  absent(/drop constraint player_protection_interventions_intervention_type_check/);
  absent(/alter[^;]*intervention_type_check/);
  absent(/grant[^;]*update[^;]*to service_role/);      // no service_role UPDATE
  absent(/to authenticated/);                          // no authenticated grants
  absent(/force row level security|enable row level security/); // B8 RLS untouched
  absent(/create table/); absent(/create view|materialized view/); absent(/create type/); absent(/cron\./);
  absent(/schema_migrations/); absent(/federation|federated/);
  absent(/projection_financial_posture|sbiq_certified_financial/);
  absent(/sbiq_b8_set_follow_up|sbiq_b6_|sbiq_ppa_|governance_evidence/); // no B8/B6/B4.1/B5 object change
});
