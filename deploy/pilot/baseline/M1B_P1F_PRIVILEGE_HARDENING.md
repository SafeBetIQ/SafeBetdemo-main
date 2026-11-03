# SafeBet IQ — M1B-P1F Pilot privilege hardening (REVIEW, revised)

Status: **prepared, not executed.** Nothing here has touched Supabase, AWS, Production, Demo or Guardian.
The curated **canonical** baseline `pilot_app_schema_baseline.sql` (SHA-256 `530941a5…a182`), `fingerprint.sql`
and the approved fingerprint `5f324b14…5f49` are **unchanged**. This revision applies the owner corrections
of M1B-P1F (supabase_admin derivative, PUBLIC EXECUTE = none, three inherited exposures closed, opt-in
future defaults, explicit Pilot labels, two separate commit authorities).

## 1. Problem
A fresh Supabase project's default privileges auto-grant every table, sequence and function that `postgres`
creates in `public` to `anon`, `authenticated` and `service_role`; PostgreSQL also grants `EXECUTE` on every
new function to `PUBLIC`. The curated baseline is a `pg_dump` of Demo: it records each object's final grants
but never emits REVOKEs for grants a target adds at CREATE time, and its own `ALTER DEFAULT PRIVILEGES`
lines come last. Applied unmodified on a fresh project it would expose ~300 relations to `anon` and make
~130 SECURITY DEFINER functions anon-callable. Additionally, the canonical baseline ends with 12
`ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin …` statements that **cannot execute on hosted Supabase**
(supabase_admin is an internal reserved role; `postgres` is not a member).

## 2. Supabase deployment derivative (Correction 1)
Rather than require `postgres ∈ supabase_admin`, disable `ON_ERROR_STOP`, or silently edit the baseline, a
**deterministic derivative** is generated from the canonical by `generate-supabase-derivative.mjs`:
- starts only from the approved canonical SHA `530941a5…` (fail-closed);
- removes **exactly** the 12 allowlisted `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public …`
  statements and nothing else (reconstruction re-proves the canonical byte-for-byte);
- emits `generated/pilot_app_schema_supabase.sql` (**SHA `c2125acc…2067`**) + `generated/transformation-report.json`.
Default privileges are **not** part of the structural fingerprint and no schema object changes, so the
derivative applies cleanly under `psql ON_ERROR_STOP` and still yields fingerprint `5f324b14…`. The Pilot
apply uses the **derivative**; Supabase-owned `supabase_admin` defaults are never touched; `postgres`
membership is never requested. `pilot_preflight.sql` A7 only **detects & reports** supabase_admin defaults.

## 3. Intended privilege state (reviewed manifest `pilot_privilege_manifest.txt`, SHA `ea03c077…`)
| | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|
| Relations (361 total) | no table without RLS | per baseline | per baseline | **0** |
| Functions, effective EXECUTE | **15** | **94** | 150 | **0** |
All 151 functions and 361 relations are owned by `postgres`; all 130 SECURITY DEFINER functions pin
`search_path`; **no** SECURITY DEFINER function is anon-executable; **no** function is PUBLIC-executable.

## 4. Remediation (execution order inside the apply workflow)
1. `pilot_preflight.sql` — read-only STOP checks (PG17, `current_user=postgres`, empty `public`, platform
   roles, `auth.*`, extensions, reviewed postgres defaults). **A7 no longer fails on supabase_admin
   non-membership** — it detects and reports only (Correction 1).
2. `pilot_pre_apply_security.sql` — revoke the Supabase/PostgreSQL auto-grant defaults so objects the
   baseline creates start owner-only (unchanged).
3. Verify canonical SHA + regenerate/verify the **Supabase derivative** (determinism + pinned SHA).
4. Apply the **derivative** with `psql -1` (single transaction).
5. **`fingerprint.sql` must equal `5f324b14…` — captured here, BEFORE any Pilot privilege hardening**, so the
   structural anchor reflects the certified baseline schema (including its table-grant state).
6. `pilot_post_apply_grants.sql` — **Pilot privilege tightening** (runs after the fingerprint):
   - Correction 2 — **no** `GRANT … TO public`; PUBLIC function EXECUTE = none.
   - Decision 3A — `REVOKE ALL ON sbiq_financial_rollup_checkpoint FROM anon, authenticated` (service_role +
     postgres retained; only SECURITY DEFINER functions touch it; no client reads it directly).
   - Decision 3B — `REVOKE EXECUTE ON sbiq_may_access_chain_scope FROM anon, public` (authenticated +
     service_role retained for the 4 `TO authenticated` RLS policies + governed audit-chain path). The
     function's null-auth behaviour stays in the immutable baseline and is unreachable by anon once EXECUTE
     is removed — reported, not rewritten.
   - Decision 3C — `REVOKE EXECUTE ON sbiq_audit_benchmark FROM anon, authenticated, public` (service_role +
     postgres retained; no application caller).
   - Correction 4 — re-revoke the Demo-parity default privileges so **future** postgres objects in `public`
     are owner-only (no anon/authenticated/service_role auto-grant; PUBLIC gets no EXECUTE).
7. `pilot_privilege_verify.sql` — fail-closed invariants (now: PUBLIC EXECUTE = none; **no** anon-executable
   SECURITY DEFINER; **no** anon-accessible table without RLS; global PUBLIC-EXECUTE default revoked; **A7:
   no postgres default auto-grants to anon/authenticated/service_role/PUBLIC**) + the canonical, `COLLATE "C"`
   listing diffed against the reviewed manifest.

The byte-exact manifest + fingerprint are proven on a disposable **`postgres:17`** apply by the CI rehearsal
and apply jobs (no secrets in rehearsal). The reviewed manifest in-repo is produced by the deterministic
`regenerate-privilege-manifest.mjs` (prior CI-verified manifest minus exactly the grants removed above, eff
recomputed, defacl reverted) and is re-proven against the live apply in CI.

## 5. Application vs schema authority (Correction 6)
Two separate authorities:
- **Schema baseline SOURCE** = `379141e…a993e` (the commit the curated baseline was dumped from). Used only
  to check out the baseline SQL for the DB apply. **Not** the application deployment authority.
- **Pilot application DEPLOYMENT** = a **new reviewed commit, PENDING** (this M1B-P1F work). `buildspec-pilot.yml`
  requires `SAFEBET_GIT_COMMIT` to be supplied at build, be a 40-hex commit, and **reject** `379141e…`
  (it predates this hardening). The SHA is not invented here; it is pinned after this work is committed.

## 6. Pilot environment labels (Correction 5)
`lib/environmentGates.ts` gains `environmentPresentation(env)` and `DemoBanner.tsx` renders it: **demo** →
"Demo · Non-Production · Synthetic Data"; **pilot** → "Pilot · Controlled Pilot Environment · Not Live
Operator Data"; **production** → no banner; unknown → neutral non-production banner. Pilot never shows the
Demo banner/label/synthetic wording (and never implies real operator data). The Demo operator selector and
the casino-simulator burst producer remain Demo-only (fail closed). `version.json` dataClass for Pilot is
`pilot-no-operator-data` (not `synthetic`). Residual (reported, not changed here): the login hero stat "6
Demo Operators" is static marketing copy shown in every environment — recommend a separate copy review.

## 7. Errata
- **Manifest byte count / CRLF:** hash the Linux (LF) checkout; the committed manifest SHA `c65de5ee…` is the
  LF value and is what CI verifies.
- **`sbiq_financial_rollup_ops_state`:** not in the baseline (schema-only dump); absent row ≡ disabled.
