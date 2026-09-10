-- ─── ARCH-V4-C7 — Case Reference Contract + least-privilege evidence worker ───
-- 1) Case Reference Contract: a bounded, Case-Management-owned view
--    guardian.case_reference (parallel to the Domain/App/Payment/Geo Reference Contracts)
--    so the Evidence Vault resolves a bounded case reference WITHOUT touching the C6 case
--    base tables. Owner postgres; jurisdiction-scoped by the app.guardian.jurisdiction GUC;
--    a plain view (NOT SECURITY DEFINER); no PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_evidence_worker — NOT reusing the
--    domain/app/payment/geo/case workers. Grants: ONLY the 9 C7 evidence tables +
--    audit_context, plus SELECT on the case_reference contract view. NO grants on public/IQ
--    and NO C1–C6 base tables. No BYPASSRLS → RLS via jurisdiction GUC.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Mgr.

create or replace view guardian.case_reference as
select
  c.case_id          as case_reference_id,
  c.case_reference   as case_reference,
  c.jurisdiction     as jurisdiction,
  c.status           as case_status,
  c.classification   as classification,
  'REFERENCED'::text as reference_status
from guardian.investigation_case c
where c.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.case_reference is
  'ARCH-V4-C7 Case Reference Contract (owner: Case & Investigation Management). Bounded, jurisdiction-scoped reference for the Evidence Vault. Consumers get SELECT on this view only — never on the C6 case base tables.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_evidence_worker') then
    create role guardian_evidence_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_evidence_worker;

do $$
declare t text; tables text[] := array[
  'guardian_evidence','guardian_evidence_version','guardian_evidence_derivation',
  'guardian_evidence_custody_event','guardian_evidence_access_event','guardian_evidence_hold',
  'guardian_evidence_export','guardian_evidence_export_item','guardian_evidence_integrity_check','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_evidence_worker', t);
    execute format('drop policy if exists ew_%s_sel on guardian.%I', t, t);
    execute format($f$create policy ew_%1$s_sel on guardian.%1$I for select to guardian_evidence_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists ew_%s_ins on guardian.%I', t, t);
    execute format($f$create policy ew_%1$s_ins on guardian.%1$I for insert to guardian_evidence_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT view only (NOT the C6 case base tables).
grant select on guardian.case_reference to guardian_evidence_worker;
