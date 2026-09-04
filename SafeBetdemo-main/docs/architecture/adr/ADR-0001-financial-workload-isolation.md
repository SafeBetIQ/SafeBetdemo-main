# ADR-0001 — Financial rollup workload isolation (ARCH-V4-A2)

- **Status:** Accepted (implemented on Demo)
- **Date:** 2026-09-04
- **Products affected:** SafeBet IQ (Financial Intelligence); Shared Platform Foundation (durable queue + workers)
- **Approver:** pending independent PR review (Demo-only; no Production)
- **Review date:** +90 days

## Context
Architecture Authority v4.0 §9 requires heavy/background work off shared authentication/OLTP
compute. The financial rollup (`sbiq-financial-rollup-refresh`) ran as pg_cron on the Demo
Supabase Postgres — the measured shared-compute offender behind the AUTH-DEMO-1 login
starvation (a `*/2`, ~118s run, watchdog-retriggered near-continuously). A1 mitigated it with
cadence + disabled watchdogs; A2 makes the isolation **structural**.

## Decision
Introduce **EventBridge Scheduler → SQS (with DLQ) → dedicated AWS Lambda worker** that
orchestrates the EXISTING authoritative incremental rollup by invoking
`public.sbiq_financial_rollup_refresh()` via PostgREST. The pg_cron trigger is disabled; the
worker is the sole authoritative trigger.

- **Queue tech: SQS** — durable, native DLQ/redrive, retries, visibility timeout; standard for
  low-frequency work.
- **Worker tech: Lambda** (not Fargate) — the work is short (~30–45s), infrequent (15 min), needs
  no persistent connections; Lambda is operationally simpler and cheaper. **Reserved concurrency = 1**
  enforces a single writer.
- **Idempotency**: relies on the DB function's existing watermark/dirty-bucket recompute + advisory
  xact lock — a duplicate delivery recomputes the same buckets (proven: bucket GGR identical across
  duplicate runs). No business change needed for exactly-once *effect*.
- **Timeout**: PostgREST enforces the API roles' ~8s statement_timeout (SQLSTATE 57014). A narrow
  migration sets a **function-scoped** `statement_timeout = 120s` on the rollup function so the
  worker path can complete, matching pg_cron behaviour. No arithmetic/semantic change.

### What is NOT changed
GGR arithmetic, certified semantics, `source_as_of`, freshness contract, tenant/casino scoping,
RLS, grants, SECURITY DEFINER status/estate (141/61/62/131 unchanged), and the app runtime
(`/api/version` stays `3810680`). The SQL aggregation still executes in Postgres (bounded,
single-writer) — A2 isolates SCHEDULING/ORCHESTRATION/RETRY/DLQ/OBSERVABILITY, not the SQL CPU;
moving the aggregation itself into worker code is a later, separately-scoped step.

## Alternatives considered
- **Lambda directly invoked by EventBridge (no SQS):** rejected — loses durable retry/DLQ/backpressure.
- **Fargate worker:** rejected — over-provisioned for a 15-min, <1-min job.
- **Reimplement the rollup in the worker (offload DB CPU):** rejected for A2 — would change the
  certified pipeline (prohibited by the milestone); revisit as a separate item.
- **Raise `statement_timeout` on `service_role` globally:** rejected — broader than needed; function
  scope is narrower.
- **Management-API PAT in the worker instead of service-role key:** rejected — PAT is a more
  powerful (project-management) credential than the DB-scoped service role.

## Consequences
- Structural prevention of the AUTH-DEMO-1 class: bounded concurrency (1), no watchdog recursion,
  external cadence, DLQ backpressure with alarms.
- New AWS surface (SQS/DLQ/Lambda/Scheduler/Secret/2 alarms) with least-privilege IAM.
- Security posture: the Demo service-role key now lives in Secrets Manager (scoped IAM read). Demo
  only. Production would require a dedicated scoped mechanism (documented, not built).

## Migration / rollback
Rollback: disable the schedule + `cron.alter_job(... active => true)` to restore pg_cron; the SQL
change reverses with `reset statement_timeout`. App EB rollback ref `demo-node20-202608301806-b104892`.
See `docs/runbooks/financial-rollup-worker.md`.
