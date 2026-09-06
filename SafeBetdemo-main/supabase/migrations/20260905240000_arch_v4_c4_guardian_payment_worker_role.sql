-- ─── ARCH-V4-C4 — App Reference Contract + least-privilege payment worker ─────
-- 1) App Reference Contract: a bounded, App-Intelligence-owned view guardian.app_reference
--    (parallel to the C3.1 Domain Reference Contract) so cross-module consumers resolve a
--    known synthetic app WITHOUT touching the C3 base tables. Owner postgres; jurisdiction-
--    scoped by the app.guardian.jurisdiction GUC; a plain view (NOT SECURITY DEFINER); no
--    PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_payment_worker for Payment
--    Intelligence persistence — NOT reusing guardian_domain_worker / guardian_app_worker.
--    Grants: ONLY the 9 C4 payment tables + audit_context, plus SELECT on the two governed
--    contract views (domain_reference, app_reference). NO grants on public/IQ and NO C2/C3
--    base tables. No BYPASSRLS → RLS enforced by jurisdiction GUC.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Manager.

create or replace view guardian.app_reference as
select
  s.app_subject_id          as app_reference_id,
  s.canonical_app_identifier as canonical_app_identifier,
  s.jurisdiction            as jurisdiction,
  'REFERENCED'::text        as reference_status,
  case
    when s.last_seen_at > now() - interval '30 days'  then 'FRESH'
    when s.last_seen_at > now() - interval '180 days' then 'AGING'
    else 'STALE'
  end                       as freshness
from guardian.mobile_app_subject s
where s.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.app_reference is
  'ARCH-V4-C4 App Reference Contract (owner: Mobile App Intelligence). Bounded, jurisdiction-scoped reference for cross-module consumers. Consumers get SELECT on this view only — never on guardian.mobile_app_subject.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_payment_worker') then
    create role guardian_payment_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_payment_worker;

do $$
declare t text; tables text[] := array[
  'merchant_subject','payment_subject','payment_provider_reference','merchant_observation',
  'payment_observation','payment_registry_comparison','payment_entity_link','payment_review_item',
  'payment_change_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_payment_worker', t);
    execute format('drop policy if exists pw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy pw_%1$s_sel on guardian.%1$I for select to guardian_payment_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists pw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy pw_%1$s_ins on guardian.%1$I for insert to guardian_payment_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT views only (NOT the C2/C3 base tables).
grant select on guardian.domain_reference to guardian_payment_worker;
grant select on guardian.app_reference to guardian_payment_worker;
