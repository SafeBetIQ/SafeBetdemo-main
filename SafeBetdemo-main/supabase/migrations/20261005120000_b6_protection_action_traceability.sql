-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B6 Protection Action Traceability (operator-local, own-casino).
--
-- Links a B4.1 protection alert to the recorded intervention(s) that represent the
-- operator's human response, answering "what recorded action followed this alert?"
-- WITHOUT any effectiveness / causal / harm-reduction / risk-trajectory claim.
--
-- Dedicated public.alert_intervention_links. The B4.1 column
-- player_protection_alerts.intervention_id is NOT touched — it remains the immutable
-- B4.1 SOURCE intervention for INTERVENTION_FOLLOW_UP_OVERDUE.
--
-- Cardinality MANY-TO-MANY, constrained to the SAME casino + SAME player.
--
-- KEY ARCHITECTURAL PROPERTY: the lifetime same-casino/same-player invariant is
-- enforced RELATIONALLY by two COMPOSITE foreign keys (ON UPDATE/DELETE RESTRICT),
-- not by an INSERT-time trigger. player_protection_interventions.casino_id/player_id
-- were found to be MUTABLE (no immutability trigger; service_role holds the Supabase
-- default-ALL incl. UPDATE/DELETE; RLS enabled but NOT forced). ON UPDATE RESTRICT
-- therefore freezes a linked intervention's (casino_id, player_id) for the link's life;
-- ON DELETE RESTRICT prevents orphaning. The composite FKs require a minimal, passive,
-- superset-of-PK UNIQUE(id, casino_id, player_id) on BOTH source tables (added below).
-- No trigger is added to player_protection_interventions and no B4.1 semantics change.
--
-- Correction is a SINGLE INSERT of the replacement row carrying supersedes_link_id; a
-- DB trigger atomically supersedes the prior active link and emits exactly one audit
-- event, all in the same statement transaction. No supersession RPC. No DELETE.
--
-- SECURITY INVOKER throughout (service_role holds the needed privileges). Fail-closed
-- DDL (plain CREATE/ALTER; any name/constraint collision aborts the migration).
--
-- NOTE: the controlled rollback is documented as an engineering runbook note in the PR
-- description / docs, NOT embedded here; applying this migration performs ONLY the
-- forward change. This migration is NOT auto-applied; it is applied (if ever) by the
-- governed raw-SQL path against IQ Demo ONLY, leaving the migration ledger unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Source-side composite uniqueness (passive supersets of the existing PK) ──
-- Required as the referenced key for the lifetime-enforcing composite FKs. These add
-- NO trigger, change NO data, and alter NO B4.1 lifecycle / identity semantics.
alter table public.player_protection_alerts
  add constraint ppa_id_casino_player_uq unique (id, casino_id, player_id);

alter table public.player_protection_interventions
  add constraint ppi_id_casino_player_uq unique (id, casino_id, player_id);

-- ── 2. Traceability link table ──────────────────────────────────────────────────
create table public.alert_intervention_links (
  id                  uuid primary key default gen_random_uuid(),
  casino_id           uuid not null references public.casinos(id)
                        on update restrict on delete restrict,
  alert_id            uuid not null,
  intervention_id     uuid not null,
  player_id           uuid not null,          -- INTERNAL integrity key only; never surfaced in API/UI/audit
  linked_at           timestamptz not null default now(),
  linked_by           uuid not null references public.users(id)
                        on update restrict on delete restrict,
  supersedes_link_id  uuid references public.alert_intervention_links(id)
                        on update restrict on delete restrict,
  superseded_at       timestamptz,
  superseded_by       uuid references public.users(id)
                        on update restrict on delete restrict,
  created_at          timestamptz not null default now(),

  -- Lifetime same-casino + same-player enforcement (relational, ON UPDATE/DELETE RESTRICT).
  -- Both composite FKs reference the link's SINGLE casino_id + player_id, so the alert and
  -- the intervention are forced to agree on casino AND player — now and for the link's life.
  constraint ail_alert_identity_fk
    foreign key (alert_id, casino_id, player_id)
    references public.player_protection_alerts (id, casino_id, player_id)
    on update restrict on delete restrict,
  constraint ail_intervention_identity_fk
    foreign key (intervention_id, casino_id, player_id)
    references public.player_protection_interventions (id, casino_id, player_id)
    on update restrict on delete restrict,

  constraint ail_no_self_supersession check (supersedes_link_id is null or supersedes_link_id <> id),
  constraint ail_superseded_pairing   check ((superseded_at is null) = (superseded_by is null))
);

-- Active link  ⟺  superseded_at IS NULL.
-- (a) at most ONE active link per (alert, intervention) pair — preserves m:n across pairs,
--     blocks a duplicate active pair, and is the race-free concurrency arbiter.
create unique index ail_active_pair_uq
  on public.alert_intervention_links (alert_id, intervention_id)
  where superseded_at is null;
-- (b) at most ONE successor per historical link — no double-supersession, no branch/tree.
create unique index ail_single_successor_uq
  on public.alert_intervention_links (supersedes_link_id)
  where supersedes_link_id is not null;
-- Reverse lookup (which alerts actively link this intervention) + casino scoping.
create index ail_intervention_active
  on public.alert_intervention_links (intervention_id)
  where superseded_at is null;
create index ail_casino on public.alert_intervention_links (casino_id);

-- ── 3. BEFORE INSERT OR UPDATE guard: timestamp ownership + immutability + correction
--       validation. SECURITY INVOKER (runs as service_role). No SECURITY DEFINER. ──
create function public.sbiq_b6_link_guard()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare v_old public.alert_intervention_links;
begin
  if tg_op = 'INSERT' then
    -- DB owns these; caller input is overwritten / rejected.
    NEW.linked_at  := now();
    NEW.created_at := now();
    if NEW.linked_by is null then
      raise exception 'B6: linked_by is required';
    end if;
    -- An inserted row may NEVER arrive already-superseded (supersession is DB-driven).
    if NEW.superseded_at is not null or NEW.superseded_by is not null then
      raise exception 'B6: superseded_at/superseded_by must be null on insert';
    end if;

    if NEW.supersedes_link_id is not null then
      -- Correction (replacement) row: validate the target old link up-front (and lock it).
      if NEW.supersedes_link_id = NEW.id then
        raise exception 'B6: a link cannot supersede itself';
      end if;
      select * into v_old from public.alert_intervention_links
        where id = NEW.supersedes_link_id for update;
      if not found then
        raise exception 'B6: supersedes_link_id % does not exist', NEW.supersedes_link_id;
      end if;
      if v_old.superseded_at is not null then
        raise exception 'B6: link % is already superseded', NEW.supersedes_link_id;
      end if;
      if v_old.alert_id is distinct from NEW.alert_id then
        raise exception 'B6: supersession must target the same alert';
      end if;
      if v_old.casino_id is distinct from NEW.casino_id
         or v_old.player_id is distinct from NEW.player_id then
        raise exception 'B6: supersession must target the same casino/player';
      end if;
    end if;
    return NEW;
  end if;

  -- UPDATE: identity + provenance + timestamps are immutable.
  if NEW.id                 is distinct from OLD.id
     or NEW.casino_id       is distinct from OLD.casino_id
     or NEW.player_id       is distinct from OLD.player_id
     or NEW.alert_id        is distinct from OLD.alert_id
     or NEW.intervention_id is distinct from OLD.intervention_id
     or NEW.linked_at       is distinct from OLD.linked_at
     or NEW.linked_by       is distinct from OLD.linked_by
     or NEW.created_at      is distinct from OLD.created_at
     or NEW.supersedes_link_id is distinct from OLD.supersedes_link_id then
    raise exception 'B6: immutable link column changed on %', OLD.id;
  end if;

  if OLD.superseded_at is not null then
    -- Already superseded ⇒ fully immutable (no re-supersede, no un-supersede).
    if NEW.superseded_at is distinct from OLD.superseded_at
       or NEW.superseded_by is distinct from OLD.superseded_by then
      raise exception 'B6: a superseded link is immutable';
    end if;
    return NEW;
  end if;

  -- OLD is active. The only legal change is a null→value supersession (both set together),
  -- AND it must be backed by a real successor row (defeats a manual UPDATE with no
  -- replacement). A true no-op (still null) is permitted.
  if NEW.superseded_at is null and NEW.superseded_by is null then
    return NEW;
  elsif NEW.superseded_at is not null and NEW.superseded_by is not null then
    if not exists (
      select 1 from public.alert_intervention_links s
       where s.supersedes_link_id = NEW.id
         and s.linked_by  = NEW.superseded_by
         and s.linked_at  = NEW.superseded_at
         and s.alert_id   = NEW.alert_id
         and s.casino_id  = NEW.casino_id
         and s.player_id  = NEW.player_id
    ) then
      raise exception 'B6: supersession requires a matching successor link';
    end if;
    return NEW;
  else
    raise exception 'B6: superseded_at and superseded_by must be set together';
  end if;
end $$;

revoke all on function public.sbiq_b6_link_guard() from public;

create trigger trg_b6_link_guard
  before insert or update on public.alert_intervention_links
  for each row execute function public.sbiq_b6_link_guard();

-- ── 4. AFTER INSERT: atomic supersession of the prior active link (for corrections)
--       + exactly one audit event into the EXISTING chain. SECURITY INVOKER. ──
create function public.sbiq_b6_link_after_insert()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
declare v_action text; v_role text; v_meta jsonb;
begin
  if NEW.supersedes_link_id is not null then
    update public.alert_intervention_links
       set superseded_at = NEW.linked_at, superseded_by = NEW.linked_by
     where id = NEW.supersedes_link_id and superseded_at is null;
    if not found then
      raise exception 'B6: could not supersede link % (missing or already superseded)', NEW.supersedes_link_id;
    end if;
    v_action := 'protection_alert.intervention_link_superseded';
    v_meta := jsonb_build_object(
      'alert_id', NEW.alert_id, 'intervention_id', NEW.intervention_id,
      'link_id', NEW.id, 'supersedes_link_id', NEW.supersedes_link_id);
  else
    v_action := 'protection_alert.intervention_linked';
    v_meta := jsonb_build_object(
      'alert_id', NEW.alert_id, 'intervention_id', NEW.intervention_id, 'link_id', NEW.id);
  end if;

  select u.role::text into v_role from public.users u where u.id = NEW.linked_by;

  insert into public.audit_events (
    event_id, event_type, event_category, action,
    resource_type, resource_id, user_id, user_role, casino_id,
    severity, outcome, metadata)
  values (
    'ail:' || v_action || ':' || NEW.id::text,
    v_action, 'responsible_gambling', v_action,
    'alert_intervention_link', NEW.id::text, NEW.linked_by, v_role, NEW.casino_id,
    'info', 'success', v_meta);

  return NEW;
end $$;

revoke all on function public.sbiq_b6_link_after_insert() from public;

create trigger trg_b6_link_after_insert
  after insert on public.alert_intervention_links
  for each row execute function public.sbiq_b6_link_after_insert();

-- ── 5. Access: governed service_role ONLY; RLS forced as defence-in-depth. ──
alter table public.alert_intervention_links enable row level security;
alter table public.alert_intervention_links force  row level security;
revoke all privileges on public.alert_intervention_links from public;
revoke all privileges on public.alert_intervention_links from anon;
revoke all privileges on public.alert_intervention_links from authenticated;
-- Defeat the Supabase platform default-ALL grant, then grant EXACTLY the three approved
-- operations (UPDATE is needed only for the trigger-driven supersession of the old row).
revoke all privileges on public.alert_intervention_links from service_role;
grant select, insert, update on public.alert_intervention_links to service_role;
