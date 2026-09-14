-- ─── ARCH-V4-C8 — Guardian National Enforcement Policy Registry + Legal/Regulatory
--     Authorisation Workflow ─────────────────────────────────────────────────
-- The HUMAN/legal authority layer that must exist BEFORE any future enforcement
-- orchestration (C9). SYNTHETIC ONLY. Flow:
--   case -> evidence -> policy applicability -> legal/regulatory review -> proposed
--   action -> HUMAN authorisation -> AUTHORISED ACTION RECORD -> STOP.
-- C8 does NOT execute or transmit the authorised action externally.
--
-- CORE SAFETY (encoded + tested; DB CHECKs):
--   INTELLIGENCE/CASE/EVIDENCE/POLICY MATCH != LEGAL DETERMINATION
--   LEGAL REVIEW != ENFORCEMENT EXECUTION ; AUTHORISATION != EXTERNAL PROVIDER ACTION
--   No EXECUTED/ACTIONED/PROVIDER_ACKNOWLEDGED state. action_authorisation CHECKs force
--   is_external_action_executed=false AND is_provider_notified=false. Final AUTHORISED
--   requires a synthetic HUMAN Authorising Officer (enforced in code + tested) — no machine
--   authorisation. Action types (DOMAIN_BLOCK, …) are AUTHORISABLE, NOT executable in C8.
-- All in the dedicated `guardian` schema. Immutable Guardian keys.

-- ── POLICY REGISTRY ───────────────────────────────────────────────────────────
create table if not exists guardian.enforcement_policy (
  policy_id       text primary key,
  product         text not null default 'GUARDIAN' check (product='GUARDIAN'),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  title           text not null,
  authority_reference_type text not null check (authority_reference_type in ('REGULATORY_POLICY','STATUTORY_REFERENCE','COURT_ORDER_REFERENCE','LICENSING_CONDITION','INTERNAL_REGULATOR_DELEGATION','EMERGENCY_AUTHORITY_REFERENCE','OTHER')),
  authority_reference text,
  status          text not null default 'DRAFT' check (status in ('DRAFT','UNDER_REVIEW','APPROVED_FOR_SYNTHETIC_USE','ACTIVE','SUSPENDED','SUPERSEDED','EXPIRED','WITHDRAWN')),
  is_synthetic    boolean not null default true check (is_synthetic),
  registered_by   text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists guardian.policy_version (
  version_id      text primary key,
  policy_id       text not null references guardian.enforcement_policy(policy_id),
  version_no      integer not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  status          text not null default 'DRAFT' check (status in ('DRAFT','UNDER_REVIEW','APPROVED_FOR_SYNTHETIC_USE','ACTIVE','SUSPENDED','SUPERSEDED','EXPIRED','WITHDRAWN')),
  source_reference text,
  source_as_of    timestamptz,
  effective_from  timestamptz,
  effective_until timestamptz,
  supersedes_version_id text references guardian.policy_version(version_id),
  content_hash    text,
  registered_by   text not null,
  reviewed_by     text,
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now(),
  unique (policy_id, version_no)
);

create table if not exists guardian.policy_action_permission (
  permission_id   text primary key,
  version_id      text not null references guardian.policy_version(version_id),
  action_type     text not null check (action_type in ('DOMAIN_BLOCK','DNS_POLICY','HOSTING_REFERRAL','REGISTRAR_REFERRAL','APP_PLATFORM_REFERRAL','PAYMENT_REFERRAL','GEO_RESTRICTION','MONITOR_ONLY')),
  permitted       boolean not null default false,
  review_required boolean not null default true,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction)
);

create table if not exists guardian.policy_condition (
  condition_id    text primary key,
  version_id      text not null references guardian.policy_version(version_id),
  condition_type  text not null check (condition_type in ('MIN_EVIDENCE_TYPES','REQUIRED_LEGAL_REVIEW','REQUIRED_CASE_STATE','TARGET_JURISDICTION','AUTHORISATION_ROLE','MAX_AUTHORISATION_DURATION','RE_REVIEW_INTERVAL')),
  condition_value text,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction)
);

create table if not exists guardian.policy_exception (
  exception_id    text primary key,
  version_id      text not null references guardian.policy_version(version_id),
  exception_type  text not null check (exception_type in ('COURT_REVIEW_REQUIRED','CROSS_JURISDICTION_REVIEW','INSUFFICIENT_AUTHORITY','EXEMPT_CATEGORY','MANUAL_ESCALATION_REQUIRED')),
  routing         text,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction)
);

create table if not exists guardian.policy_review_record (
  review_id       text primary key,
  policy_id       text not null references guardian.enforcement_policy(policy_id),
  version_id      text references guardian.policy_version(version_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  reviewer        text not null,
  reviewer_role   text not null,
  outcome         text check (outcome in ('APPROVED_FOR_SYNTHETIC_USE','RETURNED','REJECTED')),
  effective_from  timestamptz,
  authority_reference text,
  is_synthetic    boolean not null default true check (is_synthetic),
  reviewed_at     timestamptz not null default now()
);

create table if not exists guardian.policy_status_history (
  history_id      text primary key,
  policy_id       text not null references guardian.enforcement_policy(policy_id),
  version_id      text,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  previous_status text,
  new_status      text not null,
  changed_by      text,
  reason          text,
  is_synthetic    boolean not null default true check (is_synthetic),
  changed_at      timestamptz not null default now()
);

-- ── AUTHORISATION WORKFLOW ────────────────────────────────────────────────────
create table if not exists guardian.proposed_action (
  proposed_action_id text primary key,
  case_reference  text not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  action_type     text not null check (action_type in ('DOMAIN_BLOCK','DNS_POLICY','HOSTING_REFERRAL','REGISTRAR_REFERRAL','APP_PLATFORM_REFERRAL','PAYMENT_REFERRAL','GEO_RESTRICTION','MONITOR_ONLY')),
  target_type     text not null check (target_type in ('DOMAIN','MOBILE_APP','MERCHANT','PAYMENT_CHANNEL','GEO_SERVICE_REFERENCE','OPERATOR','OTHER')),
  target_reference text not null,
  version_id      text references guardian.policy_version(version_id),
  evidence_package_reference text,
  evidence_manifest_hash text,
  proposed_by     text not null,
  status          text not null default 'DRAFT' check (status in ('DRAFT','READY_FOR_LEGAL_REVIEW','LEGAL_REVIEW_REQUIRED','LEGAL_REVIEW_COMPLETE','READY_FOR_AUTHORISATION','AUTHORISED','DECLINED','WITHDRAWN','EXPIRED')),
  reason_codes    jsonb not null default '[]'::jsonb,
  correlation_id  text,
  is_synthetic    boolean not null default true check (is_synthetic),
  idempotency_key text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (jurisdiction, idempotency_key)
);

create table if not exists guardian.legal_review (
  review_id       text primary key,
  proposed_action_id text not null references guardian.proposed_action(proposed_action_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  reviewer_principal text not null,
  reviewer_role   text not null,
  outcome         text check (outcome in ('SUFFICIENT_FOR_AUTHORISATION_REVIEW','INSUFFICIENT_EVIDENCE','POLICY_NOT_APPLICABLE','AUTHORITY_NOT_ESTABLISHED','JURISDICTION_MISMATCH','RETURN_TO_INVESTIGATION','ADDITIONAL_INFORMATION_REQUIRED')),
  comments_reference text,
  requested_at    timestamptz not null default now(),
  completed_at    timestamptz,
  audit_reference text,
  is_enforcement_execution boolean not null default false check (is_enforcement_execution = false),
  is_synthetic    boolean not null default true check (is_synthetic)
);

create table if not exists guardian.action_authorisation (
  authorisation_id text primary key,
  proposed_action_id text not null references guardian.proposed_action(proposed_action_id),
  case_reference  text not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  version_id      text references guardian.policy_version(version_id),
  authority_reference text,
  authorising_officer text not null,
  authorising_role text not null,
  authorised_at   timestamptz,
  expires_at      timestamptz,
  authorisation_status text not null default 'PENDING' check (authorisation_status in ('PENDING','AUTHORISED','DECLINED','WITHDRAWN','EXPIRED','SUPERSEDED')),
  scope_snapshot  jsonb not null default '{}'::jsonb,
  evidence_manifest_reference text,
  evidence_manifest_hash text,
  conditions      jsonb not null default '[]'::jsonb,
  reason_codes    jsonb not null default '[]'::jsonb,
  audit_reference text,
  -- SAFETY INVARIANTS: C8 authorises but NEVER executes or notifies a provider.
  is_external_action_executed boolean not null default false check (is_external_action_executed = false),
  is_provider_notified boolean not null default false check (is_provider_notified = false),
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

create table if not exists guardian.authorisation_history (
  history_id      text primary key,
  authorisation_id text not null references guardian.action_authorisation(authorisation_id),
  proposed_action_id text,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  previous_status text,
  new_status      text not null,
  actor           text,
  actor_role      text,
  reason          text,
  is_synthetic    boolean not null default true check (is_synthetic),
  changed_at      timestamptz not null default now()
);

create table if not exists guardian.proposed_action_history (
  history_id      text primary key,
  proposed_action_id text not null references guardian.proposed_action(proposed_action_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  previous_status text,
  new_status      text not null,
  actor           text,
  reason_codes    jsonb,
  is_synthetic    boolean not null default true check (is_synthetic),
  changed_at      timestamptz not null default now()
);

-- ── Append-only guard for the four history tables ─────────────────────────────
create or replace function guardian.policy_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian policy/authorisation append-only table: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.policy_block_mutation() from public;

do $$
declare t text; tables text[] := array['policy_status_history','authorisation_history','proposed_action_history','policy_review_record','legal_review'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.policy_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'enforcement_policy','policy_version','policy_action_permission','policy_condition','policy_exception',
  'policy_review_record','policy_status_history','proposed_action','legal_review','action_authorisation',
  'authorisation_history','proposed_action_history'];
begin
  foreach t in array tables loop
    execute format('alter table guardian.%I enable row level security', t);
    execute format('grant select, insert on guardian.%I to authenticated, service_role', t);
    execute format('drop policy if exists g_%s_read on guardian.%I', t, t);
    execute format($f$create policy g_%1$s_read on guardian.%1$I for select to authenticated
      using ( jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') )$f$, t);
    execute format('drop policy if exists g_%s_insert on guardian.%I', t, t);
    execute format($f$create policy g_%1$s_insert on guardian.%1$I for insert to authenticated
      with check ( jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') )$f$, t);
  end loop;
end $$;

-- ── SYNTHETIC SEED (idempotent) — one ACTIVE + one EXPIRED + one SUPERSEDED policy ─
insert into guardian.enforcement_policy (policy_id, jurisdiction, title, authority_reference_type, authority_reference, status, registered_by) values
  ('POL-SYNTH-0001','ZA-GP','Synthetic domain-review authorisation policy','REGULATORY_POLICY','SYN-AUTH-REF-0001','ACTIVE','syn-poladmin'),
  ('POL-SYNTH-0002','ZA-GP','Synthetic expired policy','REGULATORY_POLICY','SYN-AUTH-REF-0002','EXPIRED','syn-poladmin'),
  ('POL-SYNTH-0100','ZA-WC','Synthetic western policy','LICENSING_CONDITION','SYN-AUTH-REF-0100','ACTIVE','syn-poladmin-wc')
  on conflict (policy_id) do nothing;

insert into guardian.policy_version (version_id, policy_id, version_no, jurisdiction, status, source_reference, effective_from, effective_until, content_hash, registered_by, reviewed_by) values
  ('POLV-0001-1','POL-SYNTH-0001',1,'ZA-GP','ACTIVE','SyntheticPolicySource','2026-01-01T00:00:00Z','2027-12-31T00:00:00Z',repeat('1',64),'syn-poladmin','syn-leg-001'),
  ('POLV-0002-1','POL-SYNTH-0002',1,'ZA-GP','EXPIRED','SyntheticPolicySource','2020-01-01T00:00:00Z','2023-12-31T00:00:00Z',repeat('2',64),'syn-poladmin','syn-leg-001'),
  ('POLV-0100-1','POL-SYNTH-0100',1,'ZA-WC','ACTIVE','SyntheticPolicySource','2026-01-01T00:00:00Z','2027-12-31T00:00:00Z',repeat('c',64),'syn-poladmin-wc','syn-leg-wc')
  on conflict (version_id) do nothing;

insert into guardian.policy_action_permission (permission_id, version_id, action_type, permitted, review_required, jurisdiction) values
  ('PAP-0001-DOMAIN','POLV-0001-1','DOMAIN_BLOCK',true,true,'ZA-GP'),
  ('PAP-0001-MONITOR','POLV-0001-1','MONITOR_ONLY',true,false,'ZA-GP'),
  ('PAP-0001-PAY','POLV-0001-1','PAYMENT_REFERRAL',false,true,'ZA-GP')
  on conflict (permission_id) do nothing;

insert into guardian.policy_condition (condition_id, version_id, condition_type, condition_value, jurisdiction) values
  ('PCON-0001-EV','POLV-0001-1','MIN_EVIDENCE_TYPES','1','ZA-GP'),
  ('PCON-0001-REV','POLV-0001-1','REQUIRED_LEGAL_REVIEW','true','ZA-GP'),
  ('PCON-0001-DUR','POLV-0001-1','MAX_AUTHORISATION_DURATION','P90D','ZA-GP')
  on conflict (condition_id) do nothing;

insert into guardian.policy_status_history (history_id, policy_id, version_id, jurisdiction, previous_status, new_status, changed_by, reason) values
  ('PSH-0001-1','POL-SYNTH-0001','POLV-0001-1','ZA-GP',null,'ACTIVE','syn-leg-001','synthetic activation review')
  on conflict (history_id) do nothing;
