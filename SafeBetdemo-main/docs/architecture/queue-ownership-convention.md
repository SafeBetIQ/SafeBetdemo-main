# Queue Ownership Convention (ARCH-V4-A3)

Formalises durable-queue ownership conventions established by A2 (the first worker path).
**Documentation/convention only — no Guardian or Regulator Suite queues/workers are created.**

## Naming
`<product>-<domain>[-<qualifier>]` and a matching `…-dlq`:
- `safebet-iq-*` — SafeBet IQ (e.g. existing `safebet-iq-financial-rollup`, `…-dlq`)
- `guardian-*` — SafeBet Guardian (reserved; none yet)
- `regulator-suite-*` — SafeBet Regulator Suite (reserved; none yet)
- `shared-*` — Shared Platform Foundation workers (e.g. future `shared-audit`, `shared-evidence`)

A queue is owned by exactly one product/foundation; cross-product traffic on one queue is prohibited.

## Per-queue standard
Each durable-worker path SHALL define: a **main queue** + **DLQ** (redrive, bounded
`maxReceiveCount`); a dedicated worker with **least-privilege IAM** (consume its queue + only the
data/secret it needs); **bounded concurrency**; **visibility timeout ≥ worker timeout**;
**idempotent** business effect; **correlation IDs**; and observability — queue depth, oldest-message
age, in-flight, DLQ depth, worker success/failure/duration; **alarms** on DLQ-not-empty and worker
failures. Reference implementation: `safebet-iq-financial-rollup` (ADR-0001, runbook
`docs/runbooks/financial-rollup-worker.md`).

## IAM
One execution role per worker, scoped to: its queue (`ReceiveMessage`/`DeleteMessage`/
`GetQueueAttributes`), its logs, namespaced metrics, and only the specific secrets/RPCs it uses.
Scheduler roles get `sqs:SendMessage` on the target queue only. No broad admin; no new anon/public
execution; no new unsafe SECURITY DEFINER.

## Tenancy
Where a message concerns a tenant/jurisdiction, carry the tenant/casino/jurisdiction id in the
message body/attributes so workers stay tenant-aware and auditable.
