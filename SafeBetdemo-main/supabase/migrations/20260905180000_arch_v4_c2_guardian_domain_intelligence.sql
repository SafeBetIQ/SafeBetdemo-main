-- ─── ARCH-V4-C2 — SafeBet Guardian Domain & Website Intelligence foundation ────
-- Guardian's first external-subject intelligence domain (SYNTHETIC ONLY). Flow:
--   discover/receive domain -> normalise -> capture synthetic evidence -> resolve
--   entity/brand refs -> compare vs Legal Operator Registry (C1) -> structured
--   intelligence result -> human review where required.
--
-- SAFETY INVARIANTS (encoded + tested):
--   DOMAIN DISCOVERED != ILLEGAL DOMAIN
--   NO LEGAL REGISTRY MATCH != ILLEGAL OPERATOR
--   HIGH-RISK SIGNAL != LEGAL FINDING ; DETECTION != ENFORCEMENT AUTHORISATION
-- No automated illegality determination (a DB CHECK forbids is_illegal_determination=true).
-- No blocking, no enforcement, no real targets. All in the dedicated `guardian` schema.
-- All identifiers use immutable Guardian keys (NOT the hostname). Reversible (runbook).

-- ── Domain subject (immutable id; hostname is an attribute, not the key) ───────
create table if not exists guardian.domain_subject (
  domain_id          text primary key,
  product            text not null default 'GUARDIAN' check (product = 'GUARDIAN'),
  canonical_hostname text not null,
  display_hostname   text not null,
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  status             text not null default 'OBSERVED',
  source_reference   text,
  is_synthetic       boolean not null default true check (is_synthetic),
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (canonical_hostname, jurisdiction)
);

create table if not exists guardian.domain_observation (
  observation_id text primary key,
  domain_id      text not null references guardian.domain_subject(domain_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  observed_at    timestamptz not null default now(),
  capture_method text not null default 'SYNTHETIC_FIXTURE',
  content_hash   text,
  idempotency_key text,
  status         text not null default 'PROCESSED',
  is_synthetic   boolean not null default true check (is_synthetic),
  unique (domain_id, idempotency_key)
);

create table if not exists guardian.website_snapshot (
  snapshot_id        text primary key,
  observation_id     text not null references guardian.domain_observation(observation_id),
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  page_title         text,
  visible_text_extract text,
  evidence_reference text,
  content_hash       text,
  http_status        integer,
  viewport           text,
  captured_at        timestamptz not null default now(),
  is_synthetic       boolean not null default true check (is_synthetic)
);

create table if not exists guardian.page_resource_reference (
  resource_id   text primary key,
  snapshot_id   text not null references guardian.website_snapshot(snapshot_id),
  jurisdiction  text not null references guardian.jurisdiction(jurisdiction),
  resource_type text not null,
  reference     text not null,
  is_synthetic  boolean not null default true check (is_synthetic)
);

create table if not exists guardian.domain_technical_signal (
  signal_id      text primary key,
  observation_id text not null references guardian.domain_observation(observation_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  signal_type    text not null,
  value          text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.domain_content_signal (
  signal_id      text primary key,
  observation_id text not null references guardian.domain_observation(observation_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  signal_type    text not null,
  present        boolean not null default false,
  detail         text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

-- Registry comparison result — NON-LEGAL. A DB CHECK forbids any illegality flag.
create table if not exists guardian.domain_registry_comparison (
  comparison_id  text primary key,
  observation_id text not null references guardian.domain_observation(observation_id),
  domain_id      text not null references guardian.domain_subject(domain_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  match_state    text not null check (match_state in ('EXACT_MATCH','KNOWN_ALIAS_MATCH','MULTIPLE_CANDIDATES','NO_MATCH','REQUIRES_REVIEW')),
  resolution_state text not null check (resolution_state in ('MATCHED_AUTHORITATIVE','MATCHED_BUT_STALE','MULTIPLE_MATCHES','NO_MATCH','SOURCE_CONFLICT','REQUIRES_REVIEW')),
  candidate_operator_id text,
  candidate_brand_id text,
  licence_reference  text,
  licence_verification_state text,
  review_priority text not null default 'LOW_REVIEW_PRIORITY' check (review_priority in ('LOW_REVIEW_PRIORITY','MEDIUM_REVIEW_PRIORITY','HIGH_REVIEW_PRIORITY')),
  review_required boolean not null default false,
  reason_codes    jsonb not null default '[]'::jsonb,
  is_illegal_determination boolean not null default false check (is_illegal_determination = false),
  created_at      timestamptz not null default now()
);

create table if not exists guardian.domain_entity_link (
  link_id        text primary key,
  domain_id      text not null references guardian.domain_subject(domain_id),
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

create table if not exists guardian.domain_review_item (
  review_id     text primary key,
  domain_id     text not null references guardian.domain_subject(domain_id),
  jurisdiction  text not null references guardian.jurisdiction(jurisdiction),
  state         text not null default 'NEW' check (state in ('NEW','TRIAGED','REQUIRES_REVIEW','VERIFIED_REFERENCE','UNRESOLVED','CLOSED')),
  review_priority text not null default 'LOW_REVIEW_PRIORITY',
  reason_codes  jsonb not null default '[]'::jsonb,
  decision      text check (decision in ('REFERENCE_MATCH_CONFIRMED','NO_REFERENCE_FOUND','SOURCE_DATA_INSUFFICIENT','REQUIRES_FURTHER_INVESTIGATION','FALSE_POSITIVE','DUPLICATE_SUBJECT')),
  assigned_role text,
  correlation_id text,
  created_at    timestamptz not null default now()
);

-- Append-only domain change history (supports future re-entry intelligence).
create table if not exists guardian.domain_change_history (
  history_id     text primary key,
  domain_id      text not null references guardian.domain_subject(domain_id),
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
  'domain_subject','domain_observation','website_snapshot','page_resource_reference',
  'domain_technical_signal','domain_content_signal','domain_registry_comparison',
  'domain_entity_link','domain_review_item','domain_change_history'];
begin
  foreach t in array tables loop
    execute format('alter table guardian.%I enable row level security', t);
    execute format('grant select, insert on guardian.%I to authenticated, service_role', t);
    execute format('drop policy if exists g_%s_read on guardian.%I', t, t);
    execute format($f$create policy g_%1$s_read on guardian.%1$I for select to authenticated
      using ( jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') )$f$, t);
  end loop;
  -- Worker insert policy (synthetic only) for authenticated Guardian sessions; service_role bypasses.
  foreach t in array tables loop
    execute format('drop policy if exists g_%s_insert on guardian.%I', t, t);
    execute format($f$create policy g_%1$s_insert on guardian.%1$I for insert to authenticated
      with check ( jurisdiction = (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'guardian_jurisdiction') )$f$, t);
  end loop;
end $$;

-- ── SYNTHETIC SEED (idempotent) — scenarios 1..7, 10 (reserved .test hostnames) ─
insert into guardian.domain_subject (domain_id, canonical_hostname, display_hostname, jurisdiction, status, source_reference) values
  ('DOM-SYNTH-0003','licensed-example-003.test','licensed-example-003.test','ZA-GP','OBSERVED','SyntheticDomainSourceAdapter'),
  ('DOM-SYNTH-0001','ref-example-001.test','ref-example-001.test','ZA-GP','OBSERVED','SyntheticDomainSourceAdapter'),
  ('DOM-SYNTH-0004','unknown-example-004.test','unknown-example-004.test','ZA-GP','OBSERVED','SyntheticDomainSourceAdapter'),
  ('DOM-SYNTH-0002','conflict-example-002.test','conflict-example-002.test','ZA-GP','OBSERVED','SyntheticDomainSourceAdapter'),
  ('DOM-SYNTH-0009','stale-example-009.test','stale-example-009.test','ZA-GP','OBSERVED','SyntheticDomainSourceAdapter'),
  ('DOM-SYNTH-WC-0100','western-example-100.test','western-example-100.test','ZA-WC','OBSERVED','SyntheticDomainSourceAdapter')
  on conflict (domain_id) do nothing;

insert into guardian.domain_observation (observation_id, domain_id, jurisdiction, capture_method, content_hash, idempotency_key) values
  ('OBS-0003-A','DOM-SYNTH-0003','ZA-GP','SYNTHETIC_FIXTURE',repeat('3',64),'idem-0003-a'),
  ('OBS-0004-A','DOM-SYNTH-0004','ZA-GP','SYNTHETIC_FIXTURE',repeat('4',64),'idem-0004-a'),
  ('OBS-WC-0100-A','DOM-SYNTH-WC-0100','ZA-WC','SYNTHETIC_FIXTURE',repeat('c',64),'idem-wc-0100-a')
  on conflict (observation_id) do nothing;

insert into guardian.website_snapshot (snapshot_id, observation_id, jurisdiction, page_title, visible_text_extract, evidence_reference, content_hash, http_status, viewport) values
  ('SNAP-0003-A','OBS-0003-A','ZA-GP','Safe Example Betting','Bet online with Safe Example Betting. Licence LIC-ZA-GP-TEST-0001.','evref:snap-0003-a',repeat('3',64),200,'1280x800'),
  ('SNAP-0004-A','OBS-0004-A','ZA-GP','Unknown Casino','Deposit now, big bonus, casino and betting.','evref:snap-0004-a',repeat('4',64),200,'1280x800')
  on conflict (snapshot_id) do nothing;

insert into guardian.domain_content_signal (signal_id, observation_id, jurisdiction, signal_type, present, detail) values
  ('CSIG-0004-1','OBS-0004-A','ZA-GP','GAMBLING_TERMINOLOGY',true,'casino/betting terms present'),
  ('CSIG-0004-2','OBS-0004-A','ZA-GP','DEPOSIT_LANGUAGE',true,'deposit/bonus CTA present')
  on conflict (signal_id) do nothing;

insert into guardian.domain_registry_comparison (comparison_id, observation_id, domain_id, jurisdiction, match_state, resolution_state, candidate_operator_id, licence_reference, licence_verification_state, review_priority, review_required, reason_codes) values
  ('CMP-0003-A','OBS-0003-A','DOM-SYNTH-0003','ZA-GP','KNOWN_ALIAS_MATCH','MATCHED_AUTHORITATIVE','OP-SYNTH-0001','LIC-ZA-GP-TEST-0001','VERIFIED','LOW_REVIEW_PRIORITY',false,'[]'::jsonb),
  ('CMP-0004-A','OBS-0004-A','DOM-SYNTH-0004','ZA-GP','NO_MATCH','NO_MATCH',null,null,null,'HIGH_REVIEW_PRIORITY',true,'["NO_AUTHORITATIVE_REGISTRY_MATCH","CONTENT_GAMBLING_SIGNAL"]'::jsonb)
  on conflict (comparison_id) do nothing;

insert into guardian.domain_review_item (review_id, domain_id, jurisdiction, state, review_priority, reason_codes, assigned_role, correlation_id) values
  ('DREV-0004','DOM-SYNTH-0004','ZA-GP','REQUIRES_REVIEW','HIGH_REVIEW_PRIORITY','["NO_AUTHORITATIVE_REGISTRY_MATCH","CONTENT_GAMBLING_SIGNAL"]'::jsonb,'INVESTIGATOR','corr-c2-0004')
  on conflict (review_id) do nothing;

insert into guardian.domain_change_history (history_id, domain_id, jurisdiction, change_type, previous_hash, new_hash, observation_id) values
  ('DCH-0003-1','DOM-SYNTH-0003','ZA-GP','FIRST_OBSERVATION',null,repeat('3',64),'OBS-0003-A')
  on conflict (history_id) do nothing;
