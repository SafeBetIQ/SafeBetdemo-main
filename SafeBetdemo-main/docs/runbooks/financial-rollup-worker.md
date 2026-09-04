# Runbook — Financial Rollup Worker (ARCH-V4-A2, DEMO)

**Region** eu-west-1 · **Account** 046276255259 (Demo) · **Owner** platform · see [ADR-0001](../architecture/adr/ADR-0001-financial-workload-isolation.md)

## Resources
| Kind | Name |
|---|---|
| Schedule (EventBridge) | `safebet-iq-financial-rollup-schedule` (rate 15 min → SQS) |
| Queue (SQS) | `safebet-iq-financial-rollup` (visibility 180s, redrive maxReceive=3) |
| DLQ (SQS) | `safebet-iq-financial-rollup-dlq` |
| Worker (Lambda) | `safebet-iq-financial-rollup-worker` (nodejs20.x, timeout 120s, reserved concurrency 1) |
| Worker role | `SafeBetIqFinancialRollupWorkerRole` (least privilege) |
| Scheduler role | `SafeBetIqSchedulerRole` (sqs:SendMessage only) |
| Secret | `safebet/demo-supabase-service-role` (service-role key; never logged) |
| Alarms | `safebet-iq-financial-rollup-dlq-not-empty`, `safebet-iq-financial-rollup-worker-failures` |
| DB function | `public.sbiq_financial_rollup_refresh(int)` — `statement_timeout=120s` (migration 20260904140000) |

## Normal operation
EventBridge fires every 15 min → enqueues a message → Lambda invokes the rollup RPC
(~30–45s) → `rollup_success` log + `SafeBet/FinancialRollup` metrics. pg_cron
`sbiq-financial-rollup-refresh` is **disabled** (worker is the sole authoritative writer).

## Observability
- Worker logs: CloudWatch `/aws/lambda/safebet-iq-financial-rollup-worker` (JSON: rollup_start/success/failure with correlationId, receiveCount, durationMs, result).
- Metrics `SafeBet/FinancialRollup`: RollupSuccess, RollupFailure, RollupDurationMs.
- Queue: `ApproximateNumberOfMessages` (depth), `...NotVisible` (in-flight); DLQ depth.
- Financial freshness: `select now()-max(computed_at) from sbiq_financial_rollup_hourly;`

## Common tasks
- **Manual refresh now:** `aws sqs send-message --queue-url <main> --message-body '{"trigger":"manual"}' --region eu-west-1`
- **Inspect DLQ:** `aws sqs receive-message --queue-url <dlq> --region eu-west-1`
- **Redrive DLQ → main after fixing root cause:** re-send the DLQ message bodies to the main queue, then purge DLQ.
- **DLQ/retry drill:** send `{"forceFail":true}` — the worker throws before touching data → retries → DLQ (safe).

## Failure handling
- Worker throws → SQS redelivers (visibility 180s) up to 3× → message → DLQ → `...-not-empty` alarm.
- DB transient error surfaces as a failed RPC → same retry path; recovers when the DB recovers.
- Worker unavailable → messages retained in SQS (durable) → drain on recovery. No silent loss.
- Duplicate delivery → idempotent (rollup recomputes buckets; advisory lock + reserved concurrency 1).

## ROLLBACK (to pg_cron)
1. Disable the worker trigger: `aws scheduler update-schedule --name safebet-iq-financial-rollup-schedule --state DISABLED --region eu-west-1 ...` (and/or `aws lambda update-event-source-mapping --uuid <uuid> --no-enabled`).
2. Re-enable pg_cron: `select cron.alter_job((select jobid from cron.job where jobname='sbiq-financial-rollup-refresh'), active => true);`
3. (Optional) revert the timeout: `alter function public.sbiq_financial_rollup_refresh(integer) reset statement_timeout;`
4. App rollback (only if app source changed, which A2 did not): EB version `demo-node20-202608301806-b104892`.

Do **not** run pg_cron and the worker as concurrent *authoritative* writers; the advisory lock
makes a brief overlap safe, but steady state must be exactly one.

## Guardrails
- Authentication is the hard SLO. If operator login regresses toward 20–40s, roll back immediately.
- Do not raise cadence below 15 min or re-enable the self-perpetuating watchdogs.
- Never log the service-role key.
