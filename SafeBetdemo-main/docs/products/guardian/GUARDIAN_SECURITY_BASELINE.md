# SafeBet Guardian — Security Baseline (ARCH-V4-C0)

Guardian must not recreate the privileged-function/over-exposure problem the A5 track closed.

## Database security
- **No new SECURITY DEFINER functions.** The `guardian` schema has **0 functions** (foundation
  is tables + RLS only). Any future Guardian function defaults `SECURITY INVOKER`; elevation
  requires explicit proof and registration under the A5 baseline
  (`docs/security/PRIVILEGED_FUNCTION_BASELINE.md`).
- **No PUBLIC/anon grants.** Schema `USAGE` + table `SELECT`/`INSERT` granted to `authenticated`
  + `service_role` only. `anon` has no `guardian` schema access (verified `has_schema_privilege`
  = false).
- **CI guard:** `npm run ci:privfn` scans the C0 migration and passes (no PUBLIC/anon grant, no
  unpinned SECURITY DEFINER).

## RLS / data access
- RLS enabled on all 7 `guardian` tables.
- Business rows scoped by `product=GUARDIAN` (table constraint) + `jurisdiction` claim
  (`request.jwt.claims ->> 'guardian_jurisdiction'`). Missing/other-product claim → deny.
- Negative tests proven at the DB: cross-jurisdiction denied (both directions), IQ principal
  sees 0 rows, `anon` denied; `service_role` (worker/admin) sees all (bypassrls, expected).

## Identity / MFA
- SafeBet IQ roles cannot access Guardian (distinct role vocabulary + explicit guard).
- **MFA hard gate active:** `MFA_REQUIRED_FOR_REAL_PRIVILEGED_USE = true`; no real privileged
  Guardian user at C0 (synthetic/service only). No real Guardian/Regulator-Suite privileged
  user or production privileged regulatory access until MFA enforcement is proven.

## Secrets / config
No hard-coded secrets (secret-scan clean). No regulator/provider/bank credentials created or
referenced. Guardian config is distinct from IQ product config; secrets remain external managed
secrets. Envelopes carry references, never inline sensitive evidence.

## External integrations & enforcement safety
No real external integration (NGB, provincial regulators, banks, PSPs, ISPs, DNS/registrars,
hosting, mobile/app platforms). Any adapter is labelled **PROPOSED — NO LIVE EXTERNAL
INTEGRATION**. Provider-neutral language (no specific app-store/platform named). Guardian never
self-executes enforcement; automated signal ≠ legal finding; no automatic blocking.

## Estate impact (verified)
Platform-wide privileged exposure unchanged: `public` SECURITY DEFINER **138**, anon **1**,
PUBLIC **1** (the A5 RLS-predicate exception). No new platform-wide privileged exposure; no RLS
weakening; identityFederation OFF; A1–A5 intact; Production untouched.
