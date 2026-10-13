-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B10 Governed Follow-Up Occurrence Recording (APPEND-ONLY).
--
-- Records the factual OCCURRENCE of a responsible-gambling follow-up against an
-- existing intervention, via ONE atomic SECURITY DEFINER function that, in a single
-- transaction: validates the actor, resolves the governed intervention (deriving
-- casino/player DB-side), snapshots the current B8 follow_up_date, writes ONE append-only
-- occurrence row and the intervention.follow_up_recorded audit. Mandatory UUID idempotency
-- with an IMMUTABLE DB-computed request fingerprint so a genuine retry stays replayable
-- even after later B8 rescheduling / eligibility change.
--
-- SEMANTIC FIREWALL: follow-up OCCURRENCE ≠ obligation COMPLETION ≠ intervention
-- EFFECTIVENESS. B10 stores NO completion/closure/success/outcome/SLA field, infers NO
-- obligation completion, and NEVER mutates scheduling (follow_up_date) or requirement
-- (follow_up_required) — B8 remains the sole scheduling authority.
--
-- Tighter than B6/B9: the new table grants service_role SELECT ONLY (no INSERT/UPDATE/
-- DELETE); all writes occur through the DEFINER function (owned by postgres at apply time,
-- BYPASSRLS, holds the INSERTs). RLS enabled + forced; no client policies.
--
-- Fail-closed DDL. NOT auto-applied; applied (if authorised) by the governed raw-SQL path
-- to IQ Demo only, leaving the migration ledger unchanged. Modifies ZERO existing rows;
-- the new table starts empty (no backfill). B4.1/B5/B6/B7-buckets/B8/B9 unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Append-only occurrence table ──
create table public.intervention_follow_up_events (
  id                        uuid        not null default gen_random_uuid(),
  casino_id                 uuid        not null,
  intervention_id           uuid        not null,
  player_id                 uuid        not null,
  scheduled_follow_up_date  date,                               -- immutable snapshot at creation (may be NULL)
  occurred_on               date        not null,               -- operator-supplied SAST business date
  recorded_at               timestamptz not null default now(), -- authoritative DB provenance
  recorded_by               uuid        not null,               -- authoritative principal (users.id)
  b10_idempotency_key       uuid        not null,
  b10_request_fingerprint   text        not null,
  constraint intervention_follow_up_events_pkey primary key (id),
  -- DB-enforced tenant/subject identity (mirrors B6 ail_intervention_identity_fk exactly).
  constraint iffe_intervention_identity_fk
    foreign key (intervention_id, casino_id, player_id)
    references public.player_protection_interventions (id, casino_id, player_id)
    on update restrict on delete restrict,
  -- Authoritative actor; RESTRICT mirrors B6 alert_intervention_links.linked_by.
  constraint iffe_recorded_by_fk
    foreign key (recorded_by) references public.users (id)
    on update restrict on delete restrict,
  -- Durable replay identity scoped to a governed casino. Both idempotency columns NOT NULL.
  constraint iffe_b10_idempotency_uq unique (casino_id, b10_idempotency_key)
);

-- ── 2. Access-path indexes only (the UNIQUE above supplies the idempotency index) ──
create index iffe_history_idx on public.intervention_follow_up_events (casino_id, intervention_id, occurred_on desc);
create index iffe_period_idx  on public.intervention_follow_up_events (casino_id, occurred_on);

-- ── 3. RLS: enabled + forced, no policies (no client surface) ──
alter table public.intervention_follow_up_events enable row level security;
alter table public.intervention_follow_up_events force  row level security;

-- ── 4. Table privileges: tighter than B6/B9 — service_role SELECT only; no client access.
--       All writes go through the DEFINER function (owner postgres, BYPASSRLS). ──
revoke all on table public.intervention_follow_up_events from public;
revoke all on table public.intervention_follow_up_events from anon;
revoke all on table public.intervention_follow_up_events from authenticated;
revoke all on table public.intervention_follow_up_events from service_role;
grant  select on table public.intervention_follow_up_events to service_role;

-- ── 5. Atomic governed creation function. SECURITY DEFINER (owned by postgres at apply
--       time; BYPASSRLS; holds the INSERTs). service_role EXECUTE only. ──
create function public.sbiq_b10_record_follow_up_occurrence(
  p_intervention_id uuid,
  p_casino_id       uuid,
  p_actor_id        uuid,
  p_idempotency_key uuid,
  p_occurred_on     date
) returns table(status text, occurrence_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role         text;
  v_actor_casino uuid;
  v_player       uuid;
  v_follow_req   boolean;
  v_follow_date  date;
  v_iv_sast      date;
  v_today        date;
  v_fp           text;
  v_id           uuid;
  v_existing     public.intervention_follow_up_events%rowtype;
begin
  if p_idempotency_key is null then raise exception 'B10: idempotency key required'; end if;
  if p_occurred_on is null     then raise exception 'B10: occurred_on required'; end if;

  -- Actor (defence-in-depth; server already authorised). Role from authoritative users.
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B10: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then
    raise exception 'B10: actor role % not permitted', v_role;
  end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then
    raise exception 'B10: actor not governed for casino';
  end if;

  -- Immutable canonical fingerprint of the ORIGINAL logical request (DB-computed; never a
  -- caller argument). Excludes DB state/provenance (schedule, requirement, recorded_at, id)
  -- so a genuine retry stays replayable after later B8 / eligibility changes.
  v_fp := encode(extensions.digest(convert_to(
    'b10v1' || chr(31) || p_casino_id::text || chr(31) || p_intervention_id::text
            || chr(31) || p_actor_id::text || chr(31) || p_occurred_on::text,
    'UTF8'), 'sha256'), 'hex');

  -- Existing idempotency key? Replay/conflict resolve by the IMMUTABLE fingerprint and do
  -- NOT re-evaluate current eligibility (a later legitimate B8/eligibility change must not
  -- break a genuine retry). Current actor authorisation was already enforced above.
  select * into v_existing from public.intervention_follow_up_events
    where casino_id = p_casino_id and b10_idempotency_key = p_idempotency_key;
  if found then
    if v_existing.b10_request_fingerprint is distinct from v_fp then
      return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid; return;
    end if;
    return query select 'REPLAYED'::text, v_existing.id; return;
  end if;

  -- NEW occurrence: resolve the governed intervention with a share lock so eligibility +
  -- schedule snapshot are consistent against a concurrent B8 UPDATE (which needs a
  -- conflicting row lock and therefore serialises after this transaction).
  select i.player_id, i.follow_up_required, i.follow_up_date,
         (i.intervention_date at time zone 'Africa/Johannesburg')::date
    into v_player, v_follow_req, v_follow_date, v_iv_sast
    from public.player_protection_interventions i
    where i.id = p_intervention_id and i.casino_id = p_casino_id
    for share;
  if not found then
    return query select 'NOT_FOUND'::text, null::uuid; return;
  end if;

  -- Eligibility: a required (scheduled OR unscheduled) follow-up may occur. Never mutate it.
  if v_follow_req is not true then
    return query select 'INVALID_STATE'::text, null::uuid; return;
  end if;

  -- occurred_on bounds (SAST): between the intervention's SAST date and today; no invented
  -- retrospective threshold. Future is also defended here (route rejects it as 400 first).
  v_today := (now() at time zone 'Africa/Johannesburg')::date;
  if p_occurred_on > v_today or p_occurred_on < v_iv_sast then
    return query select 'INVALID_STATE'::text, null::uuid; return;
  end if;

  -- Race-safe first-writer append. scheduled_follow_up_date is the immutable snapshot.
  insert into public.intervention_follow_up_events (
    casino_id, intervention_id, player_id, scheduled_follow_up_date, occurred_on,
    recorded_at, recorded_by, b10_idempotency_key, b10_request_fingerprint)
  values (
    p_casino_id, p_intervention_id, v_player, v_follow_date, p_occurred_on,
    now(), p_actor_id, p_idempotency_key, v_fp)
  on conflict (casino_id, b10_idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    -- Same-transaction audit (trg_audit_chain hashes it; failure rolls the occurrence back).
    -- Safe structured metadata only — no PII, no recorded_by, no key, no fingerprint.
    insert into public.audit_events (
      event_id, event_type, event_category, action, resource_type, resource_id,
      user_id, user_role, casino_id, severity, outcome, metadata)
    values (
      'b10:intervention.follow_up_recorded:' || v_id::text,
      'intervention.follow_up_recorded', 'responsible_gambling', 'intervention.follow_up_recorded',
      'intervention_follow_up_event', v_id::text, p_actor_id, v_role, p_casino_id, 'info', 'success',
      jsonb_build_object(
        'intervention_id', p_intervention_id,
        'scheduled_date_present', (v_follow_date is not null),
        'timing_classification',
          case when v_follow_date is null       then 'NOT_APPLICABLE'
               when p_occurred_on < v_follow_date then 'EARLY'
               when p_occurred_on = v_follow_date then 'ON_DATE'
               else 'LATE' end,
        'occurred_on', p_occurred_on));
    return query select 'CREATED'::text, v_id; return;
  end if;

  -- Lost the insert race to a concurrent identical key: load the winner, equality by the
  -- IMMUTABLE fingerprint. Uniqueness — not the pre-read — is the concurrency authority.
  select * into v_existing from public.intervention_follow_up_events
    where casino_id = p_casino_id and b10_idempotency_key = p_idempotency_key;
  if not found then raise exception 'B10: idempotency conflict resolution failed'; end if;
  if v_existing.b10_request_fingerprint is distinct from v_fp then
    return query select 'IDEMPOTENCY_CONFLICT'::text, null::uuid; return;
  end if;
  return query select 'REPLAYED'::text, v_existing.id; return;
end $$;

-- Not a browser-callable surface: service_role (the governed server) only.
revoke all     on function public.sbiq_b10_record_follow_up_occurrence(uuid,uuid,uuid,uuid,date) from public;
revoke execute on function public.sbiq_b10_record_follow_up_occurrence(uuid,uuid,uuid,uuid,date) from anon;
revoke execute on function public.sbiq_b10_record_follow_up_occurrence(uuid,uuid,uuid,uuid,date) from authenticated;
grant  execute on function public.sbiq_b10_record_follow_up_occurrence(uuid,uuid,uuid,uuid,date) to service_role;
