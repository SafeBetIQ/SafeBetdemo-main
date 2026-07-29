/*
  # Version 1.5 — Enterprise Workflow & Case Management (ADR-005)

  OPERATIONAL ORCHESTRATION metadata: cases, tasks, an append-only audit
  trail, and notifications that coordinate HUMAN actions after the certified
  enterprise flow has already produced its Recorded Facts, Derived Intelligence
  and Policy Decisions.

  This is NOT casino runtime state (no players/sessions/machines — Constitution
  2) and it NEVER alters the certified enterprise flow (Constitution 1):
  identity, events, projections, twin, intelligence and policy behave
  identically whether or not a case exists. A case REFERENCES platform evidence
  by identifier (SB-PLR player id, policy decision id, event id) in
  `evidence_refs` — it never copies intelligence or stores risk as
  authoritative state. Same class as connector_runs / operator_subscriptions.

  Security: tenant-scoped read via app_visible_casinos() (Phase 4.1 matrix);
  all mutations flow through the `workflow` edge function (service role) after
  JWT verification. Anonymous identity is preserved end-to-end (no PII).
*/

-- Monotonic sequence for human-readable case numbers (formatted in app code).
create sequence if not exists workflow_case_seq start 1000;

-- Atomic next-number accessor (the edge function formats the human id).
create or replace function sbiq_next_case_seq()
returns bigint language sql volatile as $$ select nextval('workflow_case_seq'); $$;
revoke all on function sbiq_next_case_seq() from public, anon;
grant execute on function sbiq_next_case_seq() to authenticated, service_role;

create table if not exists workflow_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique not null,
  casino_id uuid not null references casinos(id) on delete cascade,
  case_type text not null check (case_type in
    ('high-risk-player','rg-recommendation','compliance-finding','regulatory-investigation','manual')),
  status text not null default 'open' check (status in
    ('open','in-review','accepted','rejected','action-recorded','outcome-recorded','resolved','closed')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  title text not null,
  summary text,
  subject_kind text not null default 'player',
  subject_ref text,                       -- anonymous SB-PLR id / decision id (never PII)
  assigned_to text,
  due_at timestamptz,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  resolution text,
  evidence_refs jsonb not null default '[]'::jsonb,  -- references into the certified flow
  created_by text not null default 'system',
  updated_at timestamptz not null default now()
);
create index if not exists workflow_cases_casino_idx on workflow_cases(casino_id, status);
create index if not exists workflow_cases_subject_idx on workflow_cases(casino_id, subject_ref);

create table if not exists workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references workflow_cases(id) on delete cascade,
  casino_id uuid not null references casinos(id) on delete cascade,
  task_type text not null default 'compliance-action',
  description text not null,
  status text not null default 'open' check (status in ('open','in-progress','completed','escalated')),
  assigned_to text,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  evidence_ref text,                      -- reference to an existing Policy Decision / fact
  created_at timestamptz not null default now()
);
create index if not exists workflow_tasks_case_idx on workflow_tasks(case_id);
create index if not exists workflow_tasks_casino_idx on workflow_tasks(casino_id, status);

-- Append-only audit trail: the immutable coordination history of every case.
create table if not exists workflow_audit (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references workflow_cases(id) on delete cascade,
  casino_id uuid not null references casinos(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists workflow_audit_case_idx on workflow_audit(case_id, at);

-- Immutability: the audit trail may only ever be appended to (mirrors the
-- casino_event_log immutability guarantee — Constitution §5 Event Sourcing).
create or replace function workflow_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'workflow_audit is append-only (no % permitted)', tg_op;
end;
$$;
drop trigger if exists workflow_audit_no_update on workflow_audit;
create trigger workflow_audit_no_update before update or delete on workflow_audit
  for each row execute function workflow_audit_immutable();

create table if not exists workflow_notifications (
  id uuid primary key default gen_random_uuid(),
  casino_id uuid not null references casinos(id) on delete cascade,
  case_id uuid references workflow_cases(id) on delete cascade,
  recipient text not null,                -- user id or role
  kind text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists workflow_notifications_recipient_idx on workflow_notifications(casino_id, recipient, read_at);

alter table workflow_cases         enable row level security;
alter table workflow_tasks         enable row level security;
alter table workflow_audit         enable row level security;
alter table workflow_notifications enable row level security;

-- Tenant-scoped read (Phase 4.1 isolation matrix). Mutations use the service
-- role via the workflow edge function; no client write policies exist.
drop policy if exists workflow_cases_read on workflow_cases;
create policy workflow_cases_read on workflow_cases
  for select to authenticated using (casino_id in (select app_visible_casinos()));
drop policy if exists workflow_tasks_read on workflow_tasks;
create policy workflow_tasks_read on workflow_tasks
  for select to authenticated using (casino_id in (select app_visible_casinos()));
drop policy if exists workflow_audit_read on workflow_audit;
create policy workflow_audit_read on workflow_audit
  for select to authenticated using (casino_id in (select app_visible_casinos()));
drop policy if exists workflow_notifications_read on workflow_notifications;
create policy workflow_notifications_read on workflow_notifications
  for select to authenticated using (casino_id in (select app_visible_casinos()));

-- ── Executive operations rollup (WS5): composition over workflow metadata ─────
-- Optional jurisdiction filter for regulators; casino filter for operators.
-- No runtime state; anonymous (references only). SECURITY DEFINER so the
-- rollup can aggregate across visible tenants; callers still gated at the edge.
create or replace function sbiq_workflow_operations(p_casino uuid default null, p_jurisdiction text default null)
returns table (
  casino_id uuid, casino_name text, jurisdiction text,
  open_cases bigint, overdue_cases bigint, resolved_cases bigint,
  investigations_open bigint,
  compliance_tasks bigint, compliance_completed bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.name, c.jurisdiction,
    (select count(*) from workflow_cases w where w.casino_id = c.id
       and w.status not in ('resolved','closed','rejected')),
    (select count(*) from workflow_cases w where w.casino_id = c.id
       and w.due_at is not null and w.due_at < now()
       and w.status not in ('resolved','closed','rejected')),
    (select count(*) from workflow_cases w where w.casino_id = c.id
       and w.status in ('resolved','closed')),
    (select count(*) from workflow_cases w where w.casino_id = c.id
       and w.case_type = 'regulatory-investigation'
       and w.status not in ('resolved','closed','rejected')),
    (select count(*) from workflow_tasks t where t.casino_id = c.id and t.task_type = 'compliance-action'),
    (select count(*) from workflow_tasks t where t.casino_id = c.id and t.task_type = 'compliance-action' and t.status = 'completed')
  from casinos c
  where c.is_active
    and (p_casino is null or c.id = p_casino)
    and (p_jurisdiction is null or c.jurisdiction = p_jurisdiction)
  order by c.name;
$$;

revoke all on function sbiq_workflow_operations(uuid, text) from public, anon;
grant execute on function sbiq_workflow_operations(uuid, text) to authenticated, service_role;
