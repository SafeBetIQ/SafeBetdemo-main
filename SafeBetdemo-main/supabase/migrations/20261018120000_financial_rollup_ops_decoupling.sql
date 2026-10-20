-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ — Financial rollup ops decoupling (B-COUPLE-1 remediation).
--
-- Makes the GENERIC financial-rollup maintenance/ops functions environment-neutral so they no
-- longer depend on the Demo-simulation subsystem. After this change the Demo-sim ops objects
-- (sbiq_demo_sim_flags / sbiq_demo_raise_alert / sbiq_demo_sim_alerts) become removable
-- Demo-only leaves for the Pilot baseline curation (M1A-R2.2).
--
-- Certified financial semantics are UNCHANGED (stakes−winnings; projection_financial_posture;
-- sbiq_certified_financial_posture_v2; sbiq_financial_rollup_hourly; capability/shift policy).
-- Financial cron stays DISABLED. The Demo simulation subsystem is NOT removed from Demo; the
-- Demo simulator may keep its own sbiq_demo_sim_* objects for simulator purposes — the generic
-- financial functions simply stop referencing them. Modifies ZERO existing business data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Generic rollup-ops control state (kill/pause switch). Safe default: disabled. ──
create table if not exists public.sbiq_financial_rollup_ops_state (
  id         integer     primary key default 1 check (id = 1),
  enabled    boolean     not null default false,
  updated_at timestamptz not null default now()
);
-- STATIC PLATFORM CONFIG (not business data): a single control row, fail-safe disabled. This
-- matches the current operational reality (financial cron disabled) and is safe for a fresh
-- Pilot baseline (no Demo identity/values embedded).
insert into public.sbiq_financial_rollup_ops_state (id, enabled) values (1, false)
  on conflict (id) do nothing;

-- ── 2. Generic rollup-ops alerts (PLATFORM OPERATIONS only — never B4.1/B12/RG). ──
create table if not exists public.sbiq_financial_rollup_ops_alerts (
  id              bigint generated always as identity primary key,
  category        text not null,
  severity        text not null,
  scope           text,
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  resolved        boolean not null default false,
  resolved_at     timestamptz,
  resolution_notes text
);
create index if not exists sbiq_fin_rollup_ops_alerts_open_idx
  on public.sbiq_financial_rollup_ops_alerts (category, scope) where not resolved;

-- ── 3. Security: forced RLS, service_role SELECT-only; writes via the DEFINER emitter. ──
alter table public.sbiq_financial_rollup_ops_state  enable row level security;
alter table public.sbiq_financial_rollup_ops_state  force  row level security;
alter table public.sbiq_financial_rollup_ops_alerts enable row level security;
alter table public.sbiq_financial_rollup_ops_alerts force  row level security;
revoke all on table public.sbiq_financial_rollup_ops_state  from public;
revoke all on table public.sbiq_financial_rollup_ops_state  from anon;
revoke all on table public.sbiq_financial_rollup_ops_state  from authenticated;
revoke all on table public.sbiq_financial_rollup_ops_state  from service_role;
revoke all on table public.sbiq_financial_rollup_ops_alerts from public;
revoke all on table public.sbiq_financial_rollup_ops_alerts from anon;
revoke all on table public.sbiq_financial_rollup_ops_alerts from authenticated;
revoke all on table public.sbiq_financial_rollup_ops_alerts from service_role;
grant select on table public.sbiq_financial_rollup_ops_state  to service_role;
grant select on table public.sbiq_financial_rollup_ops_alerts to service_role;

-- ── 4. Generic ops-alert emitter (platform-ops; mirrors the demo emitter minus Demo columns). ──
create or replace function public.sbiq_financial_rollup_raise_alert(
  p_category text, p_severity text, p_scope text default 'financial_rollup', p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from sbiq_financial_rollup_ops_alerts
             where category=p_category and coalesce(scope,'')=coalesce(p_scope,'') and not resolved) then
    update sbiq_financial_rollup_ops_alerts set details=coalesce(p_details,'{}'::jsonb), severity=p_severity, created_at=now()
      where category=p_category and coalesce(scope,'')=coalesce(p_scope,'') and not resolved;
  else
    insert into sbiq_financial_rollup_ops_alerts(category,severity,scope,details)
      values (p_category,p_severity,p_scope,coalesce(p_details,'{}'::jsonb));
  end if;
end; $$;
alter function public.sbiq_financial_rollup_raise_alert(text,text,text,jsonb) owner to postgres;
revoke all     on function public.sbiq_financial_rollup_raise_alert(text,text,text,jsonb) from public;
revoke execute on function public.sbiq_financial_rollup_raise_alert(text,text,text,jsonb) from anon;
revoke execute on function public.sbiq_financial_rollup_raise_alert(text,text,text,jsonb) from authenticated;
grant  execute on function public.sbiq_financial_rollup_raise_alert(text,text,text,jsonb) to service_role;

-- ── 5. Re-point the three generic ops functions (bodies identical except the ops dependency). ──
create or replace function public.sbiq_financial_rollup_refresh(p_max_buckets integer DEFAULT 500) returns jsonb
    language plpgsql security definer set search_path to 'public' set statement_timeout to '120s' as $$
declare
  t0 timestamptz := clock_timestamp(); run_id bigint;
  cp_recv timestamptz; cp_id uuid; new_max_recv timestamptz; new_max_id uuid;
  v_buckets int := 0; v_events int := 0; cur_hour timestamptz := date_trunc('hour', now());
begin
  if not coalesce((select enabled from sbiq_financial_rollup_ops_state where id=1), false) then
    return jsonb_build_object('ok', true, 'skipped', 'disabled');
  end if;
  if not pg_try_advisory_xact_lock(hashtext('sbiq_financial_rollup_refresh')) then
    return jsonb_build_object('ok', false, 'reason', 'locked');
  end if;
  insert into sbiq_financial_rollup_run_log(mode) values ('incremental') returning id into run_id;
  select last_received_at, last_event_id into cp_recv, cp_id from sbiq_financial_rollup_checkpoint where id=1;

  create temporary table _dirty on commit drop as
    select distinct casino_id, date_trunc('hour', occurred_at) bucket_start
    from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
      and (cp_recv is null
           or received_at > cp_recv
           or (received_at = cp_recv and (cp_id is null or event_id > cp_id)))
    limit greatest(1, p_max_buckets);
  insert into _dirty select c.id, cur_hour from casinos c
    on conflict do nothing;

  perform public.sbiq_fin_rollup_upsert_range(min(bucket_start), max(bucket_start)+interval '1 hour') from _dirty
    where exists (select 1 from _dirty);
  select count(*) into v_buckets from _dirty;

  select received_at, event_id into new_max_recv, new_max_id
    from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
    order by received_at desc, event_id desc limit 1;
  select count(*) into v_events from casino_event_log
    where event_type in ('BET_PLACED','JACKPOT') and payload->>'bet_amount' is not null
      and (cp_recv is null or received_at > cp_recv or (received_at = cp_recv and (cp_id is null or event_id > cp_id)));

  update sbiq_financial_rollup_checkpoint set
    last_received_at = coalesce(new_max_recv, last_received_at),
    last_event_id = coalesce(new_max_id, last_event_id),
    last_success_at = now(), last_source_max_received_at = new_max_recv,
    error_category = null, updated_at = now() where id=1;
  update sbiq_financial_rollup_run_log set finished_at=now(),
    duration_ms=extract(ms from clock_timestamp()-t0)::int, buckets_processed=v_buckets,
    events_processed=v_events, outcome='ok' where id=run_id;
  return jsonb_build_object('ok', true, 'buckets', v_buckets, 'events', v_events);
exception when others then
  update sbiq_financial_rollup_checkpoint set last_failed_at=now(), error_category=sqlstate, updated_at=now() where id=1;
  update sbiq_financial_rollup_run_log set finished_at=now(), duration_ms=extract(ms from clock_timestamp()-t0)::int,
    outcome='error', error_category=sqlstate where id=run_id;
  return jsonb_build_object('ok', false, 'reason','error','error_category', sqlstate);
end; $$;
alter function public.sbiq_financial_rollup_refresh(integer) owner to postgres;

create or replace function public.sbiq_financial_rollup_watchdog() returns jsonb
    language plpgsql security definer set search_path to 'public' as $$
declare last_ok timestamptz; last_fail timestamptz; late boolean;
begin
  if not coalesce((select enabled from sbiq_financial_rollup_ops_state where id=1), false) then
    return jsonb_build_object('ok', true, 'skipped','disabled');
  end if;
  select last_success_at, last_failed_at into last_ok, last_fail from sbiq_financial_rollup_checkpoint where id=1;
  late := last_ok is null or last_ok < now() - interval '10 minutes';
  if late then
    perform sbiq_financial_rollup_raise_alert('FINANCIAL_ROLLUP_LATE','warning','financial_rollup',
      jsonb_build_object('last_success', last_ok));
  else
    update sbiq_financial_rollup_ops_alerts set resolved=true, resolved_at=now(), resolution_notes='rollup recovered'
      where category in ('FINANCIAL_ROLLUP_LATE','FINANCIAL_ROLLUP_FAILED') and not resolved;
  end if;
  if last_fail is not null and (last_ok is null or last_fail > last_ok) then
    perform sbiq_financial_rollup_raise_alert('FINANCIAL_ROLLUP_FAILED','critical','financial_rollup',
      jsonb_build_object('last_failed', last_fail));
  end if;
  return jsonb_build_object('ok', true, 'late', late, 'last_success', last_ok);
end; $$;
alter function public.sbiq_financial_rollup_watchdog() owner to postgres;

create or replace function public.sbiq_financial_rollup_status() returns jsonb
    language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'enabled', coalesce((select enabled from sbiq_financial_rollup_ops_state where id=1), false),
    'cron_active', exists(select 1 from cron.job where jobname='sbiq-financial-rollup-refresh' and active),
    'last_success', cp.last_success_at, 'last_failed', cp.last_failed_at,
    'lag_seconds', round(extract(epoch from now()-coalesce(cp.last_success_at, now())))::int,
    'rollup_version', cp.rollup_version,
    'buckets', (select count(*) from sbiq_financial_rollup_hourly),
    'buckets_reconcile', (select bool_and(reconciles) from sbiq_financial_rollup_hourly),
    'last_run_buckets', (select buckets_processed from sbiq_financial_rollup_run_log order by started_at desc limit 1),
    'source_max_occurred_at', (select max(source_max_occurred_at) from sbiq_financial_rollup_hourly),
    'freshness', case when cp.last_success_at is null then 'Unknown'
                      when cp.last_success_at < now()-interval '15 minutes' then 'Stale'
                      when cp.last_success_at < now()-interval '5 minutes' then 'Delayed' else 'Current' end,
    'open_rollup_alerts', (select count(*) from sbiq_financial_rollup_ops_alerts where not resolved and category like 'FINANCIAL_ROLLUP%'))
  from sbiq_financial_rollup_checkpoint cp where cp.id=1;
$$;
alter function public.sbiq_financial_rollup_status() owner to postgres;
