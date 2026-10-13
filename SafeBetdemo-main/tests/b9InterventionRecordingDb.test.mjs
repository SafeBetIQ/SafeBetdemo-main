// SafeBet IQ — B9 DB-runtime behaviour (honest insert, alert derivation, actor validation,
// atomic create+link+audit, fingerprinted idempotency incl. replay after B8 reschedule and
// B6 supersession). Runs ONLY against a DISPOSABLE Postgres named by B9_TEST_DATABASE_URL;
// bootstraps a minimal schema and applies the real migration. MUST NEVER point at IQ Demo/
// Production. Unset ⇒ SKIP. Equivalent behaviour proven in-process on PGlite (35/35).
//   B9_TEST_DATABASE_URL=postgres://... node --test tests/b9InterventionRecordingDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B9_TEST_DATABASE_URL;
const skip = DSN ? false : 'B9_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIG = readFileSync(join(here, '..', 'supabase', 'migrations', '20261011120000_b9_governed_intervention_recording.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333', P2 = '3a3a3a3a-3333-3333-3333-333333333333';
const UA = '44444444-4444-4444-4444-444444444444', US = '45454545-4444-4444-4444-444444444444', UR = '46464646-4444-4444-4444-444444444444', UX = '47474747-4444-4444-4444-444444444444';
const AO = 'a0000000-0000-0000-0000-000000000001', AK = 'a0000000-0000-0000-0000-000000000002', AR = 'a0000000-0000-0000-0000-000000000003', AX = 'a0000000-0000-0000-0000-000000000004';
const kk = (n) => `c0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;

const BOOT = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
end $$;
drop schema if exists extensions cascade; create schema extensions;
create or replace function extensions.digest(data bytea, kind text) returns bytea language sql immutable as $$ select sha256(data) $$;
drop table if exists public.alert_intervention_links cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.player_protection_alerts cascade;
drop table if exists public.players cascade; drop table if exists public.staff cascade;
drop table if exists public.users cascade; drop table if exists public.casinos cascade;
drop type if exists user_role cascade;
create type user_role as enum ('casino_admin','compliance_officer','super_admin','regulator');
create table public.casinos(id uuid primary key);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id));
create table public.staff(id uuid primary key);
create table public.users(id uuid primary key, role user_role not null, casino_id uuid);
create table public.player_protection_alerts(id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), status text not null default 'OPEN', unique(id,casino_id,player_id));
create table public.player_protection_interventions(
  id uuid primary key default gen_random_uuid(), casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), intervention_date timestamptz not null default now(),
  intervention_type text check (intervention_type in ('ai_alert','manual_review','limit_setting','timeout','self_exclusion_referral','helpline_referral','counseling_referral')),
  risk_score int, trigger_reason text not null, action_taken text not null,
  outcome text check (outcome in ('accepted','declined','pending','successful','unsuccessful')),
  follow_up_required boolean default false, follow_up_date date, staff_id uuid references public.staff(id),
  notes text, created_at timestamptz default now(), dispatch_status text default 'sent', triggered_at timestamptz default now(),
  risk_score_at_trigger numeric, intervention_successful boolean default true, auto_triggered boolean default true,
  channel text not null default 'system', message_content text, delivered_at timestamptz, delivery_attempts int not null default 0,
  delivery_error text, acknowledged_at timestamptz, acknowledged_by text, risk_score_after int, nrgp_reported boolean not null default false,
  nrgp_reported_at timestamptz, compliance_ref text, source text not null default 'auto' check (source in ('auto','manual','regulator_mandated')),
  constraint ppi_follow_up_consistency check (follow_up_required is true or follow_up_date is null), unique(id,casino_id,player_id));
create table public.audit_events(id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null, resource_type text, resource_id text,
  user_id uuid, user_role text, casino_id uuid, severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
create table public.alert_intervention_links(id uuid primary key default gen_random_uuid(), casino_id uuid not null, alert_id uuid not null,
  intervention_id uuid not null, player_id uuid not null, linked_at timestamptz not null default now(), linked_by uuid not null,
  supersedes_link_id uuid, superseded_at timestamptz, superseded_by uuid,
  constraint ail_alert_fk foreign key (alert_id,casino_id,player_id) references public.player_protection_alerts(id,casino_id,player_id),
  constraint ail_iv_fk foreign key (intervention_id,casino_id,player_id) references public.player_protection_interventions(id,casino_id,player_id));
create unique index ail_active_pair_uq on public.alert_intervention_links(alert_id,intervention_id) where superseded_at is null;
create function public.sbiq_b6_link_after_insert() returns trigger language plpgsql as $$
begin insert into public.audit_events(event_id,event_type,event_category,action,resource_type,resource_id,user_id,user_role,casino_id,severity,outcome,metadata)
  values('ail:'||NEW.id::text,'protection_alert.intervention_linked','responsible_gambling','protection_alert.intervention_linked','alert_intervention_link',NEW.id::text,NEW.linked_by,'',NEW.casino_id,'info','success',jsonb_build_object('alert_id',NEW.alert_id,'intervention_id',NEW.intervention_id)); return NEW; end $$;
create trigger trg_b6_link_after_insert after insert on public.alert_intervention_links for each row execute function public.sbiq_b6_link_after_insert();
insert into public.casinos values ('${C}'),('${C2}');
insert into public.players values ('${P}','${C}'),('${P2}','${C2}');
insert into public.users values ('${UA}','casino_admin','${C}'),('${US}','super_admin',null),('${UR}','regulator',null),('${UX}','casino_admin','${C2}');
insert into public.player_protection_alerts values ('${AO}','${C}','${P}','OPEN'),('${AK}','${C}','${P}','ACKNOWLEDGED'),('${AR}','${C}','${P}','RESOLVED'),('${AX}','${C2}','${P2}','OPEN');
insert into public.player_protection_interventions(casino_id,player_id,intervention_type,trigger_reason,action_taken,source,channel) values ('${C}','${P}','ai_alert','legacy','legacy','auto','system');
`;

async function connect() { const { default: pg } = await import('pg'); const c = new pg.Client({ connectionString: DSN }); await c.connect(); return c; }
const q = (c, s, p) => c.query(s, p);
const rpc = async (c, a) => (await q(c, `select * from public.sbiq_b9_record_alert_intervention($1,$2,$3,$4,$5,$6,$7,$8)`, a)).rows[0];
async function raises(c, a) { try { await rpc(c, a); return false; } catch { return true; } }
const cnt = async (c, s, p) => Number((await q(c, s, p)).rows[0].c);

test('B9 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOT); await q(c, MIG);

    await t.test('nullability: legacy non-null row survives', async () => {
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions where trigger_reason is not null`), 1);
    });

    await t.test('honest insert profile', async () => {
      const r = await rpc(c, [AO, C, UA, kk(1), 'manual_review', 'accepted', true, '2026-06-10']);
      assert.equal(r.status, 'CREATED');
      const row = (await q(c, `select * from public.player_protection_interventions where id=$1`, [r.intervention_id])).rows[0];
      assert.equal(row.source, 'manual'); assert.equal(row.channel, 'manual'); assert.equal(row.auto_triggered, false);
      assert.equal(row.intervention_successful, null); assert.equal(row.dispatch_status, null); assert.equal(row.triggered_at, null);
      assert.equal(row.staff_id, null); assert.equal(row.trigger_reason, null); assert.equal(row.action_taken, null);
      assert.equal(row.player_id, P); assert.ok(row.b9_request_fingerprint);
    });

    await t.test('type subset, outcome, follow-up', async () => {
      assert.ok(await raises(c, [AO, C, UA, kk(2), 'ai_alert', null, false, null]));
      assert.equal((await rpc(c, [AK, C, UA, kk(3), 'timeout', null, false, null])).status, 'CREATED');
      assert.equal((await rpc(c, [AR, C, UA, kk(4), 'limit_setting', null, false, null])).status, 'CREATED');
      assert.ok(await raises(c, [AO, C, UA, kk(5), 'manual_review', 'great', false, null]));
      assert.equal((await rpc(c, [AO, C, UA, kk(6), 'manual_review', null, true, null])).status, 'CREATED');
      assert.equal((await rpc(c, [AO, C, UA, kk(7), 'manual_review', null, true, '2020-01-01'])).status, 'CREATED');
      assert.ok(await raises(c, [AO, C, UA, kk(8), 'manual_review', null, false, '2026-06-10']));
    });

    await t.test('alert derivation + actor validation', async () => {
      assert.equal((await rpc(c, [AX, C, UA, kk(9), 'manual_review', null, false, null])).status, 'NOT_FOUND');
      assert.equal((await rpc(c, ['a0000000-0000-0000-0000-0000000000ff', C, UA, kk(9), 'manual_review', null, false, null])).status, 'NOT_FOUND');
      assert.ok(await raises(c, [AO, C, UR, kk(10), 'manual_review', null, false, null]));   // regulator
      assert.ok(await raises(c, [AO, C, UX, kk(10), 'manual_review', null, false, null]));   // cross-casino actor
      assert.ok(await raises(c, [AO, C, '48484848-4444-4444-4444-444444444444', kk(10), 'manual_review', null, false, null])); // missing
      assert.equal((await rpc(c, [AO, C, US, kk(11), 'manual_review', null, false, null])).status, 'CREATED'); // super_admin
    });

    await t.test('audit + one active B6 link', async () => {
      const r = await rpc(c, [AO, C, UA, kk(12), 'helpline_referral', 'pending', true, '2026-07-01']);
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where action='intervention.recorded' and resource_id=$1`, [r.intervention_id]), 1);
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events where action='protection_alert.intervention_linked' and metadata->>'intervention_id'=$1`, [r.intervention_id]), 1);
      assert.equal(await cnt(c, `select count(*)::int c from public.alert_intervention_links where intervention_id=$1 and superseded_at is null`, [r.intervention_id]), 1);
    });

    await t.test('atomicity: audit failure and link failure roll back', async () => {
      const iv0 = await cnt(c, `select count(*)::int c from public.player_protection_interventions`);
      await q(c, `alter table public.audit_events add constraint tmp_b check (action <> 'intervention.recorded') not valid`);
      assert.ok(await raises(c, [AO, C, UA, kk(20), 'manual_review', null, false, null]));
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions`), iv0);
      await q(c, `alter table public.audit_events drop constraint tmp_b`);
      const iv1 = await cnt(c, `select count(*)::int c from public.player_protection_interventions`);
      const au1 = await cnt(c, `select count(*)::int c from public.audit_events`);
      await q(c, `alter table public.alert_intervention_links add constraint tmp_l check (false) not valid`);
      assert.ok(await raises(c, [AO, C, UA, kk(21), 'manual_review', null, false, null]));
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions`), iv1);
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events`), au1);
      await q(c, `alter table public.alert_intervention_links drop constraint tmp_l`);
      // (C) B6 link-AUDIT trigger (protection_alert.intervention_linked) failure → whole txn rolls back
      const iv2 = await cnt(c, `select count(*)::int c from public.player_protection_interventions`);
      const au2 = await cnt(c, `select count(*)::int c from public.audit_events`);
      const lk2 = await cnt(c, `select count(*)::int c from public.alert_intervention_links`);
      await q(c, `alter table public.audit_events add constraint tmp_la check (action <> 'protection_alert.intervention_linked') not valid`);
      assert.ok(await raises(c, [AO, C, UA, kk(22), 'manual_review', null, false, null]));
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions`), iv2);
      assert.equal(await cnt(c, `select count(*)::int c from public.audit_events`), au2);
      assert.equal(await cnt(c, `select count(*)::int c from public.alert_intervention_links`), lk2);
      await q(c, `alter table public.audit_events drop constraint tmp_la`);
    });

    await t.test('idempotency CREATED/REPLAYED/CONFLICT', async () => {
      const first = await rpc(c, [AO, C, UA, kk(40), 'manual_review', 'accepted', true, '2026-06-10']);
      assert.equal(first.status, 'CREATED');
      const iv = await cnt(c, `select count(*)::int c from public.player_protection_interventions`);
      const rep = await rpc(c, [AO, C, UA, kk(40), 'manual_review', 'accepted', true, '2026-06-10']);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.intervention_id, first.intervention_id); assert.equal(rep.link_id, first.link_id);
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions`), iv);
      assert.equal((await rpc(c, [AK, C, UA, kk(40), 'manual_review', 'accepted', true, '2026-06-10'])).status, 'IDEMPOTENCY_CONFLICT');
      assert.equal((await rpc(c, [AO, C, UA, kk(40), 'timeout', 'accepted', true, '2026-06-10'])).status, 'IDEMPOTENCY_CONFLICT');
      assert.equal((await rpc(c, [AO, C, UA, kk(40), 'manual_review', 'declined', true, '2026-06-10'])).status, 'IDEMPOTENCY_CONFLICT');
      assert.equal((await rpc(c, [AO, C, UA, kk(40), 'manual_review', 'accepted', true, '2026-06-11'])).status, 'IDEMPOTENCY_CONFLICT');
    });

    await t.test('REPLAYED after B8 reschedule (durable fingerprint)', async () => {
      const r = await rpc(c, [AO, C, UA, kk(50), 'manual_review', null, true, '2026-06-10']);
      await q(c, `update public.player_protection_interventions set follow_up_date='2026-09-01' where id=$1`, [r.intervention_id]);
      const iv = await cnt(c, `select count(*)::int c from public.player_protection_interventions`);
      const rep = await rpc(c, [AO, C, UA, kk(50), 'manual_review', null, true, '2026-06-10']);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.intervention_id, r.intervention_id); assert.equal(rep.link_id, r.link_id);
      assert.equal(await cnt(c, `select count(*)::int c from public.player_protection_interventions`), iv);
    });

    await t.test('REPLAYED after B6 supersession (original link)', async () => {
      const r = await rpc(c, [AR, C, UA, kk(51), 'counseling_referral', null, true, null]);
      await q(c, `update public.alert_intervention_links set superseded_at=now(), superseded_by=$1 where id=$2`, [UA, r.link_id]);
      const rep = await rpc(c, [AR, C, UA, kk(51), 'counseling_referral', null, true, null]);
      assert.equal(rep.status, 'REPLAYED'); assert.equal(rep.intervention_id, r.intervention_id); assert.equal(rep.link_id, r.link_id);
    });

    await t.test('EXECUTE service_role only; SECURITY DEFINER', async () => {
      const sig = 'public.sbiq_b9_record_alert_intervention(uuid,uuid,uuid,uuid,text,text,boolean,date)';
      assert.equal((await q(c, `select has_function_privilege('service_role',$1,'EXECUTE') e`, [sig])).rows[0].e, true);
      assert.equal((await q(c, `select has_function_privilege('authenticated',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select has_function_privilege('anon',$1,'EXECUTE') e`, [sig])).rows[0].e, false);
      assert.equal((await q(c, `select prosecdef from pg_proc where proname='sbiq_b9_record_alert_intervention'`)).rows[0].prosecdef, true);
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
