// SafeBet IQ — B12: STATIC assertions over the migration SQL + runtime source guards (no DB).
//   node --test tests/b12OperatorNotificationsMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SQL = readFileSync(join(root, 'supabase', 'migrations', '20261014120000_b12_operator_notification_reads.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);

test('creates ONLY the read-state table (no persisted notifications table)', () => {
  has(/create table public\.operator_notification_reads/);
  absent(/create table public\.operator_notifications\b/);
  const creates = (code.match(/create table/g) || []).length;
  assert.equal(creates, 1, 'exactly one table');
});

test('read-state columns + PK + FKs (RESTRICT) + hex CHECK; no extra columns', () => {
  for (const c of ['casino_id', 'user_id', 'notification_id', 'read_at']) has(new RegExp(`\\b${c}\\b`));
  has(/primary key \(\s*casino_id,\s*user_id,\s*notification_id\s*\)/);
  has(/foreign key \(user_id\)\s*references public\.users\(id\)\s*on update restrict on delete restrict/);
  has(/foreign key \(casino_id\)\s*references public\.casinos\(id\)\s*on update restrict on delete restrict/);
  has(/check \(\s*notification_id ~ '\^\[0-9a-f\]\{64\}\$'\s*\)/);
  // scope the "no extra columns" guard to the CREATE TABLE block (the RPC legitimately
  // returns a `status` column, which must not trip this check).
  const block = (sql.match(/create table public\.operator_notification_reads \(([\s\S]*?)\n\);/) || [])[1] || '';
  assert.ok(block.length > 0, 'table block found');
  assert.ok(!/\btitle\b|\bmessage\b|\bpriority\b|resource_id|\bstatus\b|acknowledged|updated_at/.test(block), 'no extra columns on the read table');
});

test('RLS enabled + forced; no policies', () => {
  has(/enable row level security/);
  has(/force  ?row level security/);
  absent(/create policy/);
});

test('table privileges: service_role SELECT only; no client access; no mutation grants', () => {
  has(/revoke all\s+on table public\.operator_notification_reads from service_role/);
  has(/grant  ?select on table public\.operator_notification_reads to service_role/);
  absent(/grant[^;]*insert[^;]*to service_role/);
  absent(/grant[^;]*update[^;]*to service_role/);
  absent(/grant[^;]*delete[^;]*to service_role/);
  absent(/to authenticated/);
  absent(/grant[^;]*to anon/);
});

test('mark-read RPC: SECURITY DEFINER, pinned search_path, no dynamic SQL, INSERT ON CONFLICT only', () => {
  has(/create function public\.sbiq_b12_mark_operator_notification_read\(\s*p_casino_id\s+uuid,\s*p_actor_id\s+uuid,\s*p_notification_id text\s*\)/);
  has(/returns table\(status text\)/);
  has(/security definer/);
  has(/set search_path = pg_catalog, public/);
  absent(/execute\s+format|execute\s+'|execute\s+"/);
  has(/insert into public\.operator_notification_reads/);
  has(/on conflict \(casino_id, user_id, notification_id\) do nothing/);
  absent(/update public\.operator_notification_reads|delete from public\.operator_notification_reads/);
});

test('RPC EXECUTE: service_role only; revoked from public/anon/authenticated', () => {
  has(/revoke all\s+on function public\.sbiq_b12_mark_operator_notification_read\([^)]*\) from public/);
  has(/revoke execute on function public\.sbiq_b12_mark_operator_notification_read\([^)]*\) from anon/);
  has(/revoke execute on function public\.sbiq_b12_mark_operator_notification_read\([^)]*\) from authenticated/);
  has(/grant  ?execute on function public\.sbiq_b12_mark_operator_notification_read\([^)]*\) to service_role/);
});

test('firewall: no trigger/cron/outbox/audit/domain/ledger/provider changes', () => {
  absent(/create trigger|cron\.|create extension/);
  absent(/insert into public\.audit_events|schema_migrations/);
  absent(/player_protection_alerts|player_protection_interventions|intervention_follow_up_events|workflow_notifications/);
  absent(/federation|federated|projection_financial_posture|sbiq_certified_financial/);
  absent(/\bcascade\b/);
});

test('server source guard: projection reads only; mutates only via the mark-read RPC', () => {
  const srv = readFileSync(join(root, 'lib', 'responsibleProfitability', 'operatorNotificationsServer.ts'), 'utf8');
  assert.ok(/\.rpc\('sbiq_b12_mark_operator_notification_read'/.test(srv), 'mark-read via DEFINER RPC');
  const noComments = srv.replace(/\/\/[^\n]*/g, '');
  // no writes to domain/audit tables
  for (const t of ['player_protection_alerts', 'player_protection_interventions', 'intervention_follow_up_events', 'audit_events', 'workflow_notifications']) {
    assert.ok(!new RegExp(`from\\('${t}'\\)[\\s\\S]{0,40}\\.(insert|update|delete|upsert)\\(`).test(noComments), `no write to ${t}`);
  }
  // no direct write to the read table (only the RPC writes it)
  assert.ok(!/operator_notification_reads'\)[\s\S]{0,40}\.(insert|update|delete|upsert)\(/.test(noComments), 'no direct read-table write');
  // revision lookup must be scoped (resource_type + action), not resource_id-only
  assert.ok(/resource_type/.test(srv) && /event_category/.test(srv), 'revision lookup scoped by resource_type + category');
  assert.ok(!/realtime|\.channel\(|cron/i.test(noComments), 'no realtime/cron in server');
});

test('route source guards: auth before validation; GET read-only', () => {
  const post = readFileSync(join(root, 'app', 'api', 'casino', 'notifications', '[notificationId]', 'read', 'route.ts'), 'utf8');
  const p = post.slice(post.indexOf('export async function POST'));
  assert.ok(p.indexOf('resolveAlertAccess(req') > -1 && p.indexOf('isNotificationId(notificationId)') > p.indexOf('resolveAlertAccess(req'), 'auth precedes id/body validation');
  const get = readFileSync(join(root, 'app', 'api', 'casino', 'notifications', 'route.ts'), 'utf8');
  assert.ok(/resolveAlertAccess\(req/.test(get), 'GET authorises');
});
