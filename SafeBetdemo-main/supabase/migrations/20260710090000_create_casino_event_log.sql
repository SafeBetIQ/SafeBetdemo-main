/*
  # Enterprise Event Platform — casino_event_log (Phase 3.2)

  The authoritative, append-only event store. Every column maps 1:1 to the
  immutable enterprise envelope (lib/eventPlatform/envelope.ts).

  1. Immutability — a trigger refuses UPDATE and DELETE outright. Events are
     permanent audit evidence; corrections are new events.
  2. Realtime — persisting a row IS publishing it: consumers subscribe to
     postgres_changes on this table. No separate publish system exists.
  3. Replay (reserved) — replay_number + correlation/trace/player indexes
     support regulator-grade journey reconstruction in a future phase.
  4. Security — RLS enabled with NO client policies: the platform writes via
     service role; dashboards will read via projections (Phase 3.4+).
*/

create table if not exists casino_event_log (
  event_id uuid primary key,
  correlation_id text not null,
  trace_id uuid not null,
  tenant_id uuid not null,
  casino_id uuid not null references casinos(id) on delete restrict,
  jurisdiction text not null,
  safebet_player_id text not null
    check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}$'),
  session_id text,
  machine_id text,
  producer text not null,
  schema_version integer not null,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  processed_at timestamptz not null,
  replay_number integer not null default 0 check (replay_number >= 0),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_casino_event_log_casino_time
  on casino_event_log (casino_id, occurred_at desc);
create index if not exists idx_casino_event_log_player
  on casino_event_log (safebet_player_id, occurred_at desc);
create index if not exists idx_casino_event_log_correlation
  on casino_event_log (correlation_id);
create index if not exists idx_casino_event_log_trace
  on casino_event_log (trace_id);
create index if not exists idx_casino_event_log_type
  on casino_event_log (event_type);

-- ── Append-only enforcement ──────────────────────────────────────────────────

create or replace function casino_event_log_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'casino_event_log is append-only: events are immutable audit evidence (attempted %)', TG_OP;
end;
$$;

drop trigger if exists trg_casino_event_log_immutable on casino_event_log;
create trigger trg_casino_event_log_immutable
  before update or delete on casino_event_log
  for each row execute function casino_event_log_immutable();

-- ── Security ─────────────────────────────────────────────────────────────────

alter table casino_event_log enable row level security;
-- Intentionally no client policies: platform (service role) writes;
-- consumers read via projections from Phase 3.4 onward.
