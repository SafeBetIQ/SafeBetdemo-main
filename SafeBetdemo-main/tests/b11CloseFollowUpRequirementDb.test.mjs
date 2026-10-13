// SafeBet IQ — B11 DB-runtime behaviour (true→false closure, atomic audit, audit-backed
// durable idempotency incl. REPLAYED/NOOP/CONFLICT, cross-intervention same-key arbitration,
// B8/B10 interactions). Runs ONLY against a DISPOSABLE Postgres named by B11_TEST_DATABASE_URL
// (applies the real B8+B10+B11 migrations onto a minimal bootstrap). MUST NEVER point at IQ
// Demo/Production. Unset ⇒ SKIP. Equivalent behaviour proven in-process on PGlite (48/48).
//   B11_TEST_DATABASE_URL=postgres://... node --test tests/b11CloseFollowUpRequirementDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B11_TEST_DATABASE_URL;
const skip = DSN ? false : 'B11_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(here, '..', 'supabase', 'migrations', f), 'utf8');
const MIG_B8 = mig('20261006120000_b8_follow_up_scheduling.sql');
const MIG_B10 = mig('20261013120000_b10_follow_up_occurrence.sql');
const MIG_B11 = mig('20261013130000_b11_close_follow_up_requirement.sql');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333', P2 = '3a3a3a3a-3333-3333-3333-333333333333';
const UA = '44444444-4444-4444-4444-444444444444', UC = '45004500-4444-4444-4444-444444444444',
      US = '45454545-4444-4444-4444-444444444444', UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
const k = (n) => `c0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const ymd = (d) => d.toISOString().slice(0, 10); const TODAY = ymd(new Date());

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
drop schema if exists extensions cascade; create schema extensions;
create or replace function extensions.digest(data bytea, kind text) returns bytea language sql immutable as $$ select sha256(data) $$;
drop table if exists public.intervention_follow_up_events cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.players cascade; drop table if exists public.users cascade; drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator');
create table public.casinos(id uuid primary key);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id));
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
create table public.player_protection_interventions(
  id uuid primary key default gen_random_uuid(), casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), intervention_date timestamptz not null default now(),
  follow_up_required boolean default false, follow_up_date date, unique(id,casino_id,player_id));
create table public.audit_events(id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null, resource_type text, resource_id text,
  user_id uuid, user_role text, casino_id uuid, severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
insert into public.casinos values ('${C}'),('${C2}');
insert into public.players values ('${P}','${C}'),('${P2}','${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${UC}','compliance_officer','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
`;
const seed = (id, req, date) => `insert into public.player_protection_interventions(id,casino_id,player_id,intervention_date,follow_up_required,follow_up_date) values ('${id}','${C}','${P}','2020-01-01T00:00:00Z',${req},${date ? `'${date}'` : 'null'});`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
const close = async (c, a) => (await q(c, `select * from public.sbiq_b11_close_follow_up_requirement($1,$2,$3,$4)`, a)).rows[0].status;
const b8 = async (c, a) => (await q(c, `select public.sbiq_b8_set_follow_up($1,$2,$3,$4,$5) s`, a)).rows[0].s;
const b10 = async (c, a) => (await q(c, `select * from public.sbiq_b10_record_follow_up_occurrence($1,$2,$3,$4,$5)`, a)).rows[0].status;
async function raises(c, fn) { try { await fn(); return false; } catch { return true; } }
const row = async (c, id) => (await q(c, `select follow_up_required, follow_up_date from public.player_protection_interventions where id=$1`, [id])).rows[0];
const evid = (key) => `b11:follow-up-close:${C}:${key}`;
const auditN = async (c, e) => Number((await q(c, `select count(*)::int c from public.audit_events where event_id=$1`, [e])).rows[0].c);

test('B11 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG_B8); await q(c, MIG_B10); await q(c, MIG_B11);

    await t.test('core transitions', async () => {
      await q(c, seed('d0000000-0000-0000-0000-000000000001', true, null));
      await q(c, seed('d0000000-0000-0000-0000-000000000002', true, '2026-06-10'));
      await q(c, seed('d0000000-0000-0000-0000-000000000003', false, null));
      await q(c, seed('d0000000-0000-0000-0000-000000000004', null, null));
      assert.equal(await close(c, ['d0000000-0000-0000-0000-000000000001', C, UA, k(1)]), 'CLOSED');
      assert.deepEqual(await row(c, 'd0000000-0000-0000-0000-000000000001'), { follow_up_required: false, follow_up_date: null });
      assert.equal(await close(c, ['d0000000-0000-0000-0000-000000000002', C, UA, k(2)]), 'CLOSED');
      const md = (await q(c, `select metadata from public.audit_events where event_id=$1`, [evid(k(2))])).rows[0].metadata;
      assert.equal(ymd(new Date(md.old_follow_up_date)), '2026-06-10');
      assert.equal(await close(c, ['d0000000-0000-0000-0000-000000000003', C, UA, k(3)]), 'NOOP');
      assert.equal(await auditN(c, evid(k(3))), 0);
      assert.equal(await close(c, ['d0000000-0000-0000-0000-000000000004', C, UA, k(4)]), 'NOOP');
    });

    await t.test('idempotency CLOSED/REPLAYED/NOOP/CONFLICT', async () => {
      await q(c, seed('d1000000-0000-0000-0000-000000000001', true, null));
      await q(c, seed('d1000000-0000-0000-0000-000000000002', true, null));
      assert.equal(await close(c, ['d1000000-0000-0000-0000-000000000001', C, UA, k(10)]), 'CLOSED');
      assert.equal(await close(c, ['d1000000-0000-0000-0000-000000000001', C, UA, k(10)]), 'REPLAYED');
      assert.equal(await auditN(c, evid(k(10))), 1);
      assert.equal(await close(c, ['d1000000-0000-0000-0000-000000000001', C, UA, k(11)]), 'NOOP');  // new key, already closed
      assert.equal(await close(c, ['d1000000-0000-0000-0000-000000000002', C, UA, k(10)]), 'IDEMPOTENCY_CONFLICT');  // same key, diff iv
      assert.equal((await row(c, 'd1000000-0000-0000-0000-000000000002')).follow_up_required, true);  // loser unchanged
    });

    await t.test('NOT_FOUND + actor matrix', async () => {
      await q(c, seed('d2000000-0000-0000-0000-000000000001', true, null));
      assert.equal(await close(c, ['d0000000-0000-0000-0000-0000000000ff', C, UA, k(20)]), 'NOT_FOUND');
      assert.equal(await close(c, ['d2000000-0000-0000-0000-000000000001', C, US, k(21)]), 'CLOSED');
      assert.ok(await raises(c, () => close(c, ['d2000000-0000-0000-0000-000000000001', C, UR, k(22)])));  // regulator
      assert.ok(await raises(c, () => close(c, ['d2000000-0000-0000-0000-000000000001', C, UX, k(23)])));  // cross-casino actor
    });

    await t.test('atomic rollback on audit failure', async () => {
      await q(c, seed('d3000000-0000-0000-0000-000000000001', true, '2026-06-10'));
      await q(c, `alter table public.audit_events add constraint tmp_b11 check (action <> 'intervention.follow_up_requirement_closed') not valid`);
      assert.ok(await raises(c, () => close(c, ['d3000000-0000-0000-0000-000000000001', C, UA, k(30)])));
      assert.deepEqual(await row(c, 'd3000000-0000-0000-0000-000000000001'), { follow_up_required: true, follow_up_date: new Date('2026-06-10T00:00:00Z') });
      await q(c, `alter table public.audit_events drop constraint tmp_b11`);
    });

    await t.test('B8 interaction', async () => {
      await q(c, seed('d4000000-0000-0000-0000-000000000001', true, '2026-06-10'));
      assert.equal(await b8(c, ['d4000000-0000-0000-0000-000000000001', C, UA, 'RESCHEDULE', '2026-08-15']), 'APPLIED');
      assert.equal(await close(c, ['d4000000-0000-0000-0000-000000000001', C, UA, k(40)]), 'CLOSED');
      const md = (await q(c, `select metadata from public.audit_events where event_id=$1`, [evid(k(40))])).rows[0].metadata;
      assert.equal(ymd(new Date(md.old_follow_up_date)), '2026-08-15');
      assert.equal(await b8(c, ['d4000000-0000-0000-0000-000000000001', C, UA, 'SCHEDULE', '2026-09-01']), 'INVALID_STATE');
    });

    await t.test('B10 interaction', async () => {
      await q(c, seed('d5000000-0000-0000-0000-000000000001', true, null));
      assert.equal(await b10(c, ['d5000000-0000-0000-0000-000000000001', C, UA, k(50), TODAY]), 'CREATED');
      assert.equal(await close(c, ['d5000000-0000-0000-0000-000000000001', C, UA, k(51)]), 'CLOSED');
      assert.equal(await b10(c, ['d5000000-0000-0000-0000-000000000001', C, UA, k(52), TODAY]), 'INVALID_STATE');   // new occurrence after close
      assert.equal(await b10(c, ['d5000000-0000-0000-0000-000000000001', C, UA, k(50), TODAY]), 'REPLAYED');        // replay after close
    });

    await t.test('security posture', async () => {
      const sig = 'public.sbiq_b11_close_follow_up_requirement(uuid,uuid,uuid,uuid)';
      assert.equal((await q(c, `select has_function_privilege('service_role',$1,'EXECUTE') e`, [sig])).rows[0].e, true);
      assert.equal((await q(c, `select has_function_privilege('authenticated',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select has_function_privilege('anon',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select prosecdef from pg_proc where proname='sbiq_b11_close_follow_up_requirement'`)).rows[0].prosecdef, true);
      assert.equal((await q(c, `select has_table_privilege('service_role','public.player_protection_interventions','UPDATE') u`)).rows[0].u, false);
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
