/*
  # Phase 4.1 — Enterprise Security & Multi-Tenant Isolation
  Closes certification conditions C1 (tenant isolation) per Constitution 6.

  1. Jurisdiction registry: casinos.jurisdiction is the ONLY source of the
     jurisdiction used for policy evaluation (never a caller claim).
     users.jurisdiction scopes regulator principals.
  2. ONE tenant-visibility predicate: app_visible_casinos() (SECURITY
     DEFINER, keyed on the cryptographically verified auth.uid()) returns
     the set of casinos the current principal may observe:
       super_admin                → all casinos
       casino_admin / compliance  → their own casino
       regulator / national_reg   → casinos in their jurisdiction
       provincial_regulator       → casinos in their jurisdiction + province
       anything else / anon       → nothing
  3. Tenant-scoped RLS replaces every `using (true)` read policy on the
     enterprise platform tables. Realtime (postgres_changes) enforces the
     same policies automatically.
  4. The read-model catalogue VIEWS become security_invoker: without this
     they execute as owner and BYPASS table RLS entirely (verified live:
     reloptions were null). This closes a leak the certification missed.
*/

-- ── 1. Jurisdiction registry ─────────────────────────────────────────────────

alter table casinos add column if not exists jurisdiction text not null default 'ZA';
comment on column casinos.jurisdiction is
  'Regulatory territory of this casino (policy pack selector). Registry source of truth — never a caller claim.';

alter table users add column if not exists jurisdiction text;
comment on column users.jurisdiction is
  'Regulator principals only: the jurisdiction this regulator oversees.';

update users set jurisdiction = 'ZA'
where role::text in ('regulator', 'national_regulator', 'provincial_regulator')
  and jurisdiction is null;

-- ── 2. THE tenant-visibility predicate ───────────────────────────────────────

create or replace function app_visible_casinos()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from casinos c
  cross join (
    select u.role::text as role, u.casino_id, u.jurisdiction, u.province
    from users u
    where u.id = auth.uid() and u.is_active = true
  ) me
  where
    me.role = 'super_admin'
    or (me.role in ('casino_admin', 'compliance_officer') and c.id = me.casino_id)
    or (me.role in ('regulator', 'national_regulator')
        and me.jurisdiction is not null and c.jurisdiction = me.jurisdiction)
    or (me.role = 'provincial_regulator'
        and me.jurisdiction is not null and c.jurisdiction = me.jurisdiction
        and me.province is not null and c.province = me.province)
$$;

revoke all on function app_visible_casinos() from public;
revoke all on function app_visible_casinos() from anon;
grant execute on function app_visible_casinos() to authenticated;
grant execute on function app_visible_casinos() to service_role;

-- ── 3. Tenant-scoped RLS on the enterprise platform tables ──────────────────
-- (IN (subquery) is evaluated once per statement — no per-row lookups.)

drop policy if exists casino_event_log_read on casino_event_log;
create policy casino_event_log_tenant_read on casino_event_log
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

drop policy if exists projection_player_state_read on projection_player_state;
create policy projection_player_state_tenant_read on projection_player_state
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

drop policy if exists projection_session_state_read on projection_session_state;
create policy projection_session_state_tenant_read on projection_session_state
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

drop policy if exists projection_machine_state_read on projection_machine_state;
create policy projection_machine_state_tenant_read on projection_machine_state
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

-- ── 4. Catalogue views must run as the INVOKER (RLS applies) ─────────────────

alter view projection_casino_state       set (security_invoker = true);
alter view projection_risk_state         set (security_invoker = true);
alter view projection_behaviour_state    set (security_invoker = true);
alter view projection_intervention_state set (security_invoker = true);
alter view projection_compliance_state   set (security_invoker = true);
alter view projection_executive_state    set (security_invoker = true);
alter view projection_regulator_state    set (security_invoker = true);
