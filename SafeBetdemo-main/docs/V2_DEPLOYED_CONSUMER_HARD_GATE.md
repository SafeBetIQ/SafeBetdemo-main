# V2 — Deployed Consumer Platform Hard Gate (Milestone 4.6B)

**Result: PASS WITH CONDITIONS.** Deployed HTTP tests actually ran against a real independent process; no
regression found. Conditions are limited and testable.

## 1. Evidence That Ran
| Check | Result |
|---|---|
| Independent process deployed & reachable over HTTP | ✓ (PID 24452, Ready in 496ms) |
| `/api/health` over HTTP | ✓ 200 |
| Page routes served | ✓ **43/43 → 200**, 0 × 5xx |
| Federation/PII/secret leakage in responses | ✓ **0 hits** |
| Federation HTTP surface | ✓ **none** (5 probe routes → 404) |
| Built with V2 present | ✓ `next build` exit 0 |
| Library regression | ✓ 428/428 |
| `tsc` | ✓ clean |
| Import boundary | ✓ 0 app imports of federation |

## 2. Why PASS WITH CONDITIONS (not unconditional PASS)
Per the brief, a deployed PASS WITH CONDITIONS is permitted only where deployed tests actually ran, no
regression was found, and conditions are limited and testable — all true here. It is **not** an unconditional
deployed pass because:
- **Condition A — managed cloud deployment:** the run was a **local** independent process, not a managed
  non-production cloud deployment (no valid AWS session). 
- **Condition B — deployed server-side isolation:** the app gates client-side, so server-side operator/
  regulator/tenant/jurisdiction negatives were not provable at the HTTP layer.

## 3. Why Not FAIL
No regression was detected: every route served, no 5xx, no leakage, no federation exposure, and V2 is imported
by no operator code. The gaps are **missing** deployed evidence, not broken behaviour.

## 4. Retest to Reach Unconditional Deployed PASS
1. Provision an authorised managed non-production environment (valid AWS session + approved EB/RDS/Secrets
   Manager); deploy V2 (federation OFF).
2. Run the Consumer Platform regression + route/contract smoke **with authenticated sessions** against the
   managed deployment, including server-side operator/regulator isolation negatives.
3. Confirm zero regression and zero federation exposure → promote to unconditional deployed PASS and close C8.
