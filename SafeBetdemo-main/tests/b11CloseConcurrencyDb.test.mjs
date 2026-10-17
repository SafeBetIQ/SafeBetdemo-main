// SafeBet IQ — B11 TRUE-CONCURRENCY acceptance (real Postgres, disposable only).
// Two independent pg connections fire the close RPC with overlapping in-flight statements
// (Promise.all), proving real backend contention — NOT sequential simulation.
//   Case A: same intervention + same idempotency key → {CLOSED, REPLAYED}, one closure audit.
//   Case B: cross-intervention + same key → {CLOSED, IDEMPOTENCY_CONFLICT}, loser unchanged,
//           exactly one closure audit (deterministic event_id is casino+key, intervention-independent).
// Gated by B11_TEST_DATABASE_URL; MUST be a disposable local/CI database (guarded). Unset ⇒ SKIP.
//   SAFEBET_DISPOSABLE_TEST_DB=1 B11_TEST_DATABASE_URL=postgres://... node --test tests/b11CloseConcurrencyDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertDisposableDb } from './_disposableDbGuard.mjs';

const DSN = process.env.B11_TEST_DATABASE_URL;
const skip = DSN ? false : 'B11_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(join(here, '..', 'supabase', 'migrations', f), 'utf8');
const MIG_B8 = mig('20261006120000_b8_follow_up_scheduling.sql');
const MIG_B10 = mig('20261013120000_b10_follow_up_occurrence.sql');
const MIG_B11 = mig('20261013130000_b11_close_follow_up_requirement.sql');

const C = '11111111-1111-1111-1111-111111111111';
const P = '33333333-3333-3333-3333-333333333333';
const UA = '44444444-4444-4444-4444-444444444444';
const IV_A = 'da000000-0000-0000-0000-000000000001';   // case A
const IV_B1 = 'db000000-0000-0000-0000-000000000001';  // case B pair
const IV_B2 = 'db000000-0000-0000-0000-000000000002';
const KEYA = 'c0a00000-0000-0000-0000-000000000001';
const KEYB = 'c0b00000-0000-0000-0000-000000000002';

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
insert into public.casinos values ('${C}');
insert into public.players values ('${P}','${C}');
insert into public.users values ('${UA}','casino_admin','${C}');
insert into public.player_protection_interventions(id,casino_id,player_id,intervention_date,follow_up_required,follow_up_date)
  values ('${IV_A}','${C}','${P}','2020-01-01T00:00:00Z',true,'2026-06-10'),
         ('${IV_B1}','${C}','${P}','2020-01-01T00:00:00Z',true,'2026-08-15'),
         ('${IV_B2}','${C}','${P}','2020-01-01T00:00:00Z',true,'2026-09-20');
`;

async function newClient() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
// RPC signature order is (p_intervention_id, p_casino_id, p_actor_id, p_idempotency_key).
const closeOn = async (c, iv, key) => (await c.query(`select * from public.sbiq_b11_close_follow_up_requirement($1,$2,$3,$4)`, [iv, C, UA, key])).rows[0].status;
const rowOf = async (c, id) => (await c.query(`select follow_up_required, follow_up_date from public.player_protection_interventions where id=$1`, [id])).rows[0];
const closureAudits = async (c, ids) => Number((await c.query(`select count(*)::int n from public.audit_events where action='intervention.follow_up_requirement_closed' and resource_id = any($1)`, [ids])).rows[0].n);

test('B11 true concurrency', { skip }, async (t) => {
  assertDisposableDb(DSN);
  const admin = await newClient();
  await admin.query(BOOT); await admin.query(MIG_B8); await admin.query(MIG_B10); await admin.query(MIG_B11);
  const c1 = await newClient();
  const c2 = await newClient();
  try {
    // proof of two distinct backends
    const p1 = (await c1.query('select pg_backend_pid() p')).rows[0].p;
    const p2 = (await c2.query('select pg_backend_pid() p')).rows[0].p;
    assert.notEqual(p1, p2, 'two independent backend connections');

    await t.test('case A — same intervention + same key: CLOSED + REPLAYED, one closure audit', async () => {
      const [s1, s2] = await Promise.all([closeOn(c1, IV_A, KEYA), closeOn(c2, IV_A, KEYA)]);
      assert.deepEqual([s1, s2].sort(), ['CLOSED', 'REPLAYED'], 'exactly one winner + one replay');
      assert.deepEqual(await rowOf(admin, IV_A), { follow_up_required: false, follow_up_date: null }, 'requirement closed + date cleared');
      assert.equal(await closureAudits(admin, [IV_A]), 1, 'exactly one closure audit');
      assert.equal((await admin.query(`select count(*)::int n from public.audit_events where event_id='b11:follow-up-close:'||$1||':'||$2`, [C, KEYA])).rows[0].n, 1, 'one deterministic idempotency event');
    });

    await t.test('case B — cross-intervention + same key: CLOSED + IDEMPOTENCY_CONFLICT, loser unchanged', async () => {
      const [s1, s2] = await Promise.all([closeOn(c1, IV_B1, KEYB), closeOn(c2, IV_B2, KEYB)]);
      assert.deepEqual([s1, s2].sort(), ['CLOSED', 'IDEMPOTENCY_CONFLICT'], 'one winner + one conflict');
      const r1 = await rowOf(admin, IV_B1);
      const r2 = await rowOf(admin, IV_B2);
      const closed = [r1, r2].filter((r) => r.follow_up_required === false).length;
      const intact = [r1, r2].filter((r) => r.follow_up_required === true && r.follow_up_date !== null).length;
      assert.equal(closed, 1, 'exactly one intervention closed');
      assert.equal(intact, 1, 'loser intervention fully unchanged (still required + original date)');
      assert.equal(await closureAudits(admin, [IV_B1, IV_B2]), 1, 'exactly one closure audit across the pair');
    });
  } finally {
    await c1.end().catch(() => {}); await c2.end().catch(() => {}); await admin.end().catch(() => {});
  }
});
