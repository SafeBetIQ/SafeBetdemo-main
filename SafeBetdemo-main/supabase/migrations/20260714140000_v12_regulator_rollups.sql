/*
  # Version 1.2 — Regulator national rollups (Enterprise Regulator Portal)

  Composition (not recalculation) of the certified read-model catalogue for
  regulator oversight. These functions AGGREGATE already-projected, anonymous
  facts across the casinos of ONE jurisdiction — they compute no business
  logic, own no runtime state, and expose no PII (SB-PLR anonymous ids only).

  Constitution compliance:
   • One flow: reads projection_* read models produced by the Projection
     Platform; never events, never a second pipeline.
   • One runtime reality: no runtime state; pure read + count.
   • Intelligence/Policy unchanged: risk tiers/monitoring come from the
     published catalogue views (thresholds live there), not recomputed here.

  Scope: the caller passes the VERIFIED regulator's jurisdiction (the
  regulator-portal / consumer-gateway derives it from the JWT + registry, and
  the regulator RLS matrix already restricts a regulator to their jurisdiction).
*/

-- Per-operator anonymous rollup for a jurisdiction (one row per casino).
create or replace function sbiq_regulator_operators(p_jurisdiction text)
returns table (
  casino_id uuid, casino_name text, province text,
  active_players integer, active_sessions integer, active_machines integer,
  risk_critical integer, risk_high integer, risk_medium integer, risk_low integer,
  total_wagered numeric, ggr numeric,
  players_monitored bigint, interventions bigint, last_event_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.province,
    coalesce(cs.active_players, 0), coalesce(cs.active_sessions, 0), coalesce(cs.active_machines, 0),
    coalesce(cs.risk_critical, 0), coalesce(cs.risk_high, 0), coalesce(cs.risk_medium, 0), coalesce(cs.risk_low, 0),
    coalesce(cs.total_wagered, 0), coalesce(cs.ggr, 0),
    (select count(*) from projection_compliance_state cp where cp.casino_id = c.id),
    (select count(*) from projection_intervention_state iv where iv.casino_id = c.id),
    cs.last_event_at
  from casinos c
  left join projection_casino_state cs on cs.casino_id = c.id
  where c.jurisdiction = p_jurisdiction
  order by c.name;
$$;

revoke all on function sbiq_regulator_operators(text) from public, anon;
grant execute on function sbiq_regulator_operators(text) to authenticated, service_role;

-- National rollup: aggregate across the jurisdiction's operators.
create or replace function sbiq_regulator_national(p_jurisdiction text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ops as (select * from sbiq_regulator_operators(p_jurisdiction))
  select jsonb_build_object(
    'jurisdiction', p_jurisdiction,
    'operators', (select count(*) from ops),
    'active_players', (select coalesce(sum(active_players),0) from ops),
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
    'operators_detail', (
      select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from ops o
    )
  );
$$;

revoke all on function sbiq_regulator_national(text) from public, anon;
grant execute on function sbiq_regulator_national(text) to authenticated, service_role;
