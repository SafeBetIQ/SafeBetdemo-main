# ADR-0002 — Financial compute isolation: temporary architecture exception (ARCH-V4-A2.2)

- **Status:** Accepted — **TEMPORARY ARCHITECTURE EXCEPTION** to Architecture Authority v4.0 §9
- **Date:** 2026-09-04
- **Products affected:** SafeBet IQ (Financial Intelligence); Shared Platform Foundation
- **Approver:** pending independent PR review (Demo-only; no Production)
- **Review / exit-by date:** 2026-12-03 (or on Option-A authorisation, whichever first)
- **Relates to:** [ADR-0001](ADR-0001-financial-workload-isolation.md)

## Context
A2.1 moved the financial rollup's **scheduling/orchestration/retry/DLQ/concurrency/observability**
off shared pg_cron onto EventBridge→SQS→Lambda. A2.1's report correctly noted the **SQL
aggregation still executes inside Postgres**. A2.2 measures whether that residual in-Postgres
compute can starve authentication/OLTP, and decides the compute model.

## Measured evidence (Demo, 2026-09-04)
- **DB execution per refresh ≈ 30,105 ms** (server-side timing) — ~97% of the ~31–43s worker
  duration; the remainder is orchestration/network. Cost is ~30s **regardless of new-event
  volume** (measured with 20 events / 12 buckets and with 0 events / 6 buckets), driven by the
  incremental refresh's scan/range-upsert over a 607k-row, 126-day event log.
- **Backlog + auth guardrail:** a controlled 10-message backlog (~5 min of near-continuous serial
  30s rollups, reserved concurrency 1) with the auth compute (GoTrue token endpoint) sampled
  throughout: **p50 1.26s / p95 1.59s / max 1.68s** — vs the AUTH-DEMO-1 failure band of 20–40s.
- **DB contention during backlog:** 0 lock waits, 1–4 active queries, 8–11 connections, no blocked
  sessions; the queue **drained** (10→2) — messages are processed faster than a real backlog forms
  (scheduler enqueues 1 per 15 min; each processes in ~30–43s).
- SECURITY DEFINER estate unchanged (141/61/62/131). All six casinos GGR parity RPC==VIEW holds.

## Options evaluated
**Option A — external worker performs the calculation** (read authoritative events → compute the
rollup in the worker → bounded governed write). *True* compute isolation, but it **moves the
certified financial computation boundary out of Postgres**, which Authority §8/A2.2 §8 prohibits
changing without separate approval (arithmetic/source-authority/consistency/replay/audit risk).
**Not implemented — design-and-approve path.**

**Option B — dedicated analytical/read compute** (replica/separate analytical DB → rollup →
publish). Introduces replication delay, source-authority/consistency and certification-semantics
concerns, plus material infra cost/complexity for Demo. **Deferred.**

**Option C — current Postgres aggregation with an explicit bounded exception.** Permitted because
the measured contention is low, execution is bounded and guardrails held (evidence above), the
exception is documented here, and an exit criterion is defined. **Selected.**

## Decision
Adopt **Option C** and classify the current state as a **TEMPORARY ARCHITECTURE EXCEPTION** to §9:
**queue/orchestration isolation is achieved; full compute isolation is NOT.** This is explicitly
**not** claimed as full compute isolation.

### Compensating controls (why the exception is safe now)
Reserved concurrency = 1 (single ~30s query at a time); function `statement_timeout = 120s`;
incremental refresh; external fixed 15-min cadence (no self-perpetuating watchdog); SQS DLQ +
CloudWatch alarms; idempotent (advisory lock + watermark). Measured auth p95 1.59s under backlog.

### Residual risk
A pathological backlog (worker unavailable for many hours → tens of redundant refresh messages)
would serialise many 30s rollups. Because each is a single bounded query and one concurrent 30s
query did not starve auth, the risk is low but not structurally eliminated. The ~30s-per-refresh
cost *independent of event volume* is inefficient and is the main driver of any backlog cost.

## Exit criteria (to remove the exception → true compute isolation)
1. **Preferred:** implement **Option A** (compute the rollup in the worker, bounded governed write)
   under separate approval that covers the certified-computation-boundary change (§8), with proven
   arithmetic parity to `projection_financial_posture` / `sbiq_certified_financial_posture_v2`.
2. **Interim hardening (within Option C, optional):** optimise `sbiq_financial_rollup_refresh` so a
   near-no-op refresh is cheap (<2s) — removing the fixed ~30s cost and shrinking backlog exposure —
   with byte-parity of rollup output; and/or collapse redundant queued refresh messages.
3. Re-review by the exit-by date; if unresolved, re-authorise or escalate.

## Financial-truth impact
None. GGR = wagers − winnings, `projection_financial_posture` source authority,
`sbiq_certified_financial_posture_v2` semantics, `source_as_of`, and the
LOADING/FRESH/STALE/PARTIAL/UNAVAILABLE contract are **unchanged**; no missing/stale → R0 certified.

## Rollback
Unchanged from ADR-0001 (disable schedule/ESM + re-enable pg_cron + `reset statement_timeout`).
No Production impact.
