-- ─── ARCH-V4-C7 — SafeBet Guardian Digital Evidence Vault & Chain-of-Custody ──
-- Regulator-grade evidence lifecycle ABOVE the Shared Evidence primitive (which is NOT
-- replaced). SYNTHETIC ONLY. Flow: acquire → register → hash → classify → store/reference
-- → chain-of-custody → access → verify → link-to-case → preserve → supersede/derive →
-- retention/hold → export → audit.
--
-- PRINCIPLES (encoded + tested; DB CHECKs):
--   EVIDENCE EXISTS            != LEGAL FINDING
--   EVIDENCE LINKED TO CASE    != ILLEGAL OPERATOR
--   HASH VERIFIED              != FACT LEGALLY PROVEN
--   HIGH-VALUE EVIDENCE        != ENFORCEMENT AUTHORISATION
--   C7 manages provenance + integrity; it does NOT decide legal consequence, does NOT
--   enforce, does NOT contact providers. A CHECK forbids is_legal_determination=true AND
--   is_enforcement_authorised=true on guardian_evidence.
--
-- Custody integrity = LAYERED (ADR-0017): an independent per-evidence hash chain
-- (sequence_number + previous_event_hash → event_hash), ANCHORED to Shared Audit (each
-- material custody event also writes audit_context). No large body in relational rows —
-- content is a hash + storage reference. All in the dedicated `guardian` schema.

-- ── 1. GUARDIAN EVIDENCE (the registered evidence record) ─────────────────────
create table if not exists guardian.guardian_evidence (
  evidence_id      text primary key,
  product          text not null default 'GUARDIAN' check (product='GUARDIAN'),
  evidence_reference text not null,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  evidence_type    text not null check (evidence_type in ('WEB_CAPTURE','SCREENSHOT','DOCUMENT','REGISTRY_SOURCE_RECORD','MOBILE_APP_METADATA','PAYMENT_REFERENCE','GEO_OBSERVATION','STRUCTURED_DATA','ANALYST_ATTACHMENT','SYSTEM_GENERATED_REPORT','OTHER')),
  source_domain    text check (source_domain in ('C1_REGISTRY','C2_DOMAIN','C3_APP','C4_PAYMENT','C5_GEO','C6_CASE','ANALYST','SYSTEM')),
  source_reference text,
  classification   text not null default 'INTERNAL' check (classification in ('PUBLIC_REFERENCE','INTERNAL','RESTRICTED','HIGHLY_RESTRICTED')),
  purpose          text,
  capture_method   text,
  capture_actor    text,
  captured_at      timestamptz,
  received_at      timestamptz,
  registered_at    timestamptz not null default now(),
  content_hash     text not null,
  hash_algorithm   text not null default 'SHA-256' check (hash_algorithm='SHA-256'),
  size_bytes       bigint,
  media_type       text,
  storage_reference text,                    -- logical/object-store reference (never the body)
  integrity_status text not null default 'UNVERIFIED' check (integrity_status in ('VERIFIED','INTEGRITY_FAILED','UNVERIFIED')),
  retention_policy text not null default 'POLICY_DEFINED',
  retention_review_at timestamptz,
  legal_hold_state text not null default 'NONE' check (legal_hold_state in ('NONE','HELD')),
  correlation_id   text,
  created_by       text not null,
  is_legal_determination boolean not null default false check (is_legal_determination = false),
  is_enforcement_authorised boolean not null default false check (is_enforcement_authorised = false),
  is_synthetic     boolean not null default true check (is_synthetic),
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  unique (evidence_reference, jurisdiction),
  unique (jurisdiction, idempotency_key)
);

-- ── 2. EVIDENCE VERSION (immutability: content change = new version, never overwrite) ─
create table if not exists guardian.guardian_evidence_version (
  version_id       text primary key,
  evidence_id      text not null references guardian.guardian_evidence(evidence_id),
  version_no       integer not null,
  content_hash     text not null,
  storage_reference text,
  reason           text,
  actor            text,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now(),
  unique (evidence_id, version_no)
);

-- ── 3. EVIDENCE DERIVATION (derived artefact ↔ parent lineage; never masquerades) ─
create table if not exists guardian.guardian_evidence_derivation (
  derivation_id    text primary key,
  parent_evidence_id text not null references guardian.guardian_evidence(evidence_id),
  derived_evidence_id text not null references guardian.guardian_evidence(evidence_id),
  derivation_method text not null,
  content_hash     text,
  purpose          text,
  actor            text,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now(),
  check (parent_evidence_id <> derived_evidence_id)
);

-- ── 4. CUSTODY EVENT — APPEND-ONLY per-evidence tamper-evident hash chain ──────
create table if not exists guardian.guardian_evidence_custody_event (
  custody_event_id text primary key,
  evidence_id      text not null references guardian.guardian_evidence(evidence_id),
  sequence_number  integer not null,
  event_type       text not null check (event_type in ('CAPTURED','RECEIVED','REGISTERED','HASH_VERIFIED','STORED','ACCESSED','LINKED_TO_CASE','COPIED_FOR_EXPORT','DERIVED','CLASSIFICATION_CHANGED','LEGAL_HOLD_APPLIED','LEGAL_HOLD_RELEASED','RETENTION_REVIEWED','EXPORTED','INTEGRITY_FAILED','CORRECTION')),
  actor            text,
  actor_role       text,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  occurred_at      timestamptz not null default now(),
  reason           text,
  source_reference text,
  destination_reference text,
  correlation_id   text,
  previous_event_hash text not null,
  event_hash       text not null,
  audit_reference  text,
  is_synthetic     boolean not null default true check (is_synthetic),
  unique (evidence_id, sequence_number)
);

-- ── 5. ACCESS EVENT — APPEND-ONLY (allow/deny decisions with purpose) ─────────
create table if not exists guardian.guardian_evidence_access_event (
  access_id        text primary key,
  evidence_id      text not null references guardian.guardian_evidence(evidence_id),
  actor            text,
  actor_role       text,
  purpose          text,
  classification_at_access text,
  decision         text not null check (decision in ('ALLOW','DENY')),
  deny_reason      text,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  occurred_at      timestamptz not null default now(),
  correlation_id   text,
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 6. LEGAL / PRESERVATION HOLD (DO NOT DELETE WHILE ACTIVE; not a legal finding) ─
create table if not exists guardian.guardian_evidence_hold (
  hold_id          text primary key,
  evidence_id      text references guardian.guardian_evidence(evidence_id),
  case_reference   text,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  hold_state       text not null default 'ACTIVE' check (hold_state in ('ACTIVE','RELEASED')),
  reason           text,
  placed_by        text not null,
  placed_at        timestamptz not null default now(),
  released_by      text,
  released_at      timestamptz,
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 7. EXPORT PACKAGE (regulator/legal review prep; NOT enforcement) ──────────
create table if not exists guardian.guardian_evidence_export (
  export_id        text primary key,
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  case_reference   text,
  manifest_hash    text not null,
  hash_algorithm   text not null default 'SHA-256' check (hash_algorithm='SHA-256'),
  export_state     text not null default 'CREATED' check (export_state in ('CREATED','VERIFIED')),
  purpose          text,
  created_by       text not null,
  is_legal_determination boolean not null default false check (is_legal_determination = false),
  is_synthetic     boolean not null default true check (is_synthetic),
  created_at       timestamptz not null default now()
);

-- ── 8. EXPORT ITEM (evidence reference + hash + integrity status at export) ────
create table if not exists guardian.guardian_evidence_export_item (
  export_item_id   text primary key,
  export_id        text not null references guardian.guardian_evidence_export(export_id),
  evidence_id      text not null references guardian.guardian_evidence(evidence_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  content_hash     text not null,
  integrity_status_at_export text,
  custody_reference text,
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── 9. INTEGRITY CHECK — APPEND-ONLY (verify results; tamper preserved, not deleted) ─
create table if not exists guardian.guardian_evidence_integrity_check (
  check_id         text primary key,
  evidence_id      text not null references guardian.guardian_evidence(evidence_id),
  jurisdiction     text not null references guardian.jurisdiction(jurisdiction),
  expected_hash    text not null,
  computed_hash    text not null,
  result           text not null check (result in ('VERIFIED','INTEGRITY_FAILED')),
  actor            text,
  checked_at       timestamptz not null default now(),
  correlation_id   text,
  is_synthetic     boolean not null default true check (is_synthetic)
);

-- ── Append-only guard for custody/access/integrity (+ version/derivation are insert-only) ─
create or replace function guardian.evidence_block_mutation() returns trigger
  language plpgsql as $fn$
begin
  raise exception 'guardian evidence append-only table: % not permitted', tg_op;
end;
$fn$;
revoke all on function guardian.evidence_block_mutation() from public;

do $$
declare t text; tables text[] := array[
  'guardian_evidence_custody_event','guardian_evidence_access_event','guardian_evidence_integrity_check',
  'guardian_evidence_version','guardian_evidence_derivation'];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %s_append_only on guardian.%I', t, t);
    execute format('create trigger %1$s_append_only before update or delete on guardian.%1$I for each row execute function guardian.evidence_block_mutation()', t);
  end loop;
end $$;

-- ── RLS: jurisdiction-local, Guardian principals only. No anon/public. ────────
do $$
declare t text; tables text[] := array[
  'guardian_evidence','guardian_evidence_version','guardian_evidence_derivation',
  'guardian_evidence_custody_event','guardian_evidence_access_event','guardian_evidence_hold',
  'guardian_evidence_export','guardian_evidence_export_item','guardian_evidence_integrity_check'];
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

-- ── SYNTHETIC SEED (idempotent) — scenarios 1..3,12 ──────────────────────────
insert into guardian.guardian_evidence (evidence_id, evidence_reference, jurisdiction, evidence_type, source_domain, source_reference, classification, purpose, content_hash, size_bytes, media_type, storage_reference, integrity_status, created_by, correlation_id) values
  ('GEV-SYNTH-0001','EV-ZA-GP-0001','ZA-GP','WEB_CAPTURE','C2_DOMAIN','licensed-example-003.test','RESTRICTED','synthetic demo web capture',repeat('1',64),1024,'text/html','synthetic://evidence/ZA-GP/GEV-SYNTH-0001','VERIFIED','syn-inv-001','corr-c7-0001'),
  ('GEV-SYNTH-0002','EV-ZA-GP-0002','ZA-GP','SCREENSHOT','C3_APP','com.safebet.synthetic.bet003','INTERNAL','synthetic demo screenshot',repeat('2',64),2048,'image/png','synthetic://evidence/ZA-GP/GEV-SYNTH-0002','VERIFIED','syn-inv-001','corr-c7-0002'),
  ('GEV-SYNTH-WC-0100','EV-ZA-WC-0100','ZA-WC','DOCUMENT','C1_REGISTRY','LIC-ZA-WC-TEST-0100','HIGHLY_RESTRICTED','synthetic western doc',repeat('c',64),512,'application/pdf','synthetic://evidence/ZA-WC/GEV-SYNTH-WC-0100','VERIFIED','syn-inv-wc','corr-c7-0100')
  on conflict (evidence_id) do nothing;

insert into guardian.guardian_evidence_version (version_id, evidence_id, version_no, content_hash, storage_reference, reason, actor, jurisdiction) values
  ('GEVV-0001-1','GEV-SYNTH-0001',1,repeat('1',64),'synthetic://evidence/ZA-GP/GEV-SYNTH-0001','initial registration','syn-inv-001','ZA-GP')
  on conflict (version_id) do nothing;

insert into guardian.guardian_evidence_custody_event (custody_event_id, evidence_id, sequence_number, event_type, actor, actor_role, jurisdiction, reason, previous_event_hash, event_hash, correlation_id) values
  ('GECE-0001-1','GEV-SYNTH-0001',1,'REGISTERED','syn-inv-001','INVESTIGATOR','ZA-GP','seed registration',repeat('0',64),repeat('a',64),'corr-c7-0001'),
  ('GECE-0001-2','GEV-SYNTH-0001',2,'HASH_VERIFIED','guardian-evidence-worker','SYSTEM_SERVICE','ZA-GP','seed verify',repeat('a',64),repeat('b',64),'corr-c7-0001')
  on conflict (custody_event_id) do nothing;

insert into guardian.guardian_evidence_hold (hold_id, evidence_id, case_reference, jurisdiction, hold_state, reason, placed_by) values
  ('GEH-0001','GEV-SYNTH-0001','GC-INTAKE-0001','ZA-GP','ACTIVE','synthetic preservation hold','syn-leg-001')
  on conflict (hold_id) do nothing;
