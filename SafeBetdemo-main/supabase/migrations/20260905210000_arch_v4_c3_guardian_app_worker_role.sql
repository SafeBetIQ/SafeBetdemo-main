-- ─── ARCH-V4-C3 — least-privilege Guardian app worker DB principal ────────────
-- A SEPARATE dedicated role for Mobile App Intelligence persistence (NOT reusing
-- guardian_domain_worker). Grants ONLY on the 10 C3 mobile_app_* tables + audit_context
-- — no grants on public/IQ (IQ business data unreachable at the privilege level) and no
-- grants on the C2 domain tables (it may READ domain_subject for the app→domain link
-- only). No BYPASSRLS → RLS enforced, scoped by the per-message jurisdiction GUC.
--
-- SECRET-FREE: role created WITHOUT a password; password set out-of-band + stored ONLY in
-- AWS Secrets Manager. Reversible (runbook): revoke + drop role + delete secret.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_app_worker') then
    create role guardian_app_worker login;
  end if;
end $$;

grant usage on schema guardian to guardian_app_worker;

do $$
declare t text; tables text[] := array[
  'mobile_app_subject','mobile_app_observation','mobile_app_snapshot','mobile_app_content_signal',
  'mobile_app_technical_signal','mobile_app_registry_comparison','mobile_app_entity_link',
  'mobile_app_domain_link','mobile_app_review_item','mobile_app_change_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_app_worker', t);
    execute format('drop policy if exists aw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy aw_%1$s_sel on guardian.%1$I for select to guardian_app_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists aw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy aw_%1$s_ins on guardian.%1$I for insert to guardian_app_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Read-only on the C2 domain_subject (for the governed app→domain link resolution only).
grant select on guardian.domain_subject to guardian_app_worker;
drop policy if exists aw_domain_subject_sel on guardian.domain_subject;
create policy aw_domain_subject_sel on guardian.domain_subject for select to guardian_app_worker
  using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') );
