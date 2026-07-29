# SafeBet IQ — `audit_events` vs `audit_logs` (architecture & deprecation note)

**Do not delete or merge in this milestone.** This documents the two audit systems and a future consolidation plan.

## `audit_events` — the CERTIFIED governance chain
- **Scope:** per-casino tenant chains + one `platform` chain (`chain_scope = coalesce(casino_id::text,'platform')`).
- **Integrity:** per-tenant SHA-256 chain (`sbiq_audit_event_hash`), monotonic `chain_sequence`, `previous_hash` linkage, atomic insertion (advisory lock + FOR UPDATE), append-only (update/delete revoked from `authenticated`; break-glass owner-only), independent SQL+TS verification, verification checkpoints, scheduled `pg_cron` verification, independent `platform_integrity_alert`.
- **Writers:** evidence access/export (evidence-gateway), configuration changes (capability/shift/lifecycle triggers), synthetic seeding, chain backfill, and application governance events.
- **Readers:** Audit Centre (genuine verification), regulator verification view, Platform Health view.
- **Status:** the authoritative certified audit system.

## `audit_logs` — LEGACY
- **Model:** a SEPARATE table with its own **global** chain (single `audit_chain_seq`, `entry_hash`/`previous_hash` via `compute_audit_chain_hash`) — not per-tenant.
- **Writers/readers:** legacy application paths write `audit_logs`; the Audit Centre previously read its chain for the "verified" badge (corrected in a prior milestone to read the certified `audit_events` chains).
- **Regulator/compliance exports:** the certified evidence exports and regulator verification use `audit_events`, not `audit_logs`.
- **Risks of two systems:** divergent chain models (global vs per-tenant), potential confusion, duplicate storage.

## Classification
**Deprecated but retained.** `audit_logs` is not required by the certified governance flow but is retained for backward compatibility and historical evidence. No UI now presents it as the certified chain.

## Future consolidation plan (not this milestone)
1. Freeze `audit_logs` writers (route remaining writers to `audit_events` with proper chain_scope).
2. Preserve `audit_logs` history read-only (do NOT merge its global chain into the per-tenant model — incompatible chain shapes).
3. Provide a one-time verified export/attestation of the legacy `audit_logs` chain as a historical artifact.
4. After a retention window with no writers/readers, retire the table via an authorised, audited migration.
Do not silently merge incompatible chains; preserve all historical evidence.
