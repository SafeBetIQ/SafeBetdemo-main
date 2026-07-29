/*
  # Version 1.1 — Connector run telemetry (Enterprise Casino Integration)

  Operational telemetry for the Connector Framework — NOT runtime state. It
  records the outcome of each connector run (counts + diagnostics), so the
  Integration Health view (served by the existing Consumer Platform) can show
  connector status, throughput, and failed events. It never stores casino
  runtime state (players/sessions/machines) — those live only in the Digital
  Twin / projections (Constitution 2). One row per run; append-only in spirit.

  Security: service-role writes (the connector runs server-side after JWT
  verification); tenant-scoped read for authenticated operators/admins.
*/

create table if not exists connector_runs (
  id bigint generated always as identity primary key,
  casino_id uuid not null references casinos(id) on delete cascade,
  connector_type text not null,
  connector_name text not null,
  received integer not null default 0,
  translated integer not null default 0,
  rejected integer not null default 0,
  submitted integer not null default 0,
  failed integer not null default 0,
  diagnostics jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_connector_runs_casino_time
  on connector_runs (casino_id, created_at desc);

alter table connector_runs enable row level security;

-- Tenant-scoped read (mirrors the enterprise isolation matrix, Phase 4.1).
drop policy if exists connector_runs_tenant_read on connector_runs;
create policy connector_runs_tenant_read on connector_runs
  for select to authenticated
  using (casino_id in (select app_visible_casinos()));

-- ── Integration health rollup (no PII — counts + latest run only) ────────────
create or replace function sbiq_connector_health(p_casino uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select * from connector_runs where casino_id = p_casino
    order by created_at desc limit 200
  )
  select jsonb_build_object(
    'casino_id', p_casino,
    'runs', (select count(*) from recent),
    'received', (select coalesce(sum(received),0) from recent),
    'submitted', (select coalesce(sum(submitted),0) from recent),
    'rejected', (select coalesce(sum(rejected),0) from recent),
    'failed', (select coalesce(sum(failed),0) from recent),
    'last_run_at', (select max(finished_at) from recent),
    'connectors', (
      select coalesce(jsonb_agg(c), '[]'::jsonb) from (
        select connector_type, connector_name,
               sum(received) as received, sum(submitted) as submitted,
               sum(rejected) as rejected, sum(failed) as failed,
               max(finished_at) as last_run_at
        from recent group by connector_type, connector_name
        order by max(finished_at) desc
      ) c
    ),
    'recent_diagnostics', (
      select coalesce(jsonb_agg(d), '[]'::jsonb) from (
        select connector_name, finished_at, diagnostics
        from recent where jsonb_array_length(diagnostics) > 0
        order by finished_at desc limit 10
      ) d
    )
  );
$$;

revoke all on function sbiq_connector_health(uuid) from public, anon;
grant execute on function sbiq_connector_health(uuid) to authenticated, service_role;
