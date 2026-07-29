/*
  # Version 1.3 — Commercial enablement metadata

  COMMERCIAL / TENANT-LIFECYCLE metadata: subscriptions (plan, status,
  trial/expiry), onboarding progress, and pilot deployments. This is NOT
  casino runtime state (no players/sessions/machines) and it NEVER alters the
  certified enterprise flow — identity, events, projections, twin,
  intelligence, and policy behave identically regardless of licence. Feature
  entitlements gate commercial ACCESS at the presentation layer only.

  Security: tenant-scoped read (an operator sees only its own commercial
  record); service role (Customer Success / admin) manages via the commerce
  function after JWT verification.
*/

create table if not exists operator_subscriptions (
  casino_id uuid primary key references casinos(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('trial','pilot','standard','enterprise')),
  status text not null default 'trial' check (status in ('trial','active','suspended','expired','cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists operator_onboarding (
  casino_id uuid primary key references casinos(id) on delete cascade,
  completed jsonb not null default '[]'::jsonb,   -- array of step keys
  started_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists pilot_deployments (
  casino_id uuid primary key references casinos(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned','in-progress','ready','live','rolled-back')),
  checklist jsonb not null default '[]'::jsonb,    -- array of item keys
  started_at timestamptz,
  go_live_at timestamptz,
  notes text,
  updated_at timestamptz not null default now()
);

alter table operator_subscriptions enable row level security;
alter table operator_onboarding    enable row level security;
alter table pilot_deployments      enable row level security;

-- Tenant-scoped read (mirrors the Phase 4.1 isolation matrix).
drop policy if exists operator_subscriptions_read on operator_subscriptions;
create policy operator_subscriptions_read on operator_subscriptions
  for select to authenticated using (casino_id in (select app_visible_casinos()));
drop policy if exists operator_onboarding_read on operator_onboarding;
create policy operator_onboarding_read on operator_onboarding
  for select to authenticated using (casino_id in (select app_visible_casinos()));
drop policy if exists pilot_deployments_read on pilot_deployments;
create policy pilot_deployments_read on pilot_deployments
  for select to authenticated using (casino_id in (select app_visible_casinos()));

-- Seed a trial subscription + onboarding + pilot record for existing active
-- casinos (idempotent; never overwrites an existing commercial record).
insert into operator_subscriptions (casino_id, plan, status, trial_ends_at)
select id, 'trial', 'trial', now() + interval '30 days' from casinos where is_active
on conflict (casino_id) do nothing;

insert into operator_onboarding (casino_id, completed, started_at)
select id, '[]'::jsonb, now() from casinos where is_active
on conflict (casino_id) do nothing;

insert into pilot_deployments (casino_id, status, checklist, started_at)
select id, 'planned', '[]'::jsonb, now() from casinos where is_active
on conflict (casino_id) do nothing;

-- ── Customer Success rollup: commercial metadata + certified health ──────────
-- Composition only (reads commercial tables + connector_runs + projection
-- freshness). No runtime state; anonymous (SB-PLR only, and none exposed here).
create or replace function sbiq_customer_success()
returns table (
  casino_id uuid, casino_name text, jurisdiction text,
  plan text, sub_status text, trial_ends_at timestamptz, current_period_end timestamptz,
  onboarding_completed jsonb, onboarding_activated boolean,
  pilot_status text, pilot_checklist jsonb,
  connector_runs bigint, connector_failed bigint,
  events_in_log bigint, last_event_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.jurisdiction,
    coalesce(s.plan,'none'), coalesce(s.status,'none'), s.trial_ends_at, s.current_period_end,
    coalesce(o.completed,'[]'::jsonb), (o.activated_at is not null),
    coalesce(p.status,'planned'), coalesce(p.checklist,'[]'::jsonb),
    (select count(*) from connector_runs cr where cr.casino_id = c.id),
    (select coalesce(sum(cr.failed),0) from connector_runs cr where cr.casino_id = c.id),
    (select count(*) from casino_event_log e where e.casino_id = c.id),
    (select max(e.occurred_at) from casino_event_log e where e.casino_id = c.id)
  from casinos c
  left join operator_subscriptions s on s.casino_id = c.id
  left join operator_onboarding o on o.casino_id = c.id
  left join pilot_deployments p on p.casino_id = c.id
  where c.is_active
  order by c.name;
$$;

revoke all on function sbiq_customer_success() from public, anon;
grant execute on function sbiq_customer_success() to authenticated, service_role;
