# V2 — Deployed Restart & Rollback (Milestone 4.6B)

**Local independent-process runtime. Managed-runtime restart and deployment rollback: NOT achieved.**

## 1. Process Lifecycle Exercised (genuine)
A real OS process lifecycle was driven: **spawn** (`next start`, PID 24452) → **readiness** over HTTP
(`/api/health` 200, "Ready in 496ms") → **serve** 44 HTTP requests → **terminate** (SIGTERM, then SIGKILL).
This proves the application process starts, serves, and stops independently of the test runner.

### 1a. Actual two-cycle restart & recovery (deliverable #29)
An explicit stop→restart cycle was executed on the deployed Consumer Platform process:

| Cycle | PID | Ready | `/api/health` | Probes (`/`, `/login`, `/casino/dashboard`, `/regulator/dashboard`) |
|---|---|---|---|---|
| 1 | **1396** | `Ready in 668ms` | 200 `{status:ok, service:safebet-iq}` | all 200 |
| — | — | SIGTERM → SIGKILL | — | process terminated |
| 2 | **19736** | `Ready in 415ms` | 200 `{status:ok, service:safebet-iq}` | all 200 |

- **Distinct PIDs** (1396 ≠ 19736) → a genuine new process, not a reused/in-memory object.
- **Both cycles recovered** → the application restarts and serves HTTP after a hard kill.
- **Scope (honest):** this is **application-process** restart recovery for the Consumer Platform layer. It is
  **not** managed-runtime (EB instance recycle) restart, and it does **not** exercise federation-state restart
  (registry reconstruction, connector checkpoint) — those have no HTTP surface and were validated in-process in
  4.6A. Managed-runtime restart remains a residual.

## 2. Managed-Runtime Restart — NOT Achieved
A managed environment restart (instance recycle / EB rolling restart) was not possible (no managed runtime).
Federation-state restart recovery (registry reconstruction from durable persistence, connector checkpoint
survival) has **no HTTP surface** and was validated **in-process** in 4.6A — it is not restated as deployed
evidence.

## 3. Deployment Rollback — NOT Achieved
A managed deployment rollback (record current version → deploy test version → smoke → roll back to prior
approved version → verify health/routes/DB/flags/connector/registry/audit/financial) requires a managed
environment and was **not** executed. 

**Architecture note (not a substitute for the drill):** because V2 is additive and imported by no operator
code, an application rollback would revert only `lib/identityFederation/` behaviour with **no** operator
route/contract/schema to revert — but this remains an **unperformed** deployed drill.

## 4. Production Safety
No production rollback, no production restart, no production environment touched.

## 5. Residual
Managed-runtime restart recovery and a real non-production deployment rollback drill remain OPEN for the
managed-deployment activity (owner-executed, when an authorised environment exists).
