# SafeBet Guardian — Database Cutover (ARCH-V4-PR2 §40–§46)

Controlled, dependency-aware order (no automatic cutover; no partial split-brain):
1. Provision `SafeBet Guardian - Demo` (eu-west-1, Micro).
2. Apply the 23 `arch_v4` Guardian migrations (schema + roles + RLS + contract views + append-only guards).
3. Set worker role login passwords out-of-band; create per-worker Secrets Manager secrets for the new DB.
4. Copy the 437 synthetic rows (FK-safe, idempotent, CA-validated TLS).
5. Validate: per-table source-vs-target counts + critical ID/hash reconciliation + C7 byte-integrity + custody-head-hash equality. **Any mismatch BLOCKS cutover.**
6. Update each Guardian DB client to `guardianDbSsl()` + the new secret; rebuild every changed component from the exact canonical PR2 merge SHA; publish immutable versions; point demo aliases + SQS event sources at the immutable alias (never `$LATEST`).
7. Cut over API + workers in a bounded window.
8. Prove **0 old-DB writes** (no split-brain) for the tested window.
9. Full C1–C10 + PR1 regression against the NEW DB (no test may touch the old shared DB).
10. Retain old Guardian data as read-only rollback source (no destructive delete in PR2).

Old-DB runtime denial (post-cutover, where safe + reversible): rotate/disable the old-DB worker logins or revoke runtime grants, preserving rollback. No data deleted.
