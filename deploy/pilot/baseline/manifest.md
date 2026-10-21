# SafeBet IQ — Pilot application-schema baseline manifest (M1A-R2.2, CURATED)

Final **curated** application-owned (`public`) baseline for bootstrapping a new isolated Pilot
Supabase project (M1B). The Demo simulation/showcase/demo-admin subsystem is **excluded**
(see `curation-manifest.json`/`.md`); it was made a clean dependency leaf by the PR #133
financial-rollup ops decoupling.

| Field | Value |
|---|---|
| Repository authority | `91161a0df0fe3e39b7fc55d9cd8a5bbcd16c20ef` |
| Deployed runtime | `e1ace600f42961109d0cc0777e59179a0cc8631d` (`demo-node20-202610151445-e1ace60`) |
| Pre-decoupling full Demo fingerprint | `0bd7547d…` |
| PR #133 decoupling migration SHA | `b414bb45486c97a35b9b8d25b7755f33daf02e30add77a54d67629d753e529b3` |
| Post-decoupling full Demo fingerprint | `9d7b6c5ac957bbeb51467cae368c1e276bc9b3eaba197735048cbfbb43bd9601` |
| Historical uncurated baseline SHA | `fd6484cb…` |
| Curation manifest SHA-256 | `4f0db01fe530373e575e93f55df78ef0692b674f67efc7fb2744901e5f5f12ae` |
| **Curated baseline SHA-256 (LF, point-in-time)** | `530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182` |
| **Curated structural fingerprint (deterministic)** | `5f324b14ea87dec4601b0586bc4a4726be83ebceae3112253ba2db838ca55f49` |
| Curated size | 1,386,404 bytes / 39,103 lines |
| Business data | NONE (only static `sbiq_financial_rollup_ops_state(id=1, enabled=false)`) |

> The file SHA is point-in-time (pg_dump 17.11 random `\restrict` token); the **structural
> fingerprint** is the deterministic reproducibility/provenance anchor and was identical across
> both fresh curated applies and the post-decoupling source DB after `curation.sql`.

## Excluded (curation)
Demo subsystem: 4 views + 19 functions + 10 tables (+5 owned sequences). Classification A×10, B×23, C/D/E/F=0. Full list + per-object reasons in `curation-manifest.json`/`curation-manifest.md`.

## Retained (verified present in the curated baseline)
Certified financial (`sbiq_certified_financial_posture_v2` + `projection_financial_posture`, definitions unchanged) · generic financial rollup ops (`sbiq_financial_rollup_ops_state/_ops_alerts/_raise_alert/refresh/watchdog/status`, no Demo dependency, `enabled=false`) · B1–B13.1 governed operator objects · audit chain + immutability + verifier · machine/session/self-exclusion/event-log.

## Proofs (CI run 39631763987, green)
Curation `DROP … RESTRICT` (no CASCADE) with 0 residual dependency · two fresh applies → identical fingerprint `5f324b14…` · source→Pilot difference == exactly the curation set (`fingerprint(source-after-curation) == curated fingerprint`) · zero business data · demo subsystem absent (0/0) · generic financial ops smoke OK · B13.1 FORCE RLS + SANDBOX CHECK · audit immutability + tamper detection · Demo-identifier/secret scan clean.

## Provenance / boundaries
Git-reviewed curated baseline + manifests + fingerprint + CI evidence are the provenance. Supabase migration ledger is **not** authoritative (329 Demo rows not copied; 291 files not replayed; no marker; no provenance table). **M1B hardening:** Pilot must not enable the demo env / expose the demo super-admin + demo-auth routes.
