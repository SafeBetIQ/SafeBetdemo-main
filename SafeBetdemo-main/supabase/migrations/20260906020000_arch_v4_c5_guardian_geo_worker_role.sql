-- ─── ARCH-V4-C5 — Payment Reference Contract + least-privilege geo worker ─────
-- 1) Payment Reference Contract: a bounded, Payment-Intelligence-owned view
--    guardian.payment_reference (parallel to the C3.1 Domain Reference Contract and
--    the C4 App Reference Contract) so cross-module consumers (Geo Intelligence)
--    resolve a known synthetic merchant/payment-channel WITHOUT touching the C4 base
--    tables. Owner postgres; jurisdiction-scoped by the app.guardian.jurisdiction GUC;
--    a plain view (NOT SECURITY DEFINER); no PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_geo_worker for Geo
--    Intelligence persistence — NOT reusing guardian_domain_worker /
--    guardian_app_worker / guardian_payment_worker. Grants: ONLY the 10 C5 geo tables
--    + audit_context, plus SELECT on the three governed contract views
--    (domain_reference, app_reference, payment_reference). NO grants on public/IQ and
--    NO C2/C3/C4 base tables. No BYPASSRLS → RLS enforced by jurisdiction GUC.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Mgr.

create or replace view guardian.payment_reference as
select
  m.merchant_subject_id   as payment_reference_id,
  m.merchant_reference    as merchant_reference,
  'REFERENCED'::text      as merchant_reference_state,
  m.jurisdiction          as jurisdiction,
  coalesce(p.channel_type, 'UNKNOWN') as channel_type,
  case
    when m.last_seen_at > now() - interval '30 days'  then 'FRESH'
    when m.last_seen_at > now() - interval '180 days' then 'AGING'
    else 'STALE'
  end                     as freshness,
  'REFERENCED'::text      as reference_status
from guardian.merchant_subject m
left join guardian.payment_subject p on p.merchant_subject_id = m.merchant_subject_id
where m.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.payment_reference is
  'ARCH-V4-C5 Payment Reference Contract (owner: Payment Intelligence). Bounded, jurisdiction-scoped reference for cross-module consumers (Geo Intelligence). Consumers get SELECT on this view only — never on guardian.merchant_subject / guardian.payment_subject.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_geo_worker') then
    create role guardian_geo_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_geo_worker;

do $$
declare t text; tables text[] := array[
  'geo_region','geo_source','geo_signal','geo_subject','geo_observation','geo_service_availability',
  'geo_registry_comparison','geo_entity_link','geo_review_item','geo_change_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_geo_worker', t);
    execute format('drop policy if exists gw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy gw_%1$s_sel on guardian.%1$I for select to guardian_geo_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists gw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy gw_%1$s_ins on guardian.%1$I for insert to guardian_geo_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT views only (NOT the C2/C3/C4 base tables).
grant select on guardian.domain_reference  to guardian_geo_worker;
grant select on guardian.app_reference      to guardian_geo_worker;
grant select on guardian.payment_reference  to guardian_geo_worker;
