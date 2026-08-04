-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO uexdjngogzunjxkpxwll) — live-simulator OPERATIONS & GOVERNANCE.
-- Adds cost/volume controls, showcase cooldowns, expired-window maintenance,
-- partition readiness, storage + usage monitoring, failure/late alerts, run log
-- and health classification AROUND the existing certified simulator. It does NOT
-- change the player metric, freshness thresholds, or generate population-scale
-- seed data. All limits are enforced server-side inside trusted functions.
-- Demo-only. Append-only history is never deleted or re-hashed here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Governance limits (in-DB config, not browser-controlled). ────────────────
create table if not exists public.sbiq_demo_sim_limits (
  key text primary key, value numeric not null, note text, updated_at timestamptz not null default now()
);
insert into public.sbiq_demo_sim_limits(key,value,note) values
  ('MAX_SIM_EVENTS_PER_TICK',            1000, 'all casinos combined per tick'),
  ('MAX_SIM_EVENTS_PER_CASINO_PER_TICK',  250, 'single casino per tick'),
  ('MAX_SIM_EVENTS_PER_HOUR',           15000, 'rolling 60 min soft ceiling'),
  ('SIM_EVENTS_PER_DAY_WARNING',        75000, 'enter reduced (baseline-only) mode'),
  ('SIM_EVENTS_PER_DAY_HARDSTOP',      120000, 'skip further generation this day'),
  ('MAX_SHOWCASE_ACTIVATIONS_PER_HOUR',     3, 'per casino, rolling hour'),
  ('MAX_REGULATOR_ACTIVATIONS_PER_HOUR',    2, 'jurisdiction-wide, rolling hour'),
  ('MAX_ACTIVE_SHOWCASE_WINDOWS',           8, 'six casinos + jurisdiction + slack'),
  ('CASINO_SHOWCASE_MINUTES',              30, 'initial casino window'),
  ('CASINO_SHOWCASE_COOLDOWN_MINUTES',     10, 'no extend if activated within'),
  ('CASINO_SHOWCASE_MAX_MINUTES',          45, 'cap from original activation'),
  ('REGULATOR_SHOWCASE_MINUTES',           45, 'initial jurisdiction window'),
  ('REGULATOR_SHOWCASE_COOLDOWN_MINUTES',  15, 'no extend if activated within'),
  ('REGULATOR_SHOWCASE_MAX_MINUTES',       60, 'cap from original activation'),
  ('LATE_TICK_MINUTES',                     8, 'alert if no successful tick within'),
  ('PROJECTION_LAG_WARN_SECONDS',         180, 'sim event newer than projection by'),
  ('STORAGE_INTERNAL_ALLOC_MB',          8192, 'configured Demo internal allocation (NOT a billing limit)'),
  ('STORAGE_WARN_PCT',                     70, '% of internal allocation'),
  ('STORAGE_CRITICAL_PCT',                 85, '% of internal allocation'),
  ('DAILY_GROWTH_WARN_MB',                150, 'MB/day growth warning')
on conflict (key) do nothing;

create or replace function public.sbiq_demo_limit(p_key text) returns numeric
language sql stable set search_path to 'public' as
$$ select value from public.sbiq_demo_sim_limits where key=p_key $$;

-- ── Alert table (governance/operational; no secrets). ────────────────────────
create table if not exists public.sbiq_demo_sim_alerts (
  id bigint generated always as identity primary key,
  category text not null,             -- SIMULATOR_* (see runbook)
  severity text not null default 'warning',  -- info|warning|critical
  scope text, casino_id uuid, jurisdiction text,
  correlation_id uuid,
  details jsonb not null default '{}'::jsonb,  -- safe details only
  created_at timestamptz not null default now(),
  acknowledged boolean not null default false, acknowledged_at timestamptz,
  resolved boolean not null default false, resolved_at timestamptz, resolution_notes text
);
create index if not exists sbiq_sim_alerts_open_idx on public.sbiq_demo_sim_alerts(resolved, created_at desc);
revoke all on public.sbiq_demo_sim_alerts from anon, authenticated;
grant select on public.sbiq_demo_sim_alerts to service_role;

-- De-duplicating raise: one open alert per (category,scope) unless resolved.
create or replace function public.sbiq_demo_raise_alert(
  p_category text, p_severity text, p_scope text, p_casino uuid, p_details jsonb, p_correlation uuid default null
) returns void language plpgsql security definer set search_path to 'public' as $fn$
begin
  if exists (select 1 from sbiq_demo_sim_alerts
             where category=p_category and coalesce(scope,'')=coalesce(p_scope,'') and not resolved) then
    update sbiq_demo_sim_alerts set details=p_details, created_at=now()
      where category=p_category and coalesce(scope,'')=coalesce(p_scope,'') and not resolved;
  else
    insert into sbiq_demo_sim_alerts(category,severity,scope,casino_id,jurisdiction,correlation_id,details)
    values (p_category,p_severity,p_scope,p_casino,'ZA',p_correlation,coalesce(p_details,'{}'::jsonb));
  end if;
end; $fn$;

-- ── Simulator run log (duration, events, mode, failures). ────────────────────
create table if not exists public.sbiq_demo_sim_run_log (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(), finished_at timestamptz,
  duration_ms int, events_generated int not null default 0,
  mode text,                          -- normal|reduced|hardstop|disabled|locked|error
  per_casino jsonb, outcome text, error_category text
);
create index if not exists sbiq_sim_run_log_time_idx on public.sbiq_demo_sim_run_log(started_at desc);
revoke all on public.sbiq_demo_sim_run_log from anon, authenticated;

-- ── Showcase activation audit log (accepted + rejected). ─────────────────────
create table if not exists public.sbiq_demo_showcase_activations (
  id bigint generated always as identity primary key,
  scope text not null, casino_id uuid, profile text, account_id uuid, correlation_id uuid,
  decision text not null,             -- accepted|extended|cooldown|rate_limited|max_windows|disabled|idempotent
  requested_minutes int, effective_expiry timestamptz, created_at timestamptz not null default now()
);
create index if not exists sbiq_showcase_act_scope_idx on public.sbiq_demo_showcase_activations(scope, created_at desc);
revoke all on public.sbiq_demo_showcase_activations from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 4 — showcase activation WITH cooldown / rate-limit / cap / idempotency.
-- Login always succeeds regardless of the decision here; internal limits are not
-- revealed to the evaluator (route surfaces only a generic message).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sbiq_demo_activate_showcase(
  p_scope text, p_casino uuid, p_profile text default 'showcase',
  p_minutes int default 30, p_account uuid default null, p_correlation uuid default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare
  is_reg boolean := (p_casino is null);
  cool_min int; max_min int; init_min int; per_hour int; act_count int; win_count int;
  v_id bigint; v_activated timestamptz; v_exp timestamptz; v_cap timestamptz;
begin
  if (select value from sbiq_demo_sim_flags where key='ENABLE_DEMO_SHOWCASE_MODE') is distinct from 'true' then
    insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes)
      values (p_scope,p_casino,p_profile,p_account,p_correlation,'disabled',p_minutes);
    return jsonb_build_object('ok', false, 'reason', 'showcase_disabled');
  end if;

  if is_reg then
    init_min := coalesce(p_minutes, sbiq_demo_limit('REGULATOR_SHOWCASE_MINUTES'))::int;
    cool_min := sbiq_demo_limit('REGULATOR_SHOWCASE_COOLDOWN_MINUTES')::int;
    max_min  := sbiq_demo_limit('REGULATOR_SHOWCASE_MAX_MINUTES')::int;
    per_hour := sbiq_demo_limit('MAX_REGULATOR_ACTIVATIONS_PER_HOUR')::int;
  else
    init_min := coalesce(p_minutes, sbiq_demo_limit('CASINO_SHOWCASE_MINUTES'))::int;
    cool_min := sbiq_demo_limit('CASINO_SHOWCASE_COOLDOWN_MINUTES')::int;
    max_min  := sbiq_demo_limit('CASINO_SHOWCASE_MAX_MINUTES')::int;
    per_hour := sbiq_demo_limit('MAX_SHOWCASE_ACTIVATIONS_PER_HOUR')::int;
  end if;

  -- Existing active window for this scope?
  select id, activated_at, expires_at into v_id, v_activated, v_exp
    from sbiq_demo_showcase_windows where status='active' and scope=p_scope
    order by activated_at desc limit 1;

  if v_id is not null then
    -- Idempotent / cooldown: recent activation must not keep extending the window.
    if v_activated > now() - make_interval(mins => cool_min) then
      insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes,effective_expiry)
        values (p_scope,p_casino,p_profile,p_account,p_correlation,'cooldown',init_min,v_exp);
      return jsonb_build_object('ok', true, 'reason', 'cooldown', 'window_id', v_id, 'expires_at', v_exp);
    end if;
    -- Extend, but never beyond max_min from ORIGINAL activation.
    v_cap := v_activated + make_interval(mins => max_min);
    v_exp := least(greatest(v_exp, now() + make_interval(mins => init_min)), v_cap);
    update sbiq_demo_showcase_windows set expires_at = v_exp where id = v_id;
    insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes,effective_expiry)
      values (p_scope,p_casino,p_profile,p_account,p_correlation,'extended',init_min,v_exp);
    return jsonb_build_object('ok', true, 'reason', 'extended', 'window_id', v_id, 'expires_at', v_exp);
  end if;

  -- No active window: enforce per-hour activation rate and max concurrent windows.
  act_count := (select count(*) from sbiq_demo_showcase_activations sda
    where sda.scope=p_scope and sda.decision in ('accepted','extended') and sda.created_at > now()-interval '1 hour');
  if act_count >= per_hour then
    insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes)
      values (p_scope,p_casino,p_profile,p_account,p_correlation,'rate_limited',init_min);
    perform sbiq_demo_raise_alert('SIMULATOR_SHOWCASE_RATE_LIMIT','warning',p_scope,p_casino,
      jsonb_build_object('activations_last_hour',act_count,'limit',per_hour), p_correlation);
    return jsonb_build_object('ok', true, 'reason', 'rate_limited');
  end if;

  win_count := (select count(*) from sbiq_demo_showcase_windows where status='active' and expires_at>now());
  if win_count >= sbiq_demo_limit('MAX_ACTIVE_SHOWCASE_WINDOWS')::int then
    insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes)
      values (p_scope,p_casino,p_profile,p_account,p_correlation,'max_windows',init_min);
    return jsonb_build_object('ok', true, 'reason', 'max_windows');
  end if;

  v_exp := now() + make_interval(mins => init_min);
  insert into sbiq_demo_showcase_windows(scope, casino_id, profile, expires_at, correlation_id, triggered_by)
    values (p_scope, p_casino, p_profile, v_exp, p_correlation, p_account) returning id into v_id;
  insert into sbiq_demo_showcase_activations(scope,casino_id,profile,account_id,correlation_id,decision,requested_minutes,effective_expiry)
    values (p_scope,p_casino,p_profile,p_account,p_correlation,'accepted',init_min,v_exp);
  return jsonb_build_object('ok', true, 'reason', 'accepted', 'window_id', v_id, 'expires_at', v_exp);
end; $fn$;
revoke all on function public.sbiq_demo_activate_showcase(text,uuid,text,int,uuid,uuid) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 5 — expired-window maintenance (marks expired, resolves overlaps).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sbiq_demo_showcase_maintenance()
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare v_expired int; v_superseded int; v_active int; v_purged int;
begin
  update sbiq_demo_showcase_windows set status='expired'
    where status='active' and expires_at < now();
  get diagnostics v_expired = row_count;

  -- Overlapping active windows for the same scope: keep the latest expiry, close the rest.
  with ranked as (
    select id, row_number() over (partition by scope order by expires_at desc, activated_at desc) rn
    from sbiq_demo_showcase_windows where status='active' and expires_at>now())
  update sbiq_demo_showcase_windows w set status='superseded'
    from ranked r where w.id=r.id and r.rn>1;
  get diagnostics v_superseded = row_count;

  -- Retention: purge administrative window metadata older than 90 days (evidence
  -- of activation is preserved in sbiq_demo_showcase_activations for its own window).
  delete from sbiq_demo_showcase_windows
    where status in ('expired','superseded') and activated_at < now()-interval '90 days';
  get diagnostics v_purged = row_count;
  delete from sbiq_demo_showcase_activations where created_at < now()-interval '90 days';

  v_active := (select count(*) from sbiq_demo_showcase_windows where status='active' and expires_at>now());
  return jsonb_build_object('ok',true,'expired',v_expired,'superseded',v_superseded,'purged',v_purged,'active',v_active);
end; $fn$;
revoke all on function public.sbiq_demo_showcase_maintenance() from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6 — partition readiness (current + next two months, secure).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sbiq_demo_partition_readiness(p_ensure boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare m timestamptz; want text[]; got text[]; missing text[]; insecure text[]; part text; sec boolean;
begin
  want := array[ to_char(date_trunc('month',now()),'YYYY_MM'),
                 to_char(date_trunc('month',now())+interval '1 month','YYYY_MM'),
                 to_char(date_trunc('month',now())+interval '2 month','YYYY_MM') ];
  if p_ensure then
    for i in 0..2 loop
      perform public.sbiq_ensure_event_partition(date_trunc('month',now())+make_interval(months=>i));
    end loop;
  end if;
  missing := '{}'; insecure := '{}';
  foreach part in array want loop
    select is_secure into sec from sbiq_event_log_partition_security
      where partition = 'casino_event_log_'||part;
    if sec is null then missing := missing || part;
    elsif not sec then insecure := insecure || part; end if;
  end loop;
  if array_length(missing,1) > 0 then
    perform sbiq_demo_raise_alert('SIMULATOR_PARTITION_MISSING','critical','event_log',null,
      jsonb_build_object('missing',missing));
  end if;
  if array_length(insecure,1) > 0 then
    perform sbiq_demo_raise_alert('SIMULATOR_PARTITION_INSECURE','critical','event_log',null,
      jsonb_build_object('insecure',insecure));
  end if;
  return jsonb_build_object('ok', coalesce(array_length(missing,1),0)=0 and coalesce(array_length(insecure,1),0)=0,
    'required',want,'missing',missing,'insecure',insecure);
end; $fn$;
revoke all on function public.sbiq_demo_partition_readiness(boolean) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — simulator usage / event-volume monitoring view.
-- Counts ONLY simulator-produced events (authoritative producer tag).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.sbiq_demo_simulator_usage as
with e as (
  select casino_id, occurred_at,
    (payload->>'is_simulated')::boolean sim
  from casino_event_log where producer='safebet-demo-live-simulator-v2'
)
select
  (select count(*) from e where occurred_at > now()-interval '15 minutes') events_15m,
  (select count(*) from e where occurred_at > now()-interval '1 hour') events_1h,
  (select count(*) from e where occurred_at >= date_trunc('day', now())) events_today,
  (select count(*) from e where occurred_at >= date_trunc('month', now())) events_month,
  (select jsonb_object_agg(casino_id::text, n) from
     (select casino_id, count(*) n from e where occurred_at > now()-interval '1 hour' group by casino_id) q) events_by_casino_1h,
  (select round(avg(events_generated)) from sbiq_demo_sim_run_log where outcome='ok' and started_at>now()-interval '6 hours') avg_events_per_tick,
  (select max(events_generated) from sbiq_demo_sim_run_log where started_at>now()-interval '24 hours') peak_events_per_tick,
  (select count(*) from e where occurred_at > now()-interval '1 hour') * 24 est_daily_events,
  sbiq_demo_limit('SIM_EVENTS_PER_DAY_WARNING') day_warning_limit,
  sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP') day_hardstop_limit,
  round(100.0 * (select count(*) from e where occurred_at >= date_trunc('day', now()))
        / nullif(sbiq_demo_limit('SIM_EVENTS_PER_DAY_HARDSTOP'),0), 1) pct_of_daily_hardstop,
  (select count(*) from sbiq_demo_sim_run_log where outcome<>'ok' and started_at>now()-interval '24 hours') failures_24h,
  (select max(finished_at) from sbiq_demo_sim_run_log where outcome='ok') last_successful_tick,
  (select max(started_at) from sbiq_demo_sim_run_log where outcome<>'ok') last_failed_tick;
revoke all on public.sbiq_demo_simulator_usage from anon;
grant select on public.sbiq_demo_simulator_usage to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7 — storage / growth monitoring view.
-- Reports internal DB sizes + CONFIGURED governance thresholds (not billing).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.sbiq_demo_storage_status as
with parts as (
  select c.relname part, pg_total_relation_size(c.oid) bytes
  from pg_inherits i join pg_class c on c.oid=i.inhrelid
  join pg_class p on p.oid=i.inhparent where p.relname='casino_event_log'
),
growth as (
  select coalesce(sum(case when occurred_at>now()-interval '1 day' then 1 else 0 end),0) rows_1d
  from casino_event_log
)
select
  pg_database_size(current_database()) db_bytes,
  pg_size_pretty(pg_database_size(current_database())) db_size,
  (select coalesce(sum(bytes),0) from parts) event_log_bytes,
  pg_size_pretty((select coalesce(sum(bytes),0) from parts)) event_log_size,
  (select jsonb_object_agg(part, pg_size_pretty(bytes)) from parts) event_log_by_partition,
  pg_total_relation_size('audit_events') audit_bytes,
  pg_size_pretty(pg_total_relation_size('audit_events')) audit_size,
  pg_size_pretty(pg_total_relation_size('projection_player_state')) projection_player_size,
  -- ~180 bytes/row observed; daily growth estimate from last 24h row count.
  round((select rows_1d from growth) * 180.0 / 1048576.0, 1) est_daily_growth_mb,
  round((select rows_1d from growth) * 180.0 / 1048576.0 * 30, 1) est_monthly_growth_mb,
  sbiq_demo_limit('STORAGE_INTERNAL_ALLOC_MB') internal_alloc_mb,
  round(100.0 * pg_database_size(current_database())/1048576.0 / nullif(sbiq_demo_limit('STORAGE_INTERNAL_ALLOC_MB'),0), 1) pct_of_internal_alloc,
  case when round((select rows_1d from growth)*180.0/1048576.0,1) > 0
    then round((sbiq_demo_limit('STORAGE_INTERNAL_ALLOC_MB') - pg_database_size(current_database())/1048576.0)
               / nullif((select rows_1d from growth)*180.0/1048576.0,0)) end est_days_to_alloc,
  (select max(part) from parts) newest_partition,
  (select min(part) from parts) oldest_partition;
revoke all on public.sbiq_demo_storage_status from anon;
grant select on public.sbiq_demo_storage_status to authenticated, service_role;

select 'demo_simulator_governance_part1_installed' status;
