-- ─── ARCH-V4-C9 — Guardian Multi-Channel Enforcement Orchestration foundation ─
-- Provider-neutral orchestration lifecycle. SYNTHETIC PROVIDERS ONLY. Flow:
--   valid C8 AUTHORISED action -> revalidation -> orchestration record -> provider channel
--   selection -> synthetic provider request -> PUBLISHED/REFERRED -> provider ack -> provider
--   response -> INDEPENDENT verification -> CLOSED / follow-up.
--
-- CORE SAFETY (encoded + tested; DB CHECKs):
--   Guardian ORCHESTRATES/REFERS/PUBLISHES authorised requests; the EXTERNAL provider performs
--   the provider-side action. Guardian never itself blocks/freezes/removes/suspends/compels.
--   No real ISP/registrar/registry/host/bank/PSP/mobile/geo provider. `enforcement_orchestration`
--   CHECKs force is_real_provider=false AND is_external_network_call=false. Provider-originated
--   states (ACKNOWLEDGED/ACTIONED/DECLINED/…) come ONLY from a provider_response row — Guardian
--   cannot fabricate provider acknowledgement. ACKNOWLEDGED != ACTIONED; ACTIONED != VERIFIED;
--   only a verification record may set VERIFIED. C9 creates NO authorisation authority — it
--   consumes C8 human approval and cannot widen scope. All in the `guardian` schema.

-- ── 1. PROVIDER CHANNEL REGISTRY (synthetic, provider-neutral) ────────────────
create table if not exists guardian.provider_channel (
  provider_channel_id text primary key,
  product          text not null default 'GUARDIAN' check (product='GUARDIAN'),
  provider_type    text not null check (provider_type in ('SYNTHETIC_ISP','SYNTHETIC_DNS_PROVIDER','SYNTHETIC_REGISTRAR','SYNTHETIC_REGISTRY','SYNTHETIC_HOST','SYNTHETIC_PAYMENT_PROVIDER','SYNTHETIC_MOBILE_PLATFORM','SYNTHETIC_GEO_PROVIDER')),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  supported_action_types jsonb not null default '[]'::jsonb,
  delivery_method  text not null default 'SYNTHETIC_ADAPTER' check (delivery_method in ('SYNTHETIC_ADAPTER','API_MTLS','H2H','SFTP','SECURE_PORTAL','MANUAL_REFERRAL','SECURE_FILE','OTHER')),
  endpoint_reference text,                   -- synthetic reference only; NOT a real endpoint
  configuration_state text not null default 'SYNTHETIC_CONFIGURED',
  active           boolean not null default true,
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now()
);

-- ── 2. ENFORCEMENT ORCHESTRATION (Guardian-owned; references only) ────────────
create table if not exists guardian.enforcement_orchestration (
  orchestration_id text primary key,
  authorisation_reference text not null,     -- the C8 AuthorisedActionContract reference
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  action_type      text not null check (action_type in ('DOMAIN_BLOCK','DNS_POLICY','HOSTING_REFERRAL','REGISTRAR_REFERRAL','APP_PLATFORM_REFERRAL','PAYMENT_REFERRAL','GEO_RESTRICTION','MONITOR_ONLY')),
  target_type      text not null,
  target_reference text not null,
  provider_channel text references guardian.provider_channel(provider_channel_id),
  status           text not null default 'AUTHORISED' check (status in ('AUTHORISED','READY','PUBLISHED','REFERRED','ACKNOWLEDGED','UNDER_REVIEW','MORE_INFO_REQUIRED','ACTIONED','DECLINED','VERIFIED','CLOSED','EXPIRED','WITHDRAWN','ORCHESTRATION_BLOCKED')),
  attempt_count    integer not null default 0,
  request_payload_hash text,
  request_version  integer not null default 1,
  policy_reference text,
  authority_reference text,
  evidence_manifest_reference text,
  reason_codes     jsonb not null default '[]'::jsonb,
  correlation_id   text,
  created_at       timestamptz not null default now(),
  published_at     timestamptz,
  acknowledged_at  timestamptz,
  completed_at     timestamptz,
  -- SAFETY: no real provider, no external network call; Guardian orchestrates only.
  is_real_provider boolean not null default false check (is_real_provider = false),
  is_external_network_call boolean not null default false check (is_external_network_call = false),
  is_synthetic     boolean not null default true check (is_synthetic),
  idempotency_key  text,
  unique (jurisdiction, idempotency_key)
);

-- ── 3. PROVIDER REQUEST (versioned, immutable authorised payload snapshot) ────
create table if not exists guardian.provider_request (
  request_id       text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  request_version  integer not null,
  request_payload_hash text not null,
  action_type      text not null,
  target_reference text not null,
  authority_reference text,
  policy_reference text,
  evidence_manifest_reference text,
  provider_channel text,
  published_at     timestamptz,
  is_synthetic     boolean not null default true check (is_synthetic),
  unique (orchestration_id, request_version)
);

-- ── 4. PROVIDER RESPONSE — APPEND-ONLY (provider-originated states only) ──────
create table if not exists guardian.provider_response (
  response_id      text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  provider_channel text,
  provider_state   text not null check (provider_state in ('ACKNOWLEDGED','UNDER_REVIEW','MORE_INFO_REQUIRED','ACTIONED','DECLINED')),
  provider_reference text,                   -- synthetic receipt/reference
  request_payload_hash text,
  received_at      timestamptz not null default now(),
  reason_code      text,
  details_reference text,
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 5. ENFORCEMENT VERIFICATION — APPEND-ONLY (independent of dispatch) ───────
create table if not exists guardian.enforcement_verification (
  verification_id  text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  verification_type text not null check (verification_type in ('DOMAIN_UNAVAILABLE','DNS_POLICY_OBSERVED','HOSTING_STATUS_CHANGED','REGISTRAR_STATUS_CHANGED','APP_LISTING_CHANGED','PAYMENT_CHANNEL_STATUS_CHANGED','GEO_RESTRICTION_OBSERVED','OTHER')),
  observed_state   text,
  result           text not null check (result in ('VERIFIED','NOT_VERIFIED','INCONCLUSIVE')),
  evidence_reference text,
  verified_by      text,
  verified_at      timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 6. DISPATCH ATTEMPT — APPEND-ONLY (technical delivery vs decline) ─────────
create table if not exists guardian.dispatch_attempt (
  attempt_id       text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  attempt_no       integer not null,
  outcome          text not null check (outcome in ('PUBLISHED','TECHNICAL_FAILURE','SUPPRESSED_DUPLICATE')),
  reason           text,
  request_payload_hash text,
  is_synthetic     boolean not null default true check (is_synthetic),
  attempted_at     timestamptz not null default now(),
  unique (orchestration_id, attempt_no)
);

-- ── 7. ORCHESTRATION STATUS HISTORY — APPEND-ONLY ─────────────────────────────
create table if not exists guardian.orchestration_status_history (
  history_id       text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  previous_status  text,
  new_status       text not null,
  source           text not null check (source in ('GUARDIAN','PROVIDER','VERIFICATION')),
  actor            text,
  reason           text,
  is_synthetic     boolean not null default true check (is_synthetic),
  changed_at       timestamptz not null default now()
);

-- ── 8. WITHDRAWAL / CANCELLATION REQUEST — APPEND-ONLY (post-dispatch) ────────
create table if not exists guardian.orchestration_withdrawal (
  withdrawal_id    text primary key,
  orchestration_id text not null references guardian.enforcement_orchestration(orchestration_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  phase            text not null check (phase in ('BEFORE_DISPATCH','AFTER_DISPATCH')),
  cancellation_state text not null default 'CANCELLATION_REQUESTED' check (cancellation_state in ('WITHDRAWN_NO_DISPATCH','CANCELLATION_REQUESTED','CANCELLATION_CONFIRMED_BY_PROVIDER')),
  reason           text,
  requested_by     text,
  is_synthetic     boolean not null default true check (is_synthetic),
  requested_at     timestamptz not null default now()
);

-- ── Append-only guard for the five history/response/verification tables ───────
create or replace function guardian.orchestration_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian orchestration append-only table: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.orchestration_block_mutation() from public;

do $$
declare t text; tables text[] := array['provider_response','enforcement_verification','dispatch_attempt','orchestration_status_history','orchestration_withdrawal','provider_request'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.orchestration_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'provider_channel','enforcement_orchestration','provider_request','provider_response',
  'enforcement_verification','dispatch_attempt','orchestration_status_history','orchestration_withdrawal'];
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

-- ── SYNTHETIC SEED (idempotent) — provider channels ──────────────────────────
insert into guardian.provider_channel (provider_channel_id, provider_type, jurisdiction, supported_action_types, delivery_method) values
  ('PCH-SYNTH-DNS-ZAGP','SYNTHETIC_DNS_PROVIDER','ZA-GP','["DOMAIN_BLOCK","DNS_POLICY"]'::jsonb,'SYNTHETIC_ADAPTER'),
  ('PCH-SYNTH-PAY-ZAGP','SYNTHETIC_PAYMENT_PROVIDER','ZA-GP','["PAYMENT_REFERRAL"]'::jsonb,'SYNTHETIC_ADAPTER'),
  ('PCH-SYNTH-APP-ZAGP','SYNTHETIC_MOBILE_PLATFORM','ZA-GP','["APP_PLATFORM_REFERRAL"]'::jsonb,'SYNTHETIC_ADAPTER'),
  ('PCH-SYNTH-DNS-ZAWC','SYNTHETIC_DNS_PROVIDER','ZA-WC','["DOMAIN_BLOCK"]'::jsonb,'SYNTHETIC_ADAPTER')
  on conflict (provider_channel_id) do nothing;
