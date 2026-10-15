-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B13.1 Governed Player Communication Core (SANDBOX ONLY).
--
-- Operator-mediated, human-confirmed, responsible-gambling-only, intervention-linked,
-- versioned-template-governed, PII-minimised player-communication core. B13.1 performs NO
-- real delivery: delivery_mode is CHECK-locked to 'SANDBOX'; a code-level sandbox connector
-- (no network/contact/secret) is the only transport. Three narrow SECURITY DEFINER RPCs own
-- all writes: create (human request) → begin-send (human dispatch authorisation) →
-- record-receipt (system/connector). Separate request + send idempotency; DB-allocated
-- sequence (FOR UPDATE + UNIQUE); a full status-keyed lifecycle CHECK makes contradictory
-- rows impossible. Human accountability (requested_by, send_requested_by) is preserved and
-- immutable; connector receipts are attributed to user_id=NULL, user_role='system'
-- (truthfully supported: audit_events.user_id/user_role are nullable, no FK/CHECK, and a
-- 'system' role precedent already exists).
--
-- Stores NO player_id / phone / email / address / message body / raw provider payload.
-- B4.1/B5/B6/B7/B8/B9/B10/B11/B12/B2 unchanged; legacy delivery structures untouched; no
-- marketing; no AI; no cron; no federation. NOT auto-applied; applied (if authorised) by the
-- governed raw-SQL path to IQ Demo only, leaving the ledger unchanged. Modifies ZERO existing rows.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Core table ──
create table public.intervention_player_communications (
  id                      uuid        not null default gen_random_uuid(),
  casino_id               uuid        not null,
  intervention_id         uuid        not null,
  communication_type      text        not null,
  purpose                 text        not null,
  template_key            text        not null,
  template_version        integer     not null,
  delivery_mode           text        not null,
  channel_class           text        not null,
  sequence                integer     not null,
  requested_at            timestamptz not null default now(),
  requested_by            uuid        not null,
  request_idempotency_key uuid        not null,
  request_fingerprint     text        not null,
  status                  text        not null default 'PENDING',
  send_idempotency_key    uuid,
  send_fingerprint        text,
  send_requested_by       uuid,
  send_requested_at       timestamptz,
  provider_reference      text,
  submitted_at            timestamptz,
  delivered_at            timestamptz,
  failed_at               timestamptz,
  failure_class           text,
  constraint intervention_player_communications_pkey primary key (id),
  -- three FKs (RESTRICT): intervention + the two human accountability actors. No player FK.
  constraint iplc_intervention_fk foreign key (intervention_id) references public.player_protection_interventions(id) on update restrict on delete restrict,
  constraint iplc_requested_by_fk foreign key (requested_by)    references public.users(id) on update restrict on delete restrict,
  constraint iplc_send_requested_by_fk foreign key (send_requested_by) references public.users(id) on update restrict on delete restrict,
  -- three UNIQUE invariants
  constraint iplc_request_idem_uq unique (casino_id, request_idempotency_key),
  constraint iplc_send_idem_uq    unique (casino_id, send_idempotency_key),
  constraint iplc_sequence_uq     unique (casino_id, intervention_id, sequence),
  -- value CHECKs
  constraint iplc_communication_type_chk check (communication_type in ('LIMIT_CONFIRMATION','TIMEOUT_CONFIRMATION','SELF_EXCLUSION_SUPPORT','HELPLINE_SUPPORT','COUNSELLING_SUPPORT')),
  constraint iplc_purpose_chk       check (purpose = 'RESPONSIBLE_GAMBLING'),
  constraint iplc_template_key_chk  check (template_key in ('rg.limit_confirmation','rg.timeout_confirmation','rg.self_exclusion_support','rg.helpline_support','rg.counselling_support')),
  constraint iplc_template_version_chk check (template_version > 0),
  constraint iplc_delivery_mode_chk check (delivery_mode = 'SANDBOX'),           -- B13.1 real-send block (DB layer)
  constraint iplc_channel_class_chk check (channel_class = 'OPERATOR_MANAGED'),
  constraint iplc_status_chk        check (status in ('PENDING','SUBMITTING','SUBMITTED','DELIVERED','FAILED')),
  constraint iplc_failure_class_chk check (failure_class is null or failure_class in ('RECIPIENT_UNAVAILABLE','CHANNEL_NOT_AVAILABLE','PROVIDER_REJECTED','TEMPORARY_FAILURE','PERMANENT_FAILURE','POLICY_BLOCKED')),
  constraint iplc_sequence_chk      check (sequence > 0),
  constraint iplc_request_fp_chk    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint iplc_send_fp_chk       check (send_fingerprint is null or send_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint iplc_provider_ref_len_chk check (provider_reference is null or char_length(provider_reference) <= 200),
  -- full status-keyed lifecycle consistency (makes contradictory rows impossible)
  constraint iplc_lifecycle_chk check (
    case status
      when 'PENDING' then
        send_idempotency_key is null and send_fingerprint is null and send_requested_by is null and send_requested_at is null
        and provider_reference is null and submitted_at is null and delivered_at is null and failed_at is null and failure_class is null
      when 'SUBMITTING' then
        send_idempotency_key is not null and send_fingerprint is not null and send_requested_by is not null and send_requested_at is not null
        and submitted_at is null and delivered_at is null and failed_at is null and failure_class is null
      when 'SUBMITTED' then
        send_idempotency_key is not null and send_fingerprint is not null and send_requested_by is not null and send_requested_at is not null
        and provider_reference is not null and submitted_at is not null and delivered_at is null and failed_at is null and failure_class is null
      when 'DELIVERED' then
        send_idempotency_key is not null and send_fingerprint is not null and send_requested_by is not null and send_requested_at is not null
        and provider_reference is not null and submitted_at is not null and delivered_at is not null and failed_at is null and failure_class is null
      when 'FAILED' then
        send_idempotency_key is not null and send_fingerprint is not null and send_requested_by is not null and send_requested_at is not null
        and failed_at is not null and failure_class is not null and delivered_at is null
        and ((submitted_at is null and provider_reference is null) or (submitted_at is not null and provider_reference is not null))
      else false
    end
  )
);

-- ── 2. History index (no speculative status index) ──
create index iplc_history_idx on public.intervention_player_communications (casino_id, intervention_id, requested_at desc);

-- ── 3. RLS: enabled + forced, no policies (no client surface) ──
alter table public.intervention_player_communications enable row level security;
alter table public.intervention_player_communications force  row level security;

-- ── 4. Privileges: service_role SELECT only; no client access; writes via DEFINER RPCs ──
revoke all    on table public.intervention_player_communications from public;
revoke all    on table public.intervention_player_communications from anon;
revoke all    on table public.intervention_player_communications from authenticated;
revoke all    on table public.intervention_player_communications from service_role;
grant  select on table public.intervention_player_communications to service_role;

-- ── Helper (inlined in RPCs): canonical SHA-256 over chr(31)-joined parts via extensions.digest.

-- ── 5. CREATE: governed human request. SECURITY DEFINER (owner postgres, BYPASSRLS). ──
create function public.sbiq_b13_create_player_communication(
  p_casino_id         uuid,
  p_actor_id          uuid,
  p_intervention_id   uuid,
  p_communication_type text,
  p_template_key      text,
  p_idempotency_key   uuid
) returns table(status text, communication_id uuid, sequence integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role        text;
  v_actor_casino uuid;
  v_iv_casino   uuid;
  v_iv_type     text;
  v_fp          text;
  v_existing    public.intervention_player_communications%rowtype;
  v_seq         integer;
  v_id          uuid;
  v_expected_type text;
  v_expected_key  text;
begin
  if p_idempotency_key is null then raise exception 'B13: idempotency key required'; end if;

  -- actor
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B13: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then raise exception 'B13: actor role % not permitted', v_role; end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then raise exception 'B13: actor not governed for casino'; end if;

  -- resolve + lock intervention; derive casino + type (player identity intentionally NOT stored)
  select i.casino_id, i.intervention_type into v_iv_casino, v_iv_type
    from public.player_protection_interventions i where i.id = p_intervention_id for update;
  if not found or v_iv_casino is distinct from p_casino_id then
    return query select 'NOT_FOUND'::text, null::uuid, null::integer; return;
  end if;

  -- immutable fingerprint of the ORIGINAL request (server-governed version/purpose/mode/channel)
  v_fp := encode(extensions.digest(convert_to(
    'b13-request-v1' || chr(31) || p_casino_id::text || chr(31) || p_intervention_id::text || chr(31) || p_communication_type
      || chr(31) || p_template_key || chr(31) || '1' || chr(31) || 'RESPONSIBLE_GAMBLING' || chr(31) || 'SANDBOX'
      || chr(31) || 'OPERATOR_MANAGED' || chr(31) || p_actor_id::text, 'UTF8'), 'sha256'), 'hex');

  -- replay BEFORE mutable policy rejection (a prior request stays replayable)
  select * into v_existing from public.intervention_player_communications
    where casino_id = p_casino_id and request_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is not distinct from v_fp then
      return query select 'REPLAYED'::text, v_existing.id, v_existing.sequence; return;
    end if;
    return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid, null::integer; return;
  end if;

  -- eligibility + exact type↔communication_type↔template_key mapping (defensive; not just TS)
  v_expected_type := case v_iv_type
    when 'limit_setting' then 'LIMIT_CONFIRMATION'
    when 'timeout' then 'TIMEOUT_CONFIRMATION'
    when 'self_exclusion_referral' then 'SELF_EXCLUSION_SUPPORT'
    when 'helpline_referral' then 'HELPLINE_SUPPORT'
    when 'counseling_referral' then 'COUNSELLING_SUPPORT'
    else null end;
  if v_expected_type is null then
    return query select 'INVALID_STATE'::text, null::uuid, null::integer; return;   -- manual_review / ai_alert / other
  end if;
  if p_communication_type is distinct from v_expected_type then
    return query select 'INVALID_STATE'::text, null::uuid, null::integer; return;
  end if;
  v_expected_key := case p_communication_type
    when 'LIMIT_CONFIRMATION' then 'rg.limit_confirmation'
    when 'TIMEOUT_CONFIRMATION' then 'rg.timeout_confirmation'
    when 'SELF_EXCLUSION_SUPPORT' then 'rg.self_exclusion_support'
    when 'HELPLINE_SUPPORT' then 'rg.helpline_support'
    when 'COUNSELLING_SUPPORT' then 'rg.counselling_support'
    else null end;
  if p_template_key is distinct from v_expected_key then
    return query select 'INVALID_STATE'::text, null::uuid, null::integer; return;
  end if;

  -- sequence under the already-held intervention lock
  select coalesce(max(c.sequence), 0) + 1 into v_seq from public.intervention_player_communications c
    where c.casino_id = p_casino_id and c.intervention_id = p_intervention_id;

  begin
    insert into public.intervention_player_communications (
      casino_id, intervention_id, communication_type, purpose, template_key, template_version,
      delivery_mode, channel_class, sequence, requested_by, request_idempotency_key, request_fingerprint, status)
    values (
      p_casino_id, p_intervention_id, p_communication_type, 'RESPONSIBLE_GAMBLING', p_template_key, 1,
      'SANDBOX', 'OPERATOR_MANAGED', v_seq, p_actor_id, p_idempotency_key, v_fp, 'PENDING')
    returning id into v_id;

    insert into public.audit_events (
      event_id, event_type, event_category, action, resource_type, resource_id,
      user_id, user_role, casino_id, severity, outcome, metadata)
    values (
      'b13:player-communication:' || v_id::text || ':requested',
      'intervention.player_communication_requested', 'responsible_gambling', 'intervention.player_communication_requested',
      'intervention_player_communication', v_id::text, p_actor_id, v_role, p_casino_id, 'info', 'success',
      jsonb_build_object('intervention_id', p_intervention_id, 'communication_type', p_communication_type,
        'purpose', 'RESPONSIBLE_GAMBLING', 'template_key', p_template_key, 'template_version', 1,
        'delivery_mode', 'SANDBOX', 'channel_class', 'OPERATOR_MANAGED', 'sequence', v_seq, 'sandbox', true));

    return query select 'CREATED'::text, v_id, v_seq; return;
  exception when unique_violation then
    -- Only the request-key race is an idempotency outcome; sequence/other uniqueness fails closed.
    get stacked diagnostics v_expected_key = constraint_name;
    if v_expected_key = 'iplc_request_idem_uq' then
      select * into v_existing from public.intervention_player_communications
        where casino_id = p_casino_id and request_idempotency_key = p_idempotency_key;
      if not found then raise exception 'B13: request idempotency resolution failed'; end if;
      if v_existing.request_fingerprint is not distinct from v_fp then
        return query select 'REPLAYED'::text, v_existing.id, v_existing.sequence; return;
      end if;
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid, null::integer; return;
    end if;
    raise;   -- sequence_uq / send_idem_uq / audit event_id / anything else → fail closed
  end;
end $$;

-- ── 6. BEGIN-SEND: human dispatch authorisation (PENDING → SUBMITTING). ──
create function public.sbiq_b13_begin_player_communication_send(
  p_casino_id          uuid,
  p_actor_id           uuid,
  p_communication_id   uuid,
  p_send_idempotency_key uuid
) returns table(status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role     text;
  v_actor_casino uuid;
  v_c        public.intervention_player_communications%rowtype;
  v_fp       text;
  v_existing public.intervention_player_communications%rowtype;
  v_con      text;
begin
  if p_send_idempotency_key is null then raise exception 'B13: send idempotency key required'; end if;
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B13: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then raise exception 'B13: actor role % not permitted', v_role; end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then raise exception 'B13: actor not governed for casino'; end if;

  select * into v_c from public.intervention_player_communications
    where id = p_communication_id and casino_id = p_casino_id for update;
  if not found then return query select 'NOT_FOUND'::text; return; end if;

  v_fp := encode(extensions.digest(convert_to(
    'b13-send-v1' || chr(31) || p_casino_id::text || chr(31) || p_communication_id::text || chr(31) || p_actor_id::text || chr(31) || 'SANDBOX',
    'UTF8'), 'sha256'), 'hex');

  -- durable send-key arbitration (post-lock)
  select * into v_existing from public.intervention_player_communications
    where casino_id = p_casino_id and send_idempotency_key = p_send_idempotency_key;
  if found then
    if v_existing.id = p_communication_id and v_existing.send_fingerprint is not distinct from v_fp then
      return query select 'REPLAYED'::text; return;
    end if;
    return query select 'IDEMPOTENCY_CONFLICT'::text; return;
  end if;

  if v_c.status <> 'PENDING' then return query select 'INVALID_STATE'::text; return; end if;
  if v_c.delivery_mode <> 'SANDBOX' then raise exception 'B13: delivery_mode not SANDBOX'; end if;

  begin
    update public.intervention_player_communications
       set status = 'SUBMITTING', send_idempotency_key = p_send_idempotency_key, send_fingerprint = v_fp,
           send_requested_by = p_actor_id, send_requested_at = now()
     where id = p_communication_id and casino_id = p_casino_id;

    insert into public.audit_events (
      event_id, event_type, event_category, action, resource_type, resource_id,
      user_id, user_role, casino_id, severity, outcome, metadata)
    values (
      'b13:player-communication:' || p_communication_id::text || ':send-requested',
      'intervention.player_communication_send_requested', 'responsible_gambling', 'intervention.player_communication_send_requested',
      'intervention_player_communication', p_communication_id::text, p_actor_id, v_role, p_casino_id, 'info', 'success',
      jsonb_build_object('intervention_id', v_c.intervention_id, 'communication_type', v_c.communication_type,
        'purpose', v_c.purpose, 'template_key', v_c.template_key, 'template_version', v_c.template_version,
        'delivery_mode', v_c.delivery_mode, 'channel_class', v_c.channel_class, 'sequence', v_c.sequence, 'sandbox', true));

    return query select 'BEGUN'::text; return;
  exception when unique_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'iplc_send_idem_uq' then
      select * into v_existing from public.intervention_player_communications
        where casino_id = p_casino_id and send_idempotency_key = p_send_idempotency_key;
      if found and v_existing.id = p_communication_id and v_existing.send_fingerprint is not distinct from v_fp then
        return query select 'REPLAYED'::text; return;
      end if;
      return query select 'IDEMPOTENCY_CONFLICT'::text; return;
    end if;
    raise;   -- any other constraint → fail closed (loser mutation + audit rolled back)
  end;
end $$;

-- ── 7. RECORD-RECEIPT: system/connector transition. No actor input; service path only. ──
create function public.sbiq_b13_record_player_communication_receipt(
  p_casino_id         uuid,
  p_communication_id  uuid,
  p_status            text,
  p_provider_reference text,
  p_failure_class     text
) returns table(status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_c   public.intervention_player_communications%rowtype;
  v_evt text;
begin
  if p_status not in ('SUBMITTED','DELIVERED','FAILED') then raise exception 'B13: invalid receipt status %', p_status; end if;

  select * into v_c from public.intervention_player_communications
    where id = p_communication_id and casino_id = p_casino_id for update;
  if not found then return query select 'NOT_FOUND'::text; return; end if;
  if v_c.delivery_mode <> 'SANDBOX' then raise exception 'B13: delivery_mode not SANDBOX'; end if;

  -- idempotent replay: current state already reflects the requested receipt. SUBMITTED carries
  -- the provider reference; DELIVERED is a pure status advance; FAILED carries the failure class.
  if p_status = 'SUBMITTED' and v_c.status = 'SUBMITTED' and v_c.provider_reference is not distinct from p_provider_reference then
    return query select 'REPLAYED'::text; return; end if;
  if p_status = 'DELIVERED' and v_c.status = 'DELIVERED' then
    return query select 'REPLAYED'::text; return; end if;
  if p_status = 'FAILED' and v_c.status = 'FAILED' and v_c.failure_class is not distinct from p_failure_class then
    return query select 'REPLAYED'::text; return; end if;

  if p_status = 'SUBMITTED' then
    if v_c.status <> 'SUBMITTING' then return query select 'INVALID_STATE'::text; return; end if;
    if p_provider_reference is null then raise exception 'B13: provider_reference required for SUBMITTED'; end if;
    update public.intervention_player_communications set status='SUBMITTED', submitted_at=now(), provider_reference=p_provider_reference
      where id=p_communication_id and casino_id=p_casino_id;
    v_evt := 'submitted';
  elsif p_status = 'DELIVERED' then
    if v_c.status <> 'SUBMITTED' then return query select 'INVALID_STATE'::text; return; end if;
    update public.intervention_player_communications set status='DELIVERED', delivered_at=now()
      where id=p_communication_id and casino_id=p_casino_id;
    v_evt := 'delivered';
  else  -- FAILED
    if v_c.status not in ('SUBMITTING','SUBMITTED') then return query select 'INVALID_STATE'::text; return; end if;
    if p_failure_class is null then raise exception 'B13: failure_class required for FAILED'; end if;
    update public.intervention_player_communications set status='FAILED', failed_at=now(), failure_class=p_failure_class
      where id=p_communication_id and casino_id=p_casino_id;   -- submitted_at/provider_reference retained if already set
    v_evt := 'failed';
  end if;

  insert into public.audit_events (
    event_id, event_type, event_category, action, resource_type, resource_id,
    user_id, user_role, casino_id, severity, outcome, metadata)
  values (
    'b13:player-communication:' || p_communication_id::text || ':' || v_evt,
    'intervention.player_communication_' || v_evt, 'responsible_gambling', 'intervention.player_communication_' || v_evt,
    'intervention_player_communication', p_communication_id::text, null, 'system', p_casino_id, 'info', 'success',
    jsonb_build_object('intervention_id', v_c.intervention_id, 'communication_type', v_c.communication_type,
      'purpose', v_c.purpose, 'template_key', v_c.template_key, 'template_version', v_c.template_version,
      'delivery_mode', v_c.delivery_mode, 'channel_class', v_c.channel_class, 'sequence', v_c.sequence,
      'sandbox', true, 'failure_class', p_failure_class));

  return query select 'RECORDED'::text; return;
end $$;

-- ── 8. EXECUTE privileges: service_role only for all three RPCs ──
revoke all     on function public.sbiq_b13_create_player_communication(uuid,uuid,uuid,text,text,uuid) from public;
revoke execute on function public.sbiq_b13_create_player_communication(uuid,uuid,uuid,text,text,uuid) from anon;
revoke execute on function public.sbiq_b13_create_player_communication(uuid,uuid,uuid,text,text,uuid) from authenticated;
grant  execute on function public.sbiq_b13_create_player_communication(uuid,uuid,uuid,text,text,uuid) to service_role;

revoke all     on function public.sbiq_b13_begin_player_communication_send(uuid,uuid,uuid,uuid) from public;
revoke execute on function public.sbiq_b13_begin_player_communication_send(uuid,uuid,uuid,uuid) from anon;
revoke execute on function public.sbiq_b13_begin_player_communication_send(uuid,uuid,uuid,uuid) from authenticated;
grant  execute on function public.sbiq_b13_begin_player_communication_send(uuid,uuid,uuid,uuid) to service_role;

revoke all     on function public.sbiq_b13_record_player_communication_receipt(uuid,uuid,text,text,text) from public;
revoke execute on function public.sbiq_b13_record_player_communication_receipt(uuid,uuid,text,text,text) from anon;
revoke execute on function public.sbiq_b13_record_player_communication_receipt(uuid,uuid,text,text,text) from authenticated;
grant  execute on function public.sbiq_b13_record_player_communication_receipt(uuid,uuid,text,text,text) to service_role;
