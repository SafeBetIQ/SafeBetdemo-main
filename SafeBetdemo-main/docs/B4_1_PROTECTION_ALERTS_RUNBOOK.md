# SafeBet IQ — B4.1 Operator-Local Protection Alerts — Engineering Runbook

**Status:** IMPLEMENTATION READY · migration FILE included · **migration NOT applied to IQ Demo** ·
live end-to-end acceptance **PENDING controlled DB application**.

Forward migration: `supabase/migrations/20261001120000_b4_1_player_protection_alerts.sql`
(exact approved *Revision 3.4 FINAL* SQL).

## Scope (v1)
Operator-local / own-casino protection-alert lifecycle only. Two governed rules:
`SELF_EXCLUSION_BREACH_REVIEW`, `INTERVENTION_FOLLOW_UP_OVERDUE`. Excluded/unavailable:
`SELF_EXCLUSION_EXPIRY_REVIEW`, `INTERVENTION_COMPLETENESS_REVIEW`, `CURRENT_HIGHER_RISK_REVIEW`.
Cross-operator federation remains OFF; dormant objects untouched.

## F1 least-privilege hardening (migration `20261001130000_b4_1_service_role_least_privilege.sql`)
Supabase default privileges pre-grant `service_role` **ALL** on new public tables, so the base
migration's `grant select, insert, update` left `service_role` with DELETE/TRUNCATE/REFERENCES/
TRIGGER/MAINTAIN. This follow-up resets it: `REVOKE ALL … FROM service_role;` then
`GRANT SELECT, INSERT, UPDATE … TO service_role;`. Effective result (verified on IQ Demo):
service_role = SELECT/INSERT/UPDATE only (`relacl service_role=arw`); anon/authenticated/PUBLIC = none.
Applied 2026-10-01 via governed raw SQL (explicit txn; ledger/audit/rows unchanged).

**F2 (P3, informational, NOT changed):** the two trigger functions carry Supabase default `EXECUTE`
to anon/authenticated/service_role (PUBLIC execute revoked). Harmless — PostgreSQL forbids direct
invocation of trigger-returning functions; no table-access exploit path. Future hygiene only.

## Controlled application (requires a SEPARATE owner authorisation)
The IQ migration ledger is unreconciled. Do **not** `supabase db push` / `migration up` /
`migration repair` / bulk-reconcile. Application (when authorised) uses the controlled
`--linked` governed query path used for B2, applying ONLY this file's forward SQL.

Pre-application read-only checks (fail closed):
- object names free: `player_protection_alerts`, `sbiq_ppa_validate`, `sbiq_ppa_audit`,
  `trg_ppa_validate`, `trg_ppa_audit` (verified absent on IQ Demo 2026-10-01).
- `audit_events` contract unchanged (user_id uuid; service_role INSERT; chain + immutability triggers present).

## Controlled rollback (NOT embedded in the forward migration)
Run only under owner authorisation. No `CASCADE`. Halts if any unexpected dependency exists.

```sql
-- A. READ-ONLY dependency preflight: abort if anything outside this migration depends on the table.
do $$
declare v_blockers text;
begin
  select string_agg(kind || ' ' || nspname || '.' || objname, '; ')
    into v_blockers
  from (
    select 'fk' as kind, n.nspname, c.conname as objname
    from pg_constraint c
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and rn.nspname = 'public'
      and rt.relname = 'player_protection_alerts'
      and c.conrelid <> c.confrelid
    union all
    select 'view' as kind, vn.nspname, v.relname as objname
    from pg_depend d
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class v on v.oid = rw.ev_class
    join pg_namespace vn on vn.oid = v.relnamespace
    join pg_class t on t.oid = d.refobjid
    join pg_namespace tn on tn.oid = t.relnamespace
    where tn.nspname = 'public' and t.relname = 'player_protection_alerts'
      and v.relname <> 'player_protection_alerts'
  ) s;
  if v_blockers is not null then
    raise exception 'B4.1 rollback halted: unexpected dependencies: %', v_blockers;
  end if;
end $$;

-- B. Controlled teardown, explicit order, no CASCADE.
drop trigger trg_ppa_audit    on public.player_protection_alerts;
drop trigger trg_ppa_validate on public.player_protection_alerts;
drop table public.player_protection_alerts;
drop function public.sbiq_ppa_audit();
drop function public.sbiq_ppa_validate();
-- Immutable audit_events rows emitted during its life remain, by design.
```

## Live acceptance (after controlled application)
1. Run `tests/protectionAlertsDb.test.mjs` against a **disposable** Postgres (`B41_TEST_DATABASE_URL`) — never IQ Demo.
2. Governed API acceptance on Demo: anon→401; non-operator role→403; own-casino 200; cross-casino id→404;
   `evaluate` idempotent; acknowledge/resolve idempotent; audit chain shows generated/acknowledged/resolved.
3. Confirm B1/B2/B3 + certified GGR unaffected.
