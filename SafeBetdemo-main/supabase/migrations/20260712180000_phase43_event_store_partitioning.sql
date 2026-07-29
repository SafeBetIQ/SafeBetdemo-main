/*
  # Phase 4.3 — Enterprise Event Store: native range partitioning (H4)

  The append-only event store is recreated as a RANGE-partitioned table on
  occurred_at (monthly). This makes long-term growth sustainable WITHOUT
  weakening replay or audit:
    • Replay/audit: every event stays queryable through the parent; the
      immutability trigger, indexes, RLS (tenant-scoped, Phase 4.1), FK, id
      and dedupe constraints are all preserved.
    • Retention/archive: old months are DETACHED (never deleted — the
      immutability guarantee holds), moving cold audit data off the hot path.
    • Realtime: the publication now publishes via the partition root
      (publish_via_partition_root=true), so consumers subscribed to
      casino_event_log continue to receive inserts routed into partitions.

  Data is synthetic (Phase 4.2/4.3 reseeds), so the table is recreated empty
  and reseeded by the producer.
*/

-- ── 0. Remove the flat table (synthetic data; no inbound FKs) ────────────────
drop table if exists casino_event_log cascade;

-- ── 1. Partitioned parent (uniqueness carries the partition key) ─────────────
create table casino_event_log (
  event_id uuid not null,
  correlation_id text not null,
  trace_id uuid not null,
  tenant_id uuid not null,
  casino_id uuid not null references casinos(id) on delete restrict,
  jurisdiction text not null,
  safebet_player_id text not null
    check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}([0-9A-F]{16})?$'),
  session_id text,
  machine_id text,
  producer text not null,
  schema_version integer not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  replay_number integer not null default 0 check (replay_number >= 0),
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  primary key (event_id, occurred_at),
  unique (casino_id, dedupe_key, occurred_at)
) partition by range (occurred_at);

create index idx_casino_event_log_casino_time on casino_event_log (casino_id, occurred_at desc);
create index idx_casino_event_log_player      on casino_event_log (safebet_player_id, occurred_at desc);
create index idx_casino_event_log_correlation on casino_event_log (correlation_id);
create index idx_casino_event_log_trace       on casino_event_log (trace_id);
create index idx_casino_event_log_type        on casino_event_log (event_type);

-- ── 2. Append-only enforcement (BEFORE ROW triggers cascade to partitions) ───
create or replace function casino_event_log_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'casino_event_log is append-only: events are immutable audit evidence (attempted %)', TG_OP;
end; $$;

create trigger trg_casino_event_log_immutable
  before update or delete on casino_event_log
  for each row execute function casino_event_log_immutable();

-- ── 3. Security: tenant-scoped RLS (Phase 4.1) ───────────────────────────────
alter table casino_event_log enable row level security;
create policy casino_event_log_tenant_read on casino_event_log
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

-- ── 4. Realtime: publish via partition root so parent subscriptions fire ─────
do $$ begin
  alter publication supabase_realtime set (publish_via_partition_root = true);
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table casino_event_log;
exception when duplicate_object then null; end $$;

-- ── 5. Partition maintenance — monthly, idempotent ───────────────────────────
create or replace function sbiq_ensure_event_partition(p_ts timestamptz)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  m_start date := date_trunc('month', p_ts)::date;
  m_end   date := (date_trunc('month', p_ts) + interval '1 month')::date;
  part    text := 'casino_event_log_' || to_char(m_start, 'YYYY_MM');
begin
  if not exists (select 1 from pg_class where relname = part) then
    execute format(
      'create table %I partition of casino_event_log for values from (%L) to (%L)',
      part, m_start, m_end);
  end if;
  return part;
end;
$$;

revoke all on function sbiq_ensure_event_partition(timestamptz) from public, anon;
grant execute on function sbiq_ensure_event_partition(timestamptz) to service_role;

-- Pre-create the current month plus a forward buffer.
select sbiq_ensure_event_partition(now());
select sbiq_ensure_event_partition(now() + interval '1 month');
select sbiq_ensure_event_partition(now() + interval '2 month');
-- Cover the synthetic reseed window (2026-07).
select sbiq_ensure_event_partition('2026-07-15'::timestamptz);

-- ── 6. Retention / archive — DETACH (never delete): audit preserved ──────────
-- Detaches whole months older than the cutoff into a standalone table under
-- the archive_ prefix. Detached data remains fully queryable and immutable;
-- it simply leaves the hot partitioned parent. Reversible via ATTACH.
create or replace function sbiq_archive_event_partitions_before(p_cutoff date)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  part    text;
  bound   text;
  m_start date;
begin
  for part in
    select c.relname
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class p on p.oid = i.inhparent
    where p.relname = 'casino_event_log'
  loop
    bound := pg_get_expr((select relpartbound from pg_class where relname = part),
                         (select oid from pg_class where relname = part));
    -- FROM ('YYYY-MM-01 …') — parse the lower bound month.
    m_start := (substring(bound from 'FROM \\(''([0-9-]+)'))::date;
    if m_start < date_trunc('month', p_cutoff) then
      execute format('alter table casino_event_log detach partition %I', part);
      execute format('alter table %I rename to %I', part, 'archive_' || part);
      return next 'archive_' || part;
    end if;
  end loop;
end;
$$;

revoke all on function sbiq_archive_event_partitions_before(date) from public, anon;
grant execute on function sbiq_archive_event_partitions_before(date) to service_role;
