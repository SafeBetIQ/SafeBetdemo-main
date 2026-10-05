// SafeBet IQ — B6 DB-runtime behaviour (composite-FK lifetime invariant, active-pair
// uniqueness, trigger-driven correction/supersession, direct-UPDATE bypass prevention,
// timestamp ownership, in-trigger audit). Runs ONLY against a DISPOSABLE Postgres named
// by B6_TEST_DATABASE_URL; it bootstraps a minimal self-contained schema and applies the
// real forward migration. It MUST NEVER be pointed at IQ Demo / Production. When the env
// var is unset it SKIPS (the default harness has no database).
//   B6_TEST_DATABASE_URL=postgres://... node --test tests/protectionActionTraceabilityDb.test.mjs
//
// Equivalent behaviour was proven in-process on a disposable PGlite (36/36) during
// implementation; this committed harness reproduces it against any disposable Postgres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B6_TEST_DATABASE_URL;
const skip = DSN ? false : 'B6_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const MIGRATION = readFileSync(join(here, '..', 'supabase', 'migrations', '20261005120000_b6_protection_action_traceability.sql'), 'utf8');

const C = '11111111-1111-1111-1111-111111111111', C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333', P2 = '3a3a3a3a-3333-3333-3333-333333333333';
const U = '44444444-4444-4444-4444-444444444444', U2 = '4b4b4b4b-4444-4444-4444-444444444444';
const A1 = 'a1111111-1111-1111-1111-111111111111', A2 = 'a2222222-2222-2222-2222-222222222222';
const IV = (n) => `b${n}111111-1111-1111-1111-111111111111`;
const IVP2 = 'b9222222-2222-2222-2222-222222222222';

const BOOTSTRAP = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
drop table if exists public.alert_intervention_links cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.player_protection_alerts cascade;
drop table if exists public.player_protection_interventions cascade;
drop table if exists public.players cascade;
drop table if exists public.users cascade;
drop table if exists public.casinos cascade;
drop function if exists public.sbiq_b6_link_guard cascade;
drop function if exists public.sbiq_b6_link_after_insert cascade;
create table public.casinos(id uuid primary key, jurisdiction text not null default 'ZA', province text);
create table public.players(id uuid primary key, casino_id uuid not null references public.casinos(id));
create table public.users(id uuid primary key, role text not null);
create table public.player_protection_alerts(id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), status text not null default 'OPEN', generated_at timestamptz not null default now());
create table public.player_protection_interventions(id uuid primary key, casino_id uuid not null references public.casinos(id),
  player_id uuid not null references public.players(id), intervention_type text, intervention_date timestamptz not null default now(),
  outcome text, follow_up_required boolean);
create table public.audit_events(id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null,
  resource_type text, resource_id text, user_id uuid, user_role text, casino_id uuid,
  severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
grant insert, select on public.audit_events to service_role;
grant select on public.casinos, public.players, public.users to service_role;
-- Mirror the live posture where service_role holds the Supabase default-ALL on the source
-- tables (incl. UPDATE/DELETE). This makes the lifetime-invariant assertions meaningful:
-- a blocked casino/player UPDATE or a blocked DELETE must be the composite-FK RESTRICT
-- doing the work, NOT a missing grant.
grant select, update, delete on public.player_protection_alerts, public.player_protection_interventions to service_role;
insert into public.casinos(id) values ('${C}'),('${C2}');
insert into public.players values ('${P}','${C}'),('${P2}','${C}');
insert into public.users values ('${U}','compliance_officer'),('${U2}','casino_admin');
insert into public.player_protection_alerts(id,casino_id,player_id) values ('${A1}','${C}','${P}'),('${A2}','${C}','${P}');
insert into public.player_protection_interventions(id,casino_id,player_id,intervention_type,outcome,follow_up_required) values
  ('${IV(1)}','${C}','${P}','helpline_referral','successful',false),
  ('${IV(2)}','${C}','${P}','counseling_referral','pending',true),
  ('${IV(3)}','${C}','${P}','manual_review','accepted',false),
  ('${IV(4)}','${C}','${P}','timeout','declined',true),
  ('${IV(5)}','${C}','${P}','limit_setting','pending',false),
  ('${IV(6)}','${C}','${P}','ai_alert','accepted',false),
  ('${IV(7)}','${C}','${P}','self_exclusion_referral','pending',true),
  ('${IVP2}','${C}','${P2}','manual_review','accepted',false);
`;

async function connect() {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  return client;
}
const q = (c, sql, p) => c.query(sql, p);
async function raises(c, sql, p) { try { await q(c, sql, p); return false; } catch { return true; } }
const L = (cols, vals) => `insert into public.alert_intervention_links (${cols}) values (${vals})`;
const COL = 'casino_id,alert_id,intervention_id,player_id,linked_by';

test('B6 DB behaviour', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOTSTRAP);
    await q(c, MIGRATION);
    await q(c, 'set role service_role');

    await t.test('initial link (same casino/player) + m:n allowances; duplicate active pair rejected', async () => {
      await q(c, L(COL, `'${C}','${A1}','${IV(1)}','${P}','${U}'`));
      await q(c, L(COL, `'${C}','${A1}','${IV(2)}','${P}','${U}'`));            // 2nd intervention, same alert
      await q(c, L(COL, `'${C}','${A2}','${IV(1)}','${P}','${U}'`));            // same intervention, 2nd alert
      assert.ok(await raises(c, L(COL, `'${C}','${A1}','${IV(1)}','${P}','${U}'`)));  // duplicate active pair
    });

    await t.test('cross player/casino/existence rejected', async () => {
      assert.ok(await raises(c, L(COL, `'${C}','${A1}','${IVP2}','${P}','${U}'`)));   // intervention of other player
      assert.ok(await raises(c, L(COL, `'${C}','${A1}','${IV(3)}','${P2}','${U}'`))); // mismatched player_id
      assert.ok(await raises(c, L(COL, `'${C2}','${A1}','${IV(3)}','${P}','${U}'`))); // wrong casino
      assert.ok(await raises(c, L(COL, `'${C}','a9999999-9999-9999-9999-999999999999','${IV(3)}','${P}','${U}'`)));
      assert.ok(await raises(c, L(COL, `'${C}','${A1}','b9999999-9999-9999-9999-999999999999','${P}','${U}'`)));
    });

    await t.test('lifetime invariant: linked intervention casino/player frozen; delete blocked', async () => {
      assert.ok(await raises(c, `update public.player_protection_interventions set casino_id='${C2}' where id='${IV(1)}'`));
      assert.ok(await raises(c, `update public.player_protection_interventions set player_id='${P2}' where id='${IV(1)}'`));
      await q(c, `update public.player_protection_interventions set outcome='declined' where id='${IV(1)}'`); // non-identity OK
      assert.ok(await raises(c, `delete from public.player_protection_interventions where id='${IV(1)}'`));
      assert.ok(await raises(c, `delete from public.player_protection_alerts where id='${A1}'`));
    });

    await t.test('timestamps DB-owned; superseded-preset insert rejected', async () => {
      await q(c, L(COL + ',linked_at,created_at', `'${C}','${A2}','${IV(2)}','${P}','${U}','2000-01-01','2000-01-01'`));
      const r = await q(c, `select linked_at from public.alert_intervention_links where alert_id='${A2}' and intervention_id='${IV(2)}'`);
      assert.ok(new Date(r.rows[0].linked_at).getUTCFullYear() >= 2026);
      assert.ok(await raises(c, L(COL + ',superseded_at,superseded_by', `'${C}','${A1}','${IV(3)}','${P}','${U}',now(),'${U}'`)));
    });

    await t.test('correction: single-INSERT supersession is atomic; actor derived; old retained', async () => {
      await q(c, L(COL, `'${C}','${A1}','${IV(4)}','${P}','${U}'`));
      const oldId = (await q(c, `select id from public.alert_intervention_links where alert_id='${A1}' and intervention_id='${IV(4)}' and superseded_at is null`)).rows[0].id;
      await q(c, L(COL + ',supersedes_link_id', `'${C}','${A1}','${IV(5)}','${P}','${U2}','${oldId}'`));
      const o = (await q(c, `select superseded_at, superseded_by from public.alert_intervention_links where id='${oldId}'`)).rows[0];
      assert.ok(o.superseded_at);
      assert.equal(o.superseded_by, U2);                                       // derived from replacement actor
      const s = (await q(c, `select superseded_at from public.alert_intervention_links where alert_id='${A1}' and intervention_id='${IV(5)}'`)).rows[0];
      assert.equal(s.superseded_at, null);                                     // replacement active
      assert.ok(await raises(c, L(COL + ',supersedes_link_id', `'${C}','${A1}','${IV(6)}','${P}','${U}','${oldId}'`)));  // 2nd successor
      assert.ok(await raises(c, L(COL + ',supersedes_link_id', `'${C}','${A1}','${IV(7)}','${P}','${U}','${oldId}'`)));  // already superseded
      await q(c, L(COL, `'${C}','${A1}','${IV(4)}','${P}','${U}'`));            // re-link superseded intervention OK
    });

    await t.test('correction guards: cross-alert / self / nonexistent rejected', async () => {
      await q(c, L(COL, `'${C}','${A2}','${IV(6)}','${P}','${U}'`));
      const a2old = (await q(c, `select id from public.alert_intervention_links where alert_id='${A2}' and intervention_id='${IV(6)}' and superseded_at is null`)).rows[0].id;
      assert.ok(await raises(c, L(COL + ',supersedes_link_id', `'${C}','${A1}','${IV(7)}','${P}','${U}','${a2old}'`)));  // cross-alert
      assert.ok(await raises(c, `insert into public.alert_intervention_links(id,casino_id,alert_id,intervention_id,player_id,linked_by,supersedes_link_id) values ('${a2old}','${C}','${A2}','${IV(7)}','${P}','${U}','${a2old}')`)); // self
      assert.ok(await raises(c, L(COL + ',supersedes_link_id', `'${C}','${A2}','${IV(7)}','${P}','${U}','c9999999-9999-9999-9999-999999999999'`))); // nonexistent
    });

    await t.test('direct-UPDATE bypass prevention + immutability', async () => {
      const a2old = (await q(c, `select id from public.alert_intervention_links where alert_id='${A2}' and intervention_id='${IV(6)}' and superseded_at is null`)).rows[0].id;
      const supId = (await q(c, `select id from public.alert_intervention_links where alert_id='${A1}' and intervention_id='${IV(4)}' and superseded_at is not null`)).rows[0].id;
      assert.ok(await raises(c, `update public.alert_intervention_links set superseded_at=now(), superseded_by='${U}' where id='${a2old}'`)); // no successor
      assert.ok(await raises(c, `update public.alert_intervention_links set superseded_at=null, superseded_by=null where id='${supId}'`));     // un-supersede
      assert.ok(await raises(c, `update public.alert_intervention_links set intervention_id='${IV(7)}' where id='${a2old}'`));                 // immutable
      assert.ok(await raises(c, `update public.alert_intervention_links set casino_id='${C2}' where id='${a2old}'`));
    });

    await t.test('audit: one event per op, safe metadata (no player_id)', async () => {
      const linked = (await q(c, `select count(*)::int c from public.audit_events where action='protection_alert.intervention_linked'`)).rows[0].c;
      const sup = (await q(c, `select count(*)::int c from public.audit_events where action='protection_alert.intervention_link_superseded'`)).rows[0].c;
      assert.ok(linked >= 6, `linked events ${linked}`);
      assert.equal(sup, 1);
      const meta = (await q(c, `select metadata from public.audit_events where action='protection_alert.intervention_link_superseded'`)).rows[0].metadata;
      assert.ok(meta.supersedes_link_id && meta.link_id && meta.alert_id && meta.intervention_id);
      assert.ok(!('player_id' in meta));
    });
  } finally {
    await q(c, 'reset role').catch(() => {});
    await c.end();
  }
});
