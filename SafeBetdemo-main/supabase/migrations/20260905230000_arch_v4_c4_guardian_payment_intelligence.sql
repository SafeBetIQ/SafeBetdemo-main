-- ─── ARCH-V4-C4 — SafeBet Guardian Payment Intelligence foundation ────────────
-- Provider-neutral merchant / payment-channel intelligence. SYNTHETIC ONLY. Flow:
--   payment/merchant subject → normalise → synthetic channel evidence → resolve
--   operator/brand/domain/app references → compare vs Legal Operator Registry (C1) →
--   structured NON-LEGAL, NON-ENFORCEMENT result → human review.
--
-- SAFETY INVARIANTS (encoded + tested; DB CHECKs):
--   PAYMENT CHANNEL OBSERVED != ILLEGAL ; MERCHANT NOT MATCHED != ILLEGAL
--   BANK/PSP ASSOCIATION != LEGAL FINDING ; HIGH PRIORITY != ENFORCEMENT AUTHORISATION
--   DETECTION != PAYMENT ACTION
-- No blockPayment/freezeAccount/terminateMerchant/illegal. A comparison-table CHECK forbids
-- is_illegal_determination=true AND is_enforcement_authorised=true.
--
-- PRIVACY/MINIMISATION: NO PAN, NO CVV, NO real bank account / card / customer transaction
-- data. Only provider-neutral tokens/references/descriptors + synthetic aggregates.
-- All in the dedicated `guardian` schema. Immutable Guardian keys.

create table if not exists guardian.merchant_subject (
  merchant_subject_id text primary key,
  product            text not null default 'GUARDIAN' check (product='GUARDIAN'),
  merchant_reference text not null,
  merchant_descriptor text,
  legal_display_name text,
  provider_reference text,
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  status             text not null default 'OBSERVED',
  source_reference   text,
  is_synthetic       boolean not null default true check (is_synthetic),
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (merchant_reference, jurisdiction)
);

create table if not exists guardian.payment_subject (
  payment_subject_id text primary key,
  product            text not null default 'GUARDIAN' check (product='GUARDIAN'),
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
  channel_type       text not null default 'UNKNOWN' check (channel_type in ('CARD','BANK_TRANSFER','EFT','WALLET','VOUCHER','MOBILE_PAYMENT','CRYPTO_REFERENCE','OTHER','UNKNOWN')),
  jurisdiction       text not null references guardian.jurisdiction(jurisdiction),
  status             text not null default 'OBSERVED',
  source_reference   text,
  is_synthetic       boolean not null default true check (is_synthetic),
  created_at         timestamptz not null default now()
);

create table if not exists guardian.payment_provider_reference (
  provider_ref_id text primary key,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  provider_type   text not null check (provider_type in ('PAYMENT_SERVICE_PROVIDER','BANKING_PROVIDER','ACQUIRER','PAYMENT_PLATFORM','WALLET_PROVIDER')),
  provider_reference text not null,
  is_synthetic    boolean not null default true check (is_synthetic)
);

create table if not exists guardian.merchant_observation (
  observation_id text primary key,
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  observed_at    timestamptz not null default now(),
  descriptor     text,
  provider_reference text,
  content_hash   text,
  idempotency_key text,
  status         text not null default 'PROCESSED',
  is_synthetic   boolean not null default true check (is_synthetic),
  unique (merchant_subject_id, idempotency_key)
);

-- Payment observation — provider-neutral aggregates only (NO PAN/CVV/account numbers).
create table if not exists guardian.payment_observation (
  observation_id text primary key,
  payment_subject_id text not null references guardian.payment_subject(payment_subject_id),
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
  channel_type   text not null default 'UNKNOWN',
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  observed_at    timestamptz not null default now(),
  provider_reference text,
  descriptor     text,
  amount_aggregate numeric,
  currency       text,
  evidence_reference text,
  content_hash   text,
  idempotency_key text,
  status         text not null default 'PROCESSED',
  is_synthetic   boolean not null default true check (is_synthetic),
  unique (payment_subject_id, idempotency_key)
);

create table if not exists guardian.payment_registry_comparison (
  comparison_id  text primary key,
  observation_id text not null references guardian.payment_observation(observation_id),
  payment_subject_id text not null references guardian.payment_subject(payment_subject_id),
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
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
  is_enforcement_authorised boolean not null default false check (is_enforcement_authorised = false),
  created_at     timestamptz not null default now()
);

create table if not exists guardian.payment_entity_link (
  link_id        text primary key,
  payment_subject_id text not null references guardian.payment_subject(payment_subject_id),
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
  jurisdiction   text not null references guardian.jurisdiction(jurisdiction),
  link_type      text not null check (link_type in ('OPERATOR','BRAND','LICENCE','DOMAIN','APP')),
  target_reference text not null,
  confidence     text not null default 'LOW' check (confidence in ('LOW','MEDIUM','HIGH')),
  source         text,
  observed_at    timestamptz not null default now(),
  human_confirmed boolean not null default false,
  audit_reference text,
  is_synthetic   boolean not null default true check (is_synthetic)
);

create table if not exists guardian.payment_review_item (
  review_id     text primary key,
  payment_subject_id text not null references guardian.payment_subject(payment_subject_id),
  merchant_subject_id text not null references guardian.merchant_subject(merchant_subject_id),
  jurisdiction  text not null references guardian.jurisdiction(jurisdiction),
  state         text not null default 'NEW' check (state in ('NEW','TRIAGED','REQUIRES_REVIEW','VERIFIED_REFERENCE','UNRESOLVED','CLOSED')),
  review_priority text not null default 'LOW_REVIEW_PRIORITY',
  reason_codes  jsonb not null default '[]'::jsonb,
  decision      text check (decision in ('REFERENCE_MATCH_CONFIRMED','NO_REFERENCE_FOUND','SOURCE_DATA_INSUFFICIENT','REQUIRES_FURTHER_INVESTIGATION','FALSE_POSITIVE','DUPLICATE_SUBJECT')),
  assigned_role text,
  correlation_id text,
  created_at    timestamptz not null default now()
);

create table if not exists guardian.payment_change_history (
  history_id     text primary key,
  payment_subject_id text not null references guardian.payment_subject(payment_subject_id),
  merchant_subject_id text,
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
  'merchant_subject','payment_subject','payment_provider_reference','merchant_observation',
  'payment_observation','payment_registry_comparison','payment_entity_link','payment_review_item',
  'payment_change_history'];
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

-- ── SYNTHETIC SEED (idempotent) — scenarios 1..8 ──────────────────────────────
insert into guardian.payment_provider_reference (provider_ref_id, jurisdiction, provider_type, provider_reference) values
  ('PSP-SYNTH-001','ZA-GP','PAYMENT_SERVICE_PROVIDER','Synthetic PSP One'),
  ('ACQ-SYNTH-001','ZA-GP','ACQUIRER','Synthetic Acquirer One')
  on conflict (provider_ref_id) do nothing;

insert into guardian.merchant_subject (merchant_subject_id, merchant_reference, merchant_descriptor, legal_display_name, provider_reference, jurisdiction, source_reference) values
  ('MER-SYNTH-0001','MER-REF-0001','SAFE EXAMPLE BETTING','Synthetic Gaming Holdings','PSP-SYNTH-001','ZA-GP','SyntheticPaymentSourceAdapter'),
  ('MER-SYNTH-0004','MER-REF-0004','UNKNOWN CASINO PAY','Unknown Synthetic Merchant','PSP-SYNTH-001','ZA-GP','SyntheticPaymentSourceAdapter'),
  ('MER-SYNTH-WC-0100','MER-REF-0100','WESTERN SYNTH PAY','Western Synthetic Betting','PSP-SYNTH-001','ZA-WC','SyntheticPaymentSourceAdapter')
  on conflict (merchant_subject_id) do nothing;

insert into guardian.payment_subject (payment_subject_id, merchant_subject_id, channel_type, jurisdiction, source_reference) values
  ('PAY-SYNTH-0001','MER-SYNTH-0001','CARD','ZA-GP','SyntheticPaymentSourceAdapter'),
  ('PAY-SYNTH-0004','MER-SYNTH-0004','EFT','ZA-GP','SyntheticPaymentSourceAdapter'),
  ('PAY-SYNTH-WC-0100','MER-SYNTH-WC-0100','CARD','ZA-WC','SyntheticPaymentSourceAdapter')
  on conflict (payment_subject_id) do nothing;

insert into guardian.payment_observation (observation_id, payment_subject_id, merchant_subject_id, channel_type, jurisdiction, provider_reference, descriptor, amount_aggregate, currency, evidence_reference, content_hash, idempotency_key) values
  ('POBS-0001-A','PAY-SYNTH-0001','MER-SYNTH-0001','CARD','ZA-GP','PSP-SYNTH-001','SAFE EXAMPLE BETTING',12345.00,'ZAR','evref:pobs-0001-a',repeat('1',64),'pidem-0001-a'),
  ('POBS-0004-A','PAY-SYNTH-0004','MER-SYNTH-0004','EFT','ZA-GP','PSP-SYNTH-001','UNKNOWN CASINO PAY',6789.00,'ZAR','evref:pobs-0004-a',repeat('4',64),'pidem-0004-a')
  on conflict (observation_id) do nothing;

insert into guardian.payment_registry_comparison (comparison_id, observation_id, payment_subject_id, merchant_subject_id, jurisdiction, match_state, resolution_state, candidate_operator_id, licence_reference, licence_verification_state, review_priority, review_required, reason_codes) values
  ('PCMP-0001-A','POBS-0001-A','PAY-SYNTH-0001','MER-SYNTH-0001','ZA-GP','KNOWN_ALIAS_MATCH','MATCHED_AUTHORITATIVE','OP-SYNTH-0001','LIC-ZA-GP-TEST-0001','VERIFIED','LOW_REVIEW_PRIORITY',false,'[]'::jsonb),
  ('PCMP-0004-A','POBS-0004-A','PAY-SYNTH-0004','MER-SYNTH-0004','ZA-GP','NO_MATCH','NO_MATCH',null,null,null,'HIGH_REVIEW_PRIORITY',true,'["NO_AUTHORITATIVE_REGISTRY_MATCH","UNKNOWN_PROVIDER_REFERENCE"]'::jsonb)
  on conflict (comparison_id) do nothing;

insert into guardian.payment_review_item (review_id, payment_subject_id, merchant_subject_id, jurisdiction, state, review_priority, reason_codes, assigned_role, correlation_id) values
  ('PREV-0004','PAY-SYNTH-0004','MER-SYNTH-0004','ZA-GP','REQUIRES_REVIEW','HIGH_REVIEW_PRIORITY','["NO_AUTHORITATIVE_REGISTRY_MATCH"]'::jsonb,'INVESTIGATOR','corr-c4-0004')
  on conflict (review_id) do nothing;

insert into guardian.payment_change_history (history_id, payment_subject_id, merchant_subject_id, jurisdiction, change_type, new_hash, observation_id) values
  ('PCH-0001-1','PAY-SYNTH-0001','MER-SYNTH-0001','ZA-GP','FIRST_OBSERVATION',repeat('1',64),'POBS-0001-A')
  on conflict (history_id) do nothing;
