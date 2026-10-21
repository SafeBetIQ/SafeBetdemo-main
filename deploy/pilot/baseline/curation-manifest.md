# SafeBet IQ — Pilot baseline curation manifest (M1A-R2.2)

Exact, reviewed exclusions applied by `curation.sql` (explicit `DROP … RESTRICT`, no `CASCADE`)
to produce the final curated Pilot baseline from the **post-decoupling** Demo public schema.

| Field | Value |
|---|---|
| Repository authority | `91161a0df0fe3e39b7fc55d9cd8a5bbcd16c20ef` |
| Deployed runtime | `e1ace600f42961109d0cc0777e59179a0cc8631d` |
| Pre-decoupling full Demo fingerprint | `0bd7547d427b2146ac915b0a6834ba7c9995084f8b992d1e098fd3db1d06d280` |
| PR #133 decoupling migration SHA | `b414bb45486c97a35b9b8d25b7755f33daf02e30add77a54d67629d753e529b3` |
| Post-decoupling full Demo fingerprint | `9d7b6c5ac957bbeb51467cae368c1e276bc9b3eaba197735048cbfbb43bd9601` |
| Historical uncurated baseline SHA | `fd6484cb6369e46cb9c0a65bc23ef184208953349b1a5e64c85206272add8710` |
| **Curation manifest SHA-256** | `4f0db01fe530373e575e93f55df78ef0692b674f67efc7fb2744901e5f5f12ae` |
| **Curated baseline SHA-256 (LF)** | `530941a513216c056eab18e182be09f3d0fe803955c7c7315ccd36123b9fa182` |
| **Curated structural fingerprint** | `5f324b14ea87dec4601b0586bc4a4726be83ebceae3112253ba2db838ca55f49` |

## Excluded (33 named objects + 5 owned sequences)
- **4 views**: `sbiq_demo_sim_health_overall`, `sbiq_demo_simulation_health`, `sbiq_demo_simulator_usage`, `sbiq_demo_storage_status`.
- **19 functions**: `sbiq_admin_financial_section`, `sbiq_admin_overview_snapshot`, `sbiq_admin_refresh_registered(_manual)`, `sbiq_admin_registered_status`, `sbiq_demo_{activate_showcase, audit_cleanup, audit_insert, broken_chain, limit, live_tick, partition_readiness, raise_alert, scale_cleanup, scale_seed_batch, showcase_maintenance, sim_health_snapshot, tick_watchdog}`, `simulate_live_feed`.
- **10 tables** (+ owned seqs): `sbiq_demo_sim_limits/alerts/run_log/flags/config`, `sbiq_demo_showcase_activations/windows`, `simulation_config`, `sbiq_admin_registered_counts/refresh_log`.

Classification: A (synthetic generator) ×10, B (showcase/demo-admin) ×23, **C/D/E/F = 0**.

## Proofs
- **Dependency**: after PR #133, reverse-dependency over the full candidate set = 0 retained functions / views / triggers / FKs; 0 intra-demo FKs/triggers; `DROP … RESTRICT` succeeded for every object.
- **Difference (source→Pilot)**: `fingerprint(source-after-curation) == fingerprint(fresh curated re-apply) == 5f324b14…`; the only structural change from the post-decoupling full Demo schema is exactly this set.
- **Retained**: certified financial (`sbiq_certified_financial_posture_v2` + `projection_financial_posture`) unchanged; generic rollup ops (`sbiq_financial_rollup_ops_state/_ops_alerts/_raise_alert/refresh/watchdog/status`) present; B1–B13.1 present; audit chain present; machine/session/self-exclusion/event-log present.
- **Reproducibility**: two independent fresh applies → identical fingerprint `5f324b14…`.
- **Audit**: immutability + tamper-detection pass on the curated baseline.
- **Scans**: zero executable Demo casino UUIDs / simulator producers / demo-sim object defs / secrets in the curated baseline.

## Runtime references (M1B hardening, not a curation blocker)
Excluded objects are referenced only by **demo-env-gated, NON-PRODUCTION super-admin / demo-auth routes** (`/api/admin/overview`, `/api/admin/simulation-health`, `/api/admin/overview/refresh-registered-counts`, `/api/demo-auth/login`) + `lib/demoSim*` — never the casino-operator Pilot surface. **M1B environment-hardening requirement: the Pilot environment must not enable the demo env / expose these demo super-admin/demo-auth routes.**
