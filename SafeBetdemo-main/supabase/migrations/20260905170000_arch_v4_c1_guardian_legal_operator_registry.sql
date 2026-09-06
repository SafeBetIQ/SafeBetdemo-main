-- ─── ARCH-V4-C1 — SafeBet Guardian Legal Operator Registry + entity model ─────
-- Guardian's trusted legal/reference layer (SYNTHETIC ONLY). Answers WHO the entity
-- is, WHICH brand/regulator/licence applies, WHAT standing is recorded, WHAT source
-- supports it, and WHEN it was valid — WITHOUT deciding whether any site/app/payment
-- is illegal. ABSENCE FROM REGISTRY != ILLEGAL (enforced in code + tests).
--
-- All objects live in the dedicated `guardian` schema (never public, never IQ tables,
-- never legacy guardian_/guardianlayer_). No SECURITY DEFINER functions. No anon/public
-- grants. RLS scopes every row by jurisdiction claim + access_scope. Effective-dating +
-- status history are append-only (no destructive overwrite). Staging is separated from
-- the authoritative registry. Reversible: DROP of these objects (see runbook).
--
-- Source authority + real-integration posture: seeded data is SYNTHETIC_TEST only.
-- No NGB/PLA connection exists. Any adapter = PROPOSED — NO LIVE REGULATOR INTEGRATION.

-- ── Reference: regulatory authority ───────────────────────────────────────────
create table if not exists guardian.regulatory_authority (
  authority_id   text primary key,
  product        text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  name           text not null,
  authority_type text not null check (authority_type in ('NATIONAL','PROVINCIAL')),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  access_scope   text not null default 'NATIONAL_REFERENCE' check (access_scope in ('JURISDICTION_LOCAL','NATIONAL_REFERENCE','SHARED_REGULATORY_REFERENCE','RESTRICTED')),
  is_synthetic   boolean not null default true check (is_synthetic),
  created_at     timestamptz not null default now()
);

-- ── Registry source + source authority level ──────────────────────────────────
create table if not exists guardian.registry_source (
  source_id       text primary key,
  product         text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  source_type     text not null,
  authority       text,
  authority_level text not null check (authority_level in ('REGULATOR_AUTHORITATIVE','REGULATOR_SUPPLIED','VERIFIED_OFFICIAL_PUBLIC_RECORD','OPERATOR_SUPPLIED','THIRD_PARTY_REFERENCE','SYNTHETIC_TEST')),
  integration_state text not null default 'PROPOSED_NO_LIVE_INTEGRATION',
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

create table if not exists guardian.ingestion_batch (
  batch_id     text primary key,
  source_id    text not null references guardian.registry_source(source_id),
  jurisdiction text not null references guardian.jurisdiction(jurisdiction),
  status       text not null default 'INGESTED' check (status in ('INGESTED','VALIDATED','APPROVED','REJECTED')),
  actor        text,
  correlation_id text,
  created_at   timestamptz not null default now()
);

-- ── Authoritative operator entity (immutable Guardian id; external ids = attributes)
create table if not exists guardian.operator_entity (
  operator_id            text primary key,
  product                text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  legal_name             text not null,
  normalised_legal_name  text not null,
  registration_reference text,
  country                text,
  entity_type            text,
  jurisdiction           text not null references guardian.jurisdiction(jurisdiction),
  access_scope           text not null default 'JURISDICTION_LOCAL' check (access_scope in ('JURISDICTION_LOCAL','NATIONAL_REFERENCE','SHARED_REGULATORY_REFERENCE','RESTRICTED')),
  status                 text not null default 'ACTIVE',
  source_record_id       text,
  is_synthetic           boolean not null default true check (is_synthetic),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists guardian.operator_alias (
  alias_id         text primary key,
  operator_id      text not null references guardian.operator_entity(operator_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  alias_name       text not null,
  normalised_alias text not null,
  alias_type       text not null default 'TRADING_NAME',
  source_record_id text,
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now()
);

-- ── Brand (separate from legal entity) + historically-traceable relationship ──
create table if not exists guardian.brand (
  brand_id        text primary key,
  product         text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  brand_name      text not null,
  normalised_brand text not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  status          text not null default 'ACTIVE',
  source_record_id text,
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

create table if not exists guardian.operator_brand_relationship (
  relationship_id text primary key,
  operator_id     text not null references guardian.operator_entity(operator_id),
  brand_id        text not null references guardian.brand(brand_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  effective_from  timestamptz not null,
  effective_to    timestamptz,
  status          text not null default 'ACTIVE',
  source_record_id text,
  is_synthetic    boolean not null default true check (is_synthetic),
  recorded_at     timestamptz not null default now()
);

-- ── Licence (+ scope + append-only status history) ────────────────────────────
create table if not exists guardian.licence (
  licence_id         text primary key,
  licence_reference  text not null,
  operator_id        text not null references guardian.operator_entity(operator_id),
  issuing_authority_id text references guardian.regulatory_authority(authority_id),
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  licence_type       text not null,
  status             text not null check (status in ('LICENSED','EXPIRED','SUSPENDED','REVOKED','LAPSED','UNKNOWN')),
  effective_from     timestamptz,
  expiry_date        timestamptz,
  source_record_id   text,
  recorded_at        timestamptz not null default now(),
  last_verified_at   timestamptz,
  verification_state text not null default 'NOT_CURRENTLY_VERIFIED' check (verification_state in ('VERIFIED','NOT_CURRENTLY_VERIFIED','CONFLICTING_SOURCE_DATA','REQUIRES_HUMAN_REVIEW','UNKNOWN')),
  access_scope       text not null default 'JURISDICTION_LOCAL' check (access_scope in ('JURISDICTION_LOCAL','NATIONAL_REFERENCE','SHARED_REGULATORY_REFERENCE','RESTRICTED')),
  is_synthetic       boolean not null default true check (is_synthetic),
  -- deterministic duplicate guard: one authoritative record per (reference, authority, jurisdiction)
  unique (licence_reference, issuing_authority_id, jurisdiction)
);

create table if not exists guardian.licence_scope (
  scope_id          text primary key,
  licence_id        text not null references guardian.licence(licence_id),
  activity_category text,
  channel           text,
  jurisdiction      text not null references guardian.jurisdiction(jurisdiction),
  brand_id          text references guardian.brand(brand_id),
  applicability     text,
  conditions        jsonb not null default '{}'::jsonb,
  is_synthetic      boolean not null default true check (is_synthetic)
);

create table if not exists guardian.licence_status_history (
  history_id       text primary key,
  licence_id       text not null references guardian.licence(licence_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  previous_state   text,
  new_state        text not null,
  effective_at     timestamptz not null,
  recorded_at      timestamptz not null default now(),
  source_record_id text,
  actor            text,
  reason           text,
  correlation_id   text
);

-- ── Source record (provenance; body is a reference, never inline) ─────────────
create table if not exists guardian.registry_source_record (
  record_id          text primary key,
  source_id          text not null references guardian.registry_source(source_id),
  ingestion_batch_id text references guardian.ingestion_batch(batch_id),
  subject_type       text not null,
  subject_reference  text not null,
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  access_scope       text not null default 'JURISDICTION_LOCAL' check (access_scope in ('JURISDICTION_LOCAL','NATIONAL_REFERENCE','SHARED_REGULATORY_REFERENCE','RESTRICTED')),
  evidence_reference text,
  content_hash       text,
  retrieved_at       timestamptz,
  effective_at       timestamptz,
  recorded_at        timestamptz not null default now(),
  verification_status text not null default 'INGESTED' check (verification_status in ('INGESTED','VALIDATED','APPROVED','SUPERSEDED','REJECTED')),
  superseded_by      text references guardian.registry_source_record(record_id),
  asserted_state     text,
  is_synthetic       boolean not null default true check (is_synthetic)
);

-- ── Staging (separated from authoritative registry) ───────────────────────────
create table if not exists guardian.registry_staging (
  staging_id           text primary key,
  ingestion_batch_id   text not null references guardian.ingestion_batch(batch_id),
  jurisdiction         text not null references guardian.jurisdiction(jurisdiction),
  subject_type         text not null,
  raw_reference        text not null,
  normalised_reference text not null,
  match_state          text check (match_state in ('EXACT_MATCH','KNOWN_ALIAS_MATCH','MULTIPLE_CANDIDATES','NO_MATCH','REQUIRES_REVIEW')),
  status               text not null default 'STAGED' check (status in ('STAGED','VALIDATED','MATCHED','REVIEW','PUBLISHED','REJECTED')),
  is_synthetic         boolean not null default true check (is_synthetic),
  created_at           timestamptz not null default now()
);

-- ── Deterministic resolution result + human review ────────────────────────────
create table if not exists guardian.resolution_result (
  result_id         text primary key,
  jurisdiction      text not null references guardian.jurisdiction(jurisdiction),
  subject_reference text not null,
  match_state       text not null check (match_state in ('EXACT_MATCH','KNOWN_ALIAS_MATCH','MULTIPLE_CANDIDATES','NO_MATCH','REQUIRES_REVIEW')),
  candidate_ids     jsonb not null default '[]'::jsonb,
  resolved_operator_id text references guardian.operator_entity(operator_id),
  requires_review   boolean not null default false,
  correlation_id    text,
  created_at        timestamptz not null default now()
);

create table if not exists guardian.human_review_record (
  review_id        text primary key,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  subject_type     text not null,
  subject_reference text not null,
  reason           text not null,
  status           text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  assigned_role    text,
  resolved_by      text,
  resolution       text,
  correlation_id   text,
  created_at       timestamptz not null default now()
);

-- ── RLS: jurisdiction claim + access_scope. NATIONAL/SHARED reference is readable
--     cross-jurisdiction; JURISDICTION_LOCAL/RESTRICTED require the matching claim.
--     No anon/public grant. service_role (worker/admin) bypasses RLS as usual. ──
do $$
declare t text; tables text[] := array[
  'regulatory_authority','registry_source','ingestion_batch','operator_entity','operator_alias',
  'brand','operator_brand_relationship','licence','licence_scope','licence_status_history',
  'registry_source_record','registry_staging','resolution_result','human_review_record'];
begin
  foreach t in array tables loop
    execute format('alter table guardian.%I enable row level security', t);
    execute format('grant select, insert on guardian.%I to authenticated, service_role', t);
    execute format('drop policy if exists g_%s_read on guardian.%I', t, t);
  end loop;

  -- Tables carrying an access_scope column: scope-aware read policy. NATIONAL/SHARED
  -- reference is readable cross-jurisdiction ONLY by a Guardian principal (a session
  -- carrying a guardian_jurisdiction claim) — never by a non-Guardian (e.g. IQ) role.
  foreach t in array array['regulatory_authority','operator_entity','licence','registry_source_record'] loop
    execute format($f$
      create policy g_%1$s_read on guardian.%1$I for select to authenticated
      using (
        (access_scope in ('NATIONAL_REFERENCE','SHARED_REGULATORY_REFERENCE')
          and (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') is not null)
        or jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction')
      )$f$, t);
  end loop;

  -- Jurisdiction-local tables (no independent access_scope): strict claim match.
  foreach t in array array['registry_source','ingestion_batch','operator_alias','brand',
    'operator_brand_relationship','licence_scope','licence_status_history','registry_staging',
    'resolution_result','human_review_record'] loop
    if t = 'registry_source' then
      -- source registry has no jurisdiction column; it is shared regulatory reference,
      -- readable by any Guardian principal (claim present) but never a non-Guardian role.
      execute format($f$create policy g_%1$s_read on guardian.%1$I for select to authenticated
        using ((nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') is not null)$f$, t);
    else
      execute format($f$
        create policy g_%1$s_read on guardian.%1$I for select to authenticated
        using ( jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') )$f$, t);
    end if;
  end loop;
end $$;

-- ── SYNTHETIC SEED (idempotent) — demonstrates C1 scenarios 1..6 ───────────────
insert into guardian.regulatory_authority (authority_id, name, authority_type, jurisdiction, access_scope) values
  ('AUTH-ZA-NGB-TEST','National Gambling Board (SYNTHETIC TEST)','NATIONAL','ZA-GP','NATIONAL_REFERENCE'),
  ('AUTH-ZA-GP-PLA-TEST','Gauteng Gambling Board (SYNTHETIC TEST)','PROVINCIAL','ZA-GP','JURISDICTION_LOCAL'),
  ('AUTH-ZA-WC-PLA-TEST','Western Cape Gambling Board (SYNTHETIC TEST)','PROVINCIAL','ZA-WC','JURISDICTION_LOCAL')
  on conflict (authority_id) do nothing;

insert into guardian.registry_source (source_id, source_type, authority, authority_level) values
  ('SRC-SYNTHETIC-REGISTRY','SYNTHETIC_REGISTRY_ADAPTER','SYNTHETIC TEST','SYNTHETIC_TEST'),
  ('SRC-SYNTHETIC-CONFLICT-A','SYNTHETIC_REGISTRY_ADAPTER','SYNTHETIC TEST A','SYNTHETIC_TEST'),
  ('SRC-SYNTHETIC-CONFLICT-B','SYNTHETIC_REGISTRY_ADAPTER','SYNTHETIC TEST B','SYNTHETIC_TEST')
  on conflict (source_id) do nothing;

insert into guardian.ingestion_batch (batch_id, source_id, jurisdiction, status, actor) values
  ('BATCH-SYNTH-0001','SRC-SYNTHETIC-REGISTRY','ZA-GP','APPROVED','syn-registry-analyst')
  on conflict (batch_id) do nothing;

-- Scenario 1: licensed synthetic operator (exact match target)
insert into guardian.operator_entity (operator_id, legal_name, normalised_legal_name, registration_reference, country, entity_type, jurisdiction, status, source_record_id) values
  ('OP-SYNTH-0001','Synthetic Gaming Holdings (Pty) Ltd','synthetic gaming holdings pty ltd','REG-ZA-TEST-0001','ZA','PRIVATE_COMPANY','ZA-GP','ACTIVE','REC-SYNTH-0001'),
  ('OP-SYNTH-0009','Lapsed Play Synthetic Ltd','lapsed play synthetic ltd','REG-ZA-TEST-0009','ZA','PRIVATE_COMPANY','ZA-GP','ACTIVE','REC-SYNTH-0009'),
  ('OP-SYNTH-0002','Conflicted Operator Synthetic (Pty) Ltd','conflicted operator synthetic pty ltd','REG-ZA-TEST-0002','ZA','PRIVATE_COMPANY','ZA-GP','ACTIVE','REC-SYNTH-0002A'),
  ('OP-SYNTH-WC-0100','Western Synthetic Betting (Pty) Ltd','western synthetic betting pty ltd','REG-ZA-TEST-0100','ZA','PRIVATE_COMPANY','ZA-WC','ACTIVE','REC-SYNTH-0100')
  on conflict (operator_id) do nothing;

-- Scenario 2: brand → parent legal entity
insert into guardian.brand (brand_id, brand_name, normalised_brand, jurisdiction, status, source_record_id) values
  ('BRAND-SYNTH-0001','Safe Example Betting','safe example betting','ZA-GP','ACTIVE','REC-SYNTH-0001')
  on conflict (brand_id) do nothing;
insert into guardian.operator_brand_relationship (relationship_id, operator_id, brand_id, jurisdiction, effective_from, status, source_record_id) values
  ('OBR-SYNTH-0001','OP-SYNTH-0001','BRAND-SYNTH-0001','ZA-GP','2024-01-01T00:00:00Z','ACTIVE','REC-SYNTH-0001')
  on conflict (relationship_id) do nothing;
insert into guardian.operator_alias (alias_id, operator_id, jurisdiction, alias_name, normalised_alias, alias_type, source_record_id) values
  ('ALIAS-SYNTH-0001','OP-SYNTH-0001','ZA-GP','SGH Betting','sgh betting','TRADING_NAME','REC-SYNTH-0001')
  on conflict (alias_id) do nothing;

-- Licences: scenario 1 (LICENSED), scenario 3 (EXPIRED + history), scenario 5 (CONFLICTING)
insert into guardian.licence (licence_id, licence_reference, operator_id, issuing_authority_id, jurisdiction, licence_type, status, effective_from, expiry_date, source_record_id, last_verified_at, verification_state, access_scope) values
  ('LIC-SYNTH-0001','LIC-ZA-GP-TEST-0001','OP-SYNTH-0001','AUTH-ZA-GP-PLA-TEST','ZA-GP','ONLINE_BETTING','LICENSED','2024-01-01T00:00:00Z','2027-12-31T00:00:00Z','REC-SYNTH-0001','2026-09-01T00:00:00Z','VERIFIED','JURISDICTION_LOCAL'),
  ('LIC-SYNTH-0009','LIC-ZA-GP-TEST-0009','OP-SYNTH-0009','AUTH-ZA-GP-PLA-TEST','ZA-GP','ONLINE_BETTING','EXPIRED','2020-01-01T00:00:00Z','2023-12-31T00:00:00Z','REC-SYNTH-0009','2024-01-15T00:00:00Z','VERIFIED','JURISDICTION_LOCAL'),
  ('LIC-SYNTH-0002','LIC-ZA-GP-TEST-0002','OP-SYNTH-0002','AUTH-ZA-GP-PLA-TEST','ZA-GP','ONLINE_BETTING','UNKNOWN','2023-01-01T00:00:00Z','2026-12-31T00:00:00Z','REC-SYNTH-0002A',null,'CONFLICTING_SOURCE_DATA','JURISDICTION_LOCAL'),
  ('LIC-SYNTH-WC-0100','LIC-ZA-WC-TEST-0100','OP-SYNTH-WC-0100','AUTH-ZA-WC-PLA-TEST','ZA-WC','ONLINE_BETTING','LICENSED','2024-01-01T00:00:00Z','2027-12-31T00:00:00Z','REC-SYNTH-0100','2026-09-01T00:00:00Z','VERIFIED','JURISDICTION_LOCAL')
  on conflict (licence_reference, issuing_authority_id, jurisdiction) do nothing;

insert into guardian.licence_scope (scope_id, licence_id, activity_category, channel, jurisdiction, brand_id, applicability) values
  ('SCOPE-SYNTH-0001','LIC-SYNTH-0001','SPORTS_BETTING','ONLINE','ZA-GP','BRAND-SYNTH-0001','ONLINE_ONLY')
  on conflict (scope_id) do nothing;

-- Scenario 3: expired licence history (append-only)
insert into guardian.licence_status_history (history_id, licence_id, jurisdiction, previous_state, new_state, effective_at, source_record_id, actor, reason) values
  ('HIST-SYNTH-0009-A','LIC-SYNTH-0009','ZA-GP','LICENSED','LICENSED','2020-01-01T00:00:00Z','REC-SYNTH-0009','syn-registry-analyst','initial synthetic licence'),
  ('HIST-SYNTH-0009-B','LIC-SYNTH-0009','ZA-GP','LICENSED','EXPIRED','2024-01-01T00:00:00Z','REC-SYNTH-0009','syn-registry-analyst','synthetic expiry')
  on conflict (history_id) do nothing;

-- Scenario 5: conflicting source records (ACTIVE vs EXPIRED) → human review OPEN
insert into guardian.registry_source_record (record_id, source_id, ingestion_batch_id, subject_type, subject_reference, jurisdiction, evidence_reference, content_hash, retrieved_at, effective_at, verification_status, asserted_state) values
  ('REC-SYNTH-0001','SRC-SYNTHETIC-REGISTRY','BATCH-SYNTH-0001','LICENCE','LIC-ZA-GP-TEST-0001','ZA-GP','evref:syn-lic-0001',repeat('1',64),'2026-09-01T00:00:00Z','2026-09-01T00:00:00Z','APPROVED','LICENSED'),
  ('REC-SYNTH-0009','SRC-SYNTHETIC-REGISTRY','BATCH-SYNTH-0001','LICENCE','LIC-ZA-GP-TEST-0009','ZA-GP','evref:syn-lic-0009',repeat('9',64),'2024-01-15T00:00:00Z','2024-01-01T00:00:00Z','APPROVED','EXPIRED'),
  ('REC-SYNTH-0002A','SRC-SYNTHETIC-CONFLICT-A','BATCH-SYNTH-0001','LICENCE','LIC-ZA-GP-TEST-0002','ZA-GP','evref:syn-lic-0002a',repeat('a',64),'2026-08-01T00:00:00Z','2026-08-01T00:00:00Z','APPROVED','LICENSED'),
  ('REC-SYNTH-0002B','SRC-SYNTHETIC-CONFLICT-B','BATCH-SYNTH-0001','LICENCE','LIC-ZA-GP-TEST-0002','ZA-GP','evref:syn-lic-0002b',repeat('b',64),'2026-08-02T00:00:00Z','2026-08-02T00:00:00Z','APPROVED','EXPIRED'),
  ('REC-SYNTH-0100','SRC-SYNTHETIC-REGISTRY','BATCH-SYNTH-0001','LICENCE','LIC-ZA-WC-TEST-0100','ZA-WC','evref:syn-lic-0100',repeat('c',64),'2026-09-01T00:00:00Z','2026-09-01T00:00:00Z','APPROVED','LICENSED')
  on conflict (record_id) do nothing;

insert into guardian.human_review_record (review_id, jurisdiction, subject_type, subject_reference, reason, status, assigned_role, correlation_id) values
  ('REV-SYNTH-0002','ZA-GP','LICENCE','LIC-ZA-GP-TEST-0002','conflicting synthetic source records (LICENSED vs EXPIRED) — authoritative resolution required','OPEN','LEGAL_REVIEWER','corr-c1-conflict-0002')
  on conflict (review_id) do nothing;

insert into guardian.resolution_result (result_id, jurisdiction, subject_reference, match_state, candidate_ids, resolved_operator_id, requires_review, correlation_id) values
  ('RES-SYNTH-0001','ZA-GP','Synthetic Gaming Holdings (Pty) Ltd','EXACT_MATCH','["OP-SYNTH-0001"]','OP-SYNTH-0001',false,'corr-c1-match-0001'),
  ('RES-SYNTH-0002','ZA-GP','LIC-ZA-GP-TEST-0002','REQUIRES_REVIEW','["OP-SYNTH-0002"]',null,true,'corr-c1-conflict-0002')
  on conflict (result_id) do nothing;

