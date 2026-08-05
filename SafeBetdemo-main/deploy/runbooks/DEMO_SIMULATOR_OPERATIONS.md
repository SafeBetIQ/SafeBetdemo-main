# Runbook — SafeBet IQ Demo Live Simulator Operations

**Environment (Demo only):** Supabase `uexdjngogzunjxkpxwll` · `demo.safebetiq.com` ·
Elastic Beanstalk `safebet-iq-demo` · branch `Demo`.
**Never** touch production (`ilibvipqbkugqkppzdmh`, `app.safebetiq.com`) or marketing (`safebetiq.com`).
**No secrets in this file.**

## 1. Normal operating state

- Cron `sbiq-demo-live-tick` (jobid 6) runs **every 5 min**; producer `safebet-demo-live-simulator-v2`.
- Watchdog `sbiq-demo-tick-watchdog` runs every 5 min; partition-readiness `sbiq-demo-partition-readiness` daily 00:30.
- All six casinos show non-zero, fluctuating certified `players_active_now`.
- Baseline **~12k–35k events/day**; regulator showcase adds up to ~50k. Warning **75,000/day**, hard-stop **120,000/day**.
- Health `Healthy`; five reconciliations Green; seven audit chains verified; partitions current+next-2 secure.

**One-glance health:**
```sql
select overall_health, events_today, pct_of_daily_hardstop, reconciles_all, open_alerts, tick_late
from sbiq_demo_sim_health_overall;
```

## 2. Daily checks
- `select * from sbiq_demo_sim_health_overall;` → `overall_health` in {Healthy, Warning}; `tick_late=false`; `open_alerts=0`.
- `select * from sbiq_demo_simulator_usage;` → `est_daily_events` below warning; `failures_24h=0`.
- Super Admin → Platform Health → **Demo Simulation Health** section reads the same values.

## 3. Weekly checks
- `select * from sbiq_demo_storage_status;` → `pct_of_internal_alloc` < 70; growth stable.
- Review `sbiq_demo_sim_alerts` (open + recently resolved); acknowledge/resolve stale.
- Confirm reconciliations + 7 chains (see §Verify).

## 4. Monthly partition check (auto, plus manual confirm in last 7 days of month)
```sql
select public.sbiq_demo_partition_readiness(true);   -- ensures current + next two, secure
```
Expect `ok=true`, empty `missing`/`insecure`.

## 5. Warning response (approaching/над 75k/day)
- Simulator auto-enters **reduced mode** (baseline only, no new showcase volume) and raises `SIMULATOR_VOLUME_WARNING`.
- Confirm: `select mode,events_generated from sbiq_demo_sim_run_log order by started_at desc limit 3;` → `mode='reduced'`.
- No action needed unless growth is unexpected; investigate producer counts if so.

## 6. Critical response
- **Hard-stop reached:** `SIMULATOR_VOLUME_LIMIT_REACHED`; tick returns `mode='hardstop'`, generates **no** events, cron stays alive, audit untouched. Resets next day. To raise the ceiling deliberately: `update sbiq_demo_sim_limits set value=<n> where key='SIM_EVENTS_PER_DAY_HARDSTOP';`
- **Late/failed tick:** `SIMULATOR_TICK_LATE` / `SIMULATOR_TICK_FAILED`. Check `sbiq_demo_sim_run_log` `error_category`, pg_cron `cron.job_run_details`. Watchdog auto-resolves the alert once a successful tick lands.
- **Partition missing/insecure:** `SIMULATOR_PARTITION_MISSING` / `_INSECURE`. Run `sbiq_demo_partition_readiness(true)`; never hand-create insecure child tables.
- **All casinos zero:** `SIMULATOR_ALL_CASINOS_ZERO`. Confirm simulator enabled + cron active; run one manual `select sbiq_demo_live_tick(5);`.

## 7. Emergency disable
```sql
update sbiq_demo_sim_flags set value='false' where key='ENABLE_DEMO_LIVE_SIMULATOR';   -- stop event generation
update sbiq_demo_sim_flags set value='false' where key='ENABLE_DEMO_SHOWCASE_MODE';     -- stop showcase windows
-- if the cron itself must stop:  select cron.unschedule('sbiq-demo-live-tick');
```
This does **not** delete history, rewrite projections, break authentication, or disable audit verification.

**Confirm it stopped:**
```sql
select count(*) from casino_event_log
 where producer='safebet-demo-live-simulator-v2' and occurred_at > now()-interval '6 minutes';  -- expect 0 after next tick window
```
Active-now **decays naturally** as refreshed players age past the 30-min freshness window (no threshold change).

## 8. Re-enable safely
```sql
update sbiq_demo_sim_flags set value='true' where key='ENABLE_DEMO_LIVE_SIMULATOR';
update sbiq_demo_sim_flags set value='true' where key='ENABLE_DEMO_SHOWCASE_MODE';
-- if unscheduled:  select cron.schedule('sbiq-demo-live-tick','*/5 * * * *',$$select public.sbiq_demo_live_tick(5);$$);
select public.sbiq_demo_live_tick(5);   -- prime immediately
```
**Verify after re-enable:** `sbiq_demo_sim_health_overall` → Healthy; reconciliations Green; 7 chains verified.

## 9. Cost & storage review
- `sbiq_demo_storage_status`: `db_size`, `event_log_by_partition`, `est_daily_growth_mb`, `est_days_to_alloc`.
- Thresholds *(configured, not billing)*: warn 70%, critical 85% of `STORAGE_INTERNAL_ALLOC_MB` (8192). See `deploy/DEMO_RETENTION_POLICY.md`.

## 10. Showcase-account rotation
- Showcase windows are created only by trusted server code (secure login → `sbiq_demo_activate_showcase`).
- Cooldowns prevent repeated logins extending windows: casino 30 min (no extend < 10 min, cap 45), regulator 45 min (no extend < 15 min, cap 60); max 3 casino / 2 regulator activations per rolling hour. Login always succeeds; internal limits are never surfaced to the evaluator.

## Verify (reconciliation + chains)
```sql
-- 5 reconciliations
select bool_and(active_players = players_active_now+players_idle+players_stale) players,
       bool_and(open_sessions = active_sessions+idle_sessions+stale_sessions) sessions,
       bool_and(active_machines = machines_in_play+machines_stale) machines,
       bool_and(round(ggr,2)=round(total_wagered-total_won,2)) ggr
from projection_casino_state;
-- 7 chains
select s, sbiq_verify_audit_chain(s)->>'status' from (values
 ('a1b2c3d4-0000-0000-0000-000000000001'),('cc000001-0000-0000-0000-000000000001'),
 ('cc000002-0000-0000-0000-000000000002'),('cc000003-0000-0000-0000-000000000003'),
 ('cc000004-0000-0000-0000-000000000004'),('cc000005-0000-0000-0000-000000000005'),('platform')) v(s);
```

## Evidence required after an incident
Snapshot of `sbiq_demo_sim_health_overall`, the relevant `sbiq_demo_sim_alerts` rows,
`sbiq_demo_sim_run_log` around the event, reconciliation + chain output, and the action taken
(with timestamps, SAST). No credentials or tokens in the evidence pack.

## Distinguishing simulator failure from dashboard caching
- **Simulator failure:** `sbiq_demo_sim_run_log` shows `outcome<>'ok'` or no recent row; `last_successful_tick` stale; alert raised.
- **Dashboard caching:** run log healthy and `players_active_now` non-zero in SQL, but a page shows an old number — compare the page's **snapshot-age** indicator; small cross-page differences are expected when snapshots have different timestamps. Refresh the page; do not touch the simulator.

## Platform Health load / API troubleshooting (Super Admin)
The panel loads via `/api/admin/simulation-health` → one RPC `sbiq_demo_sim_health_snapshot()`.

- **Panel stuck on the loading skeleton / "This is taking longer than expected":**
  the client reads the token lock-free (no `getSession()` wait) and starts as soon as
  AuthContext is verified. If it stalls, check the API directly:
  `select public.sbiq_demo_sim_health_snapshot();` should return in **< 1s**. A retry
  button appears at 15s and hits `?fresh=1` (cache bypass). Retrying does not create
  duplicate polling loops (one timer; in-flight requests are aborted).
- **Supabase auth-lock delay (historical):** the old panel called
  `supabase.auth.getSession()`, which blocked on the `sb-<ref>-auth-token`
  navigator lock held by AuthContext/token-refresh on first paint (~10-20s). The
  panel now uses `readAccessTokenFast()` (synchronous localStorage read); the server
  still fully re-validates the token. If you must debug, confirm the token exists in
  `localStorage` under a `*-auth-token` key.
- **API slow (> 2s):** run `explain (analyze) select public.sbiq_demo_sim_health_snapshot();`.
  Expected cost is one `projection_casino_state` active-cohort read (~0.3s) + one
  month-bounded event-log scan. If slow, verify the indexes exist:
  `casino_event_log(producer, occurred_at)` and
  `projection_player_state(casino_id, status, last_event_at)`.
- **API timeout:** the client aborts via `AbortController` and shows a retry with a
  correlation reference. A slow API never logs the user out and never exposes stacks.
- **Duplicate requests:** a new load aborts any in-flight one; polling waits for the
  first load and pauses when the tab is hidden — there should never be two concurrent
  health requests from one panel.
- **Failed polling refresh:** previous valid data stays visible (with its certified
  snapshot age); only a subtle refreshing indicator shows. No blank flash.
- **Role-denial errors:** the API validates the caller **every** request (never from
  cache): anonymous → 401, operator/regulator → 403, super_admin → 200. A 401/403 in
  the browser means the session/role is wrong, not a health-data problem. The short
  (6s) server cache holds only non-secret health data and is returned only after a
  fresh per-request super-admin check.

## Super Admin Overview troubleshooting
The Overview loads via `/api/admin/overview` → one RPC `sbiq_admin_overview_snapshot(false)`
(core) + a deferred `?section=financial` and a deferred `national-overview`.

- **Overview stuck loading:** check the core RPC directly —
  `select public.sbiq_admin_overview_snapshot(false);` should return in **< 2.5s**
  (cold) / **< 1s** (warm/cached). The client reads the token lock-free and starts
  immediately; a spinner beyond ~5s means the API, not the client.
- **Consolidated API failure:** the hook keeps prior data and surfaces a retry with a
  correlation reference; `?fresh=1` bypasses the 8s core / 20s financial cache. A
  failed core request never logs the user out and never exposes stacks.
- **Partial widget rendering:** critical KPIs come from the core snapshot; the GGR
  (financial) and interventions/monitored/emerging (national-overview) load **deferred**
  — a brief gap there is expected and does not block first paint.
- **Cache bypass:** append `?fresh=1`. Core cache 8s, financial 20s; both hold only
  non-secret metrics and are served only after a per-request super-admin check.
- **Role-denial:** anonymous 401, operator/regulator 403, super_admin 200 — validated
  every request. A browser 403 means the session isn't super-admin.
- **Polling failure:** one 45s timer, paused when the tab is hidden; a failed refresh
  keeps the last good snapshot visible with its certified age (subtle spinner only).
- **Snapshot age not updating:** the age reflects the certified `as_of` in the payload;
  if it stops advancing, the cache may be serving (≤8s) or polling is paused (hidden
  tab). Force with the manual refresh button (`?fresh=1`).
- **Overview metrics differ from Platform Health:** both read the same certified
  projections but at **different snapshot instants** and different cache windows
  (Overview core 8s, Sim Health 6s). Small differences are expected; compare the
  certified snapshot-age on each. Registered ≠ active-now by design (observed =
  active_now + idle + stale).
- **Registered count looks stale:** `sbiq_admin_registered_counts` caches the static
  demo population, refreshed only when older than 6h; force with
  `select public.sbiq_admin_refresh_registered();`.
