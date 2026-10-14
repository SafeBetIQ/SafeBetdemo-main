// SafeBet IQ — B11: STATIC assertions over the migration SQL + runtime write guard (no DB).
//   node --test tests/b11CloseFollowUpRequirementMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SQL = readFileSync(join(root, 'supabase', 'migrations', '20261013130000_b11_close_follow_up_requirement.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('RPC-only: no table/column/index/trigger/enum/cron created', () => {
  absent(/create table/); absent(/create index/); absent(/create trigger/);
  absent(/create type/); absent(/alter table/); absent(/cron\./);
  absent(/add column|drop column|add constraint|drop constraint/);
});

test('SECURITY DEFINER fn with exact signature, pinned search_path, DB-side digest, no dynamic SQL', () => {
  has(/create function public\.sbiq_b11_close_follow_up_requirement\(\s*p_intervention_id uuid,\s*p_casino_id\s+uuid,\s*p_actor_id\s+uuid,\s*p_idempotency_key uuid\s*\)/);
  has(/returns table\(status text\)/);
  has(/security definer/);
  has(/set search_path = pg_catalog, public/);
  has(/extensions\.digest\(/);
  absent(/execute\s+format|execute\s+'|execute\s+"/);
});

test('fn accepts only the 4 governed args (no state/role/fingerprint inputs)', () => {
  const params = (SQL.match(/sbiq_b11_close_follow_up_requirement\(([\s\S]*?)\)\s*returns/i) || [])[1] || '';
  assert.ok(!/player_id|\brole\b|staff_id|follow_up_required|follow_up_date|outcome|reason|notes|source|fingerprint/i.test(params), 'no server/DB-owned args accepted');
  assert.ok(/p_idempotency_key uuid/i.test(params));
});

test('EXECUTE: service_role only; revoked from public/anon/authenticated; no generic UPDATE grant', () => {
  has(/revoke all\s+on function public\.sbiq_b11_close_follow_up_requirement\([^)]*\) from public/);
  has(/revoke execute on function public\.sbiq_b11_close_follow_up_requirement\([^)]*\) from anon/);
  has(/revoke execute on function public\.sbiq_b11_close_follow_up_requirement\([^)]*\) from authenticated/);
  has(/grant\s+execute on function public\.sbiq_b11_close_follow_up_requirement\([^)]*\) to service_role/);
  absent(/grant[^;]*update[^;]*to service_role/);
  absent(/grant[^;]*on table/);
});

test('deterministic event_id + fingerprint over original request only', () => {
  has(/'b11:follow-up-close:'\s*\|\|\s*p_casino_id::text\s*\|\|\s*':'\s*\|\|\s*p_idempotency_key::text/);
  has(/'b11v1'[\s\S]*p_casino_id::text[\s\S]*p_intervention_id::text[\s\S]*p_actor_id::text/);
  // fingerprint must NOT fold in mutable state
  const fp = (sql.match(/'b11v1'([\s\S]*?)'utf8'/) || [])[1] || '';
  assert.ok(!/follow_up_required|follow_up_date|now\(\)|v_date/.test(fp), 'fingerprint excludes mutable state');
});

test('exact one-way mutation only: requirement false + date null; no other field', () => {
  has(/set follow_up_required = false, follow_up_date = null/);
  absent(/set follow_up_required = true/);         // no reopen
  absent(/set outcome|set intervention_type|set staff_id|set source|set channel|set dispatch_status/);
  absent(/update public\.intervention_follow_up_events|update public\.alert_intervention_links|update public\.player_protection_alerts/);
});

test('atomic close+audit in one exception subtransaction; event + snapshot metadata', () => {
  has(/intervention\.follow_up_requirement_closed/);
  has(/for update/);
  has(/exception when unique_violation/);
  // the UPDATE and audit INSERT must be inside the same begin/exception block
  const block = (SQL.match(/\bbegin\s+update public\.player_protection_interventions[\s\S]*?exception when unique_violation/i) || [])[0] || '';
  assert.ok(/insert into public\.audit_events/i.test(block), 'UPDATE + audit INSERT must share the exception subtransaction');
  has(/'old_follow_up_date', v_date/);
  has(/'request_fingerprint', v_fp/);
  // audit metadata carries no PII
  const meta = (sql.match(/jsonb_build_object\(([\s\S]*?)\)\)/) || [])[1] || '';
  assert.ok(!/player_id|staff_id|risk|outcome|notes|message/.test(meta), 'audit metadata PII-free');
});

test('firewall: no reopen / completion / closure-status / cross-milestone change / ledger SQL', () => {
  absent(/reopen|follow_up_completed|obligation_closed|case_closed|\bsuccessful\b|effectiveness|risk_reduced/);
  absent(/schema_migrations/);
  absent(/federation|federated/);
  absent(/projection_financial_posture|sbiq_certified_financial/);
  absent(/sbiq_b8_set_follow_up|sbiq_b9_record|sbiq_b10_record|sbiq_b6_|governance_evidence/);
  absent(/create policy|enable row level security|force row level security/);  // no RLS object changes
});

test('B11 runtime server never issues a direct intervention UPDATE (RPC-only mutation)', () => {
  const srv = readFileSync(join(root, 'lib', 'responsibleProfitability', 'followUpRequirementClosureServer.ts'), 'utf8');
  assert.ok(/\.rpc\('sbiq_b11_close_follow_up_requirement'/.test(srv), 'must mutate via the DEFINER RPC');
  assert.ok(!/\.(update|upsert|insert|delete)\(/.test(srv.replace(/\/\/[^\n]*/g, '')), 'server must not call update/upsert/insert/delete');
});

test('route authorises before business validation (no validation oracle pre-auth)', () => {
  const route = readFileSync(join(root, 'app', 'api', 'casino', 'interventions', '[id]', 'close-follow-up-requirement', 'route.ts'), 'utf8');
  const post = route.slice(route.indexOf('export async function POST'));
  const authIdx = post.indexOf('resolveAlertAccess(req');
  const idemIdx = post.indexOf('parseIdempotencyKey(req');
  const bodyIdx = post.indexOf('parseEmptyBody(body');
  assert.ok(authIdx > -1 && idemIdx > authIdx && bodyIdx > authIdx, 'auth must precede idempotency/body validation');
});
