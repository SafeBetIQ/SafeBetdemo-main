-- ─── ARCH-V4-C3 — SafeBet Guardian Mobile App Intelligence foundation ─────────
-- Provider-neutral. SYNTHETIC ONLY. Flow: app subject → normalise identity → capture
-- synthetic metadata/evidence → deterministic signals → resolve operator/brand/licence
-- → compare vs Legal Operator Registry (C1 contract) → structured NON-LEGAL result →
-- human review where required.
--
-- SAFETY INVARIANTS (encoded + tested; DB CHECK forbids is_illegal_determination=true):
--   APP DISCOVERED != ILLEGAL APP ; APP NOT IN REGISTRY != ILLEGAL OPERATOR
--   APP PLATFORM PRESENCE != LEGAL AUTHORISATION ; PLATFORM ABSENCE != ILLEGALITY
--   HIGH REVIEW PRIORITY != LEGAL FINDING ; DETECTION != ENFORCEMENT
-- Provider-neutral: no named app store/platform. No app removal / referral / enforcement.
-- All in the dedicated `guardian` schema. Immutable Guardian keys (NOT the package id).

create table if not exists guardian.mobile_app_subject (
  app_subject_id          text primary key,
  product                 text not null default 'GUARDIAN' check (product='GUARDIAN'),
  canonical_app_identifier text not null,
  display_name            text not null,
  platform_type           text not null default 'MOBILE_APP' check (platform_type in ('MOBILE_APP','MOBILE_WEB_WRAPPER','PROGRESSIVE_WEB_APP_REFERENCE','UNKNOWN_MOBILE_DISTRIBUTION')),
  developer_display_name   text,
  jurisdiction            text not null references guardian.jurisdiction(jurisdiction),
  status                  text not null default 'OBSERVED',
  source_reference        text,
  is_synthetic            boolean not null default true check (is_synthetic),
  first_seen_at           timestamptz not null default now(),
  last_seen_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (canonical_app_identifier, jurisdiction)
);

create table if not exists guardian.mobile_app_observation (
  observation_id text primary key,
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  observed_at    timestamptz not null default now(),
  source_type    text not null default 'SYNTHETIC_FIXTURE',
  version_string text,
  publisher_text text,
  content_hash   text,
  metadata_hash  text,
  evidence_reference text,
  idempotency_key text,
  status         text not null default 'PROCESSED',
  is_synthetic   boolean not null default true check (is_synthetic),
  unique (app_subject_id, idempotency_key)
);

create table if not exists guardian.mobile_app_snapshot (
  snapshot_id    text primary key,
  observation_id text not null references guardian.mobile_app_observation(observation_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  title          text,
  description_text text,
  version        text,
  developer      text,
  category       text,
  declared_website text,
  privacy_reference text,
  support_reference text,
  declared_licence_text text,
  evidence_reference text,
  content_hash   text,
  captured_at    timestamptz not null default now(),
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.mobile_app_content_signal (
  signal_id      text primary key,
  observation_id text not null references guardian.mobile_app_observation(observation_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  signal_type    text not null,
  present        boolean not null default false,
  detail         text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.mobile_app_technical_signal (
  signal_id      text primary key,
  observation_id text not null references guardian.mobile_app_observation(observation_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  signal_type    text not null,
  value          text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.mobile_app_registry_comparison (
  comparison_id  text primary key,
  observation_id text not null references guardian.mobile_app_observation(observation_id),
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  match_state    text not null check (match_state in ('EXACT_MATCH','KNOWN_ALIAS_MATCH','MULTIPLE_CANDIDATES','NO_MATCH','REQUIRES_REVIEW')),
  resolution_state text not null check (resolution_state in ('MATCHED_AUTHORITATIVE','MATCHED_BUT_STALE','MULTIPLE_MATCHES','NO_MATCH','SOURCE_CONFLICT','REQUIRES_REVIEW')),
  candidate_operator_id text,
  candidate_brand_id text,
  licence_reference text,
  licence_verification_state text,
  review_priority text not null default 'LOW_REVIEW_PRIORITY' check (review_priority in ('LOW_REVIEW_PRIORITY','MEDIUM_REVIEW_PRIORITY','HIGH_REVIEW_PRIORITY')),
  review_required boolean not null default false,
  reason_codes   jsonb not null default '[]'::jsonb,
  is_illegal_determination boolean not null default false check (is_illegal_determination = false),
  created_at     timestamptz not null default now()
);

create table if not exists guardian.mobile_app_entity_link (
  link_id        text primary key,
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  link_type      text not null check (link_type in ('OPERATOR','BRAND','LICENCE')),
  target_reference text not null,
  confidence     text not null default 'LOW' check (confidence in ('LOW','MEDIUM','HIGH')),
  source         text,
  observed_at    timestamptz not null default now(),
  human_confirmed boolean not null default false,
  audit_reference text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

-- Governed app→domain link (references a known C2 domain, or records the declared ref).
create table if not exists guardian.mobile_app_domain_link (
  link_id        text primary key,
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  link_type      text not null check (link_type in ('APP_DECLARED_WEBSITE','APP_SUPPORT_DOMAIN','APP_PRIVACY_DOMAIN','APP_OPERATOR_DOMAIN_CANDIDATE')),
  declared_domain text not null,
  matched_domain_id text references guardian.domain_subject(domain_id),
  confidence     text not null default 'LOW' check (confidence in ('LOW','MEDIUM','HIGH')),
  source         text,
  observed_at    timestamptz not null default now(),
  human_confirmed boolean not null default false,
  audit_reference text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.mobile_app_review_item (
  review_id     text primary key,
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction  text not null references guardian.jurisdiction(jurisdiction),
  state         text not null default 'NEW' check (state in ('NEW','TRIAGED','REQUIRES_REVIEW','VERIFIED_REFERENCE','UNRESOLVED','CLOSED')),
  review_priority text not null default 'LOW_REVIEW_PRIORITY',
  reason_codes  jsonb not null default '[]'::jsonb,
  decision      text check (decision in ('REFERENCE_MATCH_CONFIRMED','NO_REFERENCE_FOUND','SOURCE_DATA_INSUFFICIENT','REQUIRES_FURTHER_INVESTIGATION','FALSE_POSITIVE','DUPLICATE_SUBJECT')),
  assigned_role text,
  correlation_id text,
  created_at    timestamptz not null default now()
);

create table if not exists guardian.mobile_app_change_history (
  history_id     text primary key,
  app_subject_id text not null references guardian.mobile_app_subject(app_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  change_type    text not null,
  previous_hash  text,
  new_hash       text,
  observation_id text,
  recorded_at    timestamptz not null default now()
);

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'mobile_app_subject','mobile_app_observation','mobile_app_snapshot','mobile_app_content_signal',
  'mobile_app_technical_signal','mobile_app_registry_comparison','mobile_app_entity_link',
  'mobile_app_domain_link','mobile_app_review_item','mobile_app_change_history'];
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

-- ── SYNTHETIC SEED (idempotent) — scenarios 1..7, 11 ──────────────────────────
insert into guardian.mobile_app_subject (app_subject_id, canonical_app_identifier, display_name, platform_type, developer_display_name, jurisdiction, source_reference) values
  ('APP-SYNTH-0003','com.safebet.synthetic.bet003','Safe Example Betting App','MOBILE_APP','Synthetic Gaming Holdings','ZA-GP','SyntheticAppSourceAdapter'),
  ('APP-SYNTH-0004','app.synthetic.unknown004','Unknown Casino App','MOBILE_APP','Unknown Synthetic Dev','ZA-GP','SyntheticAppSourceAdapter'),
  ('APP-SYNTH-WC-0100','za.synthetic.western100','Western Synthetic App','MOBILE_APP','Western Synthetic Betting','ZA-WC','SyntheticAppSourceAdapter')
  on conflict (app_subject_id) do nothing;

insert into guardian.mobile_app_observation (observation_id, app_subject_id, jurisdiction, source_type, version_string, publisher_text, content_hash, metadata_hash, evidence_reference, idempotency_key) values
  ('AOBS-0003-A','APP-SYNTH-0003','ZA-GP','SYNTHETIC_FIXTURE','1.2.0','Synthetic Gaming Holdings',repeat('3',64),repeat('a',64),'evref:aobs-0003-a','aidem-0003-a'),
  ('AOBS-0004-A','APP-SYNTH-0004','ZA-GP','SYNTHETIC_FIXTURE','0.9.1','Unknown Synthetic Dev',repeat('4',64),repeat('b',64),'evref:aobs-0004-a','aidem-0004-a')
  on conflict (observation_id) do nothing;

insert into guardian.mobile_app_snapshot (snapshot_id, observation_id, jurisdiction, title, description_text, version, developer, declared_website, declared_licence_text, evidence_reference, content_hash) values
  ('ASNAP-0003-A','AOBS-0003-A','ZA-GP','Safe Example Betting App','Bet with Safe Example Betting. Licence LIC-ZA-GP-TEST-0001.','1.2.0','Synthetic Gaming Holdings','licensed-example-003.test','LIC-ZA-GP-TEST-0001','evref:asnap-0003-a',repeat('3',64)),
  ('ASNAP-0004-A','AOBS-0004-A','ZA-GP','Unknown Casino App','Casino and betting. Deposit and bonus. Register now.','0.9.1','Unknown Synthetic Dev','unknown-app-004.test',null,'evref:asnap-0004-a',repeat('4',64))
  on conflict (snapshot_id) do nothing;

insert into guardian.mobile_app_domain_link (link_id, app_subject_id, jurisdiction, link_type, declared_domain, matched_domain_id, confidence, source) values
  ('ADL-0003','APP-SYNTH-0003','ZA-GP','APP_DECLARED_WEBSITE','licensed-example-003.test','DOM-SYNTH-0003','MEDIUM','SyntheticAppSourceAdapter')
  on conflict (link_id) do nothing;

insert into guardian.mobile_app_registry_comparison (comparison_id, observation_id, app_subject_id, jurisdiction, match_state, resolution_state, candidate_operator_id, licence_reference, licence_verification_state, review_priority, review_required, reason_codes) values
  ('ACMP-0003-A','AOBS-0003-A','APP-SYNTH-0003','ZA-GP','KNOWN_ALIAS_MATCH','MATCHED_AUTHORITATIVE','OP-SYNTH-0001','LIC-ZA-GP-TEST-0001','VERIFIED','LOW_REVIEW_PRIORITY',false,'[]'::jsonb),
  ('ACMP-0004-A','AOBS-0004-A','APP-SYNTH-0004','ZA-GP','NO_MATCH','NO_MATCH',null,null,null,'HIGH_REVIEW_PRIORITY',true,'["NO_AUTHORITATIVE_REGISTRY_MATCH","GAMBLING_CONTENT_SIGNAL"]'::jsonb)
  on conflict (comparison_id) do nothing;

insert into guardian.mobile_app_review_item (review_id, app_subject_id, jurisdiction, state, review_priority, reason_codes, assigned_role, correlation_id) values
  ('AREV-0004','APP-SYNTH-0004','ZA-GP','REQUIRES_REVIEW','HIGH_REVIEW_PRIORITY','["NO_AUTHORITATIVE_REGISTRY_MATCH","GAMBLING_CONTENT_SIGNAL"]'::jsonb,'INVESTIGATOR','corr-c3-0004')
  on conflict (review_id) do nothing;

insert into guardian.mobile_app_change_history (history_id, app_subject_id, jurisdiction, change_type, new_hash, observation_id) values
  ('ACH-0003-1','APP-SYNTH-0003','ZA-GP','FIRST_OBSERVATION',repeat('3',64),'AOBS-0003-A')
  on conflict (history_id) do nothing;
