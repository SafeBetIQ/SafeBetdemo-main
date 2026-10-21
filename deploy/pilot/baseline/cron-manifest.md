# SafeBet IQ — cron manifest (M1A-R2)

Cron jobs are **data** (`cron.job` rows), not part of the application schema baseline, and are
**not** extracted. This manifest records the current IQ Demo jobs and their Pilot classification.
No job is created, enabled, or disabled by M1A-R2.

| Job | Schedule | Active on Demo | Class | Pilot posture |
|---|---|---|---|---|
| `sbiq-demo-live-tick` | `*/5 * * * *` | yes | DEMO-ONLY | **Excluded** — synthetic data generator; must never exist on Pilot |
| `sbiq-demo-tick-watchdog` | `22,52 * * * *` | no | DEMO-ONLY | Excluded |
| `sbiq-demo-partition-readiness` | `30 0 * * *` | yes | INSPECT → likely PLATFORM | Reuse **only** after proving it is partition maintenance that does **not** generate synthetic data |
| `sbiq-audit-verify-full` | `0 2 * * *` | yes | PLATFORM-REQUIRED | Enable after controlled Pilot setup |
| `sbiq-audit-verify-incremental` | `*/15 * * * *` | yes | PLATFORM-REQUIRED | Enable after controlled Pilot setup |
| `sbiq-financial-rollup-refresh` | `*/15 * * * *` | no | DISABLED | Remain disabled unless a later governed decision |
| `sbiq-financial-rollup-watchdog` | `27,57 * * * *` | no | DISABLED | Remain disabled |

**Pilot cron posture:** no demo live-tick, no demo watchdog; audit-verification enabled after
controlled setup; partition-readiness only if proven platform-generic; financial rollup disabled.
