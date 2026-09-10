-- ─── ARCH-V4-C6 — SafeBet Guardian Case & Investigation Management foundation ─
-- The governed HUMAN investigation layer between Guardian intelligence (C1–C5) and any
-- FUTURE legal/enforcement workflow. SYNTHETIC ONLY. Flow:
--   intelligence signals → intake → case → subject/entity linking → evidence →
--   chronology → analyst findings → review → case status.
--
-- FUNDAMENTAL BOUNDARY (encoded + tested; DB CHECKs):
--   INTELLIGENCE RESULT   != LEGAL FINDING
--   CASE OPENED           != ILLEGAL OPERATOR
--   HIGH PRIORITY CASE    != ENFORCEMENT AUTHORISATION
--   INVESTIGATOR FINDING  != FINAL LEGAL DETERMINATION
--   CASE CLOSED           != PROVIDER ACTION
--   No C6 object triggers blocking/referral/enforcement. A case-table CHECK forbids
--   is_legal_determination=true AND is_enforcement_authorised=true. No enforcement
--   status (ENFORCEMENT_APPROVED/BLOCKED/TAKEDOWN_COMPLETE) and no finding
--   ILLEGAL_OPERATOR_CONFIRMED exist.
--
-- All in the dedicated `guardian` schema. Immutable Guardian keys. No SafeBet IQ public
-- business table referenced. Minimisation: cases hold REFERENCES, never duplicated bodies.

-- ── 1. INVESTIGATION CASE ─────────────────────────────────────────────────────
create table if not exists guardian.investigation_case (
  case_id         text primary key,
  product         text not null default 'GUARDIAN' check (product='GUARDIAN'),
  case_reference  text not null,
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  title           text not null,
  case_type       text not null check (case_type in ('UNAUTHORISED_OPERATION_REVIEW','DOMAIN_REVIEW','MOBILE_APP_REVIEW','PAYMENT_CHANNEL_REVIEW','GEO_JURISDICTION_REVIEW','ENTITY_RESOLUTION_REVIEW','MULTI_SIGNAL_INVESTIGATION','OTHER')),
  status          text not null default 'DRAFT' check (status in ('DRAFT','OPEN','TRIAGE','INVESTIGATING','AWAITING_INFORMATION','AWAITING_REVIEW','REVIEWED','CLOSED','CANCELLED')),
  priority        text not null default 'LOW' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),
  intake_source   text not null default 'MANUAL_SYNTHETIC_INTAKE' check (intake_source in ('MANUAL_SYNTHETIC_INTAKE','INTELLIGENCE_REVIEW_PROMOTION','SYSTEM_RECOMMENDED_CASE')),
  reason_codes    jsonb not null default '[]'::jsonb,
  purpose         text,
  classification  text not null default 'RESTRICTED',
  retention_policy text not null default 'POLICY_DEFINED',
  access_scope    text not null default 'JURISDICTION_LOCAL',
  opened_at       timestamptz,
  closed_at       timestamptz,
  closure_reason  text check (closure_reason in ('FALSE_POSITIVE','INSUFFICIENT_EVIDENCE','DUPLICATE','REFERENCE_RESOLVED','NO_FURTHER_ACTION_AT_THIS_STAGE','TRANSFERRED_FOR_FURTHER_REVIEW','OTHER')),
  created_by      text not null,
  assigned_to     text,
  correlation_id  text,
  is_legal_determination boolean not null default false check (is_legal_determination = false),
  is_enforcement_authorised boolean not null default false check (is_enforcement_authorised = false),
  is_synthetic    boolean not null default true check (is_synthetic),
  idempotency_key text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (case_reference, jurisdiction),
  unique (jurisdiction, idempotency_key)
);

-- ── 2. CASE SUBJECT (bounded reference — never duplicates the full entity) ─────
create table if not exists guardian.case_subject (
  case_subject_id text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  subject_type    text not null check (subject_type in ('OPERATOR','BRAND','LICENCE','DOMAIN','MOBILE_APP','MERCHANT','PAYMENT_CHANNEL','GEO_SERVICE_REFERENCE','OTHER_GUARDIAN_SUBJECT')),
  subject_reference text not null,
  source          text,
  relationship    text not null default 'SUBJECT_OF_INVESTIGATION',
  human_confirmed boolean not null default false,
  is_synthetic    boolean not null default true check (is_synthetic),
  linked_at       timestamptz not null default now()
);

-- ── 3. CASE INTELLIGENCE LINK (preserve what was known at the time) ────────────
create table if not exists guardian.case_intelligence_link (
  link_id         text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  source_domain   text not null check (source_domain in ('C1_REGISTRY','C2_DOMAIN','C3_APP','C4_PAYMENT','C5_GEO')),
  source_reference text not null,
  reference_type  text not null,
  reference_state text,                    -- snapshot of the governed reference match state
  source_as_of    timestamptz,
  reason          text,
  linked_by       text,
  audit_reference text,
  is_synthetic    boolean not null default true check (is_synthetic),
  linked_at       timestamptz not null default now()
);

-- ── 4. CASE EVIDENCE LINK (reference-based; body never duplicated) ─────────────
create table if not exists guardian.case_evidence_link (
  evidence_link_id text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  evidence_reference text not null,
  source_domain   text,
  classification  text not null default 'RESTRICTED',
  purpose         text,
  integrity_hash  text,
  integrity_status text not null default 'VERIFIED' check (integrity_status in ('VERIFIED','INTEGRITY_FAILED','UNVERIFIED')),
  linked_by       text,
  audit_reference text,
  is_synthetic    boolean not null default true check (is_synthetic),
  linked_at       timestamptz not null default now()
);

-- ── 5. CASE NOTE (synthetic; no secrets, no unnecessary personal data) ─────────
create table if not exists guardian.case_note (
  note_id         text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  author          text not null,
  classification  text not null default 'RESTRICTED',
  note_reference  text,                    -- reference/text (synthetic)
  purpose         text,
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

-- ── 6. CASE FINDING (bounded analyst findings; NO illegality) ──────────────────
create table if not exists guardian.case_finding (
  finding_id      text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  finding_state   text not null check (finding_state in ('FACT_CONFIRMED','REFERENCE_CONFIRMED','INCONSISTENCY_CONFIRMED','SOURCE_INSUFFICIENT','SOURCE_CONFLICT','ENTITY_RELATIONSHIP_CONFIRMED','REQUIRES_FURTHER_INVESTIGATION','FALSE_POSITIVE','UNRESOLVED')),
  reason_codes    jsonb not null default '[]'::jsonb,
  recorded_by     text not null,
  reference       text,
  is_legal_determination boolean not null default false check (is_legal_determination = false),
  is_synthetic    boolean not null default true check (is_synthetic),
  recorded_at     timestamptz not null default now()
);

-- ── 7. CASE ASSIGNMENT (historically traceable) ───────────────────────────────
create table if not exists guardian.case_assignment (
  assignment_id   text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  assigned_role   text not null check (assigned_role in ('INVESTIGATOR','LEGAL_REVIEWER','AUTHORISING_OFFICER','SYSTEM_SERVICE')),
  assigned_principal text not null,
  team_queue      text,
  assigned_by     text,
  is_synthetic    boolean not null default true check (is_synthetic),
  assigned_at     timestamptz not null default now()
);

-- ── 8. CASE REVIEW (bounded legal/regulatory review; NO external action) ───────
create table if not exists guardian.case_review (
  review_id       text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  reviewer_principal text not null,
  review_type     text not null default 'LEGAL_REVIEW',
  requested_at    timestamptz not null default now(),
  completed_at    timestamptz,
  outcome         text check (outcome in ('SUFFICIENT_FOR_FURTHER_REVIEW','INSUFFICIENT_EVIDENCE','RETURN_TO_INVESTIGATION','REFERENCE_VALIDATED','CONFLICT_REQUIRES_RESOLUTION')),
  legal_basis_reference text,               -- placeholder; no legal determination
  comments_reference text,
  audit_reference text,
  is_enforcement_authorised boolean not null default false check (is_enforcement_authorised = false),
  is_synthetic    boolean not null default true check (is_synthetic)
);

-- ── 9. CASE CHRONOLOGY — APPEND-ONLY timeline ─────────────────────────────────
create table if not exists guardian.case_chronology (
  chronology_id   text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  event_type      text not null check (event_type in ('CASE_OPENED','SUBJECT_LINKED','INTELLIGENCE_LINKED','EVIDENCE_LINKED','NOTE_ADDED','ASSIGNMENT_CHANGED','STATUS_CHANGED','PRIORITY_CHANGED','FINDING_RECORDED','REVIEW_REQUESTED','REVIEW_COMPLETED','CASE_CLOSED','CASE_REOPENED')),
  actor           text,
  detail_reference text,
  is_synthetic    boolean not null default true check (is_synthetic),
  recorded_at     timestamptz not null default now()
);

-- ── 10. CASE RELATIONSHIP (relate without merging) ────────────────────────────
create table if not exists guardian.case_relationship (
  relationship_id text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  related_case_id text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  relationship_type text not null check (relationship_type in ('DUPLICATE_OF','RELATED_TO','PARENT_CASE','CHILD_CASE','COMMON_ENTITY','COMMON_SIGNAL')),
  human_confirmed boolean not null default false,
  is_synthetic    boolean not null default true check (is_synthetic),
  created_at      timestamptz not null default now()
);

-- ── 11. CASE STATUS HISTORY — APPEND-ONLY ─────────────────────────────────────
create table if not exists guardian.case_status_history (
  status_history_id text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  previous_status text,
  new_status      text not null,
  changed_by      text,
  reason          text,
  is_synthetic    boolean not null default true check (is_synthetic),
  changed_at      timestamptz not null default now()
);

-- ── 12. CASE PRIORITY HISTORY — APPEND-ONLY ───────────────────────────────────
create table if not exists guardian.case_priority_history (
  priority_history_id text primary key,
  case_id         text not null references guardian.investigation_case(case_id),
  jurisdiction    text not null references guardian.jurisdiction(jurisdiction),
  previous_priority text,
  new_priority    text not null,
  changed_by      text,
  override_reason text,
  is_synthetic    boolean not null default true check (is_synthetic),
  changed_at      timestamptz not null default now()
);

-- ── Append-only guard for chronology + status/priority history ────────────────
create or replace function guardian.case_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian case append-only table: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.case_block_mutation() from public;

do $$
declare t text; tables text[] := array['case_chronology','case_status_history','case_priority_history'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.case_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'investigation_case','case_subject','case_intelligence_link','case_evidence_link','case_note',
  'case_finding','case_assignment','case_review','case_chronology','case_relationship',
  'case_status_history','case_priority_history'];
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

-- ── SYNTHETIC SEED (idempotent) — scenarios 1..5 ──────────────────────────────
insert into guardian.investigation_case (case_id, case_reference, jurisdiction, title, case_type, status, priority, intake_source, reason_codes, purpose, created_by, assigned_to, correlation_id, idempotency_key) values
  ('CASE-SYNTH-0001','GC-ZA-GP-0001','ZA-GP','Multi-signal synthetic investigation (Safe Example Betting)','MULTI_SIGNAL_INVESTIGATION','INVESTIGATING','MEDIUM','INTELLIGENCE_REVIEW_PROMOTION','["MULTI_SIGNAL_CORRELATION"]'::jsonb,'synthetic demo','syn-inv-001','syn-inv-001','corr-c6-0001','cidem-0001'),
  ('CASE-SYNTH-0002','GC-ZA-GP-0002','ZA-GP','Unknown domain review (NO_MATCH → investigation)','DOMAIN_REVIEW','OPEN','HIGH','SYSTEM_RECOMMENDED_CASE','["NO_AUTHORITATIVE_REGISTRY_MATCH","INVESTIGATION_REQUIRED"]'::jsonb,'synthetic demo','syn-svc','syn-inv-001','corr-c6-0002','cidem-0002')
  on conflict (case_id) do nothing;

insert into guardian.case_subject (case_subject_id, case_id, jurisdiction, subject_type, subject_reference, source, relationship) values
  ('CSUB-0001-DOM','CASE-SYNTH-0001','ZA-GP','DOMAIN','DOM-SYNTH-0003','C2_DOMAIN','SUBJECT_OF_INVESTIGATION'),
  ('CSUB-0001-APP','CASE-SYNTH-0001','ZA-GP','MOBILE_APP','APP-SYNTH-0003','C3_APP','SUBJECT_OF_INVESTIGATION'),
  ('CSUB-0001-PAY','CASE-SYNTH-0001','ZA-GP','MERCHANT','MER-SYNTH-0001','C4_PAYMENT','SUBJECT_OF_INVESTIGATION')
  on conflict (case_subject_id) do nothing;

insert into guardian.case_intelligence_link (link_id, case_id, jurisdiction, source_domain, source_reference, reference_type, reference_state, reason, linked_by) values
  ('CIL-0001-DOM','CASE-SYNTH-0001','ZA-GP','C2_DOMAIN','licensed-example-003.test','DOMAIN_REFERENCE','REFERENCED','domain reference','syn-inv-001'),
  ('CIL-0001-GEO','CASE-SYNTH-0001','ZA-GP','C5_GEO','licensed-example-003.test','GEO_REFERENCE','REFERENCED','geo reference','syn-inv-001')
  on conflict (link_id) do nothing;

insert into guardian.case_chronology (chronology_id, case_id, jurisdiction, event_type, actor, detail_reference) values
  ('CHR-0001-1','CASE-SYNTH-0001','ZA-GP','CASE_OPENED','syn-inv-001','GC-ZA-GP-0001'),
  ('CHR-0001-2','CASE-SYNTH-0001','ZA-GP','INTELLIGENCE_LINKED','syn-inv-001','CIL-0001-DOM'),
  ('CHR-0002-1','CASE-SYNTH-0002','ZA-GP','CASE_OPENED','syn-svc','GC-ZA-GP-0002')
  on conflict (chronology_id) do nothing;

insert into guardian.case_status_history (status_history_id, case_id, jurisdiction, previous_status, new_status, changed_by) values
  ('CSH-0001-1','CASE-SYNTH-0001','ZA-GP',null,'DRAFT','syn-inv-001'),
  ('CSH-0001-2','CASE-SYNTH-0001','ZA-GP','DRAFT','INVESTIGATING','syn-inv-001')
  on conflict (status_history_id) do nothing;

insert into guardian.case_priority_history (priority_history_id, case_id, jurisdiction, previous_priority, new_priority, changed_by, override_reason) values
  ('CPH-0001-1','CASE-SYNTH-0001','ZA-GP',null,'MEDIUM','syn-inv-001','initial triage')
  on conflict (priority_history_id) do nothing;
