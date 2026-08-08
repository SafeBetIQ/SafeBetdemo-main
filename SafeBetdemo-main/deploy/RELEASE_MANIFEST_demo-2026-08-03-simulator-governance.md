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
| **Runtime application commit** | **`437a099`** — reported by `/api/version` (`gitCommit`); see *Operator Dashboard redesign* below |
| Prior runtime commits | `678860f` (financial rollup), `8dc740d` (Overview consolidation), `9d7f9cd`, `8b28c54`, `27df8fd` |
| Validation & Playwright-only + DB fixes | `8721f70`, `8377963`, `c3f0430`, `3ebd8e0` (registered-refresh WHERE fix + fin check) |
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

## Operator Dashboard redesign — match Live Casino Feed (2026-08-08)

**Runtime commit:** `437a099` (redesign `bce15b0` + resilience `3f6dc5a`/`a92f531`/`437a099`).
**EB version:** `demo-node20-202608081906-437a099` (Ready/Green, `/api/version` = 437a099).
**Rollback:** `demo-node20-202608060753-678860f`.

**UI/UX:** Operator Dashboard rebuilt in the Live Casino Feed visual system — simplified
header (title + "Live operational posture for <Casino>" + Reconciled·Healthy + SnapshotAge +
Refresh), a **6-card primary KPI strip** (shared `components/dashboard/KpiCard`: Active Players
/ Active Sessions / In Play / GGR Today / Critical Risk / Open Interventions), **three compact
posture panels** (`PostureSummaryCard`: Player Activity / Session Posture / Gaming Machines &
Endpoints — replacing ~12 equal-weight cards), and a secondary **Risk Overview + Financial
Posture** row with drill-down links (progressive disclosure). Tenant-agnostic (no casino-name
conditionals); certified identities preserved (observed=active+idle+stale; open=active+idle+stale;
allocated=in_play+stale; GGR=stakes−winnings; risk population).

**Data mismatch root cause:** *frontend, not source.* Both pages read the SAME certified
`consumer-gateway` `live-floor` KPI. The screenshot "Live Feed 0 vs Operator 46" was the Live Feed
rendering `DEFAULT_KPI` zeros during the initial async gap. Fixes: `kpiLoaded` flag + skeleton (Live
Feed never shows fake zeros); lock-free token in `consumerClient`/`CasinoDataContext`; Operator
Dashboard **retries live-floor until `kpi` is populated** + a loading skeleton (no false "integrity
warning" during load).

**Burst control:** "Burst 40 Events" gated behind `super_admin` ("Demo controls"); casino/regulator
evaluators see an operational platform. Background simulator keeps the floor live regardless.

**Verification (Playwright, six casinos):** all six render the redesign; **exact active-now parity**
Live Feed↔Dashboard (49/49, 37/37, 70/70, 25/25, Betway 298, Royal Palace 16); observed distinct from
active-now; Live Feed non-zero (no fake zero-state); reconciliations Green; no cross-tenant leakage.
No data-fetch fan-out added (same 2 certified views). Tests **548/548** (+7). Five reconciliations
Green; seven chains verified. Shared components: `KpiCard`, `PostureSummaryCard`, `ReconciliationBadge`.

## Certified financial rollup + registered freshness (2026-08-06)

**Previous runtime commit:** `8dc740d` · **New runtime commit:** `678860f` (+ DB fix `3ebd8e0`).
**EB version:** `demo-node20-202608060753-678860f` (Ready/Green, `/api/version` = 678860f).
**Rollback:** `demo-node20-202608051914-8dc740d`.

**Problem:** the deferred certified financial query (`projection_financial_posture`)
scanned **~136,824 all-time financial events** → ~5–6s; registered totals used a 6h cache
with no visible freshness/refresh.

**Financial rollup (migrations `20260806100000`/`100100`/`100200`/`100300`):**
- **Rollup table** `sbiq_financial_rollup_hourly` (**version 1**) — hourly buckets from the
  SAME certified normalisation (`event_type in (BET_PLACED,JACKPOT)`, `stake=bet_amount`,
  `winnings=coalesce(win_amount,0)`, `GGR=stake−winnings`, `is_synthetic=is_simulated OR synthetic`).
- **Incremental cursor** = `received_at` + `event_id`; **dirty-bucket** rebuild (late-arriving
  events rebuild their affected buckets) + current-hour repair; `sbiq_financial_rollup_checkpoint`
  + `_run_log`. **Backfill** (resumable month batches): **5,298→5,304 buckets** from 2026-05-01.
- **Cron** `sbiq-financial-rollup-refresh` (*/2, advisory-locked) + `sbiq-financial-rollup-watchdog` (*/5).
- **Posture RPC** `sbiq_certified_financial_posture_v2(p_casino,p_as_of)` — complete buckets +
  live tail (current + h24-boundary hour); returns the **exact** `projection_financial_posture`
  rowtype. **~5,379ms → ~50ms.** SAST (UTC+2) boundaries hour-aligned.
- **Parity:** **EXACT** — all 6 casinos × {shift, today, 24h, MTD} × {stakes, winnings, GGR,
  bet-count, events-total} diff **= 0**; status/mode/synthetic/unsupported-NULL match; live re-check diff 0.

| Metric | Before | After |
|---|---|---|
| Financial DB query | ~5,379ms | **~50ms** |
| Financial API (deferred) | ~5–6s | fresh ~1.5s · cached ~0.6–1.4s (auth+network bound) |
| Full event-log scan | yes | **no** |

**Freshness/provenance (Phase 9):** `as_of`, `rollup_computed_at`, `source_max_occurred_at`,
`source_max_ingested_at`, `rollup_lag_seconds`, `rollup_version`, `reconciles`, `is_simulated`,
`capability_status`; classification **Current/Delayed/Stale/Unknown** (from last processed event).

**API:** `/api/admin/overview?section=financial` → `sbiq_admin_financial_section` (v2 + freshness +
`ENABLE_FINANCIAL_ROLLUP` **fallback** to the certified view, marked `fallback:true`). New
`POST /api/admin/overview/refresh-registered-counts` (super_admin, advisory-locked, rate-limited ≥30s,
audited). Platform Health `/api/admin/simulation-health` adds `financial_rollup` status.

**Registered freshness:** `sbiq_admin_registered_counts` gains `source_as_of`, `last_refresh_duration_ms`,
`last_refresh_status`; `sbiq_admin_registered_status()` exposes age/is_stale; auto-refresh only when
stale >6h (no per-request scan); Overview shows age + confirm-gated manual refresh (never blanks count).

**Alerts:** `FINANCIAL_ROLLUP_LATE/_FAILED` (watchdog). **Fallback tested** (disable→certified-view,
enable→rollup). **Manual-refresh matrix:** anon 401, operator 403, regulator 403, super_admin 200.
Tests **541/541** (+8). Five reconciliations Green; seven chains verified; regulator GGR = Σ.
**Cold-outlier / single-flight:** single-instance EB; per-process cache absorbs bursts (documented limitation).

## Admin Overview consolidation (2026-08-05)

**Previous runtime commit:** `9d7f9cd` · **Optimised runtime commits:** `22a34ea` (consolidation) + `8dc740d` (platform_users KPI).
**EB version:** `demo-node20-202608051914-8dc740d` (Ready/Green, `/api/version` = 8dc740d).
**Rollback:** `demo-node20-202608051350-9d7f9cd`.

**Problem:** the `/admin` Overview fired **~8 data requests** on mount with duplicates
(`casinos`, `users`, `national-overview` each **2×** — AuthContext fired `loadData` twice)
plus `software_modules` and the auth profile lookup, causing fan-out + layout shift.

**Consolidated endpoint / RPC:** `GET /api/admin/overview` → one RPC
`sbiq_admin_overview_snapshot(p_include_financial)` (migration `20260805120000`). Reads
`projection_casino_state` **once** (certified per-casino metrics, exact parity), registered
counts from a tiny **static-population cache** `sbiq_admin_registered_counts` (refreshed only
when >6h — avoids a ~1.8s scan), platform_users count, governance (7 chains, alerts,
partitions), simulator summary, per-casino set. Financial GGR
(`projection_financial_posture` ~5s over 130k events) is **optional/deferred**.

**Indexes added:** none new (reused `casino_event_log(producer,occurred_at)` and
`projection_player_state(casino_id,status,last_event_at)` from the Platform Health work).
Query-plan finding: core snapshot ~2s cold / ~0.5s cached; financial ~5–6s (deferred).

**Cache:** private in-memory — core **8s**, financial **20s**, `?fresh=1` bypass; auth
validated every request (never cached).

**Frontend:** `useAdminOverview()` — one primary request (lock-free token, immediate,
schema-validated `admin-overview-v1`, aborts stale, single 45s visibility-paused poll,
keeps prior data), + **deferred** financial + **deferred** `national-overview`
(interventions/monitored/emerging — not replicated). Users list **deferred to the Users tab**.

| Metric | Before | After |
|---|---|---|
| Initial Overview data requests | ~8 (casinos/users/national **2× each**) | **3 bounded** (1 core + 1 deferred financial + 1 deferred national) |
| Direct `casinos` / `users` fetch on first paint | 2× / 2× | **0 / 0** |
| API (core) | — | ~0.5s cached / ~2.7s fresh |
| First meaningful content (warm median) | — | **1,472ms** (min 993ms) |
| Cold first content | — | ~3,430ms (one 7.9s cache-miss outlier observed) |
| Layout shift | high (18 incremental fills) | reduced (one consolidated snapshot fill) |

**Security:** anonymous 401, operator 403, regulator 403, super_admin 200; no secrets/tokens
in the response; no CDN cache. **Metric definitions unchanged** (observed = active_now+idle+stale;
open sessions = active+idle+stale; endpoints = in_play+stale; GGR = stakes−winnings; risk =
crit+high+med+low+unclassified). Tests **533/533** (+8). Five reconciliations Green; seven
chains verified; regulator active-now/observed = Σ; Demo Ready/Green.

## Platform Health load optimisation (2026-08-05)

**Previous runtime commit:** `8b28c54` · **Optimised runtime commit:** `9d7f9cd`
(intermediate `1067606` = RPC/index/cache + client; `9d7f9cd` = AuthContext decoupling)
**EB version:** `demo-node20-202608051350-9d7f9cd` (Ready/Green, `/api/version` = 9d7f9cd).
**Rollback:** `demo-node20-202608041808-8b28c54`.

**Root cause (measured):** `/api/admin/simulation-health` took **~9–14s** because
`sbiq_demo_sim_health_overall` re-evaluated `projection_casino_state` (~1.7s over
101,982 rows) 3–4×, `sbiq_demo_storage_status` (~735ms full-table scan) 2×, plus
unbounded per-casino `max(occurred_at)` scans and 6 un-indexed producer counts. The
client added the rest: the panel called `supabase.auth.getSession()` (and, after the
first fix, waited on AuthContext's `getCurrentUser()→getUser()`), both contending the
`sb-<ref>-auth-token` navigator lock on first paint.

**Fixes:**
- **DB:** new `sbiq_demo_sim_health_snapshot()` RPC — reads the active-cohort freshness
  **once** (~10k active rows via `sbiq_session_policy`, verified exact parity with
  `projection_casino_state`) and the event log **once** (single month-bounded grouped
  scan); storage from the catalog + run-log daily estimate. Indexes
  `casino_event_log(producer,occurred_at)` and `projection_player_state(casino_id,status,last_event_at)`.
  Migration `20260804120000_demo_sim_health_snapshot_fast`. **~10s → ~0.5s.**
- **API:** one RPC call (was 7 re-scanning view reads) + short **6s private in-memory
  cache** of non-secret health data (`?fresh=1` bypass). Per-request super_admin
  validation unchanged (never cached).
- **Client:** lock-free `readAccessTokenFast()`; fetch starts **immediately on mount**
  (no AuthContext/getSession dependency); structured skeleton + staged messages;
  5/10/15s timeout stages with retry + correlation id; single polling timer that starts
  after first load, pauses on hidden tab, aborts in-flight, keeps prior data on refresh.

**Measured result (Playwright, 5 runs, real-user click):**
| Metric | Before | After |
|---|---|---|
| API response | ~9–14s | ~0.6s cached / ~2.7s fresh |
| First meaningful content (warm median) | ~10–20s | **1,636ms** |
| Six-casino panel (warm median) | ~10–20s | **1,651ms** |
| Cold first content | — | 3,491ms |
| Max observed (cold) | — | 3,512ms |

**Note:** end-to-end also depends on the heavy `/admin` page's Overview tab (~18 fetches
on mount) causing layout shift; that delays Playwright's *default* `.click()` actionability
(a test artifact), not a user-perceived block (main-thread long-tasks totalled 143ms). A
real-user click reaches the panel in ~1.6s. Reducing the Overview tab's fetch fan-out is a
separate, out-of-scope follow-up.

**Security preserved:** anonymous 401, operator 403, regulator 403, super_admin 200;
no cross-account cache exposure; no token/service-key exposure. Tests **525/525** (+6).
Five reconciliations Green; seven chains verified; simulator enabled; Demo Ready/Green.

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
