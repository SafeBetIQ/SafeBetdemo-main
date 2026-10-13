-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B11 Controlled Follow-Up Requirement Closure.
--
-- Governs the one post-creation transition B8 deliberately excludes:
--   follow_up_required: true → false   (and atomically follow_up_date → NULL)
-- via ONE atomic SECURITY DEFINER function. Means ONLY "no further follow-up is
-- currently required" — NOT completion, effectiveness, recovery, risk reduction,
-- case closure, SLA, or regulatory compliance.
--
-- Durable idempotency with NO new table: the immutable, hash-chained audit event is the
-- idempotency record. A deterministic event_id 'b11:follow-up-close:<casino>:<key>' under
-- the existing audit_events.event_id UNIQUE constraint is the atomic same-key arbiter; an
-- immutable DB-computed request fingerprint (stored in metadata) distinguishes REPLAYED
-- from IDEMPOTENCY_CONFLICT. The old follow_up_date is snapshotted into audit metadata
-- before being cleared, so final-schedule evidence is preserved.
--
-- Append-only / one-way: no reopen (false→true), no other field mutation, no B10/B6/alert
-- change, no generic UPDATE grant. B4.1/B5/B6/B7/B8/B9/B10/B2 unchanged.
--
-- Fail-closed DDL. NOT auto-applied; applied (if authorised) by the governed raw-SQL path
-- to IQ Demo only, leaving the migration ledger unchanged. Modifies ZERO existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

create function public.sbiq_b11_close_follow_up_requirement(
  p_intervention_id uuid,
  p_casino_id       uuid,
  p_actor_id        uuid,
  p_idempotency_key uuid
) returns table(status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role        text;
  v_actor_casino uuid;
  v_req         boolean;
  v_date        date;
  v_event_id    text;
  v_fp          text;
  v_existing_fp text;
begin
  if p_idempotency_key is null then raise exception 'B11: idempotency key required'; end if;

  -- Actor (authoritative; server already authorised). No caller role; no staff mapping.
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B11: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then
    raise exception 'B11: actor role % not permitted', v_role;
  end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then
    raise exception 'B11: actor not governed for casino';
  end if;

  -- Deterministic durable idempotency identity (casino + key; intervention-independent so a
  -- key reused for a different intervention collides and is resolved by fingerprint).
  v_event_id := 'b11:follow-up-close:' || p_casino_id::text || ':' || p_idempotency_key::text;

  -- Immutable canonical fingerprint of the ORIGINAL request only (DB-computed; never caller
  -- input; excludes mutable DB state so a genuine retry stays replayable).
  v_fp := encode(extensions.digest(convert_to(
    'b11v1' || chr(31) || p_casino_id::text || chr(31) || p_intervention_id::text || chr(31) || p_actor_id::text,
    'UTF8'), 'sha256'), 'hex');

  -- Resolve + LOCK the intervention (serialises against B8 UPDATE and B10 FOR SHARE).
  select i.follow_up_required, i.follow_up_date into v_req, v_date
    from public.player_protection_interventions i
    where i.id = p_intervention_id and i.casino_id = p_casino_id
    for update;
  if not found then
    return query select 'NOT_FOUND'::text; return;
  end if;

  -- Authoritative post-lock durable idempotency lookup. A prior successful CLOSED wrote this
  -- immutable audit row; a concurrent same-intervention winner committed it before we got the
  -- lock — so this read (not current false state) decides REPLAYED vs CONFLICT vs NOOP.
  select ae.metadata->>'request_fingerprint' into v_existing_fp
    from public.audit_events ae where ae.event_id = v_event_id;
  if found then
    if v_existing_fp is not distinct from v_fp then
      return query select 'REPLAYED'::text; return;
    end if;
    return query select 'IDEMPOTENCY_CONFLICT'::text; return;
  end if;

  -- No prior B11 closure for this key. Only a genuine true→false transition writes evidence.
  if v_req is not true then
    return query select 'NOOP'::text; return;     -- already not-required (or null); no audit, key NOT reserved
  end if;

  -- Atomic close + audit in ONE exception-scoped subtransaction: if the audit INSERT hits the
  -- event_id UNIQUE (a cross-intervention same-key simultaneous race), the UPDATE below is
  -- rolled back with the subtransaction, so the losing intervention is left untouched.
  begin
    update public.player_protection_interventions
       set follow_up_required = false, follow_up_date = null
     where id = p_intervention_id and casino_id = p_casino_id;

    insert into public.audit_events (
      event_id, event_type, event_category, action, resource_type, resource_id,
      user_id, user_role, casino_id, severity, outcome, metadata)
    values (
      v_event_id,
      'intervention.follow_up_requirement_closed', 'responsible_gambling', 'intervention.follow_up_requirement_closed',
      'player_protection_intervention', p_intervention_id::text, p_actor_id, v_role, p_casino_id, 'info', 'success',
      jsonb_build_object(
        'old_follow_up_required', true,
        'new_follow_up_required', false,
        'old_follow_up_date', v_date,
        'old_follow_up_date_present', (v_date is not null),
        'new_follow_up_date_present', false,
        'request_fingerprint', v_fp));

    return query select 'CLOSED'::text; return;
  exception when unique_violation then
    -- Lost the deterministic event_id race; this subtransaction's UPDATE is rolled back.
    select ae.metadata->>'request_fingerprint' into v_existing_fp
      from public.audit_events ae where ae.event_id = v_event_id;
    if v_existing_fp is not distinct from v_fp then
      return query select 'REPLAYED'::text; return;
    end if;
    return query select 'IDEMPOTENCY_CONFLICT'::text; return;
  end;
end $$;

-- Not a browser-callable surface: service_role (the governed server) only.
revoke all     on function public.sbiq_b11_close_follow_up_requirement(uuid,uuid,uuid,uuid) from public;
revoke execute on function public.sbiq_b11_close_follow_up_requirement(uuid,uuid,uuid,uuid) from anon;
revoke execute on function public.sbiq_b11_close_follow_up_requirement(uuid,uuid,uuid,uuid) from authenticated;
grant  execute on function public.sbiq_b11_close_follow_up_requirement(uuid,uuid,uuid,uuid) to service_role;
