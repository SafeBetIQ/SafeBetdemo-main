# V2 — Phase 4 · C8 Closure Evidence

**Condition C8 — "Deployed Consumer Platform runtime regression."**
**Test of satisfaction: "Deployed app regression suite + route/contract smoke tests pass with V2 present."**
**Status after Milestone 4.6: PARTIALLY CLOSED.**

## 1. Evidence Provided This Milestone
| Evidence | Artefact | Result |
|---|---|---|
| Deployed-runtime composition assembled | `runtime/composition.ts` (`FederationRuntime`) | Built |
| Full federation pipeline through actual boundaries | deployed smoke step | SB-NAT minted |
| Full financial pipeline through actual boundaries | deployed smoke step | GGR 50, balanced |
| Feature-flag governance (off/approved/shutdown/persist) | test + smoke | Pass |
| Health / version (no secrets; disabled≠unhealthy) | test | Pass |
| Restart / recovery (registry reconstruct) | test + smoke | Pass |
| Rollback (emergency shutdown) | smoke | Pass |
| Consumer Platform non-impact (import boundary) | test (0 offenders) | Pass |
| Full library regression | `node --test` | **428/428** |
| Type safety | `tsc --noEmit` | Clean |

## 2. Evidence NOT Provided (why C8 is not fully CLOSED)
The satisfaction test requires a **deployed application regression suite + route/contract smoke tests passing
with V2 present**. None of the following was executed (no authorised deployed target; production must not be
touched):
- Deployment to the approved non-production platform (Elastic Beanstalk / RDS / Secrets Manager / CloudWatch).
- A **deployed** Consumer Platform regression suite run against the running app.
- Deployed route/contract/UI/authentication smoke tests.

Per the milestone brief — "Do not close C8 based solely on local or in-process tests" — C8 is **not** closed.

## 3. Assessment
- **Closed portion:** deployed-runtime **composition** + full-pipeline in-process validation + Consumer
  Platform **architectural** non-impact (import boundary) + full library regression.
- **Open portion:** real **deployed-app** regression + route/contract smoke + managed infra.
- **Verdict: C8 PARTIALLY CLOSED.**

## 4. Retest-to-Close Procedure
1. Deploy V2 to the approved non-production platform (federation OFF).
2. Run the deployed Consumer Platform regression suite + route/contract smoke **with V2 present**.
3. Confirm zero regression and no federation-data exposure in operator contracts.
4. On green, promote C8 → CLOSED.

## 5. Related Conditions (no new deployed evidence this milestone)
- **C1** (live wager/GGR + deployed reconciliation) — pipelines ran in-process → **PARTIALLY CLOSED**.
- **C5** (external/deployed connector) — connector ran in-process → **PARTIALLY CLOSED**.
- **C2 / C3 / C4** (native RLS / DB append-only / managed secret store) — unchanged → **PARTIALLY CLOSED**.
- **C10** (registry encapsulation) — **CLOSED** (module-closure).

---

## Addendum — Milestone 4.6B (Actual Non-Production Deployment · 2026-07-16)

**Status after 4.6B: C8 remains PARTIALLY CLOSED** (advanced, not closed).

### New deployed evidence obtained (genuine, local independent process)
A real Next.js production process (PID 24452, "Ready in 496ms", `http://127.0.0.1:3123`), built fresh with V2
present, was driven over HTTP:
- `/api/health` → **200**; **43/43** page routes → **200**; **0 × 5xx**.
- **0** federation/PII/secret leakage across all 44 responses.
- **0** federation HTTP surface — 5 federation probe routes → **404**.
- Built with V2 present (`next build` exit 0); `tsc` clean; 428 library tests; 0 app imports of federation.
This satisfies, for the first time at the deployed layer: a genuine independent deployed process, deployed
route/contract smoke (for renderable routes), production isolation, and no-regression.

### Still OPEN (why C8 is not closed)
- **Managed cloud deployment** — the only AWS session is invalid (`InvalidClientTokenId`); no approved EB
  environment; deploy is owner-executed; production untouched. Local loopback ≠ managed deployment.
- **Managed infra** — RDS/native-RLS (C2), DB WORM (C3), Secrets Manager/HSM/KMS (C4), CloudWatch — none
  reachable.
- **Deployed server-side auth/operator/regulator isolation** — the app gates client-side; static shells return
  200, so server-side negatives were not provable at HTTP.
- **Deployed federation/connector/financial pipelines** — no HTTP surface by frozen design (correctly not
  exposed); confirmed by the 404s.

### Retest to close
Provision an authorised managed non-production environment (valid AWS session + approved EB/RDS/Secrets
Manager), deploy V2 (federation OFF), and run the Consumer regression + route/contract smoke **with
authenticated sessions** including server-side isolation negatives, restart, and rollback. On green → C8
CLOSED.

**Outcome line:** *Phase 4.6 Remains Partially Complete — Actual Non-Production Deployment Evidence Still
Required.* (See `V2_MILESTONE_4.6B_ACTUAL_DEPLOYMENT_REPORT.md`.)
