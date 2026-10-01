// SafeBet IQ — B4.1 DB-runtime positive-lifecycle + negative/immutability/audit acceptance.
// Runs ONLY against a DISPOSABLE Postgres named by B41_TEST_DATABASE_URL (GitHub Actions
// ephemeral service / local throwaway). It bootstraps a self-contained minimal schema and
// applies the REAL forward migrations (base + F1 hardening). MUST NEVER point at IQ Demo /
// Production. Skips when the env var is unset (the default harness has no database).
//   B41_TEST_DATABASE_URL=postgres://... node --test tests/protectionAlertsDb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DSN = process.env.B41_TEST_DATABASE_URL;
const skip = DSN ? false : 'B41_TEST_DATABASE_URL not set (disposable Postgres required; never IQ Demo)';
const here = dirname(fileURLToPath(import.meta.url));
const mig = (n) => readFileSync(join(here, '..', 'supabase', 'migrations', n), 'utf8');
const BASE_MIG = mig('20261001120000_b4_1_player_protection_alerts.sql');
const HARDEN_MIG = mig('20261001130000_b4_1_service_role_least_privilege.sql');

const C = '11111111-1111-1111-1111-111111111111';
const C2 = '22222222-2222-2222-2222-222222222222';
const P = '33333333-3333-3333-3333-333333333333';
const P2 = '99999999-9999-9999-9999-999999999999'; // belongs to C2
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
create table public.audit_events(
  id uuid primary key default gen_random_uuid(), event_id text not null unique,
  event_type text not null, event_category text not null default 'general', action text not null,
  resource_type text, resource_id text, user_id uuid, user_role text, casino_id uuid,
  severity text not null default 'info', outcome text not null default 'success',
  metadata jsonb default '{}'::jsonb, created_at timestamptz not null default now());
grant insert, select on public.audit_events to service_role;
grant select on public.casinos, public.players, public.users, public.self_exclusions, public.player_protection_interventions to service_role;
insert into public.casinos values ('${C}','ZA','WC'), ('${C2}','ZA','GP');
insert into public.players values ('${P}','${C}','SB-PLR-A'), ('${P2}','${C2}','SB-PLR-B');
insert into public.users values ('${U}','compliance_officer');
`;

async function connect() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: DSN });
  await c.connect();
  return c;
}
const q = (c, sql, p) => c.query(sql, p);
async function raises(c, sql, p) { try { await q(c, sql, p); return false; } catch { return true; } }
const sastToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const insBreach = `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, self_exclusion_id, generated_by)
  values ($1,$2,'SELF_EXCLUSION_BREACH_REVIEW',$3,$4,$5) returning id, status, evidence, generated_at, created_at, updated_at, acknowledged_at`;
const insFollow = `insert into public.player_protection_alerts (casino_id, player_id, alert_type, rule_version, intervention_id, generated_by)
  values ($1,$2,'INTERVENTION_FOLLOW_UP_OVERDUE',$3,$4,$5) returning id, status, evidence, generated_at, created_at`;

test('B4.1 disposable positive-lifecycle + negatives + audit', { skip }, async (t) => {
  const c = await connect();
  try {
    await q(c, BOOTSTRAP);
    await q(c, BASE_MIG);
    // Simulate the Supabase platform default (service_role pre-granted ALL) so the F1
    // hardening migration has something to narrow — faithful clean-room of the live gap.
    await q(c, `grant all on public.player_protection_alerts to service_role`);
    await q(c, HARDEN_MIG);

    const srv = (await import('pg')).default;
    const pgver = (await q(c, `show server_version_num`)).rows[0].server_version_num;

    // seed sources
    const seBreachNull = 'aaaa0000-0000-0000-0000-000000000001'; // breached, breach_count null
    const seBreach3 = 'aaaa0000-0000-0000-0000-000000000002';    // breached, breach_count 3
    const seActive = 'aaaa0000-0000-0000-0000-000000000003';
    const seExpired = 'aaaa0000-0000-0000-0000-000000000004';
    const seLifted = 'aaaa0000-0000-0000-0000-000000000005';
    const seOpenResolve = 'aaaa0000-0000-0000-0000-000000000006'; // for direct OPEN->RESOLVED
    const seWrongCasino = 'aaaa0000-0000-0000-0000-000000000007'; // belongs to C2 but we'll claim C
    const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 10);
    const today = sastToday();
    const ivOverdue = 'bbbb0000-0000-0000-0000-000000000001';
    const ivToday = 'bbbb0000-0000-0000-0000-000000000002';
    const ivNotReq = 'bbbb0000-0000-0000-0000-000000000003';
    const ivNullReq = 'bbbb0000-0000-0000-0000-000000000004';
    const ivNullDate = 'bbbb0000-0000-0000-0000-000000000005';
    await q(c, `insert into public.self_exclusions values
      ('${seBreachNull}','${C}','${P}','breached',null),
      ('${seBreach3}','${C}','${P}','breached',3),
      ('${seActive}','${C}','${P}','active',0),
      ('${seExpired}','${C}','${P}','expired',0),
      ('${seLifted}','${C}','${P}','lifted',0),
      ('${seOpenResolve}','${C}','${P}','breached',1),
      ('${seWrongCasino}','${C2}','${P2}','breached',1)`);
    await q(c, `insert into public.player_protection_interventions values
      ('${ivOverdue}','${C}','${P}',true,'${yesterday}'),
      ('${ivToday}','${C}','${P}',true,'${today}'),
      ('${ivNotReq}','${C}','${P}',false,'${yesterday}'),
      ('${ivNullReq}','${C}','${P}',null,'${yesterday}'),
      ('${ivNullDate}','${C}','${P}',true,null)`);

    await q(c, `set role service_role`);

    // ── Rule A: generation + evidence + timestamps ──
    let alertA;
    await t.test('Rule A generate → OPEN, DB evidence (null breach_count honest), DB timestamps', async () => {
      const r = await q(c, insBreach, [C, P, 'v1.0.0', seBreachNull, U]);
      alertA = r.rows[0].id;
      assert.equal(r.rows[0].status, 'OPEN');
      assert.equal(r.rows[0].evidence.self_exclusion_status, 'breached');
      assert.equal(r.rows[0].evidence.breach_count, null);          // preserved, not 0
      assert.equal(r.rows[0].evidence.rule_version, 'v1.0.0');
      assert.ok(r.rows[0].generated_at && r.rows[0].created_at);
      assert.equal(r.rows[0].acknowledged_at, null);
    });
    await t.test('Rule A breach_count value preserved honestly', async () => {
      const r = await q(c, insBreach, [C, P, 'v1.0.0', seBreach3, U]);
      assert.equal(r.rows[0].evidence.breach_count, 3);
      await q(c, `delete from public.player_protection_alerts where id=$1`, [r.rows[0].id]).catch(()=>{}); // ignore (service_role has no delete; cleanup optional)
    });

    // ── Rule A negatives ──
    await t.test('Rule A negatives: active/expired/lifted/wrong-player/wrong-casino rejected', async () => {
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seActive, U]));
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seExpired, U]));
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seLifted, U]));
      assert.ok(await raises(c, insBreach, [C, P2, 'v1.0.0', seBreachNull, U])); // wrong player for that SE
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seWrongCasino, U])); // SE belongs to C2
    });

    // ── identity / dedup / rule_version ──
    await t.test('identity: duplicate + rule_version-change for same self_exclusion rejected', async () => {
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seBreachNull, U]));  // exact dup
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.1', seBreachNull, U]));  // different rule_version, same source
    });

    // ── lifecycle A: OPEN→ACK→RESOLVED ──
    await t.test('Rule A lifecycle OPEN→ACK→RESOLVED with DB-owned timestamps + preserved attribution', async () => {
      await q(c, `update public.player_protection_alerts set status='ACKNOWLEDGED', acknowledged_by=$2 where id=$1`, [alertA, U]);
      let r = (await q(c, `select status, acknowledged_at, acknowledged_by, resolved_at, generated_at from public.player_protection_alerts where id=$1`, [alertA])).rows[0];
      assert.equal(r.status, 'ACKNOWLEDGED'); assert.ok(r.acknowledged_at); assert.equal(r.acknowledged_by, U); assert.equal(r.resolved_at, null);
      const gen0 = r.generated_at, ack0 = r.acknowledged_at;
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [alertA, U]);
      r = (await q(c, `select status, acknowledged_at, resolved_at, resolved_by, generated_at from public.player_protection_alerts where id=$1`, [alertA])).rows[0];
      assert.equal(r.status, 'RESOLVED'); assert.ok(r.resolved_at); assert.equal(r.resolved_by, U);
      assert.equal(r.acknowledged_at.getTime(), ack0.getTime());   // ack attribution preserved
      assert.equal(r.generated_at.getTime(), gen0.getTime());      // generation unchanged
    });
    await t.test('resolved source cannot regenerate (identity permanent)', async () => {
      assert.ok(await raises(c, insBreach, [C, P, 'v1.0.0', seBreachNull, U]));
    });

    // ── direct OPEN→RESOLVED leaves acknowledgement NULL forever ──
    await t.test('Rule A direct OPEN→RESOLVED: acknowledgement stays NULL; cannot be fabricated', async () => {
      const id = (await q(c, insBreach, [C, P, 'v1.0.0', seOpenResolve, U])).rows[0].id;
      // fabrication attempt rejected
      assert.ok(await raises(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2, acknowledged_by=$2, acknowledged_at=now() where id=$1`, [id, U]));
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [id, U]);
      const r = (await q(c, `select acknowledged_at, acknowledged_by from public.player_protection_alerts where id=$1`, [id])).rows[0];
      assert.equal(r.acknowledged_at, null); assert.equal(r.acknowledged_by, null);
    });

    // ── Rule C ──
    let alertC;
    await t.test('Rule C overdue generate → OPEN, DB evidence(follow_up_date) + timestamps; today NOT overdue', async () => {
      const r = await q(c, insFollow, [C, P, 'v1.0.0', ivOverdue, U]);
      alertC = r.rows[0].id;
      assert.equal(r.rows[0].status, 'OPEN');
      assert.equal(r.rows[0].evidence.follow_up_date, yesterday);
      assert.ok(r.rows[0].generated_at && r.rows[0].created_at);
      assert.ok(await raises(c, insFollow, [C, P, 'v1.0.0', ivToday, U]));   // today → not overdue (strict <)
    });
    await t.test('Rule C negatives: required false/null, date null, wrong casino/player rejected', async () => {
      assert.ok(await raises(c, insFollow, [C, P, 'v1.0.0', ivNotReq, U]));
      assert.ok(await raises(c, insFollow, [C, P, 'v1.0.0', ivNullReq, U]));
      assert.ok(await raises(c, insFollow, [C, P, 'v1.0.0', ivNullDate, U]));
      assert.ok(await raises(c, insFollow, [C, P2, 'v1.0.0', ivOverdue, U]));   // wrong player
    });
    await t.test('Rule C lifecycle OPEN→ACK→RESOLVED', async () => {
      await q(c, `update public.player_protection_alerts set status='ACKNOWLEDGED', acknowledged_by=$2 where id=$1`, [alertC, U]);
      assert.equal((await q(c, `select status from public.player_protection_alerts where id=$1`, [alertC])).rows[0].status, 'ACKNOWLEDGED');
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [alertC, U]);
      const r = (await q(c, `select status, resolved_at from public.player_protection_alerts where id=$1`, [alertC])).rows[0];
      assert.equal(r.status, 'RESOLVED'); assert.ok(r.resolved_at);
    });
    await t.test('Rule C rule_version change cannot duplicate same intervention', async () => {
      assert.ok(await raises(c, insFollow, [C, P, 'v9.9.9', ivOverdue, U]));
    });

    // ── idempotency: same-state no-op preserves timestamps + emits no extra audit ──
    await t.test('same-state no-op preserves updated_at + attribution + no extra audit', async () => {
      const before = (await q(c, `select updated_at from public.player_protection_alerts where id=$1`, [alertA])).rows[0].updated_at;
      const auditBefore = (await q(c, `select count(*)::int n from public.audit_events where resource_id=$1`, [alertA])).rows[0].n;
      await q(c, `update public.player_protection_alerts set status='RESOLVED', resolved_by=$2 where id=$1`, [alertA, U]); // RESOLVED->RESOLVED no-op
      const after = (await q(c, `select updated_at from public.player_protection_alerts where id=$1`, [alertA])).rows[0].updated_at;
      const auditAfter = (await q(c, `select count(*)::int n from public.audit_events where resource_id=$1`, [alertA])).rows[0].n;
      assert.equal(after.getTime(), before.getTime());   // updated_at unchanged
      assert.equal(auditAfter, auditBefore);             // no extra audit row
    });

    // ── immutability: every identity/generation/evidence column ──
    await t.test('immutable columns rejected on UPDATE', async () => {
      const id = alertC;
      const cases = [
        `update public.player_protection_alerts set id=gen_random_uuid() where id='${id}'`,
        `update public.player_protection_alerts set casino_id='${C2}' where id='${id}'`,
        `update public.player_protection_alerts set player_id='${P2}' where id='${id}'`,
        `update public.player_protection_alerts set alert_type='SELF_EXCLUSION_BREACH_REVIEW' where id='${id}'`,
        `update public.player_protection_alerts set rule_version='v2' where id='${id}'`,
        `update public.player_protection_alerts set intervention_id=gen_random_uuid() where id='${id}'`,
        `update public.player_protection_alerts set evidence='{"x":1}'::jsonb where id='${id}'`,
        `update public.player_protection_alerts set generated_at=now()-interval '1 day' where id='${id}'`,
        `update public.player_protection_alerts set generated_by=gen_random_uuid() where id='${id}'`,
        `update public.player_protection_alerts set created_at=now()-interval '1 day' where id='${id}'`,
        `update public.player_protection_alerts set status='OPEN' where id='${id}'`,   // reopen/reversal
      ];
      for (const sql of cases) assert.ok(await raises(c, sql), `should reject: ${sql.slice(0,70)}`);
    });

    // ── audit metadata (lifecycle rows + content) ──
    await t.test('audit rows carry correct actor/casino/resource/rule metadata', async () => {
      const rows = (await q(c, `select action, user_id, user_role, casino_id, resource_type, resource_id, metadata
        from public.audit_events where resource_id=$1 order by created_at`, [alertA])).rows;
      const actions = rows.map(r => r.action);
      assert.ok(actions.includes('protection_alert.generated'));
      assert.ok(actions.includes('protection_alert.acknowledged'));
      assert.ok(actions.includes('protection_alert.resolved'));
      for (const r of rows) {
        assert.equal(r.resource_type, 'player_protection_alert');
        assert.equal(r.resource_id, alertA);
        assert.equal(r.user_id, U);
        assert.equal(r.user_role, 'compliance_officer');
        assert.equal(r.casino_id, C);
        assert.equal(r.metadata.alert_type, 'SELF_EXCLUSION_BREACH_REVIEW');
        assert.equal(r.metadata.rule_version, 'v1.0.0');
        assert.ok('prior_status' in r.metadata && 'new_status' in r.metadata);
        assert.equal(r.metadata.self_exclusion_id, seBreachNull);
      }
    });

    // ── audit atomicity: a failing audit insert rolls back the alert mutation ──
    await t.test('audit failure rolls back the originating alert mutation', async () => {
      await q(c, `reset role`);
      // seed an eligible C2 source, then create an OPEN alert for it
      await q(c, `insert into public.player_protection_interventions values ('cccc0000-0000-0000-0000-000000000001','${C2}','${P2}',true,'${yesterday}')`);
      const a = (await q(c, insFollow, [C2, P2, 'v1.0.0', 'cccc0000-0000-0000-0000-000000000001', U])).rows[0].id;
      // force the audit insert to fail for 'acknowledged'
      await q(c, `alter table public.audit_events add constraint tmp_fail check (action <> 'protection_alert.acknowledged')`);
      const failed = await raises(c, `update public.player_protection_alerts set status='ACKNOWLEDGED', acknowledged_by=$2 where id=$1`, [a, U]);
      const still = (await q(c, `select status from public.player_protection_alerts where id=$1`, [a])).rows[0].status;
      await q(c, `alter table public.audit_events drop constraint tmp_fail`);
      assert.ok(failed, 'acknowledge should fail when its audit insert violates the constraint');
      assert.equal(still, 'OPEN', 'alert must roll back to OPEN when audit fails');
    });

    // ── F1 privilege clean-room: hardening left service_role = SELECT/INSERT/UPDATE only ──
    await t.test('F1: service_role has SELECT/INSERT/UPDATE and NOT DELETE/TRUNCATE/REFERENCES/TRIGGER', async () => {
      const r = (await q(c, `select
        has_table_privilege('service_role','public.player_protection_alerts','SELECT') sel,
        has_table_privilege('service_role','public.player_protection_alerts','INSERT') ins,
        has_table_privilege('service_role','public.player_protection_alerts','UPDATE') upd,
        has_table_privilege('service_role','public.player_protection_alerts','DELETE') del,
        has_table_privilege('service_role','public.player_protection_alerts','TRUNCATE') trunc,
        has_table_privilege('service_role','public.player_protection_alerts','REFERENCES') refs,
        has_table_privilege('service_role','public.player_protection_alerts','TRIGGER') trig,
        has_table_privilege('anon','public.player_protection_alerts','SELECT') anon_sel,
        has_table_privilege('authenticated','public.player_protection_alerts','SELECT') auth_sel`)).rows[0];
      assert.equal(r.sel, true); assert.equal(r.ins, true); assert.equal(r.upd, true);
      assert.equal(r.del, false); assert.equal(r.trunc, false); assert.equal(r.refs, false); assert.equal(r.trig, false);
      assert.equal(r.anon_sel, false); assert.equal(r.auth_sel, false);
      if (Number(pgver) >= 160000) {
        const m = (await q(c, `select has_table_privilege('service_role','public.player_protection_alerts','MAINTAIN') maintain`)).rows[0];
        assert.equal(m.maintain, false);
      }
    });
  } finally {
    await q(c, `reset role`).catch(() => {});
    await c.end();
  }
});
