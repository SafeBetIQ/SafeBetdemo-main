-- ─── ARCH-V4-C9 — Authorised-Action Contract + least-privilege enforcement worker ─
-- 1) Authorised-Action Contract: a bounded, C8-owned view guardian.authorised_action that
--    exposes ONLY AUTHORISED, non-expired, non-withdrawn, non-superseded records with the
--    bounded C9-handoff columns. C9 consumes this — never the C8 action_authorisation base
--    table. Owner postgres; jurisdiction-scoped by the app.guardian.jurisdiction GUC; a plain
--    view (NOT SECURITY DEFINER); no PUBLIC/anon grant. The view's WHERE clause is the
--    revalidation gate at the data layer (expired/withdrawn/superseded rows are invisible).
-- 2) A SEPARATE dedicated least-privilege role guardian_enforcement_worker — NOT reusing any
--    prior worker. Grants: SELECT/INSERT on the 8 C9 tables + audit_context, plus SELECT on
--    the authorised_action contract view. NO grants on public/IQ, NO C1–C8 base tables, NO
--    BYPASSRLS. It can NEVER create a C8 authorisation (it has no C8 table grant).
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Mgr.

create or replace view guardian.authorised_action as
select
  a.authorisation_id     as authorisation_reference,
  p.action_type          as action_type,
  p.target_type          as target_type,
  p.target_reference     as target_reference,
  a.jurisdiction         as jurisdiction,
  a.version_id           as policy_reference,
  a.authority_reference  as authority_reference,
  a.case_reference       as case_reference,
  a.evidence_manifest_reference as evidence_manifest_reference,
  a.evidence_manifest_hash as evidence_manifest_hash,
  a.authorised_at        as authorised_at,
  a.expires_at           as expires_at,
  a.authorisation_status as status
from guardian.action_authorisation a
join guardian.proposed_action p on p.proposed_action_id = a.proposed_action_id
where a.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '')
  and a.authorisation_status = 'AUTHORISED'
  and (a.expires_at is null or a.expires_at > now());

comment on view guardian.authorised_action is
  'ARCH-V4-C9 Authorised-Action Contract (owner: C8 Authorisation). Exposes ONLY AUTHORISED, non-expired records with bounded handoff columns. Data-layer revalidation gate; consumers get SELECT on this view only — never guardian.action_authorisation.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_enforcement_worker') then
    create role guardian_enforcement_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_enforcement_worker;

do $$
declare t text; tables text[] := array[
  'provider_channel','enforcement_orchestration','provider_request','provider_response',
  'enforcement_verification','dispatch_attempt','orchestration_status_history','orchestration_withdrawal','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_enforcement_worker', t);
    execute format('drop policy if exists efw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy efw_%1$s_sel on guardian.%1$I for select to guardian_enforcement_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists efw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy efw_%1$s_ins on guardian.%1$I for insert to guardian_enforcement_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT view only (NOT the C8 base tables).
grant select on guardian.authorised_action to guardian_enforcement_worker;
