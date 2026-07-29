/*
  # Enterprise Projection Platform — read models (Phase 3.3)

  The enterprise read side. Three maintained projection tables (player,
  session, machine state) are the ONLY runtime state stores; the remaining
  read-model catalogue (casino, risk, behaviour, intervention, compliance,
  executive, regulator) is defined as SQL VIEWS over them — consistent by
  construction, no duplicate state.

  Projections are DISPOSABLE: deleting them loses nothing; the Projection
  Platform rebuilds them completely from the immutable casino_event_log.

  Security: projections contain zero PII (anonymous SB-PLR ids only).
  Authenticated clients may read (dashboards consume from Phase 3.7);
  only the platform (service role) writes.
*/

-- ── Player state ─────────────────────────────────────────────────────────────

create table if not exists projection_player_state (
  casino_id uuid not null references casinos(id) on delete cascade,
  safebet_player_id text not null
    check (safebet_player_id ~ '^SB-PLR-[0-9A-F]{8}$'),
  status text not null default 'idle' check (status in ('active', 'idle')),
  current_session_id text,
  current_machine_id text,
  risk_score numeric not null default 0,
  risk_flags jsonb not null default '[]'::jsonb,
  total_wagered numeric not null default 0,
  total_won numeric not null default 0,
  bet_count integer not null default 0,
  session_count integer not null default 0,
  intervention_count integer not null default 0,
  last_intervention_at timestamptz,
  last_event_id uuid,
  last_event_at timestamptz,
  projection_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (casino_id, safebet_player_id)
);

-- ── Session state ────────────────────────────────────────────────────────────

create table if not exists projection_session_state (
  session_id text primary key,
  casino_id uuid not null references casinos(id) on delete cascade,
  safebet_player_id text not null,
  machine_id text,
  status text not null default 'active' check (status in ('active', 'ended')),
  game_type text,
  started_at timestamptz,
  ended_at timestamptz,
  total_wagered numeric not null default 0,
  total_won numeric not null default 0,
  bet_count integer not null default 0,
  risk_score numeric not null default 0,
  last_event_id uuid,
  last_event_at timestamptz,
  projection_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists idx_projection_session_casino
  on projection_session_state (casino_id, status);

-- ── Machine state ────────────────────────────────────────────────────────────

create table if not exists projection_machine_state (
  casino_id uuid not null references casinos(id) on delete cascade,
  machine_id text not null,
  machine_type text,
  status text not null default 'idle' check (status in ('active', 'idle')),
  current_player_id text,
  current_session_id text,
  current_risk_score numeric not null default 0,
  session_wagered numeric not null default 0,
  last_event_id uuid,
  last_event_at timestamptz,
  projection_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (casino_id, machine_id)
);

-- ── Read-model catalogue views (no duplicate state) ─────────────────────────

create or replace view projection_casino_state as
select
  p.casino_id,
  count(*) filter (where p.status = 'active')                as active_players,
  (select count(*) from projection_session_state s
    where s.casino_id = p.casino_id and s.status = 'active') as active_sessions,
  (select count(*) from projection_machine_state m
    where m.casino_id = p.casino_id and m.status = 'active') as active_machines,
  coalesce(sum(p.total_wagered), 0)                          as total_wagered,
  coalesce(sum(p.total_won), 0)                              as total_won,
  coalesce(sum(p.total_wagered - p.total_won), 0)            as ggr,
  count(*) filter (where p.risk_score >= 80)                 as risk_critical,
  count(*) filter (where p.risk_score >= 60 and p.risk_score < 80) as risk_high,
  count(*) filter (where p.risk_score >= 40 and p.risk_score < 60) as risk_medium,
  count(*) filter (where p.risk_score < 40)                  as risk_low,
  max(p.last_event_at)                                       as last_event_at
from projection_player_state p
group by p.casino_id;

create or replace view projection_risk_state as
select casino_id, safebet_player_id, risk_score, risk_flags,
       current_session_id, current_machine_id, last_event_at
from projection_player_state;

create or replace view projection_behaviour_state as
select casino_id, safebet_player_id, total_wagered, total_won,
       bet_count, session_count, status, last_event_at
from projection_player_state;

create or replace view projection_intervention_state as
select casino_id, safebet_player_id, intervention_count,
       last_intervention_at, risk_score, last_event_at
from projection_player_state
where intervention_count > 0;

create or replace view projection_compliance_state as
select casino_id, safebet_player_id, risk_score, risk_flags,
       intervention_count, last_intervention_at, last_event_at
from projection_player_state
where risk_score >= 60 or intervention_count > 0;

create or replace view projection_executive_state as
select * from projection_casino_state;

create or replace view projection_regulator_state as
select casino_id, active_players, active_sessions, active_machines,
       risk_critical, risk_high, risk_medium, risk_low, last_event_at
from projection_casino_state;

-- ── Security ─────────────────────────────────────────────────────────────────
-- Projections carry no PII (anonymous SB-PLR ids only). Authenticated
-- dashboards read; only the Projection Platform (service role) writes.

alter table projection_player_state enable row level security;
alter table projection_session_state enable row level security;
alter table projection_machine_state enable row level security;

drop policy if exists projection_player_state_read on projection_player_state;
create policy projection_player_state_read on projection_player_state
  for select to authenticated using (true);
drop policy if exists projection_session_state_read on projection_session_state;
create policy projection_session_state_read on projection_session_state
  for select to authenticated using (true);
drop policy if exists projection_machine_state_read on projection_machine_state;
create policy projection_machine_state_read on projection_machine_state
  for select to authenticated using (true);
