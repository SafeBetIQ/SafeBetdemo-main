// SafeBet IQ — B12 DB-runtime behaviour (mark-read RPC: READ/NOOP, append-only first-read,
// actor matrix, id-format guard, service_role SELECT-only + RPC EXECUTE matrix, FORCE RLS,
// no persisted notifications table). Runs ONLY against a DISPOSABLE Postgres named by
// B12_TEST_DATABASE_URL (bootstraps a minimal schema + applies the real migration). MUST
// NEVER point at IQ Demo/Production. Unset ⇒ SKIP. Equivalent behaviour proven on PGlite (23/23).
//   B12_TEST_DATABASE_URL=postgres://... node --test tests/b12OperatorNotificationsDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B12_TEST_DATABASE_URL;
const skip = DSN ? false : 'B12_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261014120000_b12_operator_notification_reads.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const UA = '44444444-4444-4444-4444-444444444444', UC = '45004500-4444-4444-4444-444444444444',
      US = '45454545-4444-4444-4444-444444444444', UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
const nid = (parts) => createHash('sha256').update(['b12v1', ...parts].join('\x1f'), 'utf8').digest('hex');
const ID1 = nid([C, 'SELF_EXCLUSION_ALERT', 'a0000000-0000-0000-0000-000000000001']);

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
drop table if exists public.operator_notification_reads cascade;
drop table if exists public.users cascade; drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator');
create table public.casinos(id uuid primary key);
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
insert into public.casinos values ('${C}'),('${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${UC}','compliance_officer','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
const mark = async (c, a) => (await q(c, `select * from public.sbiq_b12_mark_operator_notification_read($1,$2,$3)`, a)).rows[0].status;
async function raises(c, a) { try { await mark(c, a); return false; } catch { return true; } }
const cnt = async (c, s, p) => Number((await q(c, s, p)).rows[0].c);
const tp = async (c, role, p) => (await q(c, `select has_table_privilege($1,'public.operator_notification_reads',$2) x`, [role, p])).rows[0].x;

test('B12 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG);

    await t.test('READ/NOOP + append-only first-read + per-user independence', async () => {
      assert.equal(await mark(c, [C, UA, ID1]), 'READ');
      assert.equal(await mark(c, [C, UA, ID1]), 'NOOP');
      assert.equal(await cnt(c, `select count(*)::int c from public.operator_notification_reads where notification_id=$1`, [ID1]), 1);
      const t1 = (await q(c, `select read_at from public.operator_notification_reads where casino_id=$1 and user_id=$2 and notification_id=$3`, [C, UA, ID1])).rows[0].read_at;
      await mark(c, [C, UA, ID1]);
      const t2 = (await q(c, `select read_at from public.operator_notification_reads where casino_id=$1 and user_id=$2 and notification_id=$3`, [C, UA, ID1])).rows[0].read_at;
      assert.equal(String(t1), String(t2));
      assert.equal(await mark(c, [C, UC, ID1]), 'READ');   // independent user
      assert.equal(await cnt(c, `select count(*)::int c from public.operator_notification_reads where notification_id=$1`, [ID1]), 2);
    });

    await t.test('actor matrix + id guard', async () => {
      assert.equal(await mark(c, [C, US, ID1]), 'READ');                 // super_admin
      assert.ok(await raises(c, [C, UR, ID1]));                          // regulator
      assert.ok(await raises(c, [C, UX, ID1]));                          // cross-casino actor
      assert.ok(await raises(c, [C, '48484848-4444-4444-4444-444444444444', ID1])); // missing actor
      assert.ok(await raises(c, [C, UA, 'not-hex']));                    // invalid id
      assert.ok(await raises(c, [C, UA, 'A'.repeat(64)]));               // uppercase
    });

    await t.test('security posture', async () => {
      assert.equal(await tp(c, 'service_role', 'SELECT'), true);
      assert.equal(await tp(c, 'service_role', 'INSERT'), false);
      assert.equal(await tp(c, 'service_role', 'UPDATE'), false);
      assert.equal(await tp(c, 'service_role', 'DELETE'), false);
      assert.equal(await tp(c, 'authenticated', 'SELECT'), false);
      assert.equal(await tp(c, 'anon', 'SELECT'), false);
      const sig = 'public.sbiq_b12_mark_operator_notification_read(uuid,uuid,text)';
      assert.equal((await q(c, `select has_function_privilege('service_role',$1,'EXECUTE') e`, [sig])).rows[0].e, true);
      assert.equal((await q(c, `select has_function_privilege('authenticated',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select has_function_privilege('anon',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select prosecdef from pg_proc where proname='sbiq_b12_mark_operator_notification_read'`)).rows[0].prosecdef, true);
      assert.equal((await q(c, `select relforcerowsecurity from pg_class where relname='operator_notification_reads'`)).rows[0].relforcerowsecurity, true);
      assert.equal(await cnt(c, `select count(*)::int c from pg_policies where tablename='operator_notification_reads'`), 0);
      assert.equal(await cnt(c, `select count(*)::int c from information_schema.tables where table_schema='public' and table_name='operator_notifications'`), 0);
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
