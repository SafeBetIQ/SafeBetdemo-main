-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B9 Governed Intervention Recording (ALERT-DERIVED ONLY).
--
-- Records a REAL player-protection intervention from an existing B4.1 alert, via ONE
-- atomic SECURITY DEFINER function that, in a single transaction: resolves casino/player
-- from the alert, validates the actor, writes an HONEST intervention row (neutralising the
-- simulator-era defaults), the intervention.recorded audit, and ONE active B6 link (reusing
-- B6 unchanged, which emits protection_alert.intervention_linked). Mandatory UUID
-- idempotency with an IMMUTABLE DB-computed request fingerprint so a genuine retry stays
-- replayable even after later B8 rescheduling / B6 supersession.
--
-- Occurrence/record only — NOT effectiveness/completion/clinical/enforcement/ranking.
-- No standalone creation, no player search, no free text, no edit/delete.
--
-- Does NOT weaken B8: authenticated stays SELECT-only; service_role keeps SELECT/INSERT/
-- DELETE (no UPDATE); the global 7-value intervention_type CHECK is unchanged (the narrower
-- 6-value operator subset is enforced in the RPC + server, NOT in the table CHECK).
--
-- Fail-closed DDL. NOT auto-applied; applied (if authorised) by the governed raw-SQL path
-- to IQ Demo only, leaving the migration ledger unchanged. Modifies ZERO existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Relax simulator-era NOT NULL narrative columns (compatibility proven: no app/lib/
--       component/view/export/DTO reader depends on them; only the seeder writes them). ──
alter table public.player_protection_interventions alter column trigger_reason drop not null;
alter table public.player_protection_interventions alter column action_taken  drop not null;

-- ── 2. Idempotency columns (nullable; legacy/seeder rows stay NULL) ──
alter table public.player_protection_interventions add column b9_idempotency_key   uuid;
alter table public.player_protection_interventions add column b9_request_fingerprint text;

-- Provenance pairing: both NULL (legacy/seeder) or both NON-NULL (B9).
alter table public.player_protection_interventions
  add constraint ppi_b9_idempotency_pairing
  check ((b9_idempotency_key is null) = (b9_request_fingerprint is null));

-- Replay identity scoped to a governed casino. PG17 default NULLS DISTINCT ⇒ many NULL-key
-- legacy/seeder rows never collide; no partial index needed.
alter table public.player_protection_interventions
  add constraint ppi_b9_idempotency_uq unique (casino_id, b9_idempotency_key);

-- ── 3. Atomic governed creation function. SECURITY DEFINER (owned by postgres at apply
--       time; bypasses FORCE RLS and holds the required INSERTs). service_role EXECUTE only. ──
create function public.sbiq_b9_record_alert_intervention(
  p_alert_id          uuid,
  p_casino_id         uuid,
  p_actor_id          uuid,
  p_idempotency_key   uuid,
  p_intervention_type text,
  p_outcome           text,
  p_follow_up_required boolean,
  p_follow_up_date    date
) returns table(status text, intervention_id uuid, link_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role     text;
  v_actor_casino uuid;
  v_player   uuid;
  v_fp       text;
  v_iv       uuid;
  v_link     uuid;
  v_existing public.player_protection_interventions%rowtype;
begin
  -- Input validation (operator subset EXCLUDES ai_alert; never widens the table CHECK).
  if p_idempotency_key is null then raise exception 'B9: idempotency key required'; end if;
  if p_intervention_type not in
     ('manual_review','limit_setting','timeout','self_exclusion_referral','helpline_referral','counseling_referral') then
    raise exception 'B9: intervention_type % not permitted', p_intervention_type;
  end if;
  if p_outcome is not null and p_outcome not in ('accepted','declined','pending','successful','unsuccessful') then
    raise exception 'B9: invalid outcome %', p_outcome;
  end if;
  if p_follow_up_required is null then raise exception 'B9: follow_up_required is required'; end if;
  if p_follow_up_required is not true and p_follow_up_date is not null then
    raise exception 'B9: follow_up_date requires follow_up_required=true';
  end if;

  -- Actor (defence-in-depth; server already authorised). Role from authoritative users.
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B9: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then
    raise exception 'B9: actor role % not permitted', v_role;
  end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then
    raise exception 'B9: actor not governed for casino';
  end if;

  -- Authoritative casino/player from the scoped alert (no caller player_id; no status gate).
  select a.player_id into v_player
    from public.player_protection_alerts a
    where a.id = p_alert_id and a.casino_id = p_casino_id
    for share;
  if not found then
    return query select 'NOT_FOUND'::text, null::uuid, null::uuid; return;
  end if;

  -- Immutable canonical fingerprint of the ORIGINAL logical request (DB-computed; never a
  -- caller argument). Null markers distinguish NULL outcome/date from real values.
  v_fp := encode(extensions.digest(convert_to(
    'b9v1' || chr(31) || p_casino_id::text || chr(31) || p_alert_id::text || chr(31) || p_actor_id::text
          || chr(31) || p_intervention_type
          || chr(31) || coalesce(p_outcome, chr(1) || 'NULL')
          || chr(31) || p_follow_up_required::text
          || chr(31) || coalesce(p_follow_up_date::text, chr(1) || 'NULL'),
    'UTF8'), 'sha256'), 'hex');

  -- Race-safe first-writer INSERT with the explicit HONEST column list (no simulator defaults).
  insert into public.player_protection_interventions (
    casino_id, player_id, intervention_date, intervention_type, risk_score, trigger_reason, action_taken,
    outcome, follow_up_required, follow_up_date, staff_id, notes, created_at, dispatch_status, triggered_at,
    risk_score_at_trigger, intervention_successful, auto_triggered, channel, message_content, delivered_at,
    delivery_attempts, delivery_error, acknowledged_at, acknowledged_by, risk_score_after, nrgp_reported,
    nrgp_reported_at, compliance_ref, source, b9_idempotency_key, b9_request_fingerprint)
  values (
    p_casino_id, v_player, now(), p_intervention_type, null, null, null,
    p_outcome, p_follow_up_required, p_follow_up_date, null, null, now(), null, null,
    null, null, false, 'manual', null, null,
    0, null, null, null, null, false,
    null, null, 'manual', p_idempotency_key, v_fp)
  on conflict (casino_id, b9_idempotency_key) do nothing
  returning id into v_iv;

  if v_iv is not null then
    -- Creation audit (same transaction; trg_audit_chain hashes it).
    insert into public.audit_events (
      event_id, event_type, event_category, action, resource_type, resource_id,
      user_id, user_role, casino_id, severity, outcome, metadata)
    values (
      'b9:intervention.recorded:' || v_iv::text,
      'intervention.recorded', 'responsible_gambling', 'intervention.recorded',
      'player_protection_intervention', v_iv::text, p_actor_id, v_role, p_casino_id, 'info', 'success',
      jsonb_build_object(
        'intervention_type', p_intervention_type,
        'follow_up_required', p_follow_up_required,
        'follow_up_date_present', (p_follow_up_date is not null),
        'origin', 'alert', 'alert_id', p_alert_id));

    -- ONE active initial B6 link (reuses B6 table/guards/triggers; emits its own link audit).
    insert into public.alert_intervention_links (casino_id, alert_id, intervention_id, player_id, linked_by)
    values (p_casino_id, p_alert_id, v_iv, v_player, p_actor_id)
    returning id into v_link;

    return query select 'CREATED'::text, v_iv, v_link; return;
  end if;

  -- Conflict: a row already owns (casino_id, idempotency_key). Durable replay equality by the
  -- IMMUTABLE fingerprint — NOT by current mutable fields (so later B8 reschedule / B6
  -- supersession cannot break a genuine retry).
  select * into v_existing
    from public.player_protection_interventions
    where casino_id = p_casino_id and b9_idempotency_key = p_idempotency_key;
  if not found then raise exception 'B9: idempotency conflict resolution failed'; end if;

  if v_existing.b9_request_fingerprint is distinct from v_fp then
    return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid, null::uuid; return;
  end if;

  -- REPLAYED: return the ORIGINAL (earliest) historical B9 link for this alert+intervention,
  -- regardless of later supersession. Never manufacture a new link on replay.
  select l.id into v_link
    from public.alert_intervention_links l
    where l.alert_id = p_alert_id and l.intervention_id = v_existing.id and l.casino_id = p_casino_id
    order by l.linked_at asc, l.id asc
    limit 1;
  if v_link is null then raise exception 'B9: replay integrity — original link missing'; end if;

  return query select 'REPLAYED'::text, v_existing.id, v_link; return;
end $$;

revoke all on function public.sbiq_b9_record_alert_intervention(uuid,uuid,uuid,uuid,text,text,boolean,date) from public;
revoke execute on function public.sbiq_b9_record_alert_intervention(uuid,uuid,uuid,uuid,text,text,boolean,date) from anon;
revoke execute on function public.sbiq_b9_record_alert_intervention(uuid,uuid,uuid,uuid,text,text,boolean,date) from authenticated;
grant  execute on function public.sbiq_b9_record_alert_intervention(uuid,uuid,uuid,uuid,text,text,boolean,date) to service_role;
