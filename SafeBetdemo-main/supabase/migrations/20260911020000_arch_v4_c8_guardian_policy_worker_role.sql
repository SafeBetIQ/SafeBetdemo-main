-- ─── ARCH-V4-C8 — Evidence Reference Contract + least-privilege policy worker ─
-- 1) Evidence Reference Contract: a bounded, Evidence-Vault-owned view
--    guardian.evidence_reference (parallel to the Domain/App/Payment/Geo/Case Reference
--    Contracts) so the authorisation workflow can evaluate the evidence gate WITHOUT
--    touching the C7 evidence base tables. Owner postgres; jurisdiction-scoped by the
--    app.guardian.jurisdiction GUC; a plain view (NOT SECURITY DEFINER); no PUBLIC/anon grant.
-- 2) A SEPARATE dedicated least-privilege role guardian_policy_worker for deterministic
--    authorisation-gate evaluation — NOT reusing domain/app/payment/geo/case/evidence
--    (writer|reader) workers. Grants: SELECT on the 12 C8 tables + policy contract inputs +
--    the case_reference + evidence_reference contract views; INSERT on proposed_action +
--    proposed_action_history + audit_context ONLY (it may prepare a proposed action /
--    BLOCKED-or-REVIEW state — it may NOT insert legal_review or action_authorisation, so it
--    CANNOT grant a final authorisation). NO public/IQ, NO C1–C7 base tables, NO BYPASSRLS.
-- Secret-free: role created WITHOUT a password; password set out-of-band + Secrets Mgr.

create or replace view guardian.evidence_reference as
select
  e.evidence_id        as evidence_reference_id,
  e.evidence_reference as evidence_reference,
  e.jurisdiction       as jurisdiction,
  e.classification     as classification,
  e.integrity_status   as integrity_status,
  e.source_domain      as source_domain,
  e.legal_hold_state   as hold_state,
  e.captured_at        as captured_at,
  'REFERENCED'::text   as reference_status
from guardian.guardian_evidence e
where e.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.evidence_reference is
  'ARCH-V4-C8 Evidence Reference Contract (owner: Digital Evidence Vault). Bounded, jurisdiction-scoped reference (incl. integrity_status + hold_state) for the authorisation evidence gate. Consumers get SELECT on this view only — never the C7 evidence base tables.';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_policy_worker') then
    create role guardian_policy_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_policy_worker;

-- SELECT on all 12 C8 tables (+ audit) for deterministic evaluation.
do $$
declare t text; tables text[] := array[
  'enforcement_policy','policy_version','policy_action_permission','policy_condition','policy_exception',
  'policy_review_record','policy_status_history','proposed_action','legal_review','action_authorisation',
  'authorisation_history','proposed_action_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select on guardian.%I to guardian_policy_worker', t);
    execute format('drop policy if exists pw8_%s_sel on guardian.%I', t, t);
    execute format($f$create policy pw8_%1$s_sel on guardian.%1$I for select to guardian_policy_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- INSERT ONLY on proposed_action + its history + audit (the worker may PREPARE a proposal /
-- BLOCKED-or-REVIEW state). It CANNOT insert legal_review or action_authorisation → it can
-- never grant a final authorisation (machine authorisation impossible at the privilege level).
do $$
declare t text; tables text[] := array['proposed_action','proposed_action_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant insert on guardian.%I to guardian_policy_worker', t);
    execute format('drop policy if exists pw8_%s_ins on guardian.%I', t, t);
    execute format($f$create policy pw8_%1$s_ins on guardian.%1$I for insert to guardian_policy_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Governed cross-module CONTRACT views only (NOT the C6/C7 base tables).
grant select on guardian.case_reference     to guardian_policy_worker;
grant select on guardian.evidence_reference to guardian_policy_worker;
