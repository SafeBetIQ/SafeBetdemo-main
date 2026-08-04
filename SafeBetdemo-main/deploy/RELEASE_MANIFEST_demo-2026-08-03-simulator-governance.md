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
| **Runtime application commit** | **`8b28c54`** — reported by `/api/version` (`gitCommit`) |
| Prior runtime commit | `27df8fd` (governance milestone; superseded during positive-path verification — see below) |
| Validation & Playwright-only commits | `8721f70` (governance check), `8377963` (super-admin positive-path check) |
| Branch | `Demo` |
| Elastic Beanstalk application | `safebet-iq-app` (eu-west-1) |
| Elastic Beanstalk environment | `safebet-iq-demo` |
| **EB application version (current)** | `demo-node20-202608041808-8b28c54` — Ready/Green |
| Prior EB version | `demo-node20-202608041535-27df8fd` |
| Node version (build) | `20.20.0` (Linux, `aws/codebuild/standard:7.0`) |
| Demo Supabase project | `uexdjngogzunjxkpxwll` (demo; **not** production `ilibvipqbkugqkppzdmh`) |
| Rollback version (retain) | `demo-node20-20260803-d57e82c` |

> **Runtime-commit note:** the governance milestone shipped as `27df8fd`. The Super Admin
> positive-path verification found three required Demo Simulation Health fields not
> rendering (next expected tick, daily **warning** limit, estimated monthly events); per
> the milestone's own "redeploy only for a genuine runtime defect" rule, these were added
> (commit `8b28c54`, component-only — no API/DB change) and redeployed. `/api/version` now
> reports `8b28c54`. All other runtime behaviour, migrations, crons and certified
> semantics are unchanged from `27df8fd`.

## Super Admin positive-path verification (2026-08-04)

- **Account:** `demo.admin@safebetiq.com` — demo-only, `super_admin`, no casino/jurisdiction
  scope, not banned, **not** in the quick-login allowlist, no public Super Admin card on `/login`.
  Password reset to a strong random value stored **only** in git-ignored
  `deploy/e2e/.env.demo-walkthrough` (never printed, committed, logged or screenshotted).
- **Manual login** (email+password form, no quick-login, no auto-login) → `/admin`.
- **Rendered:** Platform Health → Demo Simulation Health panel with overall status, simulator
  + showcase enabled state, last successful + next expected tick, daily events, daily warning
  + hard limits, estimated monthly events, storage, partition readiness, projection lag,
  active showcase windows, open alerts, emergency-disable state, six-casino table; Audit Centre.
- **API authorization:** super_admin **200**, operator **403**, regulator **403**, anonymous **401**;
  no credentials/tokens/service-role key in the page or the response.
- **Value parity:** panel figures match `/api/admin/simulation-health` and DB (events_today,
  overall_health verified equal).
- **Screenshots (safe, no secrets):** `deploy/e2e/screenshots/admin-platform-health.png`,
  `admin-sim-health-panel.png`, `admin-sim-six-casino.png`, `admin-sim-alerts-partitions.png`,
  `admin-audit-centre.png`.
- **Post-walkthrough integrity:** five reconciliations Green; seven audit chains verified;
  regulator active-now = Σ, observed = Σ; **0 open alerts**; simulator enabled; overall health
  Healthy; EB Ready/Green; `/api/health` 200. Production + marketing untouched (200, unchanged).

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
