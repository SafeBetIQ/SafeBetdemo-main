/*
  # Phase 4.3 — Ingestion idempotency + projection concurrency + health
  Closes certification condition H3. No architectural change: the enterprise
  flow, reducers (TS), and read-model catalogue are unchanged.

  1. Idempotency (WS1): casino_event_log gains dedupe_key + UNIQUE(casino_id,
     dedupe_key). The Event Platform upserts with ignore-duplicates, so a
     retried event (same producer idempotency key) is neither re-appended nor
     re-projected — at-least-once delivery becomes exactly-once processing.
  2. Optimistic concurrency (WS2): the three projection tables gain
     row_version. sbiq_write_projection_states() commits a batch only if every
     row's stored row_version still equals the loaded version (checked under a
     per-casino advisory lock), eliminating lost updates. Reduction stays in
     TS (one source of truth); the RPC only writes.
  3. Observability (WS5): sbiq_platform_health() exposes ingestion/projection
     freshness with no PII.
*/

-- ── 1. Idempotency key on the event store ────────────────────────────────────
-- Synthetic data: dispose rather than backfill (the append-only trigger
-- forbids UPDATE by design). Projections rebuild from the reseeded log.

truncate table projection_player_state;
truncate table projection_session_state;
truncate table projection_machine_state;
truncate table casino_event_log;

alter table casino_event_log add column if not exists dedupe_key text not null;

drop index if exists uq_casino_event_log_dedupe;
create unique index uq_casino_event_log_dedupe
  on casino_event_log (casino_id, dedupe_key);

-- ── 2. Optimistic-concurrency counter on the projection tables ───────────────

alter table projection_player_state  add column if not exists row_version bigint not null default 0;
alter table projection_session_state add column if not exists row_version bigint not null default 0;
alter table projection_machine_state add column if not exists row_version bigint not null default 0;

create or replace function sbiq_write_projection_states(
  p_casino  uuid,
  p_players  jsonb default '[]'::jsonb,
  p_sessions jsonb default '[]'::jsonb,
  p_machines jsonb default '[]'::jsonb
)
returns table (ok boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  elem   jsonb;
  prec   projection_player_state%rowtype;
  srec   projection_session_state%rowtype;
  mrec   projection_machine_state%rowtype;
  cur    bigint;
begin
  -- Serialize writers for this casino so the version check + write is atomic
  -- relative to other batches (different casinos still run in parallel).
  perform pg_advisory_xact_lock(hashtext(p_casino::text));

  -- ── Verify every loaded version still current (else caller retries) ───────
  for elem in select * from jsonb_array_elements(p_players) loop
    prec := jsonb_populate_record(null::projection_player_state, elem);
    select row_version into cur from projection_player_state
      where casino_id = prec.casino_id and safebet_player_id = prec.safebet_player_id;
    if found then
      if cur <> prec.row_version then ok := false; return next; return; end if;
    elsif prec.row_version <> 0 then ok := false; return next; return;
    end if;
  end loop;

  for elem in select * from jsonb_array_elements(p_sessions) loop
    srec := jsonb_populate_record(null::projection_session_state, elem);
    select row_version into cur from projection_session_state where session_id = srec.session_id;
    if found then
      if cur <> srec.row_version then ok := false; return next; return; end if;
    elsif srec.row_version <> 0 then ok := false; return next; return;
    end if;
  end loop;

  for elem in select * from jsonb_array_elements(p_machines) loop
    mrec := jsonb_populate_record(null::projection_machine_state, elem);
    select row_version into cur from projection_machine_state
      where casino_id = mrec.casino_id and machine_id = mrec.machine_id;
    if found then
      if cur <> mrec.row_version then ok := false; return next; return; end if;
    elsif mrec.row_version <> 0 then ok := false; return next; return;
    end if;
  end loop;

  -- ── All versions current → write all, incrementing row_version ────────────
  for elem in select * from jsonb_array_elements(p_players) loop
    prec := jsonb_populate_record(null::projection_player_state, elem);
    prec.row_version := prec.row_version + 1;
    insert into projection_player_state values (prec.*)
      on conflict (casino_id, safebet_player_id) do update set
        status = excluded.status, current_session_id = excluded.current_session_id,
        current_machine_id = excluded.current_machine_id, risk_score = excluded.risk_score,
        risk_flags = excluded.risk_flags, total_wagered = excluded.total_wagered,
        total_won = excluded.total_won, bet_count = excluded.bet_count,
        session_count = excluded.session_count, intervention_count = excluded.intervention_count,
        last_intervention_at = excluded.last_intervention_at, last_event_id = excluded.last_event_id,
        last_event_at = excluded.last_event_at, projection_version = excluded.projection_version,
        row_version = excluded.row_version, updated_at = excluded.updated_at;
  end loop;

  for elem in select * from jsonb_array_elements(p_sessions) loop
    srec := jsonb_populate_record(null::projection_session_state, elem);
    srec.row_version := srec.row_version + 1;
    insert into projection_session_state values (srec.*)
      on conflict (session_id) do update set
        casino_id = excluded.casino_id, safebet_player_id = excluded.safebet_player_id,
        machine_id = excluded.machine_id, status = excluded.status, game_type = excluded.game_type,
        started_at = excluded.started_at, ended_at = excluded.ended_at,
        total_wagered = excluded.total_wagered, total_won = excluded.total_won,
        bet_count = excluded.bet_count, risk_score = excluded.risk_score,
        last_event_id = excluded.last_event_id, last_event_at = excluded.last_event_at,
        projection_version = excluded.projection_version, row_version = excluded.row_version,
        updated_at = excluded.updated_at;
  end loop;

  for elem in select * from jsonb_array_elements(p_machines) loop
    mrec := jsonb_populate_record(null::projection_machine_state, elem);
    mrec.row_version := mrec.row_version + 1;
    insert into projection_machine_state values (mrec.*)
      on conflict (casino_id, machine_id) do update set
        machine_type = excluded.machine_type, floor_location = excluded.floor_location,
        status = excluded.status, current_player_id = excluded.current_player_id,
        current_session_id = excluded.current_session_id, current_risk_score = excluded.current_risk_score,
        session_wagered = excluded.session_wagered, last_event_id = excluded.last_event_id,
        last_event_at = excluded.last_event_at, projection_version = excluded.projection_version,
        row_version = excluded.row_version, updated_at = excluded.updated_at;
  end loop;

  ok := true; return next;
end;
$$;

revoke all on function sbiq_write_projection_states(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function sbiq_write_projection_states(uuid, jsonb, jsonb, jsonb) to service_role;

-- ── 3. Observability: platform health (no PII — ids and counts only) ─────────

create or replace function sbiq_platform_health(p_casino uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'casino_id', p_casino,
    'events_in_log', (select count(*) from casino_event_log where casino_id = p_casino),
    'distinct_players', (select count(distinct safebet_player_id) from casino_event_log where casino_id = p_casino),
    'players_projected', (select count(*) from projection_player_state where casino_id = p_casino),
    'sessions_projected', (select count(*) from projection_session_state where casino_id = p_casino),
    'machines_projected', (select count(*) from projection_machine_state where casino_id = p_casino),
    'last_event_at', (select max(occurred_at) from casino_event_log where casino_id = p_casino),
    'projection_lag_seconds', extract(epoch from (
      now() - coalesce((select max(last_event_at) from projection_player_state where casino_id = p_casino), now()))),
    'max_row_version', (select coalesce(max(row_version),0) from projection_player_state where casino_id = p_casino)
  );
$$;

revoke all on function sbiq_platform_health(uuid) from public, anon;
grant execute on function sbiq_platform_health(uuid) to authenticated, service_role;
