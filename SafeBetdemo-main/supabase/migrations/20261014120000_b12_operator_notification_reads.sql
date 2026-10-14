-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — B12 Operator Notification & Escalation (read-state only).
--
-- B12 is an OPERATOR-LOCAL, IN_APP, PROJECTION-BASED attention layer. Notification
-- EXISTENCE is derived at read time from authoritative domain state (B4.1 self-exclusion
-- alerts; B8 current follow-up schedule). The ONLY new persisted B12 state is per-user
-- READ state. There is intentionally NO operator_notifications table, no trigger, no
-- outbox, no cron, no worker, no external provider, no audit-chain event.
--
-- Read state is operational UI state, NOT governance evidence (the underlying B4.1/B8/B9/
-- B10/B11 records + audit chain remain authoritative). No PII is stored. Writes occur ONLY
-- through the narrow SECURITY DEFINER RPC; service_role gets SELECT only; no client access.
--
-- Fail-closed DDL. NOT auto-applied; applied (if authorised) by the governed raw-SQL path
-- to IQ Demo only, leaving the migration ledger unchanged. Modifies ZERO existing rows.
-- B4.1/B5/B6/B7/B8/B9/B10/B11/B2 unchanged; no domain-table write grant restored.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Per-user read state (the only persisted B12 object) ──
create table public.operator_notification_reads (
  casino_id       uuid        not null,
  user_id         uuid        not null,
  notification_id text        not null,                 -- deterministic server SHA-256 (hex)
  read_at         timestamptz not null default now(),   -- first-read timestamp (never updated)
  constraint operator_notification_reads_pkey primary key (casino_id, user_id, notification_id),
  constraint onr_user_fk   foreign key (user_id)   references public.users(id)   on update restrict on delete restrict,
  constraint onr_casino_fk foreign key (casino_id) references public.casinos(id) on update restrict on delete restrict,
  constraint onr_notification_id_hex check (notification_id ~ '^[0-9a-f]{64}$')
);

-- ── 2. RLS: enabled + forced, no policies (no client surface) ──
alter table public.operator_notification_reads enable row level security;
alter table public.operator_notification_reads force  row level security;

-- ── 3. Privileges: service_role SELECT only; no client access; writes via the DEFINER RPC.
revoke all    on table public.operator_notification_reads from public;
revoke all    on table public.operator_notification_reads from anon;
revoke all    on table public.operator_notification_reads from authenticated;
revoke all    on table public.operator_notification_reads from service_role;
grant  select on table public.operator_notification_reads to service_role;

-- ── 4. Narrow mark-read function. SECURITY DEFINER (owner postgres; BYPASSRLS; holds the
--       INSERT). Append-only first-read; never UPDATE/DELETE. service_role EXECUTE only.
--       The governed route validates CURRENT projection membership BEFORE calling this. ──
create function public.sbiq_b12_mark_operator_notification_read(
  p_casino_id       uuid,
  p_actor_id        uuid,
  p_notification_id text
) returns table(status text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_role         text;
  v_actor_casino uuid;
  v_id           text;
begin
  if p_notification_id is null or p_notification_id !~ '^[0-9a-f]{64}$' then
    raise exception 'B12: invalid notification id';
  end if;

  -- Actor (defence-in-depth; the server already authorised). Role from authoritative users.
  select u.role::text, u.casino_id into v_role, v_actor_casino from public.users u where u.id = p_actor_id;
  if v_role is null then raise exception 'B12: actor not found'; end if;
  if v_role not in ('casino_admin','compliance_officer','super_admin') then
    raise exception 'B12: actor role % not permitted', v_role;
  end if;
  if v_role in ('casino_admin','compliance_officer') and v_actor_casino is distinct from p_casino_id then
    raise exception 'B12: actor not governed for casino';
  end if;

  insert into public.operator_notification_reads (casino_id, user_id, notification_id)
  values (p_casino_id, p_actor_id, p_notification_id)
  on conflict (casino_id, user_id, notification_id) do nothing
  returning notification_id into v_id;

  if v_id is not null then
    return query select 'READ'::text; return;
  end if;
  return query select 'NOOP'::text; return;   -- already read (first read_at retained)
end $$;

revoke all     on function public.sbiq_b12_mark_operator_notification_read(uuid,uuid,text) from public;
revoke execute on function public.sbiq_b12_mark_operator_notification_read(uuid,uuid,text) from anon;
revoke execute on function public.sbiq_b12_mark_operator_notification_read(uuid,uuid,text) from authenticated;
grant  execute on function public.sbiq_b12_mark_operator_notification_read(uuid,uuid,text) to service_role;
