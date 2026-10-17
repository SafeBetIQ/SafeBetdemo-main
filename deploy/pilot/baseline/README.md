# SafeBet IQ — Pilot application-schema baseline (M1A-R2)

Authoritative, application-owned (`public` schema) database baseline used to bootstrap a **new
isolated Pilot Supabase project** (M1B) — never by replaying the repo migration history (the
local 291 files ≠ the 329 Demo ledger rows) and never by copying Demo business data.

## Authorities
- **Repository authority:** `8ae2ea0b20603570af968ff8ea63979665edb640` (Demo branch after PR #131, CI/test-tooling only).
- **Live runtime deployment:** `e1ace600f42961109d0cc0777e59179a0cc8631d` (`demo-node20-202610151445-e1ace60`). The delta between them is PR #131 CI tooling only.
- **Schema authority:** the **live IQ Demo database `public` schema** (not migration replay).

## How the baseline is produced (CI only)
Extraction requires the authorised read-only Demo Postgres credential (`secrets.SUPABASE_DB_URL_DEMO`)
and `pg_dump`, which exist only on the CI runner. The workflow
`.github/workflows/pilot-m1a-baseline.yml`:
1. connects **read-only** to IQ Demo and records safe metadata (no secret printed);
2. runs `pg_dump --schema-only --schema=public` (no data, no mutation);
3. (generator stage) filters/normalises into `pilot_app_schema_baseline.sql` — application objects
   only; excludes `guardian`, Supabase-managed schemas, cron rows, migration history, roles,
   secrets, and all business data;
4. applies it to **two** disposable Postgres 17 databases (with documented test-only platform
   shims kept out of the baseline), proves **zero business data**, computes an OID/timestamp-free
   **structural fingerprint** that must be **identical** across both, and classifies every
   Demo-vs-baseline difference.

## Scope guards
- Never mutates IQ Demo; never uses the PROD credential; never loads real data.
- Platform-managed roles/extensions/schemas are supplied by the target platform (or test shims),
  **not** embedded in the baseline.
- Migration ledger is **not** treated as baseline provenance; the committed baseline SQL +
  manifest + SHA-256 + structural fingerprint are the provenance.

Artifacts (added by the generator stage): `pilot_app_schema_baseline.sql`, `manifest.json`,
`manifest.md`, `cron-manifest.md`.
