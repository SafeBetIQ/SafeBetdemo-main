-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B8 Follow-Up Scheduling Integrity & Intervention Governance Hardening.
--
-- TWO responsibilities:
--   (A) Governed follow-up SCHEDULING on EXISTING interventions (schedule / reschedule
--       / unschedule a follow_up_date) via ONE atomic SECURITY DEFINER function that
--       mutates follow_up_date AND writes the audit event in the same transaction.
--   (B) Close the P1 unaudited direct-browser intervention mutation path, apply
--       least-privilege, FORCE RLS, and a follow-up consistency CHECK.
--
-- B8 is NOT intervention creation, generic editing, follow_up_required change, completion,
-- effectiveness, or SLA. Only follow_up_date may change, and only via the function.
--
-- LIVE-VERIFIED FACTS (read-only introspection, IQ Demo):
--   • player_protection_interventions / audit_events / users are owned by `postgres`.
--   • `postgres` and `service_role` have rolbypassrls=true; authenticated/anon do not.
--     ⇒ A `postgres`-owned SECURITY DEFINER bypasses RLS even under FORCE RLS (BYPASSRLS
--       wins), so NO owner-specific "TO postgres" policy is required.
--   • SELECT for operators/regulators/super_admin is already provided by
--     `ppi_tenant_isolation` + the two "view all" policies; the legacy ALL policy is the
--     ONLY write policy ⇒ dropping it (plus revoking write GRANTS) closes the P1 with no
--     replacement SELECT policy needed.
--   • CHECK has 0 current violations (all rows are true+null or false+null).
--
-- Fail-closed DDL (plain statements; any collision aborts). NOT auto-applied; applied (if
-- authorised) by the governed raw-SQL path to IQ Demo only, leaving the ledger unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (B1) Remove the legacy direct-browser ALL write path ──────────────────────────
drop policy if exists "Casino admins can manage their casino interventions" on public.player_protection_interventions;

-- ── (B2) authenticated: read-only. Revoke every write privilege (defence-in-depth;
--        RLS already denies writes with no write policy). SELECT grant retained so the
--        existing SELECT policies (ppi_tenant_isolation / view-all) keep functioning. ──
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.player_protection_interventions from authenticated;

-- ── (B3) service_role least privilege: SELECT/INSERT/DELETE only (seeder needs
--        INSERT+DELETE; reads need SELECT). NO generic UPDATE — scheduling goes ONLY
--        through sbiq_b8_set_follow_up. Defeat the Supabase platform default-ALL. ──
revoke all privileges on table public.player_protection_interventions from service_role;
grant select, insert, delete on table public.player_protection_interventions to service_role;

-- ── (B4) Defence-in-depth RLS: enable + FORCE. service_role/postgres bypass via
--        rolbypassrls; this binds only non-bypass roles (authenticated/anon). ──
alter table public.player_protection_interventions enable row level security;
alter table public.player_protection_interventions force  row level security;

-- ── (B5) Follow-up consistency: a date may exist only when follow-up is required. ──
alter table public.player_protection_interventions
  add constraint ppi_follow_up_consistency
  check (follow_up_required is true or follow_up_date is null);

-- ── (A) Atomic scheduling function. SECURITY DEFINER (owned by postgres at apply time;
--        bypasses RLS and holds UPDATE/INSERT) — required because service_role no longer
--        has generic UPDATE. Only follow_up_date changes; audit is in-transaction. ──
create function public.sbiq_b8_set_follow_up(
  p_intervention_id uuid,
  p_casino_id       uuid,
  p_actor_id        uuid,
  p_action          text,
  p_follow_up_date  date
) returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_iv           public.player_protection_interventions%rowtype;
  v_role         text;
  v_actor_casino uuid;
  v_old          date;
  v_new          date;
  v_event        text;
begin
  if p_action not in ('SCHEDULE','RESCHEDULE','UNSCHEDULE') then
    raise exception 'B8: invalid action %', p_action;
  end if;

  -- Actor (defence-in-depth; the server API has already authorised the principal). Role
  -- is derived from the authoritative users row, never trusted from the caller.
  select u.role::text, u.casino_id into v_role, v_actor_casino
    from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B8: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then
    raise exception 'B8: actor role % not permitted', v_role;
  end if;
  if v_role in ('casino_admin','compliance_officer')
     and v_actor_casino is distinct from p_casino_id then
    raise exception 'B8: actor not governed for casino';
  end if;

  -- Lock the intervention within the governed casino; no cross-casino existence leak.
  select * into v_iv from public.player_protection_interventions
    where id = p_intervention_id and casino_id = p_casino_id
    for update;
  if not found then return 'NOT_FOUND'; end if;

  -- Requirement precedence (takes priority over idempotency).
  if v_iv.follow_up_required is not true then return 'INVALID_STATE'; end if;

  v_old := v_iv.follow_up_date;

  if p_action = 'SCHEDULE' then
    if p_follow_up_date is null then raise exception 'B8: SCHEDULE requires a date'; end if;
    if v_old is not null then return 'INVALID_STATE'; end if;
    v_new := p_follow_up_date; v_event := 'intervention.follow_up_scheduled';
  elsif p_action = 'RESCHEDULE' then
    if p_follow_up_date is null then raise exception 'B8: RESCHEDULE requires a date'; end if;
    if v_old is null then return 'INVALID_STATE'; end if;
    if p_follow_up_date = v_old then return 'NOOP'; end if;
    v_new := p_follow_up_date; v_event := 'intervention.follow_up_rescheduled';
  else  -- UNSCHEDULE
    if p_follow_up_date is not null then raise exception 'B8: UNSCHEDULE must not supply a date'; end if;
    if v_old is null then return 'NOOP'; end if;
    v_new := null; v_event := 'intervention.follow_up_unscheduled';
  end if;

  -- Only follow_up_date changes; identity/other fields are untouched.
  update public.player_protection_interventions
     set follow_up_date = v_new
   where id = p_intervention_id and casino_id = p_casino_id;

  -- Same-transaction audit into the existing chain (trg_audit_chain hashes it; failure
  -- rolls the whole statement back). Safe metadata only — no PII.
  insert into public.audit_events (
    event_id, event_type, event_category, action,
    resource_type, resource_id, user_id, user_role, casino_id, severity, outcome, metadata)
  values (
    'b8:' || v_event || ':' || p_intervention_id::text || ':' || gen_random_uuid()::text,
    v_event, 'responsible_gambling', v_event,
    'player_protection_intervention', p_intervention_id::text, p_actor_id, v_role, p_casino_id,
    'info', 'success',
    jsonb_build_object('old_follow_up_date', v_old, 'new_follow_up_date', v_new, 'operation', p_action));

  return 'APPLIED';
end $$;

-- Not a browser-callable surface: service_role (the governed server) only.
revoke all on function public.sbiq_b8_set_follow_up(uuid, uuid, uuid, text, date) from public;
revoke execute on function public.sbiq_b8_set_follow_up(uuid, uuid, uuid, text, date) from anon;
revoke execute on function public.sbiq_b8_set_follow_up(uuid, uuid, uuid, text, date) from authenticated;
grant  execute on function public.sbiq_b8_set_follow_up(uuid, uuid, uuid, text, date) to service_role;
