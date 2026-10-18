# SafeBet IQ — Pilot application-schema baseline manifest (M1A-R2)

| Field | Value |
|---|---|
| Artifact | `pilot_app_schema_baseline.sql` |
| Repository authority SHA | `8ae2ea0b20603570af968ff8ea63979665edb640` |
| Live runtime deployment | `e1ace600f42961109d0cc0777e59179a0cc8631d` (`demo-node20-202610151445-e1ace60`) |
| Repo↔runtime delta | PR #131 CI/test tooling only |
| Schema authority | live IQ Demo `public` schema (read-only `pg_dump --schema-only`) |
| Demo Postgres version | 17.6 (pg_dump 17.11) |
| Baseline size | 1,485,809 bytes / 41,135 lines |
| Baseline file SHA-256 (LF, point-in-time) | `fd6484cb6369e46cb9c0a65bc23ef184208953349b1a5e64c85206272add8710` |
| **Structural fingerprint (deterministic)** | **`0bd7547d427b2146ac915b0a6834ba7c9995084f8b992d1e098fd3db1d06d280`** |
| Fingerprint identical across | IQ Demo public · disposable DB #1 · disposable DB #2 |
| Business data | NONE (schema only; zero-data assertion passed) |

> The file SHA is point-in-time because pg_dump 17.11 emits a random per-dump `\restrict` token.
> Reproducibility/provenance/drift is anchored on the **structural fingerprint** (OID/timestamp/row-count-free), which is deterministic and was identical across the Demo source and both fresh disposable applies.

## Object counts (public)
tables 331 (4 partitioned parents) · views 25 · matviews 5 · functions 169 (SECURITY DEFINER 146) · triggers 55 · policies 677 · RLS-enabled 319 · FORCE-RLS 117.

## Included / excluded
- **Included:** `public` application objects only — tables/partitions, sequences, views, matviews, functions (incl. all `sbiq_*` SECURITY DEFINER), triggers, constraints, indexes, RLS/FORCE flags, policies, application grants, audit-chain objects, certified-financial objects, B1–B13.1 objects, machine/session/self-exclusion/financial-capability schema.
- **Excluded:** `guardian` (out of IQ pilot scope); Supabase-managed `auth`/`storage`/`realtime`/`vault`/`graphql(_public)`; `cron`/`net`/`extensions` implementation; `supabase_migrations` history; database/platform roles; extension implementation objects; all business/evidence/simulator rows; the single `CREATE SCHEMA public;` statement.

## Extensions (declared, not dumped)
Application-required: `pgcrypto`, `uuid-ossp`, `plpgsql`. Platform: `pg_cron` (+ `pg_net`/`pg_stat_statements`/`supabase_vault` platform-managed). Supplied by the target platform (or the disposable test harness), never embedded in the baseline.

## Security (fresh-apply spot-check)
B13.1 `intervention_player_communications`: FORCE RLS true, 0 policies, 3 SECURITY DEFINER RPCs, `delivery_mode` CHECK = `SANDBOX` only. Audit-chain functions/triggers present (proven by Demo↔baseline fingerprint parity). Certified-financial objects present and unchanged (stakes−winnings).

## Provenance
Git-reviewed baseline SQL + this manifest + structural fingerprint + controlled deployment evidence are the provenance. The Supabase migration ledger is **not** treated as baseline provenance (the 291 local files ≠ 329 Demo ledger rows is neither reconciled nor replayed). No new DB provenance table is recommended for M1B.

## Verification
GitHub Actions `SafeBet IQ — Pilot M1A-R2 baseline extraction`, run `39063709266` (green): extract → two disposable applies (platform-prep + baseline, 0 SQL errors) → identical structural fingerprint → fingerprint == Demo → zero-business-data → B13.1/security spot-check.
