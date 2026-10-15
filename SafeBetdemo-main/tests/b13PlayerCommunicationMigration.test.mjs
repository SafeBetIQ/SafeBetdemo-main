// SafeBet IQ — B13.1: STATIC assertions over the migration SQL + runtime source guards (no DB).
//   node --test tests/b13PlayerCommunicationMigration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SQL = readFileSync(join(root, 'supabase', 'migrations', '20261014130000_b13_1_player_communication_core.sql'), 'utf8');
const sql = SQL.toLowerCase();
const code = sql.replace(/--[^\n]*/g, '');
const has = (re) => assert.ok(re.test(sql), `expected match ${re}`);
const absent = (re) => assert.ok(!re.test(code), `expected CODE not to match ${re}`);
// CREATE TABLE block only (RPCs legitimately mention status/outcome/provider words).
const block = (sql.match(/create table public\.intervention_player_communications \(([\s\S]*?)\n\);/) || [])[1] || '';

test('creates exactly one table (the communications core)', () => {
  has(/create table public\.intervention_player_communications/);
  assert.equal((code.match(/create table/g) || []).length, 1, 'exactly one table');
  assert.ok(block.length > 0, 'table block found');
});

test('table stores NO player identity / contact / message / raw provider payload', () => {
  for (const forbidden of ['player_id', 'email', 'phone', 'recipient', 'message_body', 'message_text', 'body', 'provider_response', 'raw', 'viewed_at', 'acknowledged_at', 'marketing']) {
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(block), `forbidden column ${forbidden} present in table`);
  }
});

test('three FKs, all ON UPDATE/DELETE RESTRICT; no player FK', () => {
  has(/foreign key \(intervention_id\) references public\.player_protection_interventions\(id\) on update restrict on delete restrict/);
  has(/foreign key \(requested_by\)\s*references public\.users\(id\) on update restrict on delete restrict/);
  has(/foreign key \(send_requested_by\) references public\.users\(id\) on update restrict on delete restrict/);
  assert.equal((code.match(/foreign key/g) || []).length, 3, 'exactly three FKs');
  assert.ok(!/references public\.players\b/.test(code), 'no FK to players');
  absent(/\bcascade\b/);
});

test('three UNIQUE invariants', () => {
  has(/unique \(casino_id, request_idempotency_key\)/);
  has(/unique \(casino_id, send_idempotency_key\)/);
  has(/unique \(casino_id, intervention_id, sequence\)/);
});

test('enum + value CHECKs', () => {
  has(/communication_type in \('limit_confirmation','timeout_confirmation','self_exclusion_support','helpline_support','counselling_support'\)/);
  has(/purpose = 'responsible_gambling'/);
  has(/delivery_mode = 'sandbox'/);                       // real-send block at DB layer
  has(/channel_class = 'operator_managed'/);
  has(/status in \('pending','submitting','submitted','delivered','failed'\)/);
  has(/template_version > 0/);
  has(/sequence > 0/);
  has(/request_fingerprint ~ '\^\[0-9a-f\]\{64\}/);
});

test('full status-keyed lifecycle CHECK exists', () => {
  has(/case status/);
  has(/when 'pending' then/);
  has(/when 'submitting' then/);
  has(/when 'submitted' then/);
  has(/when 'delivered' then/);
  has(/when 'failed' then/);
  has(/else false/);
});

test('history index; no speculative status index', () => {
  has(/create index iplc_history_idx on public\.intervention_player_communications \(casino_id, intervention_id, requested_at desc\)/);
  assert.equal((code.match(/create index/g) || []).length, 1, 'exactly one index');
});

test('RLS enabled + forced; no policies', () => {
  has(/enable row level security/);
  has(/force  ?row level security/);
  absent(/create policy/);
});

test('table privileges: service_role SELECT only; no client/mutation grants', () => {
  has(/revoke all\s+on table public\.intervention_player_communications from service_role/);
  has(/grant  ?select on table public\.intervention_player_communications to service_role/);
  absent(/grant[^;]*insert[^;]*to service_role/);
  absent(/grant[^;]*update[^;]*to service_role/);
  absent(/grant[^;]*delete[^;]*to service_role/);
  absent(/to authenticated/);
  absent(/grant[^;]*to anon/);
});

test('three SECURITY DEFINER RPCs, pinned search_path, no dynamic SQL, explicit digest', () => {
  for (const fn of ['sbiq_b13_create_player_communication', 'sbiq_b13_begin_player_communication_send', 'sbiq_b13_record_player_communication_receipt']) {
    has(new RegExp(`create function public\\.${fn}\\(`));
  }
  assert.equal((code.match(/security definer/g) || []).length, 3, 'three definer fns');
  assert.equal((code.match(/set search_path = pg_catalog, public/g) || []).length, 3, 'all pin search_path');
  absent(/execute\s+format|execute\s+'|execute\s+"/);     // no dynamic SQL
  has(/extensions\.digest\(/);                             // explicit extension-schemaed digest
  absent(/(?<!extensions\.)digest\(convert_to/);           // never unqualified digest
});

test('receipt RPC attributes to system actor (user_id null, role system); human phases keep human actor', () => {
  has(/'b13:player-communication:'/);
  has(/null, 'system'/);                                   // system-actor receipt
  has(/:requested/);
  has(/:send-requested/);
});

test('RPC EXECUTE: service_role only; revoked from public/anon/authenticated', () => {
  for (const fn of ['sbiq_b13_create_player_communication', 'sbiq_b13_begin_player_communication_send', 'sbiq_b13_record_player_communication_receipt']) {
    has(new RegExp(`revoke all\\s+on function public\\.${fn}\\([^)]*\\) from public`));
    has(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from anon`));
    has(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from authenticated`));
    has(new RegExp(`grant  ?execute on function public\\.${fn}\\([^)]*\\) to service_role`));
  }
});

test('firewall: no cron/realtime/external/legacy-queue/webhook/marketing/federation; no B5 allowlist change', () => {
  absent(/cron\.|create extension|pg_net|http_post|net\.http/);
  absent(/intervention_delivery_queue|integration_webhooks/);
  absent(/federation|federated|projection_financial_posture|sbiq_certified_financial/);
  absent(/marketing/);
  absent(/schema_migrations/);
  // only this table's audit inserts; no edits to other domain tables
  absent(/insert into public\.player_protection_alerts|update public\.player_protection_interventions/);
});

test('server source guard: writes ONLY via the three DEFINER RPCs; no contact reads', () => {
  const srv = readFileSync(join(root, 'lib', 'responsibleProfitability', 'playerCommunicationsServer.ts'), 'utf8');
  const noComments = srv.replace(/\/\/[^\n]*/g, '');
  assert.ok(/\.rpc\('sbiq_b13_create_player_communication'/.test(srv), 'create via DEFINER RPC');
  assert.ok(/\.rpc\('sbiq_b13_begin_player_communication_send'/.test(srv), 'begin-send via DEFINER RPC');
  assert.ok(/\.rpc\('sbiq_b13_record_player_communication_receipt'/.test(srv), 'receipt via DEFINER RPC');
  // never a direct write to the communications or any domain/audit table
  for (const t of ['intervention_player_communications', 'player_protection_interventions', 'audit_events']) {
    assert.ok(!new RegExp(`from\\('${t}'\\)[\\s\\S]{0,60}\\.(insert|update|delete|upsert)\\(`).test(noComments), `no direct write to ${t}`);
  }
  // never reads player contact columns
  assert.ok(!/players'\)[\s\S]{0,80}(email|phone|id_number)/.test(noComments), 'no player contact read');
  assert.ok(!/realtime|\.channel\(|cron/i.test(noComments), 'no realtime/cron');
});

test('connector source guard: sandbox only; no network/contact/secret', () => {
  const conn = readFileSync(join(root, 'lib', 'responsibleProfitability', 'playerCommunicationConnector.ts'), 'utf8');
  assert.ok(/non-SANDBOX/.test(conn), 'refuses non-SANDBOX');
  assert.ok(!/fetch\(|http|axios|nodemailer|twilio|sendgrid|XMLHttpRequest|net\.|dns\./i.test(conn.replace(/\/\/[^\n]*/g, '')), 'no network/provider calls');
});

test('route source guards: auth before validation; create/send POST + history GET', () => {
  const post = readFileSync(join(root, 'app', 'api', 'casino', 'interventions', '[id]', 'communications', 'route.ts'), 'utf8');
  const p = post.slice(post.indexOf('export async function POST'));
  assert.ok(p.indexOf('resolveAlertAccess(req') > -1 && p.indexOf('parseIdempotencyKey') > p.indexOf('resolveAlertAccess(req'), 'auth precedes idempotency/body validation');
  assert.ok(/listPlayerCommunications/.test(post), 'GET history present');
  const send = readFileSync(join(root, 'app', 'api', 'casino', 'interventions', '[id]', 'communications', '[communicationId]', 'send', 'route.ts'), 'utf8');
  const s = send.slice(send.indexOf('export async function POST'));
  assert.ok(s.indexOf('resolveAlertAccess(req') > -1 && s.indexOf('parseIdempotencyKey') > s.indexOf('resolveAlertAccess(req'), 'send auth precedes validation');
  assert.ok(/export async function GET\(\) \{ return deny\(404\)/.test(send), 'send GET is 404');
});
