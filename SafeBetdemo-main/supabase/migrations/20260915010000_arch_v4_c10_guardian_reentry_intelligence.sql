-- ─── ARCH-V4-C10 — Guardian Provider Follow-up, Continuous Verification & Re-entry Intelligence ─
-- Completes the POST-ORCHESTRATION lifecycle. SYNTHETIC ONLY. Flow:
--   C9 VERIFIED orchestration -> follow-up verification observation -> new synthetic signal ->
--   re-entry candidate -> relationship assessment -> authority-coverage assessment -> human review
--   -> routing to EXISTING-AUTHORITY review (C8) OR NEW investigation (C6)/new C8 authorisation.
--
-- CORE SAFETY (encoded + tested; DB CHECKs + append-only + RLS):
--   RE-ENTRY DETECTED != ILLEGALITY DETERMINED. RE-ENTRY DETECTED != EXISTING AUTHORITY APPLIES.
--   SIMILAR TARGET != SAME OPERATOR. SHARED INFRASTRUCTURE != SAME ENTITY. HISTORIC VERIFIED
--   ACTION != PERMANENTLY VERIFIED. C10 is intelligence + verification + routing ONLY — it never
--   blocks/refers/enforces, never sets provider states, never creates C8 authority, never widens
--   C8 scope, and cannot enqueue C9 enforcement. No real crawling / DNS / provider / app-store /
--   payment / traffic surveillance — synthetic fixtures/adapters only. Person-level surveillance is
--   impossible: re-entry operates at operator/brand/service/domain/app/payment-channel/infra reference.
--   Historic verification records are immutable; re-entry APPENDS observations/candidates.

-- ── 1. FOLLOW-UP / CONTINUOUS VERIFICATION OBSERVATION — APPEND-ONLY (§6/§7/§8) ─
create table if not exists guardian.enforcement_verification_observation (
  verification_observation_id text primary key,
  orchestration_reference text not null,     -- bounded C9 orchestration reference (contract)
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  target_type      text not null,
  target_reference text not null,
  verification_type text not null check (verification_type in ('DOMAIN_UNAVAILABLE','DNS_POLICY_OBSERVED','HOSTING_STATUS_CHANGED','REGISTRAR_STATUS_CHANGED','APP_LISTING_CHANGED','PAYMENT_CHANNEL_STATUS_CHANGED','GEO_RESTRICTION_OBSERVED','OTHER')),
  observation_kind text not null default 'FOLLOWUP' check (observation_kind in ('INITIAL','FOLLOWUP','PERIODIC')),
  observed_state   text,
  result           text not null check (result in ('EXPECTED_STATE_OBSERVED','EXPECTED_STATE_NOT_OBSERVED','INCONCLUSIVE','TARGET_UNAVAILABLE','TARGET_AVAILABLE','TARGET_CHANGED','REFERENCE_NOT_FOUND','REQUIRES_REVIEW')),
  source_reference text,                      -- synthetic source reference only
  evidence_reference text,                    -- C7 evidence reference (no body duplication)
  correlation_id   text,
  observed_at      timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic),
  is_real_observation_source boolean not null default false check (is_real_observation_source = false),
  is_external_network_call boolean not null default false check (is_external_network_call = false),
  created_at       timestamptz not null default now()
);

-- ── 2. RE-ENTRY CANDIDATE (Guardian-owned; state machine + review/coverage) (§9/§22) ─
create table if not exists guardian.reentry_candidate (
  reentry_candidate_id text primary key,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  original_orchestration_reference text not null,
  original_target_type text not null,
  original_target_reference text not null,
  candidate_target_type text not null,
  candidate_target_reference text not null,
  detected_at      timestamptz not null default now(),
  candidate_state  text not null default 'DETECTED' check (candidate_state in ('DETECTED','TRIAGED','REQUIRES_REVIEW','RELATIONSHIP_CONFIRMED','FALSE_POSITIVE','COVERAGE_REVIEW_REQUIRED','EXISTING_AUTHORITY_PATH','NEW_INVESTIGATION_REQUIRED','ROUTED_TO_C8','CLOSED')),
  relationship_type text not null check (relationship_type in ('SAME_TARGET_REAPPEARED','KNOWN_ALIAS','MIRROR_REFERENCE','REDIRECT_RELATIONSHIP','BRAND_RELATIONSHIP','ENTITY_RELATIONSHIP','INFRASTRUCTURE_REUSE','APP_RELISTING','PAYMENT_REFERENCE_REUSE','GEO_AVAILABILITY_CHANGE','UNKNOWN_RELATIONSHIP')),
  reason_codes     jsonb not null default '[]'::jsonb,
  review_priority  text not null default 'LOW' check (review_priority in ('LOW','MEDIUM','HIGH')),
  coverage_state   text not null default 'COVERAGE_UNCLEAR' check (coverage_state in ('EXPLICITLY_COVERED','NOT_COVERED','COVERAGE_UNCLEAR','AUTHORITY_EXPIRED','AUTHORITY_WITHDRAWN','AUTHORITY_SUPERSEDED','REQUIRES_C8_REVIEW')),
  human_review_state text not null default 'PENDING_REVIEW' check (human_review_state in ('PENDING_REVIEW','IN_REVIEW','REVIEW_COMPLETE')),
  evidence_reference text,
  correlation_id   text,
  idempotency_key  text,
  -- SAFETY: a candidate is a correlation/intelligence record — never a legal or enforcement outcome.
  is_illegality_determined boolean not null default false check (is_illegality_determined = false),
  is_authority_applied     boolean not null default false check (is_authority_applied = false),
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (jurisdiction, idempotency_key)
);

-- ── 3. RELATIONSHIP ASSESSMENT — APPEND-ONLY (§15) ────────────────────────────
create table if not exists guardian.reentry_relationship_assessment (
  assessment_id    text primary key,
  reentry_candidate_id text not null references guardian.reentry_candidate(reentry_candidate_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  relationship_type text not null,
  correlation_source text not null check (correlation_source in ('OPERATOR','BRAND','DOMAIN','APP','PAYMENT','GEO','PREVIOUS_ORCHESTRATION','INFRASTRUCTURE','OTHER')),
  reason           text,
  reason_codes     jsonb not null default '[]'::jsonb,
  evidence_reference text,
  human_confirmation_state text not null default 'UNCONFIRMED' check (human_confirmation_state in ('UNCONFIRMED','CONFIRMED','REJECTED')),
  observed_at      timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 4. AUTHORITY-COVERAGE ASSESSMENT — APPEND-ONLY (§16/§17) ───────────────────
create table if not exists guardian.reentry_coverage_assessment (
  coverage_id      text primary key,
  reentry_candidate_id text not null references guardian.reentry_candidate(reentry_candidate_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  authorisation_reference text,              -- the existing C8 authority evaluated (nullable)
  coverage_state   text not null check (coverage_state in ('EXPLICITLY_COVERED','NOT_COVERED','COVERAGE_UNCLEAR','AUTHORITY_EXPIRED','AUTHORITY_WITHDRAWN','AUTHORITY_SUPERSEDED','REQUIRES_C8_REVIEW')),
  reason_codes     jsonb not null default '[]'::jsonb,
  -- C10 NEVER makes the final legal determination — this is an internal routing assessment.
  is_final_legal_determination boolean not null default false check (is_final_legal_determination = false),
  assessed_at      timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 5. HUMAN REVIEW — APPEND-ONLY (§21) ───────────────────────────────────────
create table if not exists guardian.reentry_review (
  review_id        text primary key,
  reentry_candidate_id text not null references guardian.reentry_candidate(reentry_candidate_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  reviewer_role    text not null check (reviewer_role in ('INVESTIGATOR','LEGAL_REVIEWER')),
  reviewer_principal_id text not null,       -- bound authenticated Guardian principal (never self-asserted)
  outcome          text not null check (outcome in ('SAME_TARGET_CONFIRMED','RELATED_TARGET_CONFIRMED','RELATIONSHIP_UNRESOLVED','FALSE_POSITIVE','EXISTING_AUTHORITY_REVIEW_REQUIRED','NEW_INVESTIGATION_REQUIRED','INSUFFICIENT_EVIDENCE')),
  notes_reference  text,
  reviewed_at      timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 6. ROUTING DECISION — APPEND-ONLY (§19/§20/§40/§43/§44) ────────────────────
create table if not exists guardian.reentry_routing (
  routing_id       text primary key,
  reentry_candidate_id text not null references guardian.reentry_candidate(reentry_candidate_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  routing_outcome  text not null check (routing_outcome in ('EXISTING_AUTHORITY_REVIEW','NEW_INVESTIGATION','NEW_C8_AUTHORISATION_REQUIRED','COVERAGE_REVIEW','CLOSED_FALSE_POSITIVE')),
  target_module    text not null check (target_module in ('C6_INVESTIGATION','C8_AUTHORISATION','NONE')),
  authorisation_reference text,
  reason_codes     jsonb not null default '[]'::jsonb,
  routed_by        text not null,
  -- C10 records a routing outcome only; it NEVER authorises (C8) or dispatches (C9).
  is_authorisation_granted boolean not null default false check (is_authorisation_granted = false),
  is_enforcement_dispatched boolean not null default false check (is_enforcement_dispatched = false),
  routed_at        timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 7. CANDIDATE STATE HISTORY — APPEND-ONLY (§38) ────────────────────────────
create table if not exists guardian.reentry_candidate_history (
  history_id       text primary key,
  reentry_candidate_id text not null references guardian.reentry_candidate(reentry_candidate_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  previous_state   text,
  new_state        text not null,
  source           text not null check (source in ('GUARDIAN','REENTRY_WORKER','HUMAN_REVIEW','ROUTING')),
  actor            text,
  reason           text,
  changed_at       timestamptz not null default now(),
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── Append-only guard for the six history/observation/assessment/review/routing tables ─
create or replace function guardian.reentry_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian re-entry append-only table: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.reentry_block_mutation() from public;

do $$
declare t text; tables text[] := array[
  'enforcement_verification_observation','reentry_relationship_assessment','reentry_coverage_assessment',
  'reentry_review','reentry_routing','reentry_candidate_history'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.reentry_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'enforcement_verification_observation','reentry_candidate','reentry_relationship_assessment',
  'reentry_coverage_assessment','reentry_review','reentry_routing','reentry_candidate_history'];
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

-- reentry_candidate is a state machine: service_role may UPDATE state (history is appended
-- separately + immutable). The worker role (next migration) gets INSERT/SELECT only.
grant update on guardian.reentry_candidate to service_role;
