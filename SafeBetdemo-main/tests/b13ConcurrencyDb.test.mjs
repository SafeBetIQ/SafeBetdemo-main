// SafeBet IQ — B13.1 TRUE-CONCURRENCY acceptance (real Postgres, disposable only).
// Independent pg connections fire the create / begin-send RPCs with overlapping in-flight
// statements (Promise.all) — real backend contention, not sequential simulation.
//   1. same request key (same intervention)      → {CREATED, REPLAYED}, one row, one requested audit
//   2. cross-intervention same request key        → {CREATED, IDEMPOTENCY_CONFLICT}, loser no row/audit
//   3. two keys same intervention (sequence race)  → both CREATED, sequences {N, N+1}
//   4. same-communication send key                 → {BEGUN, REPLAYED}, SUBMITTING, one send_requested audit
//   5. cross-communication same send key           → {BEGUN, IDEMPOTENCY_CONFLICT}, loser fully rolled back
// Gated by B13_TEST_DATABASE_URL; MUST be disposable (guarded). Unset ⇒ SKIP.
//   SAFEBET_DISPOSABLE_TEST_DB=1 B13_TEST_DATABASE_URL=postgres://... node --test tests/b13ConcurrencyDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assertDisposableDb } from './_disposableDbGuard.mjs';

const DSN = process.env.B13_TEST_DATABASE_URL;
const skip = DSN ? false : 'B13_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261014130000_b13_1_player_communication_core.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111';
const UA = '44444444-4444-4444-4444-444444444444';
const IV1 = 'a0000000-0000-0000-0000-000000000001';
const IV2A = 'a0000000-0000-0000-0000-00000000002a', IV2B = 'a0000000-0000-0000-0000-00000000002b';
const IV3 = 'a0000000-0000-0000-0000-000000000003';
const IV4 = 'a0000000-0000-0000-0000-000000000004';
const IV5 = 'a0000000-0000-0000-0000-000000000005';
const RK1 = 'b0000000-0000-0000-0000-000000000001';
const RK2 = 'b0000000-0000-0000-0000-000000000002';
const RK3A = 'b0000000-0000-0000-0000-00000000003a', RK3B = 'b0000000-0000-0000-0000-00000000003b';
const RK4 = 'b0000000-0000-0000-0000-000000000004';
const RK5A = 'b0000000-0000-0000-0000-00000000005a', RK5B = 'b0000000-0000-0000-0000-00000000005b';
const SK4 = 'c0000000-0000-0000-0000-000000000004';
const SK5 = 'c0000000-0000-0000-0000-000000000005';

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
drop schema if exists extensions cascade; create schema extensions;
create or replace function extensions.digest(data bytea, kind text) returns bytea language sql immutable as $$ select sha256(data) $$;
drop table if exists public.intervention_player_communications cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.users cascade; drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator');
create table public.casinos(id uuid primary key);
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
create table public.player_protection_interventions(id uuid primary key, casino_id uuid not null, intervention_type text not null);
create table public.audit_events(
  id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text, event_category text, action text, resource_type text, resource_id text,
  user_id uuid, user_role text, casino_id uuid, severity text, outcome text, metadata jsonb,
  created_at timestamptz not null default now());
insert into public.casinos values ('${C}');
insert into public.users values ('${UA}','casino_admin','${C}');
insert into public.player_protection_interventions values
  ('${IV1}','${C}','limit_setting'),('${IV2A}','${C}','limit_setting'),('${IV2B}','${C}','limit_setting'),
  ('${IV3}','${C}','limit_setting'),('${IV4}','${C}','limit_setting'),('${IV5}','${C}','limit_setting');
`;

async function newClient() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const createOn = async (c, iv, key) => (await c.query(`select * from public.sbiq_b13_create_player_communication($1,$2,$3,'LIMIT_CONFIRMATION','rg.limit_confirmation',$4)`, [C, UA, iv, key])).rows[0];
const beginOn = async (c, comm, sendKey) => (await c.query(`select * from public.sbiq_b13_begin_player_communication_send($1,$2,$3,$4)`, [C, UA, comm, sendKey])).rows[0].status;
const commCount = async (c, iv) => Number((await c.query(`select count(*)::int n from public.intervention_player_communications where intervention_id=$1`, [iv])).rows[0].n);
const auditCount = async (c, commId, action) => Number((await c.query(`select count(*)::int n from public.audit_events where resource_id=$1 and action=$2`, [commId, action])).rows[0].n);
const commRow = async (c, id) => (await c.query(`select status, send_idempotency_key, send_fingerprint, send_requested_by, send_requested_at from public.intervention_player_communications where id=$1`, [id])).rows[0];

test('B13.1 true concurrency', { skip }, async (t) => {
  assertDisposableDb(DSN);
  const admin = await newClient();
  await admin.query(BOOT); await admin.query(MIG);
  const c1 = await newClient();
  const c2 = await newClient();
  try {
    const p1 = (await c1.query('select pg_backend_pid() p')).rows[0].p;
    const p2 = (await c2.query('select pg_backend_pid() p')).rows[0].p;
    assert.notEqual(p1, p2, 'two independent backend connections');

    await t.test('1 — same request key: CREATED + REPLAYED, one row, one requested audit', async () => {
      const [r1, r2] = await Promise.all([createOn(c1, IV1, RK1), createOn(c2, IV1, RK1)]);
      assert.deepEqual([r1.status, r2.status].sort(), ['CREATED', 'REPLAYED']);
      const id = (r1.communication_id || r2.communication_id);
      assert.ok(id, 'a communication id returned');
      assert.equal(r1.communication_id, r2.communication_id, 'same row returned to both');
      assert.equal(await commCount(admin, IV1), 1, 'exactly one row');
      assert.equal(await auditCount(admin, id, 'intervention.player_communication_requested'), 1, 'one requested audit');
    });

    await t.test('2 — cross-intervention same request key: CREATED + IDEMPOTENCY_CONFLICT, loser no row/audit', async () => {
      const [r1, r2] = await Promise.all([createOn(c1, IV2A, RK2), createOn(c2, IV2B, RK2)]);
      assert.deepEqual([r1.status, r2.status].sort(), ['CREATED', 'IDEMPOTENCY_CONFLICT']);
      const total = await commCount(admin, IV2A) + await commCount(admin, IV2B);
      assert.equal(total, 1, 'exactly one row created across the pair (loser rolled back)');
    });

    await t.test('3 — two keys same intervention: both CREATED, sequences {1,2}', async () => {
      const [r1, r2] = await Promise.all([createOn(c1, IV3, RK3A), createOn(c2, IV3, RK3B)]);
      assert.deepEqual([r1.status, r2.status].sort(), ['CREATED', 'CREATED']);
      assert.deepEqual([r1.sequence, r2.sequence].sort((a, b) => a - b), [1, 2], 'distinct N / N+1 sequences');
      assert.equal(await commCount(admin, IV3), 2, 'two rows, UNIQUE(casino,intervention,sequence) held');
    });

    await t.test('4 — same-communication send key: BEGUN + REPLAYED, SUBMITTING, one send_requested audit', async () => {
      const created = await createOn(admin, IV4, RK4);
      const comm = created.communication_id;
      const [s1, s2] = await Promise.all([beginOn(c1, comm, SK4), beginOn(c2, comm, SK4)]);
      assert.deepEqual([s1, s2].sort(), ['BEGUN', 'REPLAYED']);
      const row = await commRow(admin, comm);
      assert.equal(row.status, 'SUBMITTING');
      assert.ok(row.send_requested_by && row.send_requested_at && row.send_idempotency_key && row.send_fingerprint, 'send fields set exactly once');
      assert.equal(await auditCount(admin, comm, 'intervention.player_communication_send_requested'), 1, 'one send_requested audit');
    });

    await t.test('5 — cross-communication same send key: BEGUN + IDEMPOTENCY_CONFLICT, loser fully rolled back', async () => {
      const a = await createOn(admin, IV5, RK5A);
      const b = await createOn(admin, IV5, RK5B);
      const [s1, s2] = await Promise.all([beginOn(c1, a.communication_id, SK5), beginOn(c2, b.communication_id, SK5)]);
      assert.deepEqual([s1, s2].sort(), ['BEGUN', 'IDEMPOTENCY_CONFLICT']);
      const ra = await commRow(admin, a.communication_id);
      const rb = await commRow(admin, b.communication_id);
      const loser = ra.status === 'PENDING' ? ra : rb;
      const winner = ra.status === 'SUBMITTING' ? ra : rb;
      assert.equal(winner.status, 'SUBMITTING', 'winner advanced');
      assert.equal(loser.status, 'PENDING', 'loser still PENDING');
      assert.equal(loser.send_idempotency_key, null, 'loser send key NULL');
      assert.equal(loser.send_fingerprint, null, 'loser send fingerprint NULL');
      assert.equal(loser.send_requested_by, null, 'loser send_requested_by NULL');
      assert.equal(loser.send_requested_at, null, 'loser send_requested_at NULL');
      const loserId = ra.status === 'PENDING' ? a.communication_id : b.communication_id;
      assert.equal(await auditCount(admin, loserId, 'intervention.player_communication_send_requested'), 0, 'no send_requested audit for loser (subtransaction rollback)');
    });
  } finally {
    await c1.end().catch(() => {}); await c2.end().catch(() => {}); await admin.end().catch(() => {});
  }
});
