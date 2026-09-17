-- ─── ARCH-V4-C10 — C9 Orchestration Reference Contract + least-privilege re-entry worker ─
-- 1) A bounded, C9-owned view guardian.orchestration_reference exposing ONLY the bounded
--    handoff columns of an orchestration (incl. latest provider state + latest verification
--    state). C10 consumes THIS — never the C9 enforcement_orchestration / provider_response /
--    enforcement_verification base tables. Owner postgres; jurisdiction-scoped by the
--    app.guardian.jurisdiction GUC; a plain view (NOT SECURITY DEFINER); no PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_reentry_worker — NOT reusing the C9
--    enforcement worker. Grants: SELECT/INSERT on the C10 tables + audit_context, SELECT on the
--    orchestration_reference contract view. NO grants on public/IQ, NO C1–C9 base tables, NO
--    UPDATE/DELETE, NO BYPASSRLS. It can NEVER dispatch C9 (no enforcement grant, no SQS send).
-- Secret-free: role created WITHOUT a password; login password set out-of-band + Secrets Mgr.

-- ── C9 Orchestration Reference Contract (bounded; latest provider + verification state) ──
create or replace view guardian.orchestration_reference as
select
  o.orchestration_id        as orchestration_reference,
  o.authorisation_reference as authorisation_reference,
  o.action_type             as action_type,
  o.target_type             as target_type,
  o.target_reference        as target_reference,
  o.jurisdiction            as jurisdiction,
  o.provider_channel        as provider_channel,
  o.status                  as orchestration_status,
  ( select pr.provider_state from guardian.provider_response pr
      where pr.orchestration_id = o.orchestration_id
      order by pr.received_at desc limit 1 ) as latest_provider_state,
  ( select v.result from guardian.enforcement_verification v
      where v.orchestration_id = o.orchestration_id
      order by v.verified_at desc limit 1 ) as latest_verification_state,
  o.created_at              as created_at,
  o.completed_at            as closed_at,
  'ACTIVE'                  as reference_status
from guardian.enforcement_orchestration o
where o.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.orchestration_reference is
  'ARCH-V4-C10 C9 Orchestration Reference Contract (owner: C9 Orchestration). Bounded handoff columns incl. latest provider + verification state; jurisdiction-scoped; plain view (not SECURITY DEFINER). Consumers get SELECT on this view only — never guardian.enforcement_orchestration / provider_response / enforcement_verification.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_reentry_worker') then
    create role guardian_reentry_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_reentry_worker;

do $$
declare t text; tables text[] := array[
  'enforcement_verification_observation','reentry_candidate','reentry_relationship_assessment',
  'reentry_coverage_assessment','reentry_review','reentry_routing','reentry_candidate_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_reentry_worker', t);
    execute format('drop policy if exists rew_%s_sel on guardian.%I', t, t);
    execute format($f$create policy rew_%1$s_sel on guardian.%1$I for select to guardian_reentry_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists rew_%s_ins on guardian.%I', t, t);
    execute format($f$create policy rew_%1$s_ins on guardian.%1$I for insert to guardian_reentry_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT view only (NOT the C9 base tables). The worker holds NO grant
-- on guardian.enforcement_orchestration and cannot dispatch enforcement.
grant select on guardian.orchestration_reference to guardian_reentry_worker;
