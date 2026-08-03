-- Regulator rollup: expose certified freshness-based active-now separately from observed.
-- sbiq_regulator_operators adds players_active_now/idle/stale; sbiq_regulator_national adds
-- players_active_now (active-now) + observed_players. Platform-wide; no casino-specific logic.

drop function if exists public.sbiq_regulator_national(text);
drop function if exists public.sbiq_regulator_operators(text);
create function public.sbiq_regulator_operators(p_jurisdiction text)
 returns table(casino_id uuid, casino_name text, province text, active_players integer, players_active_now integer, players_idle integer, players_stale integer, active_sessions integer, active_machines integer, risk_critical integer, risk_high integer, risk_medium integer, risk_low integer, total_wagered numeric, ggr numeric, players_monitored bigint, interventions bigint, last_event_at timestamptz)
 language sql stable security definer set search_path to 'public'
as $fn$
  select c.id, c.name, c.province,
    coalesce(cs.active_players,0),        -- observed (players in the activity projection)
    coalesce(cs.players_active_now,0),    -- certified freshness-based active-now
    coalesce(cs.players_idle,0), coalesce(cs.players_stale,0),
    coalesce(cs.active_sessions,0), coalesce(cs.active_machines,0),
    coalesce(cs.risk_critical,0), coalesce(cs.risk_high,0), coalesce(cs.risk_medium,0), coalesce(cs.risk_low,0),
    coalesce(cs.total_wagered,0), coalesce(cs.ggr,0),
    (select count(*) from projection_compliance_state cp where cp.casino_id=c.id),
    (select count(*) from projection_intervention_state iv where iv.casino_id=c.id),
    cs.last_event_at
  from casinos c left join projection_casino_state cs on cs.casino_id=c.id
  where c.jurisdiction=p_jurisdiction order by c.name;
$fn$;
create function public.sbiq_regulator_national(p_jurisdiction text)
 returns jsonb language sql stable security definer set search_path to 'public'
as $fn$
  with ops as (select * from sbiq_regulator_operators(p_jurisdiction))
  select jsonb_build_object(
    'jurisdiction', p_jurisdiction,
    'operators', (select count(*) from ops),
    'players_active_now', (select coalesce(sum(players_active_now),0) from ops),
    'observed_players', (select coalesce(sum(active_players),0) from ops),
    'active_players', (select coalesce(sum(active_players),0) from ops),  -- retained: observed (back-compat)
    'active_sessions', (select coalesce(sum(active_sessions),0) from ops),
    'active_machines', (select coalesce(sum(active_machines),0) from ops),
    'risk_critical', (select coalesce(sum(risk_critical),0) from ops),
    'risk_high', (select coalesce(sum(risk_high),0) from ops),
    'risk_medium', (select coalesce(sum(risk_medium),0) from ops),
    'risk_low', (select coalesce(sum(risk_low),0) from ops),
    'total_wagered', (select coalesce(sum(total_wagered),0) from ops),
    'ggr', (select coalesce(sum(ggr),0) from ops),
    'players_monitored', (select coalesce(sum(players_monitored),0) from ops),
    'interventions', (select coalesce(sum(interventions),0) from ops),
    'last_event_at', (select max(last_event_at) from ops),
    'operators_detail', (select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from ops o)
  );
$fn$;
select 'reg_fns_updated' status;
