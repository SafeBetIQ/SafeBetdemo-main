# B6 Protection Action Traceability — Runbook

Operator-local linkage of a B4.1 protection alert to the recorded intervention(s) that
represent the operator's human response. **Occurrence only** — a link records that an
action followed an alert, never that it worked (no effectiveness / causal / harm-reduction
/ risk-trajectory claim). Own-casino, same-player, many-to-many. Cross-operator federation
stays OFF.

Migration: `supabase/migrations/20261005120000_b6_protection_action_traceability.sql`.
Applied (if authorised) by the governed raw-SQL path against **IQ Demo only**, leaving
`supabase_migrations.schema_migrations` unchanged (ledger remains 329). Never `db push` /
`migration up` / `repair` / `reconcile`.

## Objects created

- `UNIQUE(id, casino_id, player_id)` on `player_protection_alerts` (`ppa_id_casino_player_uq`)
- `UNIQUE(id, casino_id, player_id)` on `player_protection_interventions` (`ppi_id_casino_player_uq`)
  — passive supersets of the existing PK; required as composite-FK targets. No trigger
  added to interventions; no data/semantic change to either source table.
- Table `public.alert_intervention_links` with:
  - PK `id`; composite FKs `ail_alert_identity_fk`, `ail_intervention_identity_fk`
    (both `ON UPDATE RESTRICT ON DELETE RESTRICT`); simple FKs on `casino_id`, `linked_by`,
    `superseded_by`, `supersedes_link_id` (all RESTRICT).
  - CHECKs `ail_no_self_supersession`, `ail_superseded_pairing`.
  - Partial unique indexes `ail_active_pair_uq`, `ail_single_successor_uq`; indexes
    `ail_intervention_active`, `ail_casino`.
- Functions/triggers `sbiq_b6_link_guard` (BEFORE INSERT/UPDATE), `sbiq_b6_link_after_insert`
  (AFTER INSERT) — both SECURITY INVOKER.
- RLS enabled + forced; `service_role` = SELECT/INSERT/UPDATE only (REVOKE-ALL first).

## Lifetime invariant

`link.casino_id = alert.casino_id = intervention.casino_id` and
`link.player_id = alert.player_id = intervention.player_id` hold for the entire life of a
link — enforced relationally by the two composite FKs. Because a linked intervention's
`casino_id`/`player_id` are frozen by `ON UPDATE RESTRICT`, later source drift is rejected
by the database (not merely by API convention).

## Correction

A correction is a **single INSERT** of a replacement row carrying `supersedes_link_id`.
The `AFTER INSERT` trigger atomically marks the prior active link superseded
(`superseded_at`/`superseded_by = replacement.linked_at/linked_by`) and emits exactly one
`protection_alert.intervention_link_superseded` audit event — same statement transaction,
fail-closed. There is **no DELETE** and **no un-link**; the corrected link is retained as
history. Double-supersession, self-supersession, cross-alert and cross-casino/player
corrections are DB-rejected.

## Synthetic seeder interaction

`scripts/seed/seeders/interventions.ts#resetInterventions` detects B6 links for the target
casino(s) and **aborts** the reseed rather than attempt a delete that `ON DELETE RESTRICT`
would block. B6 traceability history is never auto-deleted by the seeder. A deliberate full
synthetic reset, if ever required, is a separate controlled maintenance operation:

1. Confirm the environment is **IQ Demo** (synthetic) and authorised for reset.
2. Remove B6 links for the target casinos **first** (controlled maintenance SQL, audited),
   then reseed interventions.

## Rollback (dependency-safe; B6-owned objects only; no CASCADE)

```
drop trigger if exists trg_b6_link_after_insert on public.alert_intervention_links;
drop trigger if exists trg_b6_link_guard       on public.alert_intervention_links;
drop function if exists public.sbiq_b6_link_after_insert();
drop function if exists public.sbiq_b6_link_guard();
drop table if exists public.alert_intervention_links;   -- its own FKs/indexes/CHECKs go with it
alter table public.player_protection_interventions drop constraint if exists ppi_id_casino_player_uq;
alter table public.player_protection_alerts        drop constraint if exists ppa_id_casino_player_uq;
```

`audit_events` rows emitted while B6 was active remain (append-only history). No source-table
behaviour or B4.1 object is modified by rollback.
