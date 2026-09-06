-- ─── ARCH-V4-C2.1 — least-privilege Guardian domain worker DB principal ───────
-- A dedicated, non-human Postgres role for the domain worker's persistence. It has
-- GRANTS ONLY on the guardian schema's C2 domain tables (+ audit_context) — it has
-- NO grants on `public`/SafeBet IQ tables, so IQ business data is unreachable at the
-- privilege level. It is NOT service_role and has NO BYPASSRLS, so RLS is enforced;
-- dedicated policies scope every read/write by a per-message jurisdiction GUC
-- (`app.guardian.jurisdiction`) that the worker sets after validating the message.
--
-- SECRET-FREE MIGRATION: the role is created WITHOUT a password here. The password is
-- set out-of-band (`alter role … password`) and stored ONLY in AWS Secrets Manager —
-- never committed. Reversible (runbook): revoke grants + drop role + delete secret.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'guardian_domain_worker') then
    create role guardian_domain_worker login;
  end if;
end $$;

-- Schema usage only on guardian (NOT public / NOT any IQ schema).
grant usage on schema guardian to guardian_domain_worker;

-- Minimum table privileges: SELECT (idempotency lookups) + INSERT (persist) on the C2
-- domain tables and the shared audit-context table. No UPDATE/DELETE, no other tables.
do $$
declare t text; tables text[] := array[
  'domain_subject','domain_observation','website_snapshot','page_resource_reference',
  'domain_technical_signal','domain_content_signal','domain_registry_comparison',
  'domain_entity_link','domain_review_item','domain_change_history','audit_context'];
begin
  foreach t in array tables loop
    execute format('grant select, insert on guardian.%I to guardian_domain_worker', t);
    -- Dedicated RLS policies for the worker role, scoped by the jurisdiction GUC.
    execute format('drop policy if exists gw_%s_sel on guardian.%I', t, t);
    execute format($f$create policy gw_%1$s_sel on guardian.%1$I for select to guardian_domain_worker
      using ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
    execute format('drop policy if exists gw_%s_ins on guardian.%I', t, t);
    execute format($f$create policy gw_%1$s_ins on guardian.%1$I for insert to guardian_domain_worker
      with check ( jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true),'') )$f$, t);
  end loop;
end $$;

-- Allow the worker role to set only its own jurisdiction GUC (a custom GUC needs no grant;
-- documented here for clarity). The worker sets: `set app.guardian.jurisdiction = '<jur>'`.
