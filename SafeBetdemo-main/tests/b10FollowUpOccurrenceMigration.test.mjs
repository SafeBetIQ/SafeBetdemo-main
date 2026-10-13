// SafeBet IQ — B10: STATIC assertions over the migration SQL + runtime write guard (no DB).
//   node --test tests/b10FollowUpOccurrenceMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SQL = readFileSync(join(root, 'supabase', 'migrations', '20261013120000_b10_follow_up_occurrence.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('creates the append-only occurrence table with exact columns', () => {
  has(/create table public\.intervention_follow_up_events/);
  for (const c of ['id', 'casino_id', 'intervention_id', 'player_id', 'scheduled_follow_up_date', 'occurred_on', 'recorded_at', 'recorded_by', 'b10_idempotency_key', 'b10_request_fingerprint']) {
    has(new RegExp(`\\b${c}\\b`));
  }
  has(/occurred_on\s+date\s+not null/);
  has(/recorded_at\s+timestamptz not null default now\(\)/);
  has(/b10_idempotency_key\s+uuid\s+not null/);
  has(/b10_request_fingerprint\s+text\s+not null/);
});

test('composite intervention identity FK + recorded_by FK (RESTRICT)', () => {
  has(/foreign key \(intervention_id, casino_id, player_id\)\s*references public\.player_protection_interventions \(id, casino_id, player_id\)\s*on update restrict on delete restrict/);
  has(/foreign key \(recorded_by\) references public\.users \(id\)\s*on update restrict on delete restrict/);
});

test('casino-scoped idempotency UNIQUE + access-path indexes', () => {
  has(/unique \(casino_id, b10_idempotency_key\)/);
  has(/create index iffe_history_idx on public\.intervention_follow_up_events \(casino_id, intervention_id, occurred_on desc\)/);
  has(/create index iffe_period_idx\s+on public\.intervention_follow_up_events \(casino_id, occurred_on\)/);
});

test('RLS enabled + forced; no client policies', () => {
  has(/enable row level security/);
  has(/force  ?row level security/);
  absent(/create policy/);
});

test('table privileges: service_role SELECT only; no client access; no write grants', () => {
  has(/revoke all on table public\.intervention_follow_up_events from service_role/);
  has(/grant  ?select on table public\.intervention_follow_up_events to service_role/);
  absent(/grant[^;]*insert[^;]*to service_role/);
  absent(/grant[^;]*update[^;]*to service_role/);
  absent(/grant[^;]*delete[^;]*to service_role/);
  absent(/to authenticated/);
  absent(/grant[^;]*to anon/);
});

test('SECURITY DEFINER fn: pinned search_path, no dynamic SQL, DB-side digest, fingerprint not a param', () => {
  has(/create function public\.sbiq_b10_record_follow_up_occurrence\(/);
  has(/security definer/);
  has(/set search_path = pg_catalog, public/);
  has(/extensions\.digest\(/);
  absent(/execute\s+format|execute\s+'|execute\s+"/);
  const params = (SQL.match(/sbiq_b10_record_follow_up_occurrence\(([\s\S]*?)\)\s*returns/i) || [])[1] || '';
  assert.ok(!/fingerprint/i.test(params), 'fingerprint must be computed in-DB');
  assert.ok(/p_idempotency_key\s+uuid/i.test(params) && /p_occurred_on\s+date/i.test(params));
  assert.ok(!/player_id|follow_up_date|follow_up_required|recorded_at|recorded_by|outcome|source/i.test(params), 'no server/DB-owned args accepted');
});

test('EXECUTE: service_role only; revoked from public/anon/authenticated', () => {
  has(/revoke all\s+on function public\.sbiq_b10_record_follow_up_occurrence\([^)]*\) from public/);
  has(/revoke execute on function public\.sbiq_b10_record_follow_up_occurrence\([^)]*\) from anon/);
  has(/revoke execute on function public\.sbiq_b10_record_follow_up_occurrence\([^)]*\) from authenticated/);
  has(/grant\s+execute on function public\.sbiq_b10_record_follow_up_occurrence\([^)]*\) to service_role/);
});

test('atomic occurrence + audit; occurrence-only event; safe metadata (no PII)', () => {
  has(/insert into public\.intervention_follow_up_events/);
  has(/intervention\.follow_up_recorded/);
  has(/'intervention_follow_up_event'/);
  has(/on conflict \(casino_id, b10_idempotency_key\) do nothing/);
  const meta = (sql.match(/jsonb_build_object\(([\s\S]*?)\)\)/) || [])[1] || '';
  assert.ok(!/player_id|recorded_by|idempotency|fingerprint|risk/.test(meta), 'audit metadata must be PII-free');
});

test('occurrence table has NO completion/outcome/closure/success/supersedes column', () => {
  // scope the word-ban to the CREATE TABLE column block (the audit INSERT legitimately uses
  // the audit_events.outcome column + the literal 'success' and must not trip this guard).
  const block = (sql.match(/create table public\.intervention_follow_up_events \(([\s\S]*?)\n\);/) || [])[1] || '';
  assert.ok(block.length > 0, 'table block found');
  assert.ok(!/\bcompleted\b|completion|obligation_closed|follow_up_completed|closure|\bsuccess\b|\boutcome\b|supersedes_id|\bstatus\b/.test(block), 'no completion/outcome/closure column');
});

test('append-only firewall: no scheduling mutation; no cross-milestone change', () => {
  absent(/update public\.player_protection_interventions/);
  absent(/set follow_up_required|set follow_up_date/);
  absent(/create type|cron\./);
  absent(/schema_migrations/);
  absent(/federation|federated/);
  absent(/projection_financial_posture|sbiq_certified_financial/);
  absent(/sbiq_b8_set_follow_up|sbiq_b9_record|sbiq_b6_|sbiq_ppa_|governance_evidence|alert_intervention_links/);
  absent(/create trigger[^;]*player_protection_interventions/);
});

test('B10 runtime server code never writes the table directly (RPC-only mutation)', () => {
  const srv = readFileSync(join(root, 'lib', 'responsibleProfitability', 'followUpOccurrenceServer.ts'), 'utf8');
  assert.ok(/\.rpc\('sbiq_b10_record_follow_up_occurrence'/.test(srv), 'must mutate via the DEFINER RPC');
  assert.ok(!/\.(insert|update|delete|upsert)\(/.test(srv.replace(/\/\/[^\n]*/g, '')), 'server must not call insert/update/delete/upsert');
});

test('route authorises before business validation (no validation oracle pre-auth)', () => {
  const route = readFileSync(join(root, 'app', 'api', 'casino', 'interventions', '[id]', 'follow-up-occurrences', 'route.ts'), 'utf8');
  // compare CALL sites (not the import line) inside the POST handler.
  const post = route.slice(route.indexOf('export async function POST'));
  const authIdx = post.indexOf('resolveAlertAccess(req');
  const idemIdx = post.indexOf('parseIdempotencyKey(req');
  const bodyIdx = post.indexOf('parseOccurrenceBody(body');
  assert.ok(authIdx > -1 && idemIdx > authIdx && bodyIdx > authIdx, 'auth must precede idempotency/body validation');
});
