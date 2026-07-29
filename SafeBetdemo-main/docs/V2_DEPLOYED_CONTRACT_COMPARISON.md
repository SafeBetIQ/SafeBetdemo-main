# V2 — Deployed Contract Comparison (Milestone 4.6B)

**Deployed responses (real process PID 24452) vs approved baseline. Local, non-production.**

## 1. Comparable Surface
At the HTTP layer only routes that render without a live session were comparable: `/api/health` (JSON) and 43
page shells (HTML). Data-bearing operator/regulator API contracts are populated client-side after auth, so
their deployed JSON payloads were not observable from this build.

## 2. `/api/health` Contract
| Field | Baseline | Deployed | Match |
|---|---|---|---|
| `status` | `"ok"` | `"ok"` | ✓ |
| `service` | `"safebet-iq"` | `"safebet-iq"` | ✓ |
| `ts` | ISO-8601 string | `2026-07-25T19:11:17.453Z` | ✓ |
| HTTP status | 200 | 200 | ✓ |
| content-type | `application/json` | `application/json` | ✓ |

No required-field / type / enum / status change.

## 3. Federation Non-Exposure (verified over HTTP)
No deployed response contained any of:
- SB-NAT identifier (`SB-NAT-<CC>-…`)
- federation decision / matching candidate
- National Player Twin
- national policy outcome
- national financial aggregate
- cross-operator information
- `identityFederation` symbol

(0 leakage hits across all 44 responses; federation routes 404.)

## 4. Limitation
Deployed **data** contract comparison for authenticated operator/regulator APIs was not performed (client-side
data fetching; no server-rendered authenticated JSON in this build). This is a residual for the managed
deployment + a server-driven or authenticated-session harness.
