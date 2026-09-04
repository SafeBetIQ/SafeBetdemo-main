> **STATUS UPDATE (ARCH-V4-A2, 2026-09-04):** the **Financial rollup refresh** is now ISOLATED onto EventBridge Scheduler → SQS (+DLQ) → dedicated Lambda worker (`safebet-iq-financial-rollup-worker`, reserved concurrency 1); the pg_cron `sbiq-financial-rollup-refresh` is DISABLED. See [ADR-0001](architecture/adr/ADR-0001-financial-workload-isolation.md) and [runbook](runbooks/financial-rollup-worker.md). Remaining workloads below are not yet moved.

# ARCH-V3-A2 — Workload Isolation Hand-off Inventory

Produced by ARCH-V3-A1 (financial/live close-out) as the input to **Track A2 —
Workload Isolation** (architecture v3 §18.3, §19.1). A1 did **not** build A2; it
kept every heavy workload OFF the auth/OLTP critical path via conservative cadence
+ advisory locks + disabled watchdogs. A2 moves these off shared Supabase compute
onto a durable queue + dedicated worker pools.

Measurements are from the Demo project `uexdjngogzunjxkpxwll` at A1 close-out
(2026-09-02/03), read-only from `cron.job` + `cron.job_run_details`.

## Current heavy / recurring workloads

| Workload | Current execution location | Cadence | Avg / Max duration | Input | Output | Idempotency | Locking | Target A2 worker class |
|---|---|---|---|---|---|---|---|---|
| **Financial rollup refresh** (`sbiq-financial-rollup-refresh` → `sbiq_financial_rollup_refresh`) | pg_cron on the shared Supabase OLTP/Auth DB | `*/15` | ~33s / ~48s | `casino_event_log` dirty buckets since a `received_at` watermark cursor | `sbiq_financial_rollup_hourly` (upsert) | Yes — dirty-bucket range upsert, re-runnable to same state | `pg_try_advisory_xact_lock('sbiq_financial_rollup_refresh')` (non-overlap) | **Financial Worker Pool** — queue-triggered (SQS/EventBridge), watermark/cursor batch on ECS/Fargate or Lambda; checkpoint after success |
| **Demo/live event generation** (`sbiq-demo-live-tick` → `sbiq_demo_live_tick`) | pg_cron on the shared DB | `*/5` | ~2s / ~4s | `sbiq_demo_sim_config` (targets, bet range), `projection_player_state` | `casino_event_log` `BET_PLACED` events + projection state | Yes — `dedupe_key` + `ON CONFLICT DO NOTHING`; per-day hardstop/warning volume governance | `pg_try_advisory_xact_lock('sbiq_demo_live_tick')` | **Simulator/producer worker** — scheduled task on dedicated compute; same volume governance + dedupe |
| **Audit verification (incremental)** (`sbiq-audit-verify-incremental`) | pg_cron on the shared DB | `*/15` | ~0–1s | `audit_events` (incremental chain segment) | Chain verification state | Yes — verify is read-only/derived | (light; short-running) | **Evidence/Audit worker** — queue or scheduled, off OLTP |
| **Audit verification (full)** (`sbiq-audit-verify-full`) | pg_cron on the shared DB | daily `0 2 * * *` | n/a (nightly) | Full `audit_events` chain | Chain health/verification | Yes | n/a | **Evidence/Audit worker** — nightly batch |
| **Demo partition readiness** (`sbiq-demo-partition-readiness`) | pg_cron on the shared DB | daily `30 0 * * *` | n/a | Partition catalog | Ensured next-period partitions | Yes | n/a | **Platform-ops maintenance worker** |

### Disabled by design (must NOT be re-enabled as-is)
| Job | State | Reason |
|---|---|---|
| `sbiq-demo-tick-watchdog` | **inactive** | Self-perpetuating re-trigger — the AUTH-DEMO-1 compute-starvation pattern. A2 replaces watchdog re-triggering with queue redelivery + dead-letter. |
| `sbiq-financial-rollup-watchdog` | **inactive** | Same self-perpetuating anti-pattern (the `*/2`, ~118s runaway root cause). |

## Future workloads to provision directly on A2 (greenfield — do NOT add to pg_cron)

| Workload | Input | Output | Idempotency | Target A2 worker class |
|---|---|---|---|---|
| **Guardian discovery / correlation** | domains/apps/operators, DNS/RDAP/TLS/hosting intel | operator entity graph, cases, evidence | Per-subject upsert; content-hash dedupe | Guardian Discovery/Correlation Workers |
| **Website Pre-Compliance scanning** | submitted URLs, journeys | findings + screenshot/DOM evidence | Per-URL/rule-version idempotent | Website Scan Worker Pool (headless browser) |
| **VLT telemetry processing** | device heartbeats/meters/faults | hot telemetry + exception vs certified state | Per-event dedupe/watermark | Telemetry Processing Workers (queue/stream) |
| **Payment intelligence processing** | merchant tokens, PSP/acquirer signals (no PAN/CVV) | operator↔merchant correlation, referrals | Idempotent ingestion | Payment Intelligence Workers |
| **Evidence processing / reporting** | evidence artefacts, report requests | hashed vault artefacts, generated reports | Content-hash idempotent | Evidence Processing / Reporting Workers |

## A2 guardrails carried forward (from A1 evidence)
- **Authentication is the critical SLO** — no heavy workload may share the auth/OLTP compute path (measured: `*/2` 118s rollup ⇒ GoTrue 20–40s; the AUTH-DEMO-1 incident).
- **Background runtime ≪ schedule interval**; **one writer** per stream; **no duplicate writers**; **no watchdog recursion**; **every worker idempotent + observable** (§19.1).
- Move order: **Financial rollup refresh first** (highest measured cost on the shared DB), then the simulator producer, then audit verification, then greenfield workers as their modules are built.
