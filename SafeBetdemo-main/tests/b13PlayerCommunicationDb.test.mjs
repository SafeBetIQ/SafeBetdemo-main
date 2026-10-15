// SafeBet IQ — B13.1 DB-runtime behaviour (the three player-communication RPCs: create /
// begin-send / record-receipt lifecycle, idempotency + conflict arbitration, lifecycle CHECK,
// service_role SELECT-only + RPC EXECUTE matrix, FORCE RLS, system-actor audit). Runs ONLY
// against a DISPOSABLE Postgres named by B13_TEST_DATABASE_URL (bootstraps a minimal schema +
// applies the real migration). MUST NEVER point at IQ Demo/Production. Unset ⇒ SKIP.
// Equivalent behaviour is also proven on in-process PGlite.
//   B13_TEST_DATABASE_URL=postgres://... node --test tests/b13PlayerCommunicationDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B13_TEST_DATABASE_URL;
const skip = DSN ? false : 'B13_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261014130000_b13_1_player_communication_core.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const UA = '44444444-4444-4444-4444-444444444444', UC = '45004500-4444-4444-4444-444444444444',
      US = '45454545-4444-4444-4444-444444444444', UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
const IV_LIMIT = 'a0000000-0000-0000-0000-000000000001';     // limit_setting (eligible)
const IV_MANUAL = 'a0000000-0000-0000-0000-000000000002';    // manual_review (ineligible)
const IV_C2 = 'a0000000-0000-0000-0000-000000000003';        // belongs to C2
const K1 = 'b0000000-0000-0000-0000-000000000001', K2 = 'b0000000-0000-0000-0000-000000000002', K3 = 'b0000000-0000-0000-0000-000000000003';
const S1 = 'c0000000-0000-0000-0000-000000000001', S2 = 'c0000000-0000-0000-0000-000000000002';

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
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
insert into public.casinos values ('${C}'),('${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${UC}','compliance_officer','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
insert into public.player_protection_interventions values ('${IV_LIMIT}','${C}','limit_setting'),('${IV_MANUAL}','${C}','manual_review'),('${IV_C2}','${C2}','limit_setting');
`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
const create = async (c, a) => (await q(c, `select * from public.sbiq_b13_create_player_communication($1,$2,$3,$4,$5,$6)`, a)).rows[0];
const begin = async (c, a) => (await q(c, `select * from public.sbiq_b13_begin_player_communication_send($1,$2,$3,$4)`, a)).rows[0].status;
const receipt = async (c, a) => (await q(c, `select * from public.sbiq_b13_record_player_communication_receipt($1,$2,$3,$4,$5)`, a)).rows[0].status;
const cnt = async (c, s, p) => Number((await q(c, s, p)).rows[0].c);
async function raises(c, s, p) { try { await q(c, s, p); return false; } catch { return true; } }

test('B13.1 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG);

    let commId;
    await t.test('create: CREATED → sequence 1 + requested audit (human actor)', async () => {
      const r = await create(c, [C, UA, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K1]);
      assert.equal(r.status, 'CREATED'); assert.equal(r.sequence, 1); assert.ok(r.communication_id);
      commId = r.communication_id;
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where resource_id=$1 and action='intervention.player_communication_requested' and user_id=$2 and user_role='casino_admin'`, [commId, UA]), 1);
    });

    await t.test('create: REPLAYED (same key) returns same id/sequence', async () => {
      const r = await create(c, [C, UA, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K1]);
      assert.equal(r.status, 'REPLAYED'); assert.equal(r.communication_id, commId); assert.equal(r.sequence, 1);
    });

    await t.test('create: IDEMPOTENCY_CONFLICT (same key, different type)', async () => {
      const r = await create(c, [C, UA, IV_LIMIT, 'TIMEOUT_CONFIRMATION', 'rg.timeout_confirmation', K1]);
      assert.equal(r.status, 'IDEMPOTENCY_CONFLICT'); assert.equal(r.communication_id, null);
    });

    await t.test('create: NOT_FOUND unknown / cross-casino intervention', async () => {
      assert.equal((await create(c, [C, UA, 'a0000000-0000-0000-0000-0000000000ff', 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K2])).status, 'NOT_FOUND');
      assert.equal((await create(c, [C, UA, IV_C2, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K2])).status, 'NOT_FOUND');
    });

    await t.test('create: INVALID_STATE on ineligible type + mismatched mapping', async () => {
      assert.equal((await create(c, [C, UA, IV_MANUAL, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K2])).status, 'INVALID_STATE');
      assert.equal((await create(c, [C, UA, IV_LIMIT, 'TIMEOUT_CONFIRMATION', 'rg.timeout_confirmation', K2])).status, 'INVALID_STATE'); // type≠intervention
    });

    await t.test('create: actor matrix (regulator/cross-casino/missing rejected)', async () => {
      assert.ok(await raises(c, `select public.sbiq_b13_create_player_communication($1,$2,$3,$4,$5,$6)`, [C, UR, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K3]));
      assert.ok(await raises(c, `select public.sbiq_b13_create_player_communication($1,$2,$3,$4,$5,$6)`, [C, UX, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K3]));
      assert.ok(await raises(c, `select public.sbiq_b13_create_player_communication($1,$2,$3,$4,$5,$6)`, [C, '48484848-4444-4444-4444-444444444444', IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K3]));
    });

    await t.test('begin-send: BEGUN → SUBMITTING + send-requested audit (human); REPLAYED', async () => {
      assert.equal(await begin(c, [C, UA, commId, S1]), 'BEGUN');
      assert.equal((await q(c, `select status from public.intervention_player_communications where id=$1`, [commId])).rows[0].status, 'SUBMITTING');
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where resource_id=$1 and action='intervention.player_communication_send_requested' and user_id=$2`, [commId, UA]), 1);
      assert.equal(await begin(c, [C, UA, commId, S1]), 'REPLAYED');          // same send key
    });

    await t.test('begin-send: IDEMPOTENCY_CONFLICT (send key already bound elsewhere/other state)', async () => {
      // a different communication reusing S1 → conflict
      const r2 = await create(c, [C, UA, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', K3]);
      assert.equal(r2.sequence, 2);                                            // sequence increments per intervention
      assert.equal(await begin(c, [C, UA, r2.communication_id, S1]), 'IDEMPOTENCY_CONFLICT');
    });

    await t.test('receipt: SUBMITTED → DELIVERED with system actor; replay REPLAYED', async () => {
      assert.equal(await receipt(c, [C, commId, 'SUBMITTED', 'sandbox:abc', null]), 'RECORDED');
      assert.equal(await receipt(c, [C, commId, 'SUBMITTED', 'sandbox:abc', null]), 'REPLAYED');
      assert.equal(await receipt(c, [C, commId, 'DELIVERED', null, null]), 'RECORDED');
      assert.equal(await receipt(c, [C, commId, 'DELIVERED', null, null]), 'REPLAYED');
      const row = (await q(c, `select status, submitted_at, delivered_at, provider_reference from public.intervention_player_communications where id=$1`, [commId])).rows[0];
      assert.equal(row.status, 'DELIVERED'); assert.ok(row.submitted_at && row.delivered_at && row.provider_reference);
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where resource_id=$1 and user_role='system' and user_id is null`, [commId]), 2); // submitted+delivered
    });

    await t.test('receipt: INVALID_STATE for illegal transition (SUBMITTED after DELIVERED)', async () => {
      assert.equal(await receipt(c, [C, commId, 'SUBMITTED', 'sandbox:zzz', null]), 'INVALID_STATE');
    });

    await t.test('FAILED path from SUBMITTING', async () => {
      const r3 = await create(c, [C, UC, IV_LIMIT, 'LIMIT_CONFIRMATION', 'rg.limit_confirmation', 'b0000000-0000-0000-0000-00000000000f']);
      await begin(c, [C, UC, r3.communication_id, S2]);
      assert.equal(await receipt(c, [C, r3.communication_id, 'FAILED', null, 'PROVIDER_REJECTED']), 'RECORDED');
      const row = (await q(c, `select status, failed_at, failure_class, delivered_at from public.intervention_player_communications where id=$1`, [r3.communication_id])).rows[0];
      assert.equal(row.status, 'FAILED'); assert.ok(row.failed_at); assert.equal(row.failure_class, 'PROVIDER_REJECTED'); assert.equal(row.delivered_at, null);
    });

    await t.test('lifecycle CHECK rejects contradictory owner-level row', async () => {
      // even the table owner cannot persist a DELIVERED row with null delivered_at
      assert.ok(await raises(c, `update public.intervention_player_communications set status='DELIVERED', delivered_at=null where id=$1`, [commId]));
    });

    await t.test('delivery_mode CHECK blocks non-SANDBOX', async () => {
      assert.ok(await raises(c, `update public.intervention_player_communications set delivery_mode='LIVE' where id=$1`, [commId]));
    });

    await t.test('security posture', async () => {
      const tp = async (role, p) => (await q(c, `select has_table_privilege($1,'public.intervention_player_communications',$2) x`, [role, p])).rows[0].x;
      assert.equal(await tp('service_role', 'SELECT'), true);
      assert.equal(await tp('service_role', 'INSERT'), false);
      assert.equal(await tp('service_role', 'UPDATE'), false);
      assert.equal(await tp('service_role', 'DELETE'), false);
      assert.equal(await tp('authenticated', 'SELECT'), false);
      assert.equal(await tp('anon', 'SELECT'), false);
      assert.equal((await q(c, `select relforcerowsecurity from pg_class where relname='intervention_player_communications'`)).rows[0].relforcerowsecurity, true);
      assert.equal(await cnt(c, `select count(*)::int c from pg_policies where tablename='intervention_player_communications'`), 0);
      for (const sig of [
        'public.sbiq_b13_create_player_communication(uuid,uuid,uuid,text,text,uuid)',
        'public.sbiq_b13_begin_player_communication_send(uuid,uuid,uuid,uuid)',
        'public.sbiq_b13_record_player_communication_receipt(uuid,uuid,text,text,text)']) {
        assert.equal((await q(c, `select has_function_privilege('service_role',$1,'EXECUTE') e`, [sig])).rows[0].e, true);
        assert.equal((await q(c, `select has_function_privilege('authenticated',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
        assert.equal((await q(c, `select has_function_privilege('anon',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      }
      assert.equal(await cnt(c, `select count(*)::int c from pg_proc where proname like 'sbiq_b13_%' and prosecdef`), 3);
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
