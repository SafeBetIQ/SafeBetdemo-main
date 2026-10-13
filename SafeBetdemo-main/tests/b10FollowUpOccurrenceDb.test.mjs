// SafeBet IQ — B10 DB-runtime behaviour (append-only occurrence, eligibility, occurred_on
// bounds, schedule snapshot, timing, atomic audit, fingerprinted idempotency incl. durable
// replay after B8 reschedule / eligibility change, service_role SELECT-only posture).
// Runs ONLY against a DISPOSABLE Postgres named by B10_TEST_DATABASE_URL; bootstraps a
// minimal schema and applies the real migration. MUST NEVER point at IQ Demo/Production.
// Unset ⇒ SKIP. Equivalent behaviour proven in-process on PGlite.
//   B10_TEST_DATABASE_URL=postgres://... node --test tests/b10FollowUpOccurrenceDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B10_TEST_DATABASE_URL;
const skip = DSN ? false : 'B10_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261013120000_b10_follow_up_occurrence.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333', P2 = '3a3a3a3a-3333-3333-3333-333333333333';
const UA = '44444444-4444-4444-4444-444444444444', UC = '45004500-4444-4444-4444-444444444444',
      US = '45454545-4444-4444-4444-444444444444', UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
// interventions: IVREQ=required+undated, IVDATE=required+dated, IVNO=not required, IV2=other casino
const IVREQ = 'd0000000-0000-0000-0000-000000000001', IVDATE = 'd0000000-0000-0000-0000-000000000002',
      IVNO = 'd0000000-0000-0000-0000-000000000003', IV2 = 'd0000000-0000-0000-0000-000000000004';
const kk = (n) => `c0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;

const ymd = (d) => d.toISOString().slice(0, 10);
const TODAY = ymd(new Date());
const TOMORROW = ymd(new Date(Date.now() + 86400000));
const PAST = '2021-01-01';          // after intervention_date (2020-01-01), before today
const BEFORE_IV = '2019-01-01';     // before intervention_date

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
drop table if exists public.players cascade;
drop table if exists public.users cascade; drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator');
create table public.casinos(id uuid primary key);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id));
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
create table public.player_protection_interventions(
  id uuid primary key default gen_random_uuid(), casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), intervention_date timestamptz not null default now(),
  follow_up_required boolean default false, follow_up_date date,
  constraint ppi_follow_up_consistency check (follow_up_required is true or follow_up_date is null),
  unique(id,casino_id,player_id));
create table public.audit_events(id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null, resource_type text, resource_id text,
  user_id uuid, user_role text, casino_id uuid, severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
insert into public.casinos values ('${C}'),('${C2}');
insert into public.players values ('${P}','${C}'),('${P2}','${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${UC}','compliance_officer','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
insert into public.player_protection_interventions(id,casino_id,player_id,intervention_date,follow_up_required,follow_up_date) values
  ('${IVREQ}','${C}','${P}','2020-01-01T00:00:00Z',true,null),
  ('${IVDATE}','${C}','${P}','2020-01-01T00:00:00Z',true,'2026-06-10'),
  ('${IVNO}','${C}','${P}','2020-01-01T00:00:00Z',false,null),
  ('${IV2}','${C2}','${P2}','2020-01-01T00:00:00Z',true,null);
`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
const rpc = async (c, a) => (await q(c, `select * from public.sbiq_b10_record_follow_up_occurrence($1,$2,$3,$4,$5)`, a)).rows[0];
async function raises(c, a) { try { await rpc(c, a); return false; } catch { return true; } }
const cnt = async (c, s, p) => Number((await q(c, s, p)).rows[0].c);
const priv = async (c, role, obj, p) => (await q(c, `select has_table_privilege($1,$2,$3) x`, [role, obj, p])).rows[0].x;

test('B10 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG);

    await t.test('creation: eligibility + derived identity + snapshot', async () => {
      const r1 = await rpc(c, [IVREQ, C, UA, kk(1), TODAY]);
      assert.equal(r1.status, 'CREATED');
      const row = (await q(c, `select * from public.intervention_follow_up_events where id=$1`, [r1.occurrence_id])).rows[0];
      assert.equal(row.casino_id, C); assert.equal(row.player_id, P);           // DB-derived
      assert.equal(row.recorded_by, UA); assert.ok(row.recorded_at);            // actor/provenance
      assert.equal(row.scheduled_follow_up_date, null);                         // undated snapshot
      assert.ok(row.b10_request_fingerprint);
      const r2 = await rpc(c, [IVDATE, C, UA, kk(2), TODAY]);
      assert.equal(r2.status, 'CREATED');
      const row2 = (await q(c, `select scheduled_follow_up_date from public.intervention_follow_up_events where id=$1`, [r2.occurrence_id])).rows[0];
      assert.equal(ymd(new Date(row2.scheduled_follow_up_date)), '2026-06-10'); // dated snapshot captured
      assert.equal((await rpc(c, [IVNO, C, UA, kk(3), TODAY])).status, 'INVALID_STATE');   // not required
    });

    await t.test('occurred_on bounds (SAST)', async () => {
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(10), PAST])).status, 'CREATED');          // past after intervention
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(11), TODAY])).status, 'CREATED');         // today
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(12), TOMORROW])).status, 'INVALID_STATE');// future (RPC defence)
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(13), BEFORE_IV])).status, 'INVALID_STATE');// before intervention
    });

    await t.test('multiple occurrences incl. same day (separate keys)', async () => {
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(20), TODAY])).status, 'CREATED');
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(21), TODAY])).status, 'CREATED');
      assert.ok(await cnt(c, `select count(*)::int c from public.intervention_follow_up_events where intervention_id=$1 and occurred_on=$2`, [IVREQ, TODAY]) >= 2);
    });

    await t.test('actor validation + tenant isolation', async () => {
      assert.equal((await rpc(c, [IVREQ, C, UC, kk(30), TODAY])).status, 'CREATED');   // compliance_officer
      assert.equal((await rpc(c, [IVREQ, C, US, kk(31), TODAY])).status, 'CREATED');   // super_admin
      assert.ok(await raises(c, [IVREQ, C, UR, kk(32), TODAY]));                        // regulator
      assert.ok(await raises(c, [IVREQ, C, UX, kk(33), TODAY]));                        // cross-casino actor
      assert.ok(await raises(c, [IVREQ, C, '48484848-4444-4444-4444-444444444444', kk(34), TODAY])); // missing actor
      assert.equal((await rpc(c, [IV2, C, UA, kk(35), TODAY])).status, 'NOT_FOUND');    // intervention in another casino
    });

    await t.test('atomicity: forced audit failure rolls back the occurrence', async () => {
      const n0 = await cnt(c, `select count(*)::int c from public.intervention_follow_up_events`);
      await q(c, `alter table public.audit_events add constraint tmp_b10 check (action <> 'intervention.follow_up_recorded') not valid`);
      assert.ok(await raises(c, [IVREQ, C, UA, kk(40), TODAY]));
      assert.equal(await cnt(c, `select count(*)::int c from public.intervention_follow_up_events`), n0);
      await q(c, `alter table public.audit_events drop constraint tmp_b10`);
    });

    await t.test('idempotency CREATED/REPLAYED/CONFLICT + one audit', async () => {
      const first = await rpc(c, [IVREQ, C, UA, kk(50), TODAY]);
      assert.equal(first.status, 'CREATED');
      const n = await cnt(c, `select count(*)::int c from public.intervention_follow_up_events`);
      const rep = await rpc(c, [IVREQ, C, UA, kk(50), TODAY]);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.occurrence_id, first.occurrence_id);
      assert.equal(await cnt(c, `select count(*)::int c from public.intervention_follow_up_events`), n);   // no new row
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where resource_id=$1`, [first.occurrence_id]), 1); // one audit only
      assert.equal((await rpc(c, [IVDATE, C, UA, kk(50), TODAY])).status, 'IDEMPOTENCY_CONFLICT'); // diff intervention
      assert.equal((await rpc(c, [IVREQ, C, UC, kk(50), TODAY])).status, 'IDEMPOTENCY_CONFLICT');  // diff actor
      assert.equal((await rpc(c, [IVREQ, C, UA, kk(50), PAST])).status, 'IDEMPOTENCY_CONFLICT');   // diff occurred_on
    });

    await t.test('durable replay after B8 reschedule + eligibility change', async () => {
      const r = await rpc(c, [IVDATE, C, UA, kk(60), TODAY]);
      assert.equal(r.status, 'CREATED');
      const snap = (await q(c, `select scheduled_follow_up_date from public.intervention_follow_up_events where id=$1`, [r.occurrence_id])).rows[0].scheduled_follow_up_date;
      // B8 reschedule (date change) then unschedule
      await q(c, `update public.player_protection_interventions set follow_up_date='2027-01-01' where id=$1`, [IVDATE]);
      let rep = await rpc(c, [IVDATE, C, UA, kk(60), TODAY]);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.occurrence_id, r.occurrence_id);
      const snap2 = (await q(c, `select scheduled_follow_up_date from public.intervention_follow_up_events where id=$1`, [r.occurrence_id])).rows[0].scheduled_follow_up_date;
      assert.equal(ymd(new Date(snap2)), ymd(new Date(snap)));   // snapshot immutable
      // later eligibility change: follow_up_required → false (unschedule first to satisfy CHECK)
      await q(c, `update public.player_protection_interventions set follow_up_date=null where id=$1`, [IVDATE]);
      await q(c, `update public.player_protection_interventions set follow_up_required=false where id=$1`, [IVDATE]);
      rep = await rpc(c, [IVDATE, C, UA, kk(60), TODAY]);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.occurrence_id, r.occurrence_id);   // replay survives ineligibility
    });

    await t.test('security posture: service_role SELECT-only; RPC EXECUTE matrix; SECURITY DEFINER', async () => {
      assert.equal(await priv(c, 'service_role', 'public.intervention_follow_up_events', 'SELECT'), true);
      assert.equal(await priv(c, 'service_role', 'public.intervention_follow_up_events', 'INSERT'), false);
      assert.equal(await priv(c, 'service_role', 'public.intervention_follow_up_events', 'UPDATE'), false);
      assert.equal(await priv(c, 'service_role', 'public.intervention_follow_up_events', 'DELETE'), false);
      assert.equal(await priv(c, 'authenticated', 'public.intervention_follow_up_events', 'SELECT'), false);
      assert.equal(await priv(c, 'authenticated', 'public.intervention_follow_up_events', 'INSERT'), false);
      assert.equal(await priv(c, 'anon', 'public.intervention_follow_up_events', 'SELECT'), false);
      const sig = 'public.sbiq_b10_record_follow_up_occurrence(uuid,uuid,uuid,uuid,date)';
      assert.equal((await q(c, `select has_function_privilege('service_role',$1,'EXECUTE') e`, [sig])).rows[0].e, true);
      assert.equal((await q(c, `select has_function_privilege('authenticated',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select has_function_privilege('anon',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select prosecdef from pg_proc where proname='sbiq_b10_record_follow_up_occurrence'`)).rows[0].prosecdef, true);
      assert.equal((await q(c, `select relforcerowsecurity from pg_class where relname='intervention_follow_up_events'`)).rows[0].relforcerowsecurity, true);
    });

    await t.test('audit metadata is PII-free occurrence evidence', async () => {
      const ok = await rpc(c, [IV2, C2, UX, kk(71), TODAY]);     // clean occurrence in the other casino
      assert.equal(ok.status, 'CREATED');
      const md = (await q(c, `select metadata from public.audit_events where resource_id=$1`, [ok.occurrence_id])).rows[0].metadata;
      assert.ok(Object.prototype.hasOwnProperty.call(md, 'timing_classification'));
      assert.ok(Object.prototype.hasOwnProperty.call(md, 'scheduled_date_present'));
      assert.ok(Object.prototype.hasOwnProperty.call(md, 'intervention_id'));
      assert.ok(!('player_id' in md) && !('recorded_by' in md) && !('fingerprint' in md) && !('b10_idempotency_key' in md));
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
