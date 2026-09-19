# SafeBet Guardian — Database Migration (ARCH-V4-PR2 §5/§7/§11/§18/§22)

## Schema reconstruction (authoritative, not a dump/restore)
Apply the 23 `arch_v4` Guardian migrations (C0 foundation → PR1) in order to the fresh project. NO uncontrolled shared-DB dump. NO IQ/public business tables. Extensions required: `uuid-ossp`, `pgcrypto` (plus Supabase defaults). Tool: `scripts/guardian/pr2/pr2-migration.mjs manifest` emits the ordered list + per-file SHA-256 + a ledger digest (reproducible from repository migrations).

## Data migration (controlled, bounded window)
SOURCE FREEZE (brief) → SCHEMA DEPLOY → DATA COPY → VALIDATION → APPLICATION CUTOVER → POST-CUTOVER PROOF. No long-term dual-write; no split-brain. Tool: `pr2-migration.mjs copy --source <s> --target <t>` copies guardian rows FK-safe + idempotent (`on conflict do nothing`) over CA-validated TLS; it refuses to run without an explicit `--target` and never reads/writes IQ data.

## Preservation (must match exactly; any mismatch BLOCKS cutover)
C1–C10 + PR1 data; evidence IDs + content hashes; custody chain head hashes; case references; policy versions; authorisations + scope/manifest hashes; orchestration IDs + payload hashes; re-entry candidate IDs; identity entitlements + account states. Source baseline captured pre-cutover (110 tables / 437 rows; critical digests for evidence-content, custody-head, authorisation-scope, orchestration-payload, entitlement). Migration re-authorises nothing, re-dispatches nothing, re-interprets no historic VERIFIED.

## Reconciliation
`pr2-migration.mjs reconcile --source <s> --target <t>` → per-table source-vs-target counts + exits non-zero on any mismatch. `pr2-migration.mjs evidence --source <s>` → C7 custody-head + content-hash reference digest. Compare the target digest to the captured source baseline.

## Migration ledger
A clean Guardian ledger in the dedicated DB (version, checksum, applied_at, target ref, source repo SHA). Do NOT import the stale shared IQ migration ledger.
