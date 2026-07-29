# Pilot Persistence Recovery Guide (Milestone 4.1)

**ADR-006 (frozen) · PILOT NON-PRODUCTION ONLY.**

## 1. Recovery model
The pilot store is event-sourced: authoritative records + an append-only assignment log + a SHA-256-
chained append-only audit. Recovery = **reconstruct the in-process registry from durable storage** and
**verify integrity**. No derived/cached data is required to recover — it is reconstructable.

## 2. Restart reconstruction (validated)
1. Construct a fresh `DurableFileBackend(baseDir)` over the existing store directory.
2. Construct `new RegulatorPlaneStore({ backend })` (rehydrates the audit chain).
3. `store.reconstructRegistry(serviceOrIntegrityCtx)` → a registry with identical records, mint-counter
   continuity (no id re-mint), and the full assignment log.
4. `registry.verifyIntegrity().ok` and `store.verifyAuditChain(ctx).ok` must be true.
Verified in `tests/identityFederation.persistence.test.mjs` (fresh backend over the same directory).

## 3. Backup & restore (foundation)
- **Backup:** `DurableFileBackend.backupTo(backupDir)` copies every store file to a backup directory.
- **Restore:** construct a new `DurableFileBackend(backupDir)` + `RegulatorPlaneStore`; reconstruct and
  run `verifyStoreIntegrity(ctx)` (registry integrity + audit chain) — must be `ok` (tested).
- A full operational restore drill with **RPO/RTO** targets and scheduled backups maps to **Phase 4.7**
  (`V2_PHASE_4_OPERATIONAL_READINESS_PLAN.md`) — not claimed complete here.

## 4. Integrity verification
- `verifyAuditChain(ctx)` — detects modified / reordered / broken-chain / gap tampering.
- `reconstructRegistry(ctx).verifyIntegrity()` — unique/immutable identifiers, referential + version +
  historical consistency.
- `verifyStoreIntegrity(ctx)` — both combined; used after any restore.

## 5. Authorisation
Reconstruction / integrity / diagnostics require an **authorised service** context or a regulator with
an `integrity` / `auditor` role (deny-by-default). Regulator readers and operators cannot reconstruct.

## 6. Failure handling
- Malformed identifier / missing context / wrong jurisdiction → `AccessDeniedError` (safe, no sensitive
  data).
- A detected integrity/chain failure → restore from the most recent good backup, then re-verify.
- Duplicate submission during recovery → idempotent (no duplicate identity).

## 7. Deployment binding
Managed-RDS backup/restore, point-in-time recovery, and durable WORM audit storage are conditions
**C2 / C3 / C6** — the recovery model here is the pilot foundation; the managed-store drill is a
later-milestone / deployment activity.
