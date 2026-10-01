// SafeBet IQ — B4.1 DB-runtime behaviour (triggers/constraints/identity/eligibility/
// timestamps/lifecycle/audit). Runs ONLY against a DISPOSABLE Postgres named by
// B41_TEST_DATABASE_URL; it bootstraps a self-contained minimal schema and applies the
// real forward migration. It MUST NEVER be pointed at IQ Demo / Production. When the
// env var is unset it SKIPS (the default harness has no database).
//   B41_TEST_DATABASE_URL=postgres://... node --test tests/protectionAlertsDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B41_TEST_DATABASE_URL;
const skip = DSN ? false : 'B41_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(join(here, '..', 'supabase', 'migrations', '20261001120000_b4_1_player_protection_alerts.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111';
const P = '33333333-3333-3333-3333-333333333333';
const U = '44444444-4444-4444-4444-444444444444';

const BOOTSTRAP = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
drop table if exists public.player_protection_alerts cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.self_exclusions cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.players cascade;
drop table if exists public.users cascade;
drop table if exists public.casinos cascade;
drop function if exists public.sbiq_ppa_validate cascade;
drop function if exists public.sbiq_ppa_audit cascade;
create table public.casinos(id uuid primary key, jurisdiction text not null, province text);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id), player_id text not null);
create table public.users(id uuid primary key, role text not null);
create table public.self_exclusions(id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid references public.players(id), status text not null, breach_count integer);
create table public.player_protection_interventions(id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), follow_up_required boolean, follow_up_date date);
-- minimal audit_events matching the columns the B4.1 audit trigger inserts (no chain trigger needed)
create table public.audit_events(
  id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null,
  resource_type text, resource_id text, user_id uuid, user_role text, casino_id uuid,
  severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
grant insert, select on public.audit_events to service_role;
grant select on public.casinos, public.players, public.users, public.self_exclusions, public.player_protection_interventions to service_role;
insert into public.casinos values ('${C}','ZA','WC');
insert into public.players values ('${P}','${C}','SB-PLR-TEST');
insert into public.users values ('${U}','compliance_officer');
`;

async function connect() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  return client;
}
const q = (c, sql, params) => c.query(sql, params);
async function raises(c, sql, params) {
  try { await q(c, sql, params); return false; } catch { return true; }
}

test('B4.1 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOTSTRAP);
    await q(c, MIGRATION);
    await q(c, `set role service_role`);

    const se = '55555555-5555-5555-5555-555555555555';    // breached, null breach_count
    const seActive = '66666666-6666-6666-6666-666666666666';
    const ivOverdue = '77777777-7777-7777-7777-777777777777';
    const ivToday = '88888888-8888-8888-8888-888888888888';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 10);
    await q(c, `insert into public.self_exclusions values ($1,$2,$3,'breached',null)`, [se, C, P]);
    await q(c, `insert into public.self_exclusions values ($1,$2,$3,'active',1)`, [seActive, C, P]);
    await q(c, `insert into public.player_protection_interventions values ($1,$2,$3,true,$4)`, [ivOverdue, C, P, yesterday]);
    await q(c, `insert into public.player_protection_interventions values ($1,$2,$3,true,$4)`, [ivToday, C, P, today]);

    const insBreach = `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, self_exclusion_id, generated_by)
      values ($1,$2,'SELF_EXCLUSION_BREACH_REVIEW','v1.0.0',$3,$4) returning id, status, evidence, generated_at, acknowledged_at, resolved_at`;

    await t.test('Rule A breached insert → OPEN, DB evidence (null breach_count honest), DB timestamp', async () => {
      const r = await q(c, insBreach, [C, P, se, U]);
      assert.equal(r.rows[0].status, 'OPEN');
      assert.equal(r.rows[0].evidence.self_exclusion_status, 'breached');
      assert.equal(r.rows[0].evidence.breach_count, null);     // preserved honestly, not 0
      assert.equal(r.rows[0].evidence.rule_version, 'v1.0.0');
      assert.ok(r.rows[0].generated_at);                       // DB-owned
      assert.equal(r.rows[0].acknowledged_at, null);
    });

    await t.test('identity: duplicate breach alert for same self_exclusion_id rejected', async () => {
      assert.ok(await raises(c, insBreach, [C, P, se, U]));
    });

    await t.test('Rule A ineligible (active) rejected; null-player rejected', async () => {
      assert.ok(await raises(c, insBreach, [C, P, seActive, U]));
    });

    await t.test('Rule C: overdue (yesterday SAST) inserts; today is NOT overdue', async () => {
      const insIv = (iv) => q(c, `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, intervention_id, generated_by)
        values ($1,$2,'INTERVENTION_FOLLOW_UP_OVERDUE','v1.0.0',$3,$4) returning evidence`, [C, P, iv, U]);
      const r = await insIv(ivOverdue);
      assert.equal(r.rows[0].evidence.follow_up_date, yesterday);
      assert.ok(await raises(c, `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, intervention_id, generated_by)
        values ($1,$2,'INTERVENTION_FOLLOW_UP_OVERDUE','v1.0.0',$3,$4)`, [C, P, ivToday, U]));
    });

    await t.test('rule_version empty rejected', async () => {
      assert.ok(await raises(c, `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, self_exclusion_id, generated_by)
        values ($1,$2,'SELF_EXCLUSION_BREACH_REVIEW','  ',$3,$4)`, [C, P, se, U]));
    });

    await t.test('lifecycle: OPEN→ACK sets DB acknowledged_at; ACK→RESOLVED keeps ack; reopen rejected', async () => {
      const id = (await q(c, `select id from public.player_protection_alerts where self_exclusion_id=$1`, [se])).rows[0].id;
      await q(c, `update public.player_protection_alerts set status='ACKNOWLEDGED', acknowledged_by=$2 where id=$1`, [id, U]);
      let row = (await q(c, `select status, acknowledged_at, acknowledged_by, resolved_at from public.player_protection_alerts where id=$1`, [id])).rows[0];
      assert.equal(row.status, 'ACKNOWLEDGED'); assert.ok(row.acknowledged_at); assert.equal(row.resolved_at, null);
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [id, U]);
      row = (await q(c, `select status, acknowledged_at, resolved_at from public.player_protection_alerts where id=$1`, [id])).rows[0];
      assert.equal(row.status, 'RESOLVED'); assert.ok(row.acknowledged_at); assert.ok(row.resolved_at);
      assert.ok(await raises(c, `update public.player_protection_alerts set status='OPEN' where id=$1`, [id]));      // no reopen
    });

    await t.test('id + evidence immutable on UPDATE', async () => {
      const id = (await q(c, `select id from public.player_protection_alerts where intervention_id=$1`, [ivOverdue])).rows[0].id;
      assert.ok(await raises(c, `update public.player_protection_alerts set id=gen_random_uuid() where id=$1`, [id]));
      assert.ok(await raises(c, `update public.player_protection_alerts set evidence='{"x":1}'::jsonb where id=$1`, [id]));
    });

    await t.test('OPEN→RESOLVED cannot fabricate acknowledgement attribution', async () => {
      const id = (await q(c, `select id from public.player_protection_alerts where intervention_id=$1`, [ivOverdue])).rows[0].id;
      assert.ok(await raises(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2, acknowledged_by=$2, acknowledged_at=now() where id=$1`, [id, U]));
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [id, U]);
      const row = (await q(c, `select acknowledged_at, acknowledged_by from public.player_protection_alerts where id=$1`, [id])).rows[0];
      assert.equal(row.acknowledged_at, null); assert.equal(row.acknowledged_by, null);   // ack stays null forever
    });

    await t.test('audit chain received generated + acknowledged + resolved events', async () => {
      const n = (await q(c, `select count(*)::int c from public.audit_events where resource_type='player_protection_alert' and action in
        ('protection_alert.generated','protection_alert.acknowledged','protection_alert.resolved')`)).rows[0].c;
      assert.ok(n >= 3, `expected >= 3 lifecycle audit rows, got ${n}`);
    });
  } finally {
    await q(c, `reset role`).catch(() => {});
    await c.end();
  }
});
