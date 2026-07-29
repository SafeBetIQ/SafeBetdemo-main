/*
  # Phase 4.4 — Enterprise Policy Store (WS1) · closes roadmap M1
  Externalises policy CONFIGURATION into a versioned, audited repository.
  Policy LOGIC is untouched: the Enterprise Policy & Rules Platform still
  evaluates via lib/policyPlatform/evaluation.ts (Constitution 4). This store
  only holds the rule DATA the platform loads through its existing configure()
  seam — a policy change is a data change, never a code change.

  - policy_sets: versioned bundles; exactly one 'active' at a time (partial
    unique), with effective dating and activation audit.
  - policy_rules: the rules of each version (full PolicyRule as JSONB +
    indexed columns for querying). Byte-for-byte what the platform validates.
  - policy_change_log: immutable audit trail of seed / activate / rollback.
  Security: service-role only (the platform loads via service role; admins
  manage via the platform-ops function after JWT verification). No client
  policies — matches the event store's least-privilege posture.
*/

create table if not exists policy_sets (
  version integer primary key,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  effective_from timestamptz,
  effective_to timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  activated_by text
);

-- At most one active policy set platform-wide.
create unique index if not exists uq_policy_sets_one_active
  on policy_sets ((status)) where status = 'active';

create table if not exists policy_rules (
  id bigint generated always as identity primary key,
  policy_set_version integer not null references policy_sets(version) on delete cascade,
  policy_id text not null,
  scope text not null,
  jurisdiction text,
  casino_id uuid,
  applies_to text not null,
  action text not null,
  priority text not null,
  enabled boolean not null default true,
  definition jsonb not null,               -- the complete PolicyRule
  unique (policy_set_version, policy_id)
);
create index if not exists idx_policy_rules_set on policy_rules (policy_set_version);

create table if not exists policy_change_log (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  actor text not null,
  action text not null check (action in ('seed', 'activate', 'rollback', 'draft')),
  from_version integer,
  to_version integer,
  reason text
);

alter table policy_sets       enable row level security;
alter table policy_rules      enable row level security;
alter table policy_change_log enable row level security;
-- No client policies: service role manages/loads; RLS denies everyone else.

-- ── Load the ACTIVE (and currently-effective) policy set's rule definitions ──
create or replace function sbiq_active_policy_rules()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select r.definition
  from policy_rules r
  join policy_sets s on s.version = r.policy_set_version
  where s.status = 'active'
    and (s.effective_from is null or s.effective_from <= now())
    and (s.effective_to   is null or s.effective_to   >  now())
  order by r.policy_id;
$$;

revoke all on function sbiq_active_policy_rules() from public, anon, authenticated;
grant execute on function sbiq_active_policy_rules() to service_role;

-- ── Activate a version (promotion or rollback), audited & atomic ─────────────
create or replace function sbiq_activate_policy_set(p_version integer, p_actor text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_from integer;
begin
  if not exists (select 1 from policy_sets where version = p_version) then
    raise exception 'policy set version % does not exist', p_version;
  end if;
  select version into v_from from policy_sets where status = 'active';

  update policy_sets set status = 'archived' where status = 'active' and version <> p_version;
  update policy_sets
    set status = 'active', activated_at = now(), activated_by = p_actor
    where version = p_version;

  insert into policy_change_log (actor, action, from_version, to_version, reason)
  values (p_actor,
          case when v_from is null then 'seed'
               when p_version < coalesce(v_from, p_version) then 'rollback'
               else 'activate' end,
          v_from, p_version, p_reason);

  return jsonb_build_object('active_version', p_version, 'previous_version', v_from);
end;
$$;

revoke all on function sbiq_activate_policy_set(integer, text, text) from public, anon, authenticated;
grant execute on function sbiq_activate_policy_set(integer, text, text) to service_role;
