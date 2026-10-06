// SafeBet IQ — B8 DB-runtime behaviour (CHECK truth table; sbiq_b8_set_follow_up
// transitions/NOOP/INVALID_STATE/NOT_FOUND; actor role+casino validation; identity
// immutability; atomic audit + rollback). Runs ONLY against a DISPOSABLE Postgres named
// by B8_TEST_DATABASE_URL; bootstraps a minimal schema and applies the real migration.
// MUST NEVER point at IQ Demo/Production. Unset ⇒ SKIP.
//   B8_TEST_DATABASE_URL=postgres://... node --test tests/b8FollowUpSchedulingDb.test.mjs
// Equivalent behaviour proven in-process on disposable PGlite (36/36) during implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B8_TEST_DATABASE_URL;
const skip = DSN ? false : 'B8_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261006120000_b8_follow_up_scheduling.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333', P2 = '39393939-3333-3333-3333-333333333333';
const UA = '44444444-4444-4444-4444-444444444444', US = '45454545-4444-4444-4444-444444444444';
const UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
const IV = (n) => `b${n}111111-1111-1111-1111-111111111111`;

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
drop table if exists public.audit_events cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.players cascade;
drop table if exists public.users cascade;
drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
drop function if exists public.sbiq_b8_set_follow_up(uuid,uuid,uuid,text,date) cascade;
create table public.casinos(id uuid primary key);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id));
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator','national_regulator','provincial_regulator');
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
create table public.player_protection_interventions(
  id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), intervention_date timestamptz not null default now(),
  outcome text, follow_up_required boolean default false, follow_up_date date, staff_id uuid);
create table public.audit_events(id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null,
  resource_type text, resource_id text, user_id uuid, user_role text, casino_id uuid,
  severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
grant insert, select on public.audit_events to service_role;
insert into public.casinos values ('${C}'),('${C2}');
insert into public.players values ('${P}','${C}'),('${P2}','${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
insert into public.player_protection_interventions(id,casino_id,player_id,outcome,follow_up_required) values
  ('${IV(1)}','${C}','${P}','pending',true),('${IV(2)}','${C}','${P}','pending',true),
  ('${IV(3)}','${C}','${P}','accepted',false),('${IV(7)}','${C2}','${P2}','pending',true);
`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
async function raises(c, s, p) { try { await q(c, s, p); return false; } catch { return true; } }
const call = (c, iv, casino, actor, action, date) => q(c, `select public.sbiq_b8_set_follow_up($1,$2,$3,$4,$5) r`, [iv, casino, actor, action, date]);
const res = async (c, iv, casino, actor, action, date) => (await call(c, iv, casino, actor, action, date)).rows[0].r;

test('B8 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG);

    await t.test('CHECK truth table', async () => {
      const ins = (id, req, d) => `insert into public.player_protection_interventions(id,casino_id,player_id,follow_up_required,follow_up_date) values ('${id}','${C}','${P}',${req},${d})`;
      assert.ok(!(await raises(c, ins('a1111111-1111-1111-1111-111111111111', 'false', 'null'))));
      assert.ok(await raises(c, ins('a2111111-1111-1111-1111-111111111111', 'false', `'2026-06-01'`)));
      assert.ok(!(await raises(c, ins('a3111111-1111-1111-1111-111111111111', 'true', 'null'))));
      assert.ok(!(await raises(c, ins('a4111111-1111-1111-1111-111111111111', 'true', `'2026-06-01'`))));
      assert.ok(!(await raises(c, ins('a5111111-1111-1111-1111-111111111111', 'null', 'null'))));
      assert.ok(await raises(c, ins('a6111111-1111-1111-1111-111111111111', 'null', `'2026-06-01'`)));
    });

    await t.test('schedule/reschedule/unschedule transitions + NOOP + INVALID_STATE + NOT_FOUND', async () => {
      assert.equal(await res(c, IV(1), C, UA, 'SCHEDULE', '2026-06-10'), 'APPLIED');
      assert.equal(await res(c, IV(1), C, UA, 'SCHEDULE', '2026-07-01'), 'INVALID_STATE');  // already scheduled
      assert.equal(await res(c, IV(3), C, UA, 'SCHEDULE', '2026-06-10'), 'INVALID_STATE');  // required=false
      assert.equal(await res(c, IV(7), C, UA, 'SCHEDULE', '2026-06-10'), 'NOT_FOUND');      // other casino, scoped out
      assert.equal(await res(c, 'b9999999-9999-9999-9999-999999999999', C, UA, 'SCHEDULE', '2026-06-10'), 'NOT_FOUND');
      assert.equal(await res(c, IV(1), C, UA, 'RESCHEDULE', '2026-08-01'), 'APPLIED');
      assert.equal(await res(c, IV(1), C, UA, 'RESCHEDULE', '2026-08-01'), 'NOOP');          // identical
      assert.equal(await res(c, IV(2), C, UA, 'RESCHEDULE', '2026-08-01'), 'INVALID_STATE'); // unscheduled
      assert.equal(await res(c, IV(1), C, UA, 'UNSCHEDULE', null), 'APPLIED');
      assert.equal(await res(c, IV(1), C, UA, 'UNSCHEDULE', null), 'NOOP');                  // already null
      assert.equal(await res(c, IV(3), C, UA, 'UNSCHEDULE', null), 'INVALID_STATE');          // required=false (not NOOP)
      // follow_up_required unchanged by unschedule
      assert.equal((await q(c, `select follow_up_required f from public.player_protection_interventions where id='${IV(1)}'`)).rows[0].f, true);
    });

    await t.test('past/future dates accepted', async () => {
      assert.equal(await res(c, IV(2), C, UA, 'SCHEDULE', '2020-01-01'), 'APPLIED');
      assert.equal(await res(c, IV(2), C, UA, 'RESCHEDULE', '2099-01-01'), 'APPLIED');
    });

    await t.test('actor validation (role + casino defence-in-depth)', async () => {
      assert.equal(await res(c, IV(1), C, US, 'SCHEDULE', '2026-06-10'), 'APPLIED');          // super_admin ok
      assert.ok(await raises(c, `select public.sbiq_b8_set_follow_up('${IV(1)}','${C}','${UR}','RESCHEDULE','2026-06-11')`)); // regulator rejected
      assert.ok(await raises(c, `select public.sbiq_b8_set_follow_up('${IV(1)}','${C}','${UX}','RESCHEDULE','2026-06-11')`)); // cross-casino actor rejected
      assert.ok(await raises(c, `select public.sbiq_b8_set_follow_up('${IV(1)}','${C}','48484848-4444-4444-4444-444444444444','RESCHEDULE','2026-06-11')`)); // unknown actor
    });

    await t.test('identity immutable; only follow_up_date changes', async () => {
      const row = (await q(c, `select casino_id,player_id,outcome,follow_up_required from public.player_protection_interventions where id='${IV(1)}'`)).rows[0];
      assert.equal(row.casino_id, C); assert.equal(row.player_id, P); assert.equal(row.follow_up_required, true);
    });

    await t.test('audit: one event per real change, NOOP none, safe metadata', async () => {
      const n = async (a) => (await q(c, `select count(*)::int c from public.audit_events where action=$1`, [a])).rows[0].c;
      assert.ok((await n('intervention.follow_up_scheduled')) >= 3);
      assert.ok((await n('intervention.follow_up_rescheduled')) >= 2);
      assert.ok((await n('intervention.follow_up_unscheduled')) >= 1);
      const meta = (await q(c, `select metadata from public.audit_events where action='intervention.follow_up_unscheduled' limit 1`)).rows[0].metadata;
      assert.ok('old_follow_up_date' in meta && 'new_follow_up_date' in meta && meta.operation === 'UNSCHEDULE' && !('player_id' in meta));
    });

    await t.test('atomic rollback when audit insert fails', async () => {
      await q(c, `alter table public.audit_events add constraint tmp_block check (action <> 'intervention.follow_up_scheduled') not valid`);
      const before = (await q(c, `select follow_up_date d from public.player_protection_interventions where id='${IV(2)}'`)).rows[0].d;
      await q(c, `update public.player_protection_interventions set follow_up_date=null where id='${IV(2)}'`);  // make it schedulable
      const threw = await raises(c, `select public.sbiq_b8_set_follow_up('${IV(2)}','${C}','${UA}','SCHEDULE','2026-06-10')`);
      const after = (await q(c, `select follow_up_date d from public.player_protection_interventions where id='${IV(2)}'`)).rows[0].d;
      assert.ok(threw && after === null);   // rolled back to the null we set
      await q(c, `alter table public.audit_events drop constraint tmp_block`);
      void before;
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
