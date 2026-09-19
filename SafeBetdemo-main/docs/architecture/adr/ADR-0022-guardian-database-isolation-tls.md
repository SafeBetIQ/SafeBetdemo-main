# ADR-0022 — Guardian Database Isolation & CA-Validated PostgreSQL TLS (ARCH-V4-PR2)

- **Status:** Accepted (design + pre-provisioning engineering complete); provisioning gated on the Supabase Pro upgrade
- **Date:** 2026-09-19
- **Context:** Guardian (C0–C10 + PR1) shares the `SafeBet Demo` Supabase project (`uexdjngogzunjxkpxwll`, us-west-2) with SafeBet IQ, and every Guardian PostgreSQL client uses `ssl.rejectUnauthorized:false`. PR2 must move Guardian to an independently governed non-production PostgreSQL database and enable CA-validated TLS, without touching SafeBet IQ or Production.

## Decision
1. **Dedicated Supabase project** `SafeBet Guardian - Demo` (eu-west-1, Micro compute, non-production, synthetic-only) — a real data-plane boundary (own endpoint/credentials/roles/secrets/migration lifecycle/backup/monitoring/ownership), not a schema or role in the shared DB. Chosen because it is the smallest architecture meeting independent governance + Postgres compatibility + TLS validation + backup/recovery + least privilege, on the already-approved platform (no new vendor; AWS RDS explicitly declined by the owner).
2. **Schema reconstruction from authoritative migrations** — the **23 `arch_v4` Guardian migrations** (C0 foundation → PR1), applied in order to the fresh project. The §3 inventory proved **0 foreign keys from `guardian` to any non-guardian schema** and **0 references to `public`/IQ tables**, so the schema rebuilds cleanly with no IQ business tables (`GUARDIAN_DATABASE_MIGRATION.md`).
3. **Synthetic data copy** — the 437 Guardian rows copied FK-safe, idempotent, over CA-validated TLS, preserving all critical IDs/hashes (evidence content + custody-head hashes, C8 authorisation/scope hashes, C9 payload hashes, C10 candidates, PR1 entitlements). A source reconciliation baseline (110 tables/437 rows + critical digests) is captured pre-cutover; post-cutover reconciliation must match exactly or cutover is blocked.
4. **CA-validated TLS** — a single helper `products/guardian/src/db/tls.ts` (`guardianDbSsl()`) that ALWAYS returns `rejectUnauthorized:true` + hostname verification + TLS1.2 min, loads a controlled CA bundle when required, and is structurally incapable of emitting an insecure config (throws on any bypass). All 11 Guardian DB clients switch to it atomically with the endpoint cutover.
5. **Roles/RLS/contracts** rebuilt by the same migrations (11 dedicated worker roles + resolver, RLS, 9 contract views); per-worker secrets rotated for the new DB; API/worker IAM `GetSecretValue` narrowed to each own secret.
6. **Controlled cutover** — provision → migrate → validate → (no split-brain) cutover all workers+API at exact canonical provenance on immutable aliases → prove 0 old-DB writes → retain old Guardian data as read-only rollback source (no destructive delete in PR2).

## Consequences
- **Provisioning gate:** the org must be Supabase Pro first (free-tier 2-project cap). The upgrade is a billing checkout the owner performs.
- **Carried P1:** duplicate hosted zones (PR3); step-up auth; **PR1 route-coverage gap** (several C6/C7/C9 mutation routes not yet behind the human-identity gate — blocks real-user activation, not the DB cutover).
- **Rollback:** runtime target stays PR1 `f9a26a2`; if the new DB has accepted authoritative post-cutover writes, rollback requires an explicit freeze/reconciliation (`GUARDIAN_DATABASE_ROLLBACK.md`). No identity/audit/evidence history deleted.
