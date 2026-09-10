-- ─── ARCH-V4-C6 — Geo Reference Contract + least-privilege case worker ────────
-- 1) Geo Reference Contract: a bounded, Geo-Intelligence-owned view
--    guardian.geo_reference (parallel to the Domain/App/Payment Reference Contracts) so
--    cross-module consumers (Case & Investigation Management) resolve a known synthetic
--    geo service WITHOUT touching the C5 base tables. Owner postgres; jurisdiction-scoped
--    by the app.guardian.jurisdiction GUC; a plain view (NOT SECURITY DEFINER); no
--    PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_case_worker for Case
--    persistence — NOT reusing the domain/app/payment/geo workers. Grants: ONLY the 12
--    C6 case tables + audit_context, plus SELECT on the four governed contract views
--    (domain_reference, app_reference, payment_reference, geo_reference). NO grants on
--    public/IQ and NO C2/C3/C4/C5 base tables. No BYPASSRLS → RLS via jurisdiction GUC.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Mgr.

create or replace view guardian.geo_reference as
select
  s.geo_subject_id          as geo_reference_id,
  s.subject_reference       as geo_reference,
  s.subject_type            as subject_type,
  s.jurisdiction            as jurisdiction,
  a.region_id               as region_reference,
  coalesce(a.availability_state, 'UNKNOWN') as availability_state,
  'REFERENCED'::text        as reference_status,
  case
    when s.last_seen_at > now() - interval '30 days'  then 'FRESH'
    when s.last_seen_at > now() - interval '180 days' then 'AGING'
    else 'STALE'
  end                       as freshness
from guardian.geo_subject s
left join guardian.geo_service_availability a on a.geo_subject_id = s.geo_subject_id
where s.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.geo_reference is
  'ARCH-V4-C6 Geo Reference Contract (owner: Geo & Jurisdiction Intelligence). Bounded, jurisdiction-scoped reference for cross-module consumers (Case Management). Consumers get SELECT on this view only — never on the C5 base tables.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_case_worker') then
    create role guardian_case_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_case_worker;

do $$
declare t text; tables text[] := array[
  'investigation_case','case_subject','case_intelligence_link','case_evidence_link','case_note',
  'case_finding','case_assignment','case_review','case_chronology','case_relationship',
  'case_status_history','case_priority_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_case_worker', t);
    execute format('drop policy if exists cw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy cw_%1$s_sel on guardian.%1$I for select to guardian_case_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists cw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy cw_%1$s_ins on guardian.%1$I for insert to guardian_case_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT views only (NOT the C2/C3/C4/C5 base tables).
grant select on guardian.domain_reference  to guardian_case_worker;
grant select on guardian.app_reference      to guardian_case_worker;
grant select on guardian.payment_reference  to guardian_case_worker;
grant select on guardian.geo_reference      to guardian_case_worker;
