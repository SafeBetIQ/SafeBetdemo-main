# SafeBet IQ Demo — Data Retention & Archival Policy

**Scope:** Demo environment only — Supabase `uexdjngogzunjxkpxwll`, `demo.safebetiq.com`,
Elastic Beanstalk `safebet-iq-demo`. **Not** a production policy and **not** a
regulatory retention statement. These are *Demo governance choices* selected to keep
the live simulator running safely without uncontrolled growth. Values marked
*(configured)* are internal governance settings, not measured billing limits.

## Retention classes

| Data class | Store | Policy | Automated deletion in this milestone? |
|---|---|---|---|
| **Event-log evidence** | `casino_event_log` (monthly partitions) | Append-only. Retained for the approved Demo evidence period. **Never** deleted or re-hashed during normal simulator operation. | **No.** Any archival/drop of a partition requires a separate, owner-approved migration. |
| **Audit-chain records** | `audit_events` (per-tenant SHA-256 chain) | Append-only, integrity-verified. Historical hashes must remain unchanged. | **No.** Never deleted or rewritten. |
| **Showcase-window metadata** | `sbiq_demo_showcase_windows` | Administrative only. Expired/superseded rows purged after **90 days** *(configured)* by `sbiq_demo_showcase_maintenance()`. | Yes — administrative metadata only, ≥ 90 days old. |
| **Showcase activation log** | `sbiq_demo_showcase_activations` | Accepted + rejected decisions. Retained **90 days** *(configured)*. | Yes — ≥ 90 days old. |
| **Simulator run log** | `sbiq_demo_sim_run_log` | Per-tick duration/mode/outcome. Suggested **30 days** high-resolution *(configured; not auto-purged in this milestone — grows ~288 rows/day)*. | No (documented for a future maintenance pass). |
| **Simulator alerts** | `sbiq_demo_sim_alerts` | Retained while open; resolved alerts kept for review. Suggested **90 days** *(configured)*. | No (manual/`resolved` lifecycle). |
| **Health samples (external)** | Local sampler output / screenshots | 5-min samples **30 days**; hourly rollups **12 months** *(configured)*. | Local only — git-ignored, rotated after evidence period. **Never** contains credentials/tokens. |
| **Playwright artifacts** | `deploy/e2e/screenshots` | Local test artifacts, git-ignored. Rotated/deleted after the approved evidence period. Must never include credentials or tokens. | Local only. |

## Storage forecast (selected policy)

Measured baseline (2026-08-03): DB **336 MB**, event-log **206 MB**, audit **632 kB**,
daily growth **~1.2 MB/day** (≈ 34k simulator events/day at ~180 bytes/row), monthly
**~36 MB/month**. Against the *configured* internal allocation of **8,192 MB**, current
usage is **~4.1%**, with a projected runway of **thousands of days** at the baseline rate.
The daily hard-stop (120,000 events) caps the worst case at roughly **~22 MB/day** →
**~650 MB/month**, still a multi-year runway before the configured allocation, at which
point the owner-approved archival migration (drop oldest secure partition after export)
would run. No such deletion happens automatically in this milestone.

## Principles

1. **Evidence is never silently destroyed.** Event-log and audit-chain history are
   append-only; deletion is a separate, explicit, owner-approved migration.
2. **Only administrative metadata is auto-purged**, and only after ≥ 90 days.
3. **Configured vs measured** is always distinguished — internal allocation and percentage
   thresholds are governance settings, not Supabase billing limits.
4. **No secrets** are retained in logs, samples, or screenshots.
