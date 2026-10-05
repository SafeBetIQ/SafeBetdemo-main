// SafeBet IQ — B6: STATIC assertions over the migration SQL (always run; no DB needed).
// Locks the reviewed shape: source composite UNIQUEs, two composite FKs, RESTRICT (no
// CASCADE), RLS enable+force, service_role REVOKE-ALL then SELECT/INSERT/UPDATE only,
// no DELETE/TRUNCATE, no anon/authenticated grants, no SECURITY DEFINER, DB-owned
// timestamps, active-pair + single-successor partial uniques, audit events, and that it
// neither mutates migration history nor touches federation / certified-financial objects.
//   node --test tests/protectionActionTraceabilityMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(here, '..', 'supabase', 'migrations', '20261005120000_b6_protection_action_traceability.sql'), 'utf8');
const sql = SQL.toLowerCase();
// Comment-stripped view for "must-be-absent" checks that could be tripped by explanatory
// comments (e.g. "No SECURITY DEFINER", "no CASCADE").
const code = sql.replace(/--[^\n]*/g, '');
const absentInCode = (re) => assert.ok(!re.test(code), `expected migration CODE NOT to match ${re}`);
const has = (re) => assert.ok(re.test(SQL), `expected migration to match ${re}`);
const hasL = (re) => assert.ok(re.test(sql), `expected migration to match ${re}`);
const absent = (re) => assert.ok(!re.test(sql), `expected migration NOT to match ${re}`);

test('source-side composite UNIQUE(id, casino_id, player_id) on BOTH source tables', () => {
  has(/alter table public\.player_protection_alerts[\s\S]*?unique\s*\(id,\s*casino_id,\s*player_id\)/i);
  has(/alter table public\.player_protection_interventions[\s\S]*?unique\s*\(id,\s*casino_id,\s*player_id\)/i);
});

test('creates the dedicated alert_intervention_links table (not reusing alerts.intervention_id)', () => {
  has(/create table public\.alert_intervention_links/i);
  // never ADDs/repurposes an intervention_id column on the alerts table (single-statement scope)
  absentInCode(/alter table public\.player_protection_alerts[^;]*add[^;]*intervention_id/i);
});

test('two composite FKs referencing (id, casino_id, player_id)', () => {
  has(/foreign key \(alert_id,\s*casino_id,\s*player_id\)\s*references public\.player_protection_alerts \(id,\s*casino_id,\s*player_id\)/i);
  has(/foreign key \(intervention_id,\s*casino_id,\s*player_id\)\s*references public\.player_protection_interventions \(id,\s*casino_id,\s*player_id\)/i);
});

test('all FK relationships are ON UPDATE RESTRICT ON DELETE RESTRICT; no CASCADE', () => {
  const restricts = sql.match(/on update restrict on delete restrict/g) ?? [];
  assert.ok(restricts.length >= 5, `expected >=5 RESTRICT/RESTRICT FKs, got ${restricts.length}`);
  absent(/cascade/);
});

test('player_id present as internal integrity key', () => {
  hasL(/player_id\s+uuid not null/);
});

test('active-pair + single-successor partial unique indexes', () => {
  has(/create unique index ail_active_pair_uq[\s\S]*?\(alert_id,\s*intervention_id\)[\s\S]*?where superseded_at is null/i);
  has(/create unique index ail_single_successor_uq[\s\S]*?\(supersedes_link_id\)[\s\S]*?where supersedes_link_id is not null/i);
});

test('no-self-supersession + superseded pairing CHECKs', () => {
  hasL(/check \(supersedes_link_id is null or supersedes_link_id <> id\)/);
  hasL(/check \(\(superseded_at is null\) = \(superseded_by is null\)\)/);
});

test('DB owns timestamps (default now + trigger overwrite)', () => {
  hasL(/linked_at\s+timestamptz not null default now\(\)/);
  hasL(/created_at\s+timestamptz not null default now\(\)/);
  hasL(/new\.linked_at\s*:=\s*now\(\)/);
  hasL(/new\.created_at\s*:=\s*now\(\)/);
});

test('guard + after-insert triggers exist and are SECURITY INVOKER (no DEFINER)', () => {
  has(/create function public\.sbiq_b6_link_guard\(\)/i);
  has(/create function public\.sbiq_b6_link_after_insert\(\)/i);
  has(/create trigger trg_b6_link_guard\s+before insert or update/i);
  has(/create trigger trg_b6_link_after_insert\s+after insert/i);
  absentInCode(/security definer/);
});

test('emits the two governed audit actions into the existing chain; safe metadata only', () => {
  hasL(/protection_alert\.intervention_linked/);
  hasL(/protection_alert\.intervention_link_superseded/);
  hasL(/insert into public\.audit_events/);
  hasL(/'alert_intervention_link'/);
  // audit metadata carries only governed refs — never player_id/pii/free text
  absent(/jsonb_build_object\([^)]*player_id/);
});

test('RLS enabled AND forced', () => {
  hasL(/enable row level security/);
  hasL(/force\s+row level security/);
});

test('service_role REVOKE ALL then SELECT/INSERT/UPDATE only; no DELETE/TRUNCATE; no anon/authenticated grants', () => {
  hasL(/revoke all privileges on public\.alert_intervention_links from service_role/);
  hasL(/grant select, insert, update on public\.alert_intervention_links to service_role/);
  absent(/grant[^;]*delete[^;]*alert_intervention_links/);
  absent(/grant[^;]*truncate/);
  absent(/grant[^;]*on public\.alert_intervention_links to anon/);
  absent(/grant[^;]*on public\.alert_intervention_links to authenticated/);
  hasL(/revoke all privileges on public\.alert_intervention_links from anon/);
  hasL(/revoke all privileges on public\.alert_intervention_links from authenticated/);
});

test('trigger function execute revoked from public', () => {
  hasL(/revoke all on function public\.sbiq_b6_link_guard\(\) from public/);
  hasL(/revoke all on function public\.sbiq_b6_link_after_insert\(\) from public/);
});

test('does NOT mutate migration history, federation, or certified-financial objects', () => {
  absent(/schema_migrations/);
  absent(/db push|migration up|migration repair|reconcile/);
  absent(/federation|federated/);
  absent(/projection_financial_posture|certified_financial|sbiq_certified_financial/);
  // B4.1 lifecycle/trigger objects are not altered
  absent(/drop .*player_protection_alerts/);
  absent(/sbiq_ppa_/);
});
