-- ─── ARCH-V4-C3.1 — Domain Reference Contract; remove raw C2 coupling ─────────
-- Replaces the app worker's DIRECT SELECT on the C2 base table guardian.domain_subject
-- with a bounded, Domain-owned contract object: the view guardian.domain_reference.
--
-- The view is owned by Domain Intelligence (the table owner, postgres); it exposes ONLY
-- the bounded reference fields (never the full row, never arbitrary query capability) and
-- is JURISDICTION-SCOPED via the `app.guardian.jurisdiction` GUC. Because the view runs
-- with the owner's privileges over domain_subject, a consumer role (guardian_app_worker)
-- needs SELECT on the VIEW only — NOT on the base table. So we REVOKE the base-table grant.
--
-- Not a SECURITY DEFINER function (a plain view). No PUBLIC/anon grant. Reversible: drop
-- the view + re-grant domain_subject + restore the aw_domain_subject_sel policy.

-- Bounded Domain-owned reference contract (jurisdiction-scoped by the caller's GUC).
create or replace view guardian.domain_reference as
select
  ds.domain_id            as domain_reference_id,
  ds.canonical_hostname   as canonical_hostname,
  ds.jurisdiction         as jurisdiction,
  'REFERENCED'::text      as reference_status,
  case
    when ds.last_seen_at > now() - interval '30 days'  then 'FRESH'
    when ds.last_seen_at > now() - interval '180 days' then 'AGING'
    else 'STALE'
  end                     as freshness
from guardian.domain_subject ds
where ds.jurisdiction = nullif(current_setting('app.guardian.jurisdiction', true), '');

comment on view guardian.domain_reference is
  'ARCH-V4-C3.1 Domain Reference Contract (owner: Domain Intelligence). Bounded, jurisdiction-scoped reference for cross-module consumers (e.g. Mobile App Intelligence). Consumers get SELECT on this view only — never on guardian.domain_subject.';

-- Consumer (app worker) gets the contract view; base-table grant is REMOVED.
grant select on guardian.domain_reference to guardian_app_worker;
revoke select on guardian.domain_subject from guardian_app_worker;
drop policy if exists aw_domain_subject_sel on guardian.domain_subject;
