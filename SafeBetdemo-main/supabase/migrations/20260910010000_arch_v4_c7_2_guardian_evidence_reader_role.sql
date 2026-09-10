-- ─── ARCH-V4-C7.2 — least-privilege evidence RETRIEVAL principal ──────────────
-- A SEPARATE dedicated read/retrieval DB role guardian_evidence_reader — NOT the writer
-- (guardian_evidence_worker) and NOT any other Guardian worker. Grants:
--   • SELECT on the 9 evidence tables (read metadata: canonical hash, storage ref,
--     jurisdiction, classification) + audit_context + the governed case_reference view;
--   • INSERT ONLY on guardian_evidence_access_event and guardian_evidence_custody_event
--     (record the audited ACCESS + append an ACCESSED custody event).
-- NO INSERT on guardian_evidence / _version / _derivation / _hold / _export(_item) /
-- _integrity_check (the reader cannot fabricate/alter evidence). NO public/IQ, NO C1–C6 base
-- tables, NO BYPASSRLS → RLS via the app.guardian.jurisdiction GUC.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Manager.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_evidence_reader') then
    create role guardian_evidence_reader login;
  end if;
end $$;

grant usage on schema guardian to guardian_evidence_reader;

-- SELECT on all evidence tables + audit + read-only RLS policy (jurisdiction GUC).
do $$
declare t text; tables text[] := array[
  'guardian_evidence','guardian_evidence_version','guardian_evidence_derivation',
  'guardian_evidence_custody_event','guardian_evidence_access_event','guardian_evidence_hold',
  'guardian_evidence_export','guardian_evidence_export_item','guardian_evidence_integrity_check','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select on guardian.%I to guardian_evidence_reader', t);
    execute format('drop policy if exists er_%s_sel on guardian.%I', t, t);
    execute format($f$create policy er_%1$s_sel on guardian.%1$I for select to guardian_evidence_reader
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- INSERT ONLY on the two append-only audit surfaces the reader must write.
do $$
declare t text; tables text[] := array['guardian_evidence_access_event','guardian_evidence_custody_event','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant insert on guardian.%I to guardian_evidence_reader', t);
    execute format('drop policy if exists er_%s_ins on guardian.%I', t, t);
    execute format($f$create policy er_%1$s_ins on guardian.%1$I for insert to guardian_evidence_reader
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT view only (NOT the C6 case base tables).
grant select on guardian.case_reference to guardian_evidence_reader;
