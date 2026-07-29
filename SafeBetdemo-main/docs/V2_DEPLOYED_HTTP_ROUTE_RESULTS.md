# V2 — Deployed HTTP Route Results (Milestone 4.6B)

**Source: real independent Next.js process PID 24452 at `http://127.0.0.1:3123`. Local, non-production, synthetic.**

## 1. Method
Each route fetched over HTTP (`redirect: manual`), recording status, latency, content-type, byte length, and a
leakage scan of the body. Dynamic route probed with sample id `SB-PLR-707371C3`.

## 2. API Routes
| Route | Method | Status | Latency | Contract |
|---|---|---|---|---|
| `/api/health` | GET | **200** | 13 ms | `{status:"ok", service:"safebet-iq", ts:ISO}` — matches baseline |

## 3. Page Routes (43/43 → HTTP 200, 0 × 5xx)
All of the following returned **200** (HTML shell), latencies 21–151 ms, no leakage:

`/`, `/about`, `/login`, `/help`, `/privacy`, `/terms`, `/cookies`, `/contact`, `/technology`,
`/admin`, `/admin/access-control`, `/admin/audit`, `/admin/compliance-overview`, `/admin/customer-success`,
`/admin/security`, `/admin/user-roles`,
`/casino/api-centre`, `/casino/cases`, `/casino/compliance-workflow`, `/casino/dashboard`,
`/casino/explainability`, `/casino/integration`, `/casino/integration/onboarding`, `/casino/live-feed`,
`/casino/notifications`, `/casino/onboarding`, `/casino/operations`, `/casino/players`,
`/casino/players/SB-PLR-707371C3/investigate`, `/casino/reports`,
`/features/behavioral-risk-intelligence`, `/features/casinos`, `/features/compliance-reporting`,
`/features/cross-operator-intelligence`, `/features/regulator-intelligence`, `/features/regulators`,
`/features/responsible-gambling-interventions`, `/features/self-exclusion-network`,
`/regulator/cases`, `/regulator/dashboard`, `/regulator/intelligence`,
`/regulator/intelligence/investigation`, `/regulator/reports`.

Status distribution: **`{ "200": 43 }`**.

## 4. Negative Routes (federation surface must not exist)
| Route | Status |
|---|---|
| `/api/federation` | **404** |
| `/api/sb-nat` | **404** |
| `/federation` | **404** |
| `/regulator/federation` | **404** |
| `/api/national-policy` | **404** |

→ No federation HTTP surface is exposed by the deployed app.

## 5. Honest Caveat
The role-gated routes (`/admin/*`, `/casino/*`, `/regulator/*`) are statically-rendered (`○`) shells that
enforce role/session **client-side**; a 200 proves the shell serves, **not** server-side authorisation. Deployed
server-side auth negatives were therefore not satisfiable against this build — see main report §15/§17.
