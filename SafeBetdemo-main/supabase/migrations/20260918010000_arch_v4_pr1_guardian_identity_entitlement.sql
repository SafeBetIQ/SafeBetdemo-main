-- ─── ARCH-V4-PR1 — Guardian Privileged Identity & Governed Entitlement ────────
-- Production-ready human-identity foundation (DEMO / test identities only). The Guardian
-- ROLE and permitted JURISDICTION originate ONLY from this governed, administratively-managed
-- entitlement — never from a request body, token custom claim, email domain, or org name. The
-- authenticated token subject (Cognito sub) is the key. Account state + effective window gate
-- access (suspension/disablement/expiry deny even with a valid token). Human-only: service
-- principals can NEVER hold a human role here (is_human CHECK). PR1 = synthetic/test identities
-- only (is_synthetic_test CHECK), clearly labelled NON-PRODUCTION. No new SECURITY DEFINER.

-- ── 1. IDENTITY ENTITLEMENT (governed role/jurisdiction/account-state) ─────────
create table if not exists guardian.identity_entitlement (
  entitlement_id   text primary key,
  subject          text not null,                 -- trusted token subject (Cognito sub); NOT an email
  identity_provider text not null,                -- issuer (Cognito user pool URL)
  guardian_role    text not null check (guardian_role in ('INVESTIGATOR','LEGAL_REVIEWER','AUTHORISING_OFFICER','POLICY_ADMINISTRATOR','GUARDIAN_ADMINISTRATOR')),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  account_state    text not null default 'INVITED' check (account_state in ('INVITED','ACTIVE','SUSPENDED','DISABLED','EXPIRED')),
  mfa_required     boolean not null default true,
  is_human         boolean not null default true check (is_human),        -- §31/§32 human-only
  effective_from   timestamptz,
  effective_until  timestamptz,
  -- Governed activation record (§13): who/what activated this entitlement + evidence.
  activated_by     text,
  activated_at     timestamptz,
  audit_reference  text,
  -- PR1: NON-PRODUCTION synthetic/test identities only (no real regulator staff).
  is_synthetic_test boolean not null default true check (is_synthetic_test),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (subject)
);
comment on table guardian.identity_entitlement is
  'ARCH-V4-PR1 governed Guardian role/jurisdiction entitlement keyed by trusted token subject. Authority source for role + permitted jurisdiction (never request-supplied). PR1 = synthetic/test identities only.';

-- ── 2. ENTITLEMENT CHANGE HISTORY — APPEND-ONLY (governed + audited) ──────────
create table if not exists guardian.identity_entitlement_history (
  history_id       text primary key,
  entitlement_id   text not null references guardian.identity_entitlement(entitlement_id),
  subject          text not null,
  change_type      text not null check (change_type in ('CREATED','ACTIVATED','SUSPENDED','DISABLED','EXPIRED','ROLE_CHANGED','JURISDICTION_CHANGED','REINSTATED')),
  previous_state   text,
  new_state        text,
  changed_by       text not null,                 -- activating/administrating principal (must itself be MFA-governed)
  reason           text,
  changed_at       timestamptz not null default now(),
  is_synthetic_test boolean not null default true check (is_synthetic_test)
);

-- Append-only guard for the entitlement history.
create or replace function guardian.identity_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian identity history is append-only: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.identity_block_mutation() from public;
drop trigger if exists identity_entitlement_history_append_only on guardian.identity_entitlement_history;
create trigger identity_entitlement_history_append_only before update or delete
  on guardian.identity_entitlement_history for each row execute function guardian.identity_block_mutation();

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
alter table guardian.identity_entitlement enable row level security;
alter table guardian.identity_entitlement_history enable row level security;
-- Administrative access via service_role only (governed entitlement management).
grant select, insert, update on guardian.identity_entitlement to service_role;
grant select, insert on guardian.identity_entitlement_history to service_role;

-- ── 4. DEDICATED LEAST-PRIVILEGE RESOLVER ROLE (API entitlement lookup) ────────
-- The Guardian API authenticates a request by looking up the entitlement for a trusted
-- subject. It gets a SEPARATE read-only role: SELECT on identity_entitlement + INSERT on
-- audit_context (login/auth audit) ONLY. No UPDATE/DELETE, no other table, no BYPASSRLS.
-- Secret-free: role created WITHOUT a password; login password set out-of-band + Secrets Mgr.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_identity_resolver') then
    create role guardian_identity_resolver login;
  end if;
end $$;
grant usage on schema guardian to guardian_identity_resolver;
grant select on guardian.identity_entitlement to guardian_identity_resolver;
grant select, insert on guardian.audit_context to guardian_identity_resolver;

-- The resolver must read any subject to authenticate it (entitlement is the authority source,
-- not a jurisdiction-partitioned business table). Read-only + INSERT-only audit; no mutation.
drop policy if exists idr_entitlement_sel on guardian.identity_entitlement;
create policy idr_entitlement_sel on guardian.identity_entitlement for select to guardian_identity_resolver using ( true );
drop policy if exists idr_audit_ins on guardian.audit_context;
create policy idr_audit_ins on guardian.audit_context for insert to guardian_identity_resolver with check ( true );
