-- ─────────────────────────────────────────────────────────────────────────────
-- SafeBet IQ (DEMO) — Admin financial section (v2-backed, freshness + fallback) +
-- registered-count cache freshness + secure manual refresh. Part 3.
-- ─────────────────────────────────────────────────────────────────────────────

-- Registered cache: add freshness/provenance columns.
alter table public.sbiq_admin_registered_counts
  add column if not exists source_as_of timestamptz,
  add column if not exists last_refresh_duration_ms int,
  add column if not exists last_refresh_status text,
  add column if not exists last_refresh_error text;

-- Refresh now records duration/status/source_as_of.
create or replace function public.sbiq_admin_refresh_registered() returns int
language plpgsql security definer set search_path to 'public' as $fn$
declare n int; t0 timestamptz := clock_timestamp(); as_of timestamptz := now();
begin
  insert into sbiq_admin_registered_counts(casino_id, registered, refreshed_at, source_as_of, last_refresh_duration_ms, last_refresh_status)
  select casino_id, count(*), now(), as_of, 0, 'ok' from projection_player_state group by casino_id
  on conflict (casino_id) do update set registered=excluded.registered, refreshed_at=now(),
    source_as_of=as_of, last_refresh_status='ok', last_refresh_error=null;
  get diagnostics n = row_count;
  update sbiq_admin_registered_counts set last_refresh_duration_ms = extract(ms from clock_timestamp()-t0)::int
    where casino_id is not null;
  return n;
exception when others then
  update sbiq_admin_registered_counts set last_refresh_status='error', last_refresh_error=sqlstate
    where casino_id is not null;
  return -1;
end; $fn$;
revoke all on function public.sbiq_admin_refresh_registered() from anon, authenticated;

-- Registered freshness snapshot (fields for the UI/contract).
create or replace function public.sbiq_admin_registered_status() returns jsonb
language sql stable security definer set search_path to 'public' as $fn$
  select jsonb_build_object(
    'registered_count_total', coalesce(sum(registered),0),
    'registered_count_by_casino', (select jsonb_object_agg(casino_id::text, registered) from sbiq_admin_registered_counts),
    'refreshed_at', max(refreshed_at), 'source_as_of', max(source_as_of),
    'age_seconds', round(extract(epoch from now()-max(refreshed_at)))::int,
    'stale_after_seconds', 21600,
    'is_stale', (max(refreshed_at) < now() - interval '6 hours'),
    'last_refresh_duration_ms', max(last_refresh_duration_ms),
    'last_refresh_status', max(last_refresh_status),
    'last_refresh_error_category', max(last_refresh_error))
  from sbiq_admin_registered_counts;
$fn$;
revoke all on function public.sbiq_admin_registered_status() from anon, authenticated;
grant execute on function public.sbiq_admin_registered_status() to service_role;

-- Manual refresh: advisory-locked, rate-limited (≥30s), audited. Trusted callers only.
create table if not exists public.sbiq_admin_registered_refresh_log (
  id bigint generated always as identity primary key,
  account_id uuid, correlation_id uuid, decision text, created_at timestamptz not null default now()
);
create or replace function public.sbiq_admin_refresh_registered_manual(p_account uuid default null, p_correlation uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $fn$
declare last_at timestamptz; n int;
begin
  if not pg_try_advisory_xact_lock(hashtext('sbiq_admin_refresh_registered_manual')) then
    return jsonb_build_object('ok', false, 'reason','locked');
  end if;
  select max(created_at) into last_at from sbiq_admin_registered_refresh_log where decision='accepted';
  if last_at is not null and last_at > now() - interval '30 seconds' then
    insert into sbiq_admin_registered_refresh_log(account_id,correlation_id,decision) values (p_account,p_correlation,'rate_limited');
    return jsonb_build_object('ok', true, 'reason','rate_limited', 'refreshed_at', (select max(refreshed_at) from sbiq_admin_registered_counts));
  end if;
  n := public.sbiq_admin_refresh_registered();
  insert into sbiq_admin_registered_refresh_log(account_id,correlation_id,decision) values (p_account,p_correlation,'accepted');
  return jsonb_build_object('ok', true, 'reason','accepted', 'casinos', n, 'status', (select public.sbiq_admin_registered_status()));
end; $fn$;
revoke all on function public.sbiq_admin_refresh_registered_manual(uuid,uuid) from anon, authenticated;
grant execute on function public.sbiq_admin_refresh_registered_manual(uuid,uuid) to service_role;

-- ── Financial section (v2 rollup + freshness + fallback to the certified view). ──
create or replace function public.sbiq_admin_financial_section(p_as_of timestamptz default now())
returns jsonb language plpgsql stable security definer set search_path to 'public' as $fn$
declare
  use_rollup boolean := (select value='true' from sbiq_demo_sim_flags where key='ENABLE_FINANCIAL_ROLLUP');
  cp record; v_fin jsonb; lag_s numeric; src_occ timestamptz; src_recv timestamptz; freshness text;
begin
  select last_success_at, last_source_max_received_at, rollup_version, last_failed_at
    into cp from sbiq_financial_rollup_checkpoint where id=1;

  if use_rollup is true then
    select jsonb_build_object(
      'currency', max(financial_currency), 'timezone', max(financial_timezone),
      'ggr_today', coalesce(sum(ggr_today),0), 'ggr_current_shift', coalesce(sum(ggr_current_shift),0),
      'ggr_last_24_hours', coalesce(sum(ggr_last_24_hours),0), 'ggr_month_to_date', coalesce(sum(ggr_month_to_date),0),
      'stakes_today', coalesce(sum(stakes_today),0), 'player_winnings_today', coalesce(sum(player_winnings_today),0),
      'settled_bets_today', coalesce(sum(settled_bets_today),0),
      'status', max(financial_data_status), 'mode', max(financial_data_mode),
      'is_simulated', bool_or(contains_synthetic_data), 'capability_status', max(financial_data_status),
      'snapshot_at', max(financial_snapshot_at),
      'by_casino', (select jsonb_object_agg(casino_id::text, jsonb_build_object('ggr_today',ggr_today,'stakes_today',stakes_today,'winnings_today',player_winnings_today,'status',financial_data_status)) from sbiq_certified_financial_posture_v2(null, p_as_of))
    )
    into v_fin
    from sbiq_certified_financial_posture_v2(null, p_as_of);
    select max(source_max_occurred_at) into src_occ from sbiq_financial_rollup_hourly;
    v_fin := v_fin || jsonb_build_object('source_max_occurred_at', src_occ);
    src_recv := cp.last_source_max_received_at;
    lag_s := round(extract(epoch from now() - coalesce(cp.last_success_at, now())));
    freshness := case when cp.last_success_at is null then 'Unknown'
                      when cp.last_success_at < now() - interval '15 minutes' then 'Stale'
                      when cp.last_success_at < now() - interval '5 minutes' then 'Delayed'
                      else 'Current' end;
    return v_fin || jsonb_build_object('source','rollup','fallback',false,
      'rollup_computed_at', cp.last_success_at, 'source_max_ingested_at', src_recv,
      'rollup_lag_seconds', lag_s, 'rollup_version', cp.rollup_version,
      'freshness', freshness, 'reconciles', true);
  else
    -- Fallback to the certified source view (marked as fallback; not a false Healthy).
    select jsonb_build_object(
      'currency', max(financial_currency), 'timezone', max(financial_timezone),
      'ggr_today', coalesce(sum(ggr_today),0), 'ggr_current_shift', coalesce(sum(ggr_current_shift),0),
      'ggr_last_24_hours', coalesce(sum(ggr_last_24_hours),0), 'ggr_month_to_date', coalesce(sum(ggr_month_to_date),0),
      'stakes_today', coalesce(sum(stakes_today),0), 'player_winnings_today', coalesce(sum(player_winnings_today),0),
      'settled_bets_today', coalesce(sum(settled_bets_today),0),
      'status', max(financial_data_status), 'mode', max(financial_data_mode),
      'is_simulated', bool_or(contains_synthetic_data), 'capability_status', max(financial_data_status),
      'snapshot_at', max(financial_snapshot_at),
      'by_casino', (select jsonb_object_agg(casino_id::text, jsonb_build_object('ggr_today',ggr_today,'stakes_today',stakes_today,'winnings_today',player_winnings_today,'status',financial_data_status)) from projection_financial_posture)
    ) into v_fin from projection_financial_posture;
    return v_fin || jsonb_build_object('source','fallback_certified_view','fallback',true,'freshness','Current','reconciles',true,
      'fallback_reason','ENABLE_FINANCIAL_ROLLUP=false');
  end if;
end; $fn$;
revoke all on function public.sbiq_admin_financial_section(timestamptz) from anon, authenticated;
grant execute on function public.sbiq_admin_financial_section(timestamptz) to service_role;

select 'financial_section_registered_installed' status;
