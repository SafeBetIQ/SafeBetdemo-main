-- ─── ARCH-V4-C5 — SafeBet Guardian Geo & Jurisdiction Intelligence foundation ─
-- Property / service / jurisdiction-level intelligence. SYNTHETIC ONLY. Flow:
--   geo/jurisdiction signal → validate source → normalise region/reference →
--   link to domain/app/operator/payment subjects (GOVERNED CONTRACTS) → compare
--   expected legal jurisdiction → structured NON-LEGAL, NON-ENFORCEMENT result →
--   human review.
--
-- CORE PRIVACY BOUNDARY:  GEO INTELLIGENCE != INDIVIDUAL SURVEILLANCE.
--   Default data unit is PROPERTY / SERVICE / DOMAIN / APP / OPERATOR / AGGREGATE
--   REGION — never a PERSON. There is deliberately NO person entity and NO
--   person-level column (no player_id / customer_id / subscriber_id / device
--   advertising id / mobile_number / individual ip history / browsing history /
--   precise persistent personal geolocation) anywhere in this schema.
--
-- LEGAL-SAFETY INVARIANTS (encoded + tested; DB CHECKs):
--   SERVICE OBSERVED IN REGION           != ILLEGAL OPERATION
--   SERVICE AVAILABLE ACROSS JURISDICTION != LEGAL VIOLATION
--   LICENCE JURISDICTION MISMATCH        != FINAL LEGAL FINDING
--   UNKNOWN GEO SIGNAL                   != ILLEGAL
--   HIGH REVIEW PRIORITY                 != ENFORCEMENT AUTHORISATION
--   No availability state ILLEGAL_IN_REGION. A comparison-table CHECK forbids
--   is_illegal_determination=true AND is_enforcement_authorised=true.
--
-- All in the dedicated `guardian` schema. Immutable Guardian keys. No SafeBet IQ
-- public business table is referenced.

-- ── 1. GEO REGION — region modelled independently of a person. Guardian IDs. ──
create table if not exists guardian.geo_region (
  region_id       text primary key,
  product         text not null default 'GUARDIAN' check (product='GUARDIAN'),
  country         text not null,
  region_type     text not null check (region_type in ('COUNTRY','PROVINCE','STATE','REGULATORY_JURISDICTION','MUNICIPALITY','REGION')),
  region_code     text not null,
  region_name     text,
  parent_region_id text references guardian.geo_region(region_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

-- ── 2. GEO SOURCE — only lawful/public/regulator-approved signal categories. ──
create table if not exists guardian.geo_source (
  source_id       text primary key,
  source_name     text not null,
  source_type     text not null check (source_type in (
                    'DECLARED_SERVICE_JURISDICTION','LICENCE_JURISDICTION','REGIONAL_AVAILABILITY_FIXTURE',
                    'APP_TERRITORY_FIXTURE','PAYMENT_CHANNEL_JURISDICTION','HOSTING_REGION_REFERENCE',
                    'REGULATOR_AGGREGATE_OBSERVATION','SYNTHETIC_NETWORK_LOCATION','ACCESSIBILITY_OBSERVATION',
                    'AGGREGATE_REGION_VISIBILITY')),
  authority_level text not null default 'SYNTHETIC_TEST' check (authority_level='SYNTHETIC_TEST'),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

-- ── 3. GEO SIGNAL — aggregate/region-level signal instances (no person-level). ─
create table if not exists guardian.geo_signal (
  signal_id       text primary key,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  region_id       text references guardian.geo_region(region_id),
  source_id       text references guardian.geo_source(source_id),
  signal_class    text not null check (signal_class in (
                    'DECLARED_SERVICE_JURISDICTION','LICENCE_JURISDICTION','DOMAIN_REGIONAL_AVAILABILITY',
                    'APP_DECLARED_TERRITORY','PAYMENT_CHANNEL_JURISDICTION','HOSTING_SERVICE_REGION',
                    'REGULATOR_AGGREGATE_REGIONAL_OBSERVATION','SYNTHETIC_NETWORK_LOCATION_METADATA',
                    'SYNTHETIC_ACCESSIBILITY_OBSERVATION','AGGREGATE_REGION_VISIBILITY_METRIC')),
  signal_category text,                     -- neutral category/token (never a person)
  aggregate_metric numeric,                 -- region-level aggregate only (e.g. visibility index)
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

-- ── 4. GEO SUBJECT — references a SERVICE/PROPERTY, never a person. ────────────
create table if not exists guardian.geo_subject (
  geo_subject_id  text primary key,
  product         text not null default 'GUARDIAN' check (product='GUARDIAN'),
  subject_type    text not null check (subject_type in ('DOMAIN','MOBILE_APP','OPERATOR','BRAND','PAYMENT_CHANNEL','SERVICE','INFRASTRUCTURE_REFERENCE')),
  subject_reference text not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  source_reference text,
  is_synthetic    boolean not null default true check (is_synthetic),
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (subject_reference, jurisdiction)
);

-- ── 5. GEO OBSERVATION — APPEND-ONLY. No person-level location. ────────────────
create table if not exists guardian.geo_observation (
  observation_id  text primary key,
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  region_id       text not null references guardian.geo_region(region_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  observed_at     timestamptz not null default now(),
  observation_type text not null default 'REGIONAL_AVAILABILITY',
  availability_state text not null check (availability_state in ('AVAILABLE','NOT_OBSERVED','RESTRICTED_BY_FIXTURE','UNKNOWN','INCONSISTENT','REQUIRES_REVIEW')),
  source          text,
  confidence_category text not null default 'UNKNOWN' check (confidence_category in ('LOW','MEDIUM','HIGH','UNKNOWN')),
  evidence_reference text,
  content_hash    text,
  idempotency_key text,
  source_as_of    timestamptz,
  status          text not null default 'PROCESSED',
  is_synthetic    boolean not null default true check (is_synthetic),
  unique (geo_subject_id, idempotency_key)
);

-- ── 6. GEO SERVICE AVAILABILITY — derived current availability per subject/region.
create table if not exists guardian.geo_service_availability (
  availability_id text primary key,
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  region_id       text not null references guardian.geo_region(region_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  availability_state text not null check (availability_state in ('AVAILABLE','NOT_OBSERVED','RESTRICTED_BY_FIXTURE','UNKNOWN','INCONSISTENT','REQUIRES_REVIEW')),
  expected_regulatory_jurisdiction text,
  observed_at     timestamptz not null default now(),
  source_as_of    timestamptz,
  is_synthetic    boolean not null default true check (is_synthetic),
  unique (geo_subject_id, region_id)
);

-- ── 7. GEO REGISTRY COMPARISON — structured NON-LEGAL, NON-ENFORCEMENT result. ─
create table if not exists guardian.geo_registry_comparison (
  comparison_id   text primary key,
  observation_id  text not null references guardian.geo_observation(observation_id),
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  region_id       text not null references guardian.geo_region(region_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  expected_regulatory_jurisdiction text,
  observed_availability_state text not null,
  registry_match_state text not null check (registry_match_state in ('EXACT_MATCH','KNOWN_ALIAS_MATCH','MULTIPLE_CANDIDATES','NO_MATCH','REQUIRES_REVIEW')),
  resolution_state text not null check (resolution_state in ('MATCHED_AUTHORITATIVE','MATCHED_BUT_STALE','MULTIPLE_MATCHES','NO_MATCH','SOURCE_CONFLICT','REQUIRES_REVIEW')),
  candidate_operator_id text,
  licence_reference text,
  licence_jurisdiction text,
  domain_reference_state text,
  app_reference_state text,
  payment_reference_state text,
  review_priority text not null default 'LOW_REVIEW_PRIORITY' check (review_priority in ('LOW_REVIEW_PRIORITY','MEDIUM_REVIEW_PRIORITY','HIGH_REVIEW_PRIORITY')),
  review_required boolean not null default false,
  reason_codes    jsonb not null default '[]'::jsonb,
  freshness       text,
  is_illegal_determination boolean not null default false check (is_illegal_determination = false),
  is_enforcement_authorised boolean not null default false check (is_enforcement_authorised = false),
  created_at      timestamptz not null default now()
);

-- ── 8. GEO ENTITY LINK — cross-domain links via governed contracts only. ──────
create table if not exists guardian.geo_entity_link (
  link_id         text primary key,
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  link_type       text not null check (link_type in ('OPERATOR','BRAND','LICENCE','DOMAIN','APP','PAYMENT')),
  target_reference text not null,
  relationship_type text not null default 'OBSERVED_REFERENCE',
  confidence      text not null default 'LOW' check (confidence in ('LOW','MEDIUM','HIGH')),
  source          text,
  observed_at     timestamptz not null default now(),
  human_confirmed boolean not null default false,
  audit_reference text,
  is_synthetic    boolean not null default true check (is_synthetic)
);

-- ── 9. GEO REVIEW ITEM — bounded human-review states/decisions only. ──────────
create table if not exists guardian.geo_review_item (
  review_id       text primary key,
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  state           text not null default 'NEW' check (state in ('NEW','TRIAGED','REQUIRES_REVIEW','VERIFIED_REFERENCE','UNRESOLVED','CLOSED')),
  review_priority text not null default 'LOW_REVIEW_PRIORITY',
  reason_codes    jsonb not null default '[]'::jsonb,
  decision        text check (decision in ('REFERENCE_MATCH_CONFIRMED','REGION_REFERENCE_CONFIRMED','SOURCE_DATA_INSUFFICIENT','INCONSISTENCY_CONFIRMED','REQUIRES_FURTHER_INVESTIGATION','FALSE_POSITIVE','DUPLICATE_SUBJECT')),
  assigned_role   text,
  correlation_id  text,
  created_at      timestamptz not null default now()
);

-- ── 10. GEO CHANGE HISTORY — APPEND-ONLY; prior state preserved. ──────────────
create table if not exists guardian.geo_change_history (
  history_id      text primary key,
  geo_subject_id  text not null references guardian.geo_subject(geo_subject_id),
  region_id       text references guardian.geo_region(region_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  change_type     text not null,
  previous_state  text,
  new_state       text,
  previous_hash   text,
  new_hash        text,
  observation_id  text,
  recorded_at     timestamptz not null default now()
);

-- ── Append-only guard for observation + change history (no destructive overwrite).
create or replace function guardian.geo_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian geo append-only table: % not permitted', tg_op;
end;
$fn$;
-- Keep the estate baseline clean: this is a trigger-only guard (SECURITY INVOKER); it is
-- never called directly. Revoke the default PUBLIC EXECUTE so no anon/PUBLIC grant is added.
revoke all on function guardian.geo_block_mutation() from public;

do $$
declare t text; tables text[] := array['geo_observation','geo_change_history'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.geo_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'geo_region','geo_source','geo_signal','geo_subject','geo_observation','geo_service_availability',
  'geo_registry_comparison','geo_entity_link','geo_review_item','geo_change_history'];
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

-- ── SYNTHETIC SEED (idempotent) — regions, sources, signals, scenarios 1..3,13 ─
insert into guardian.geo_region (region_id, country, region_type, region_code, region_name, parent_region_id, jurisdiction) values
  ('RGN-ZA-GP','ZA','REGULATORY_JURISDICTION','ZA-GP','Gauteng regulatory jurisdiction (synthetic)', null,'ZA-GP'),
  ('RGN-ZA-GP-PROV','ZA','PROVINCE','ZA-GP-PROV','Gauteng province (synthetic)','RGN-ZA-GP','ZA-GP'),
  ('RGN-ZA-WC','ZA','REGULATORY_JURISDICTION','ZA-WC','Western Cape regulatory jurisdiction (synthetic)', null,'ZA-WC')
  on conflict (region_id) do nothing;

insert into guardian.geo_source (source_id, source_name, source_type, jurisdiction) values
  ('GSRC-DECL-ZA-GP','Synthetic declared service jurisdiction','DECLARED_SERVICE_JURISDICTION','ZA-GP'),
  ('GSRC-AVAIL-ZA-GP','Synthetic regional availability fixture','REGIONAL_AVAILABILITY_FIXTURE','ZA-GP'),
  ('GSRC-AGG-ZA-GP','Synthetic aggregate region visibility','AGGREGATE_REGION_VISIBILITY','ZA-GP'),
  ('GSRC-AVAIL-ZA-WC','Synthetic regional availability fixture (WC)','REGIONAL_AVAILABILITY_FIXTURE','ZA-WC')
  on conflict (source_id) do nothing;

insert into guardian.geo_signal (signal_id, jurisdiction, region_id, source_id, signal_class, signal_category, aggregate_metric) values
  ('GSIG-0001','ZA-GP','RGN-ZA-GP','GSRC-DECL-ZA-GP','DECLARED_SERVICE_JURISDICTION','DECLARED', null),
  ('GSIG-0013','ZA-GP','RGN-ZA-GP','GSRC-AGG-ZA-GP','AGGREGATE_REGION_VISIBILITY_METRIC','AGGREGATE', 42)
  on conflict (signal_id) do nothing;

insert into guardian.geo_subject (geo_subject_id, subject_type, subject_reference, jurisdiction, source_reference) values
  ('GEO-SYNTH-0001','SERVICE','licensed-example-003.test','ZA-GP','SyntheticGeoSourceAdapter'),
  ('GEO-SYNTH-0002','SERVICE','mismatch-region-005.test','ZA-GP','SyntheticGeoSourceAdapter'),
  ('GEO-SYNTH-0003','SERVICE','unknown-region-004.test','ZA-GP','SyntheticGeoSourceAdapter'),
  ('GEO-SYNTH-WC-0100','SERVICE','western-region-100.test','ZA-WC','SyntheticGeoSourceAdapter')
  on conflict (geo_subject_id) do nothing;

insert into guardian.geo_observation (observation_id, geo_subject_id, region_id, jurisdiction, observation_type, availability_state, source, confidence_category, evidence_reference, content_hash, idempotency_key, source_as_of) values
  ('GOBS-0001-A','GEO-SYNTH-0001','RGN-ZA-GP','ZA-GP','REGIONAL_AVAILABILITY','AVAILABLE','SyntheticGeoSourceAdapter','HIGH','evref:gobs-0001-a',repeat('1',64),'gidem-0001-a','2026-09-01T00:00:00Z'),
  ('GOBS-0003-A','GEO-SYNTH-0003','RGN-ZA-GP','ZA-GP','REGIONAL_AVAILABILITY','UNKNOWN','SyntheticGeoSourceAdapter','LOW','evref:gobs-0003-a',repeat('3',64),'gidem-0003-a','2026-09-01T00:00:00Z')
  on conflict (observation_id) do nothing;

insert into guardian.geo_service_availability (availability_id, geo_subject_id, region_id, jurisdiction, availability_state, expected_regulatory_jurisdiction, source_as_of) values
  ('GAVL-0001','GEO-SYNTH-0001','RGN-ZA-GP','ZA-GP','AVAILABLE','ZA-GP','2026-09-01T00:00:00Z')
  on conflict (geo_subject_id, region_id) do nothing;

insert into guardian.geo_registry_comparison (comparison_id, observation_id, geo_subject_id, region_id, jurisdiction, expected_regulatory_jurisdiction, observed_availability_state, registry_match_state, resolution_state, candidate_operator_id, licence_reference, licence_jurisdiction, domain_reference_state, review_priority, review_required, reason_codes, freshness) values
  ('GCMP-0001-A','GOBS-0001-A','GEO-SYNTH-0001','RGN-ZA-GP','ZA-GP','ZA-GP','AVAILABLE','KNOWN_ALIAS_MATCH','MATCHED_AUTHORITATIVE','OP-SYNTH-0001','LIC-ZA-GP-TEST-0001','ZA-GP','REFERENCED','LOW_REVIEW_PRIORITY',false,'[]'::jsonb,'FRESH'),
  ('GCMP-0003-A','GOBS-0003-A','GEO-SYNTH-0003','RGN-ZA-GP','ZA-GP','ZA-GP','UNKNOWN','NO_MATCH','NO_MATCH',null,null,null,null,'HIGH_REVIEW_PRIORITY',true,'["NO_AUTHORITATIVE_REGISTRY_MATCH","UNKNOWN_REGION_REFERENCE"]'::jsonb,'UNKNOWN')
  on conflict (comparison_id) do nothing;

insert into guardian.geo_entity_link (link_id, geo_subject_id, jurisdiction, link_type, target_reference, relationship_type, confidence, source) values
  ('GEL-0001-DOMAIN','GEO-SYNTH-0001','ZA-GP','DOMAIN','licensed-example-003.test','OBSERVED_REFERENCE','MEDIUM','SyntheticGeoSourceAdapter'),
  ('GEL-0001-OPERATOR','GEO-SYNTH-0001','ZA-GP','OPERATOR','OP-SYNTH-0001','OBSERVED_REFERENCE','MEDIUM','SyntheticGeoSourceAdapter')
  on conflict (link_id) do nothing;

insert into guardian.geo_review_item (review_id, geo_subject_id, jurisdiction, state, review_priority, reason_codes, assigned_role, correlation_id) values
  ('GREV-0003','GEO-SYNTH-0003','ZA-GP','REQUIRES_REVIEW','HIGH_REVIEW_PRIORITY','["NO_AUTHORITATIVE_REGISTRY_MATCH"]'::jsonb,'INVESTIGATOR','corr-c5-0003')
  on conflict (review_id) do nothing;

insert into guardian.geo_change_history (history_id, geo_subject_id, region_id, jurisdiction, change_type, new_state, new_hash, observation_id) values
  ('GCH-0001-1','GEO-SYNTH-0001','RGN-ZA-GP','ZA-GP','FIRST_OBSERVATION','AVAILABLE',repeat('1',64),'GOBS-0001-A')
  on conflict (history_id) do nothing;
