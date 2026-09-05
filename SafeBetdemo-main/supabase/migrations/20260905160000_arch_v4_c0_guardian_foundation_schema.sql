-- ─── ARCH-V4-C0 — SafeBet Guardian standalone data boundary ──────────────────
-- Guardian's independent data-ownership boundary is a DEDICATED `guardian` schema
-- (interim strangler; a separate database/project is the final target). Guardian
-- data NEVER lives in `public` and NEVER shares the SafeBet IQ business tables.
-- This is the clean C0 namespace — it does NOT reuse legacy public.guardian_* /
-- public.guardianlayer_* objects (those are IQ minor-protection / legacy).
--
-- SYNTHETIC DATA ONLY. No real regulator/provider integration. No SECURITY DEFINER
-- functions (no privileged-function regression). No PUBLIC/anon grants. RLS scopes
-- every row by product + jurisdiction (claim `guardian_jurisdiction`); service_role
-- (worker/admin) bypasses RLS as usual.
--
-- Reversible:  DROP SCHEMA guardian CASCADE;  (removes everything below cleanly;
--              no SafeBet IQ object is touched.)

create schema if not exists guardian;

-- Grants: authenticated (future synthetic Guardian principals via PostgREST) +
-- service_role (worker/admin). Deliberately NOT anon, NOT public.
grant usage on schema guardian to authenticated, service_role;

-- ── Service metadata (product registry) ──────────────────────────────────────
create table if not exists guardian.service_metadata (
  id             smallint primary key default 1,
  product        text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  schema_version text not null default 'c0',
  standalone     boolean not null default true,
  data_class     text not null default 'synthetic' check (data_class = 'synthetic'),
  mfa_required_for_real_privileged_use boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint guardian_service_singleton check (id = 1)
);

-- ── Jurisdiction registry ─────────────────────────────────────────────────────
create table if not exists guardian.jurisdiction (
  jurisdiction text primary key,
  display_name text not null,
  is_synthetic boolean not null default true check (is_synthetic),
  created_at   timestamptz not null default now()
);

-- ── Synthetic principal reference (C0: synthetic only) ────────────────────────
create table if not exists guardian.principal (
  principal_id text primary key,
  product      text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  role         text not null check (role in ('INVESTIGATOR','LEGAL_REVIEWER','AUTHORISING_OFFICER','EXTERNAL_PROVIDER','SYSTEM_SERVICE')),
  auth_assurance text not null default 'SYNTHETIC_TEST',
  is_synthetic boolean not null default true check (is_synthetic),
  created_at   timestamptz not null default now()
);

-- ── Case primitive ────────────────────────────────────────────────────────────
create table if not exists guardian.case (
  case_id      text primary key,
  product      text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  status       text not null default 'OPEN' check (status in ('OPEN','UNDER_REVIEW','CLOSED')),
  actor_principal_id text,
  correlation_id text not null,
  evidence_reference text,
  audit_reference    text,
  is_synthetic boolean not null default true check (is_synthetic),
  created_at   timestamptz not null default now()
);

-- ── Evidence reference (pointer + integrity hash; never the body) ─────────────
create table if not exists guardian.evidence_ref (
  evidence_id  text primary key,
  product      text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  case_reference text,
  classification text not null check (classification in ('PUBLIC','RESTRICTED','SENSITIVE')),
  integrity_hash text not null,
  retention_until timestamptz not null,
  access_purpose text not null,
  is_synthetic boolean not null default true check (is_synthetic),
  created_at   timestamptz not null default now()
);

-- ── Audit context linkage (product=GUARDIAN; chain scope guardian:<jurisdiction>) ─
create table if not exists guardian.audit_context (
  id           bigint generated always as identity primary key,
  product      text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  chain_scope  text not null,
  event_type   text not null,
  actor_principal_id text,
  correlation_id text not null,
  case_reference text,
  occurred_at  timestamptz not null default now()
);

-- ── Message / job metadata (queue namespace guardian-*) ───────────────────────
create table if not exists guardian.message (
  idempotency_key text primary key,
  product      text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  event_type   text not null,
  correlation_id text not null,
  payload_reference text not null,
  occurred_at  timestamptz not null default now()
);

-- ── Row-Level Security: product + jurisdiction scoping ────────────────────────
-- Claim carrier: request.jwt.claims ->> 'guardian_jurisdiction'. Missing/other-product
-- claims yield NULL → predicate false → deny. service_role bypasses RLS (worker/admin).
alter table guardian.service_metadata enable row level security;
alter table guardian.jurisdiction     enable row level security;
alter table guardian.principal         enable row level security;
alter table guardian."case"            enable row level security;
alter table guardian.evidence_ref      enable row level security;
alter table guardian.audit_context     enable row level security;
alter table guardian.message           enable row level security;

-- Service metadata + jurisdiction registry: readable by any authenticated Guardian
-- session (non-sensitive product metadata), still never anon.
drop policy if exists g_service_read on guardian.service_metadata;
create policy g_service_read on guardian.service_metadata for select to authenticated using (true);
drop policy if exists g_jurisdiction_read on guardian.jurisdiction;
create policy g_jurisdiction_read on guardian.jurisdiction for select to authenticated using (true);

-- Business tables: a session may see only rows whose jurisdiction equals its
-- guardian_jurisdiction claim (and product is always GUARDIAN by table constraint).
do $$
declare t text;
begin
  foreach t in array array['principal','case','evidence_ref','audit_context','message'] loop
    execute format($f$drop policy if exists g_%1$s_jur on guardian.%2$s$f$, replace(t,'"',''), case when t='case' then '"case"' else t end);
    execute format($f$
      create policy g_%1$s_jur on guardian.%2$s for select to authenticated
      using (
        jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction')
      )$f$, replace(t,'"',''), case when t='case' then '"case"' else t end);
  end loop;
end $$;

-- Per-table grants: SELECT/INSERT to authenticated + service_role only (RLS still
-- restricts rows for authenticated). NEVER anon, NEVER public.
grant select, insert on guardian.service_metadata, guardian.jurisdiction, guardian.principal,
  guardian."case", guardian.evidence_ref, guardian.audit_context, guardian.message
  to authenticated, service_role;
grant usage on all sequences in schema guardian to authenticated, service_role;

-- ── Synthetic seed (idempotent) — two jurisdictions to prove RLS isolation ────
insert into guardian.service_metadata (id) values (1) on conflict (id) do nothing;
insert into guardian.jurisdiction (jurisdiction, display_name) values
  ('ZA-GP','Gauteng (synthetic)'), ('ZA-WC','Western Cape (synthetic)')
  on conflict (jurisdiction) do nothing;
insert into guardian.principal (principal_id, jurisdiction, role) values
  ('syn-inv-za-gp','ZA-GP','INVESTIGATOR'), ('syn-inv-za-wc','ZA-WC','INVESTIGATOR')
  on conflict (principal_id) do nothing;
insert into guardian."case" (case_id, jurisdiction, correlation_id, actor_principal_id) values
  ('syn-case-za-gp','ZA-GP','corr-gp','syn-inv-za-gp'),
  ('syn-case-za-wc','ZA-WC','corr-wc','syn-inv-za-wc')
  on conflict (case_id) do nothing;
insert into guardian.evidence_ref (evidence_id, jurisdiction, case_reference, classification, integrity_hash, retention_until, access_purpose) values
  ('syn-ev-za-gp','ZA-GP','syn-case-za-gp','RESTRICTED', repeat('a',64), '2030-01-01T00:00:00Z','demo'),
  ('syn-ev-za-wc','ZA-WC','syn-case-za-wc','RESTRICTED', repeat('b',64), '2030-01-01T00:00:00Z','demo')
  on conflict (evidence_id) do nothing;
