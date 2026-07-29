/*
  # Session Lifecycle Integrity — certified active-session posture

  ROOT CAUSE (4,572 active sessions vs 151 active players):
  The certified event stream contains only session-OPEN events
  (SESSION_START / CARD_INSERT / MACHINE_ALLOCATED) and NO close events
  (SESSION_END / CARD_REMOVED). The projection opens one row per start and
  nothing ever closes it, so projection_session_state accumulated 4,927
  'active' rows / 0 'ended' — ~12 stale sessions per player (one player had
  46 active sessions on a single machine across 11 days). All were sequential
  re-starts of the same player at the same machine.

  CERTIFIED LIFECYCLE (evidence-derived, no invented statuses):
    Created → Active → Idle → Stale → Closed(ended)
  Concurrency policy: a player occupies ONE machine at a time ⇒ at most one
  open session per (casino, player). A newer SESSION_START SUPERSEDES older
  open sessions for the same player (authoritative evidence that the prior
  ended). Because no close event exists, freshness is derived from the last
  certified activity (last_event_at) against a CONFIGURABLE timeout policy.

  This migration:
    1. Adds an explicit close reason to the session projection.
    2. Adds a configurable session_lifecycle_policy (platform/casino scope).
    3. Makes the session projection SELF-CORRECTING via a supersession trigger
       (runs regardless of write path, so the live simulator stays bounded).
    4. Deterministically REPAIRS the existing backlog from authoritative
       evidence (older sessions per player → ended/superseded; ended_at = the
       next session's start). No source events are deleted.
    5. Publishes a certified session-posture read model (active/idle/stale)
       and reclassifies projection_casino_state.active_sessions to FRESH
       active sessions, adding idle_sessions / stale_sessions / open_sessions.

  The player-risk reconciliation (active_players = five risk bands) is
  untouched. Consumer Platform remains the source of truth; no parallel
  session engine is introduced.
*/

-- ── 1. Explicit close reason ─────────────────────────────────────────────────
alter table projection_session_state add column if not exists ended_reason text;

-- ── 2. Configurable lifecycle policy (not hard-coded in the dashboard) ───────
create table if not exists session_lifecycle_policy (
  scope               text    not null check (scope in ('platform','casino')),
  casino_id           uuid    references casinos(id) on delete cascade,
  idle_after_minutes  integer not null default 30  check (idle_after_minutes  > 0),
  stale_after_minutes integer not null default 240 check (stale_after_minutes > 0),
  concurrency_limit   integer not null default 1   check (concurrency_limit  >= 1),
  updated_at          timestamptz not null default now(),
  unique (scope, casino_id)
);
-- Platform default: active if seen within 30 min, idle up to 4h, stale beyond.
insert into session_lifecycle_policy (scope, casino_id, idle_after_minutes, stale_after_minutes, concurrency_limit)
values ('platform', null, 30, 240, 1)
on conflict (scope, casino_id) do nothing;

alter table session_lifecycle_policy enable row level security;
drop policy if exists slp_read on session_lifecycle_policy;
create policy slp_read on session_lifecycle_policy for select to authenticated using (true);

-- Resolve the effective policy for a casino (casino override, else platform).
create or replace function sbiq_session_policy(p_casino uuid)
returns table(idle_after_minutes int, stale_after_minutes int, concurrency_limit int)
language sql stable security invoker set search_path to 'public' as $$
  select idle_after_minutes, stale_after_minutes, concurrency_limit
  from (
    select 1 as pref, idle_after_minutes, stale_after_minutes, concurrency_limit
      from session_lifecycle_policy where scope='casino' and casino_id = p_casino
    union all
    select 2 as pref, idle_after_minutes, stale_after_minutes, concurrency_limit
      from session_lifecycle_policy where scope='platform' and casino_id is null
  ) t order by pref limit 1;
$$;

-- ── 3. Self-correcting supersession trigger (bounds the live simulator) ──────
create or replace function sbiq_supersede_prior_sessions()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  -- A newly-active session supersedes the player's older open sessions.
  update projection_session_state prior
     set status = 'ended',
         ended_at = coalesce(NEW.started_at, now()),
         ended_reason = 'superseded',
         updated_at = now()
   where prior.casino_id = NEW.casino_id
     and prior.safebet_player_id = NEW.safebet_player_id
     and prior.session_id <> NEW.session_id
     and prior.status = 'active'
     and coalesce(prior.started_at, 'epoch'::timestamptz) <= coalesce(NEW.started_at, now());
  return NEW;
end $$;

drop trigger if exists trg_supersede_prior_sessions on projection_session_state;
create trigger trg_supersede_prior_sessions
  after insert or update of status, started_at on projection_session_state
  for each row when (NEW.status = 'active')
  execute function sbiq_supersede_prior_sessions();

-- ── 4. Deterministic repair of the existing backlog (evidence-based) ─────────
-- Keep the newest open session per (casino, player); mark all older open
-- sessions ended/superseded, with ended_at = the NEXT session's start.
with ranked as (
  select session_id,
         row_number() over w  as rn_asc,
         count(*)     over p  as total,
         lead(started_at) over w as next_start,
         last_event_at, started_at
  from projection_session_state
  where status = 'active'
  window p as (partition by casino_id, safebet_player_id),
         w as (partition by casino_id, safebet_player_id order by started_at asc nulls first, session_id asc)
)
update projection_session_state s
   set status = 'ended',
       ended_at = coalesce(r.next_start, s.last_event_at, s.started_at),
       ended_reason = 'superseded',
       updated_at = now()
  from ranked r
 where s.session_id = r.session_id
   and r.rn_asc < r.total;   -- everything except the newest is superseded

-- ── 5. Certified session-posture read model ─────────────────────────────────
-- Per-session posture (also the drill-down evidence source). Open sessions are
-- classified by freshness against the configurable policy; ended sessions are
-- 'closed'. security_invoker so tenant RLS applies.
create or replace view projection_session_posture as
select
  s.session_id, s.casino_id, s.safebet_player_id, s.machine_id,
  s.status, s.started_at, s.last_event_at, s.ended_at, s.ended_reason,
  round((extract(epoch from (now() - coalesce(s.last_event_at, s.started_at))) / 60.0)::numeric, 1) as idle_minutes,
  case
    when s.status = 'ended' then 'closed'
    when coalesce(s.last_event_at, s.started_at) >= now() - make_interval(mins => pol.idle_after_minutes)  then 'active'
    when coalesce(s.last_event_at, s.started_at) >= now() - make_interval(mins => pol.stale_after_minutes) then 'idle'
    else 'stale'
  end as posture
from projection_session_state s
cross join lateral (select * from sbiq_session_policy(s.casino_id)) pol;
alter view projection_session_posture set (security_invoker = true);

-- Reclassify casino aggregates: active_sessions = FRESH active sessions; add
-- idle / stale / open session posture. Risk bands are untouched.
create or replace view projection_casino_state as
select
  p.casino_id,
  count(*) filter (where p.status = 'active')                as active_players,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'active') as active_sessions,
  (select count(*) from projection_machine_state m
     where m.casino_id = p.casino_id and m.status = 'active') as active_machines,
  coalesce(sum(p.total_wagered), 0)                          as total_wagered,
  coalesce(sum(p.total_won), 0)                              as total_won,
  coalesce(sum(p.total_wagered - p.total_won), 0)            as ggr,
  count(*) filter (where p.status = 'active' and p.risk_score >= 80)                        as risk_critical,
  count(*) filter (where p.status = 'active' and p.risk_score >= 60 and p.risk_score < 80)  as risk_high,
  count(*) filter (where p.status = 'active' and p.risk_score >= 40 and p.risk_score < 60)  as risk_medium,
  count(*) filter (
    where p.status = 'active' and p.risk_score < 40
      and not (p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb)
  )                                                          as risk_low,
  max(p.last_event_at)                                       as last_event_at,
  count(*) filter (
    where p.status = 'active'
      and p.risk_score = 0 and p.bet_count = 0 and p.risk_flags = '[]'::jsonb
  )                                                          as risk_unclassified,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'idle')  as idle_sessions,
  (select count(*) from projection_session_posture sp
     where sp.casino_id = p.casino_id and sp.posture = 'stale') as stale_sessions,
  (select count(*) from projection_session_state s
     where s.casino_id = p.casino_id and s.status = 'active')   as open_sessions
from projection_player_state p
group by p.casino_id;

alter view projection_casino_state set (security_invoker = true);
