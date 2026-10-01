-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B4.1 Operator-Local Protection Alerts (own-casino only).
-- Persisted lifecycle OPEN→ACKNOWLEDGED→RESOLVED. Governed service_role access ONLY.
-- Identity = typed source FK (one alert ever per source row per type). DB re-proves
-- rule eligibility on INSERT, GENERATES immutable evidence from the source, and OWNS
-- all lifecycle timestamps. id + identity + evidence + generation are immutable.
-- rule_version is non-empty provenance, NOT identity. Verified vs live IQ Demo schema
-- (audit_events.user_id uuid; service_role holds INSERT; users.id uuid, users.role enum).
-- Fail-closed DDL (plain CREATE; any name collision aborts the migration).
--
-- NOTE: the controlled rollback for this object is documented as an engineering runbook
-- note (products/../docs or PR description) and is NOT embedded as an auto-executing
-- section here, so applying this migration performs ONLY the forward change.
-- ─────────────────────────────────────────────────────────────────────────────

create table public.player_protection_alerts (
  id                 uuid primary key default gen_random_uuid(),
  casino_id          uuid not null references public.casinos(id),
  player_id          uuid not null references public.players(id),
  alert_type         text not null
                       check (alert_type in ('SELF_EXCLUSION_BREACH_REVIEW','INTERVENTION_FOLLOW_UP_OVERDUE')),
  rule_version       text not null check (length(btrim(rule_version)) > 0),
  self_exclusion_id  uuid references public.self_exclusions(id),
  intervention_id    uuid references public.player_protection_interventions(id),
  evidence           jsonb not null default '{}'::jsonb,
  status             text not null default 'OPEN'
                       check (status in ('OPEN','ACKNOWLEDGED','RESOLVED')),
  generated_at       timestamptz not null default now(),
  generated_by       uuid not null references public.users(id),
  acknowledged_at    timestamptz,
  acknowledged_by    uuid references public.users(id),
  resolved_at        timestamptz,
  resolved_by        uuid references public.users(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint ppa_source_shape check (
       (alert_type = 'SELF_EXCLUSION_BREACH_REVIEW'
          and self_exclusion_id is not null and intervention_id is null)
    or (alert_type = 'INTERVENTION_FOLLOW_UP_OVERDUE'
          and intervention_id is not null and self_exclusion_id is null)
  ),
  constraint ppa_ack_pairing      check ((acknowledged_at is null) = (acknowledged_by is null)),
  constraint ppa_resolved_pairing check ((resolved_at is null) = (resolved_by is null)),
  constraint ppa_open_coherent check (
    status <> 'OPEN'
    or (acknowledged_at is null and acknowledged_by is null
        and resolved_at is null and resolved_by is null)),
  constraint ppa_ack_coherent check (
    status <> 'ACKNOWLEDGED'
    or (acknowledged_at is not null and acknowledged_by is not null
        and resolved_at is null and resolved_by is null)),
  constraint ppa_resolved_coherent check (
    status <> 'RESOLVED'
    or (resolved_at is not null and resolved_by is not null))
);

-- Permanent per-condition identity: one alert ever per source row per rule (ANY
-- lifecycle state; no status predicate; no rule_version). RESOLVED stays historical
-- and blocks regeneration from that same source row.
create unique index ppa_identity_self_exclusion
  on public.player_protection_alerts (self_exclusion_id)
  where alert_type = 'SELF_EXCLUSION_BREACH_REVIEW';
create unique index ppa_identity_intervention
  on public.player_protection_alerts (intervention_id)
  where alert_type = 'INTERVENTION_FOLLOW_UP_OVERDUE';

-- Listing / FK indexes
create index ppa_casino_status_gen on public.player_protection_alerts (casino_id, status, generated_at desc);
create index ppa_casino_player     on public.player_protection_alerts (casino_id, player_id);
create index ppa_intervention_fk   on public.player_protection_alerts (intervention_id);

-- ── Eligibility + evidence + lifecycle + immutability + DB-owned timestamps ──
-- SECURITY INVOKER (runs as service_role, which holds the required SELECT on the
-- source tables and INSERT on audit_events). No SECURITY DEFINER.
create function public.sbiq_ppa_validate()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_player_casino uuid;
  v_se_status     text;
  v_se_breach     integer;
  v_fur           boolean;
  v_fud           date;
begin
  if tg_op = 'INSERT' then
    if NEW.status <> 'OPEN'
       or NEW.acknowledged_at is not null or NEW.acknowledged_by is not null
       or NEW.resolved_at is not null or NEW.resolved_by is not null then
      raise exception 'B4.1: new alert must begin OPEN with no lifecycle attribution';
    end if;
    if NEW.generated_by is null then
      raise exception 'B4.1: generated_by is required';
    end if;

    select p.casino_id into v_player_casino from public.players p where p.id = NEW.player_id;
    if v_player_casino is null or v_player_casino <> NEW.casino_id then
      raise exception 'B4.1: player % not in casino %', NEW.player_id, NEW.casino_id;
    end if;

    if NEW.alert_type = 'SELF_EXCLUSION_BREACH_REVIEW' then
      select s.status, s.breach_count into v_se_status, v_se_breach
      from public.self_exclusions s
      where s.id = NEW.self_exclusion_id
        and s.casino_id = NEW.casino_id
        and s.player_id = NEW.player_id;
      if not found or v_se_status is distinct from 'breached' then
        raise exception 'B4.1: self_exclusion % not an eligible breached row for casino %/player %',
          NEW.self_exclusion_id, NEW.casino_id, NEW.player_id;
      end if;
      -- DB-generated immutable evidence (overwrites any caller value); NULL breach_count kept honest
      NEW.evidence := jsonb_build_object(
        'rule_version', NEW.rule_version,
        'self_exclusion_status', v_se_status,
        'breach_count', v_se_breach);

    elsif NEW.alert_type = 'INTERVENTION_FOLLOW_UP_OVERDUE' then
      select i.follow_up_required, i.follow_up_date into v_fur, v_fud
      from public.player_protection_interventions i
      where i.id = NEW.intervention_id
        and i.casino_id = NEW.casino_id
        and i.player_id = NEW.player_id;
      if not found
         or v_fur is not true
         or v_fud is null
         or not (v_fud < (now() at time zone 'Africa/Johannesburg')::date) then
        raise exception 'B4.1: intervention % not an eligible overdue follow-up for casino %/player %',
          NEW.intervention_id, NEW.casino_id, NEW.player_id;
      end if;
      NEW.evidence := jsonb_build_object(
        'rule_version', NEW.rule_version,
        'follow_up_date', v_fud);
    end if;

    -- DB-authoritative timestamps (overwrite any caller-supplied values)
    NEW.generated_at := now();
    NEW.created_at   := now();
    NEW.updated_at   := now();
    return NEW;
  end if;

  -- UPDATE: id / identity / evidence / generation are immutable
  if NEW.id             is distinct from OLD.id
     or NEW.casino_id       is distinct from OLD.casino_id
     or NEW.player_id       is distinct from OLD.player_id
     or NEW.alert_type      is distinct from OLD.alert_type
     or NEW.rule_version    is distinct from OLD.rule_version
     or NEW.self_exclusion_id  is distinct from OLD.self_exclusion_id
     or NEW.intervention_id    is distinct from OLD.intervention_id
     or NEW.evidence        is distinct from OLD.evidence
     or NEW.generated_at    is distinct from OLD.generated_at
     or NEW.generated_by    is distinct from OLD.generated_by
     or NEW.created_at      is distinct from OLD.created_at then
    raise exception 'B4.1: immutable column changed on alert %', OLD.id;
  end if;

  -- legal transitions only (no reverse / no reopen)
  if not (
       (OLD.status = 'OPEN'         and NEW.status in ('OPEN','ACKNOWLEDGED','RESOLVED'))
    or (OLD.status = 'ACKNOWLEDGED' and NEW.status in ('ACKNOWLEDGED','RESOLVED'))
    or (OLD.status = 'RESOLVED'     and NEW.status =  'RESOLVED')
  ) then
    raise exception 'B4.1: illegal transition % -> % on alert %', OLD.status, NEW.status, OLD.id;
  end if;

  -- acknowledgement attribution may change ONLY on OPEN->ACKNOWLEDGED; timestamp DB-set there
  if OLD.status = 'OPEN' and NEW.status = 'ACKNOWLEDGED' then
    if NEW.acknowledged_by is null then
      raise exception 'B4.1: acknowledged_by required on OPEN->ACKNOWLEDGED';
    end if;
    NEW.acknowledged_at := now();                 -- DB-authoritative (overwrite)
  else
    if NEW.acknowledged_at is distinct from OLD.acknowledged_at
       or NEW.acknowledged_by is distinct from OLD.acknowledged_by then
      raise exception 'B4.1: acknowledgement attribution may change only on OPEN->ACKNOWLEDGED';
    end if;
  end if;

  -- resolution attribution may change ONLY on ->RESOLVED (from OPEN/ACKNOWLEDGED); timestamp DB-set
  if NEW.status = 'RESOLVED' and OLD.status in ('OPEN','ACKNOWLEDGED') then
    if NEW.resolved_by is null then
      raise exception 'B4.1: resolved_by required on ->RESOLVED';
    end if;
    NEW.resolved_at := now();                     -- DB-authoritative (overwrite)
  else
    if NEW.resolved_at is distinct from OLD.resolved_at
       or NEW.resolved_by is distinct from OLD.resolved_by then
      raise exception 'B4.1: resolution attribution may change only on ->RESOLVED';
    end if;
  end if;

  -- updated_at bumps only on a real transition; a true no-op preserves it
  if NEW.status is distinct from OLD.status then
    NEW.updated_at := now();
  else
    NEW.updated_at := OLD.updated_at;
  end if;
  return NEW;
end $$;

revoke all on function public.sbiq_ppa_validate() from public;

create trigger trg_ppa_validate
  before insert or update on public.player_protection_alerts
  for each row execute function public.sbiq_ppa_validate();

-- ── Atomic audit emission into the EXISTING chain, same transaction (INVOKER) ──
-- Matches verified live audit_events contract: user_id uuid; explicit unique event_id;
-- NOT NULL event_type/event_category/action/severity/outcome supplied. The existing
-- BEFORE-INSERT trg_audit_chain remains authoritative for hashing/chain columns.
create function public.sbiq_ppa_audit()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare v_action text; v_actor uuid; v_role text; v_prior text;
begin
  if tg_op = 'INSERT' then
    v_action := 'protection_alert.generated';    v_actor := NEW.generated_by;    v_prior := null;
  elsif NEW.status = 'ACKNOWLEDGED' and OLD.status = 'OPEN' then
    v_action := 'protection_alert.acknowledged'; v_actor := NEW.acknowledged_by; v_prior := OLD.status;
  elsif NEW.status = 'RESOLVED' and OLD.status <> 'RESOLVED' then
    v_action := 'protection_alert.resolved';     v_actor := NEW.resolved_by;     v_prior := OLD.status;
  else
    return NEW;  -- idempotent no-op update ⇒ no audit row
  end if;

  select u.role::text into v_role from public.users u where u.id = v_actor;

  insert into public.audit_events (
    event_id, event_type, event_category, action,
    resource_type, resource_id, user_id, user_role, casino_id,
    severity, outcome, metadata)
  values (
    'ppa:' || v_action || ':' || NEW.id::text,
    v_action, 'responsible_gambling', v_action,
    'player_protection_alert', NEW.id::text, v_actor, v_role, NEW.casino_id,
    'info', 'success',
    jsonb_build_object(
      'alert_type', NEW.alert_type, 'rule_version', NEW.rule_version,
      'prior_status', v_prior, 'new_status', NEW.status,
      'self_exclusion_id', NEW.self_exclusion_id, 'intervention_id', NEW.intervention_id));
  return NEW;
end $$;

revoke all on function public.sbiq_ppa_audit() from public;

create trigger trg_ppa_audit
  after insert or update on public.player_protection_alerts
  for each row execute function public.sbiq_ppa_audit();

-- ── Access: governed service_role ONLY; RLS forced as defense-in-depth ──
alter table public.player_protection_alerts enable row level security;
alter table public.player_protection_alerts force  row level security;
revoke all on public.player_protection_alerts from public;
revoke all on public.player_protection_alerts from anon;
revoke all on public.player_protection_alerts from authenticated;
grant select, insert, update on public.player_protection_alerts to service_role;
