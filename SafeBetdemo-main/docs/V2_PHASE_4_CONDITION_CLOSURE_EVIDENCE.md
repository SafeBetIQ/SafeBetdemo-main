# Phase 4 — Condition Closure Evidence (as of Milestone 4.1)

**2026-07-16 · ADR-006 (frozen).** Honest closure status per certification condition. Closure criteria
are the verbatim "Test of satisfaction" from `V2_CERTIFICATION_RISK_AND_CONDITIONS.md` §4.
**No condition is over-claimed.** Milestone 4.1 addressed C2, C3, C10.

## Closure status matrix
| Condition | Milestone | Status after 4.1 | Evidence |
|---|---|---|---|
| C1 Live Event Platform contribution + reconciliation | 4.3/4.5 | OPEN | not in scope |
| **C2 Durable regulator-plane DB + RLS** | **4.1** | **PARTIALLY CLOSED** | durable store + app-enforced RLS matrix (tested); native RDS/Postgres RLS = binding |
| **C3 Durable append-only audit storage** | **4.1** | **PARTIALLY CLOSED** | durable append-only + SHA-256 chain + tamper detection (tested); DB-permission WORM = binding |
| C4 Pepper + rotation | 4.2 | OPEN | not in scope |
| C5 Live operator connector | 4.4 | OPEN | not in scope |
| C6 Backup/restore | 4.7 | PARTIAL (foundation) | backup + post-restore integrity tested; full drill/RPO-RTO = 4.7 |
| C7 Legal/privacy | 4.7 | OPEN | not in scope |
| C8 Deployed regression | 4.6 | OPEN | not in scope |
| C9 Operational readiness | 4.7 | OPEN | not in scope |
| **C10 Runtime-private internal state** | **4.1** | **CLOSED** | module-closure encapsulation + 7 adversarial runtime tests |

## C2 — PARTIALLY CLOSED
- **Verbatim test:** "Regulator-plane data persisted; RLS negative tests (operator denied) pass against the live store."
- **Done:** durable regulator-plane persistence (`DurableFileBackend`); deny-by-default RLS with a full
  negative matrix (operator / casino-admin / unauthenticated / wrong-jurisdiction / cross-sovereign
  denied) **run against the real store**.
- **Residual (binding):** native Postgres RLS on a managed non-production RDS.
- **Retest to fully close:** RLS negatives against the managed store once provisioned.

## C3 — PARTIALLY CLOSED
- **Verbatim test:** "Audit persisted append-only; update/delete attempts rejected at the store."
- **Done:** durable append-only audit (JSONL) + SHA-256 hash chain; **no** update/delete/replace surface
  on chain/store/backend; modified/reordered/broken-chain tampering detected; chain intact after restart.
- **Residual (binding):** database-permission WORM immutability (no UPDATE/DELETE grant + immutable
  storage). Application design + cryptographic chain enforce append-only in 4.1; DB-permission
  immutability is not claimed.
- **Retest to fully close:** store-level mutation rejection on the managed store.

## C10 — CLOSED
- **Verbatim test:** "Internal registry state unreachable at runtime; adversarial injection attempt fails."
- **Done:** runtime-private state (non-exported module WeakMap + non-exported module functions); no
  global TS-target change; 7 adversarial runtime tests pass (state unreachable, mutation methods absent,
  immutable returns, no arbitrary insert, no counter reset, immutable audit, no validation bypass);
  375/375 regression.
- **Residual:** none at the current build target. **Status: CLOSED.**

## C6 — foundation only (full closure at 4.7)
Backup (`backupTo`) + post-restore integrity verification are implemented and tested. The full
operational restore drill with RPO/RTO and scheduled backups maps to Phase 4.7.

## Overall
Milestone 4.1 does **not** claim controlled-pilot readiness. C10 is CLOSED; C2 and C3 are PARTIALLY
CLOSED with explicit, testable deployment bindings; C6 has a tested foundation. All other conditions
remain OPEN and mapped to their milestones.
