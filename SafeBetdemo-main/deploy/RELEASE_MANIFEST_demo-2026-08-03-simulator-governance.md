# SafeBet IQ — Demo Release Manifest (Simulator Operations & Governance)

**Release tag:** `demo-2026-08-03-simulator-governance`
**Environment:** `demo.safebetiq.com` (non-production demo, synthetic data)
**Milestone:** Operationalise the live simulator safely — cost/volume governance,
showcase cooldowns, expired-window maintenance, partition readiness, storage/usage
monitoring, failure/late alerts, emergency controls, Platform Health UI, snapshot age.

> The certified metric semantics are **unchanged**:
> `Live Feed Active Players = Operator Dashboard Active Now = certified players_active_now`.
> No freshness threshold was weakened and no population-scale seed was generated.

## Runtime / deployment

| Field | Value |
|---|---|
| Runtime source commit | recorded by `/api/version` (git HEAD of this release on branch `Demo`) |
| Branch | `Demo` |
| Elastic Beanstalk application | `safebet-iq-app` (eu-west-1) |
| Elastic Beanstalk environment | `safebet-iq-demo` |
| EB application version | `demo-node20-20260803-<sha>` (see completion report / EB console) |
| Node version (build) | `20.x` (Linux, `aws/codebuild/standard:7.0`) |
| Demo Supabase project | `uexdjngogzunjxkpxwll` (demo; **not** production `ilibvipqbkugqkppzdmh`) |
| Rollback version (retain) | `demo-node20-20260803-d57e82c` |

## Simulator (unchanged core + governance)

| Field | Value |
|---|---|
| Simulator producer | `safebet-demo-live-simulator-v2` |
| Simulator cron | `sbiq-demo-live-tick` (jobid 6), every 5 min |
| Watchdog cron | `sbiq-demo-tick-watchdog`, every 5 min |
| Partition-readiness cron | `sbiq-demo-partition-readiness`, daily 00:30 |
| Baseline event volume | ~12,000–35,000 events/day (measured est. ~34k) |
| Showcase event volume | up to ~50,000 events/day |
| **Daily warning limit** | **75,000/day** → reduced (baseline-only) mode |
| **Daily hard limit** | **120,000/day** → skip generation, cron stays alive, audit untouched |
| Per-tick limit (all casinos) | 1,000 |
| Per-casino-per-tick limit | 250 |
| Casino showcase cooldown | 30 min window · no extend < 10 min · cap 45 min · ≤ 3/casino/hr |
| Regulator showcase cooldown | 45 min window · no extend < 15 min · cap 60 min · ≤ 2 jurisdiction/hr |
| Max concurrent showcase windows | 8 |

## Migrations (Demo Supabase)

| Migration | Purpose |
|---|---|
| `20260803120000_demo_simulator_governance.sql` | limits table, alert table, run log, activation log, governed `sbiq_demo_activate_showcase` (cooldown/rate-limit/cap/idempotent), `sbiq_demo_showcase_maintenance`, `sbiq_demo_partition_readiness`, `sbiq_demo_simulator_usage`, `sbiq_demo_storage_status` |
| `20260803120100_demo_simulator_governance_tick.sql` | governed `sbiq_demo_live_tick` (server-side volume limits, reduced/hardstop, failure/zero alerts, run log), extended per-casino + overall health views, `sbiq_demo_tick_watchdog`, watchdog + partition-readiness cron schedules |

## Monitoring / health sources

- **Event volume:** `sbiq_demo_simulator_usage`
- **Storage/growth:** `sbiq_demo_storage_status` (internal DB sizes + *configured* thresholds; not billing)
- **Per-casino health:** `sbiq_demo_simulation_health`
- **Overall health:** `sbiq_demo_sim_health_overall` (Healthy/Warning/Critical/Disabled/Unknown)
- **Alerts:** `sbiq_demo_sim_alerts` — `SIMULATOR_TICK_FAILED/_LATE`, `_VOLUME_WARNING/_LIMIT_REACHED`, `_STORAGE_WARNING/_CRITICAL`, `_SHOWCASE_RATE_LIMIT`, `_PARTITION_MISSING/_INSECURE`, `_PROJECTION_LAG`, `_RECONCILIATION_FAILED`, `_ALL_CASINOS_ZERO`, `_CASINO_ZERO_DURING_SHOWCASE`
- **Platform Health UI:** Super Admin → Platform Health → *Demo Simulation Health* (super-admin + demo gated via `/api/admin/simulation-health`)
- **Snapshot age:** `components/SnapshotAge.tsx` on Operator Dashboard, Live Feed, Regulator overview, Simulation Health (certified `as_of`, SAST, stale threshold)

## Emergency disable / re-enable

Flags in `sbiq_demo_sim_flags`: `ENABLE_DEMO_LIVE_SIMULATOR`, `ENABLE_DEMO_SHOWCASE_MODE`
(+ `cron.unschedule('sbiq-demo-live-tick')` if required). Active-now decays naturally.
See `deploy/runbooks/DEMO_SIMULATOR_OPERATIONS.md`.

## Retention policy

`deploy/DEMO_RETENTION_POLICY.md` — event-log & audit-chain append-only (never auto-deleted/re-hashed);
administrative window/activation metadata purged ≥ 90 days; storage forecast documented.

## Verification (this release)

- Automated tests: **519/519** (baseline 510 + 9 governance tests)
- Governance controls (live DB): cooldown, rate-limit, reduced mode, hardstop, emergency disable/re-enable — all pass
- Five reconciliations: **Green**; seven audit chains: **verified**
- Regulator active-now = Σ six casinos; regulator observed = Σ observed
- Partitions: current + next two (`2026_08/09/10`) present & secure
- Storage: DB 336 MB · event-log 206 MB · audit 632 kB · ~1.2 MB/day · 4.1% of internal alloc
- Overall health: **Healthy**

## Operations runbook

`deploy/runbooks/DEMO_SIMULATOR_OPERATIONS.md`
