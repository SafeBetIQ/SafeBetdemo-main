# SafeBet IQ — Local Development & Demonstration Guide

Run and demonstrate the entire certified Version 1.2 platform on a local machine. **The certified enterprise architecture is unchanged** — this guide only describes how to run it locally.

**Key fact:** "AWS" in this project is the **Elastic Beanstalk application host**. The data/platform tier (PostgreSQL + Edge Functions + Realtime + Auth) is **Supabase-managed and independent of AWS**. So when AWS/EB is suspended, you run the **Next.js app locally** (replacing the EB host) pointed at the existing Supabase project — every layer of the enterprise flow (Identity → Event → Projection → Twin → Intelligence → Policy → Consumer) runs exactly as certified, hosted on Supabase. No AWS dependency blocks local demonstration.

---

## 1. Prerequisites
| Software | Version (verified) | Notes |
|---|---|---|
| Node.js | ≥ 20 (verified on **v24.14.1**) | required |
| npm | ≥ 10 (verified **11.11.0**) | ships with Node |
| Git Bash / PowerShell | any | Windows verified |
| (optional) Supabase CLI | ≥ 2.84 | only for the full-local stack in §9 |
| (optional) Docker Desktop | current | only for the full-local stack in §9 |

Framework: Next.js **13.5.1**, React **18.2.0**.

## 2. Installation
```bash
cd SafeBetdemo-main            # the project root (contains package.json)
npm install                   # installs dependencies into node_modules/
```

## 3. Environment variables (`.env.local`)
A `.env.local` at the project root is already present and configured. Required keys (identify only — never commit or share secret values):
| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL (`https://uexdjngogzunjxkpxwll.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon/publishable key (safe in the browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | server-side only; never expose to the browser |
| `SAFEBET_OPERATING_MODE` | optional | `development` \| `demonstration` (default) \| `staging` \| `production` |
| `SAFEBET_IDENTITY_PROVIDER` | optional | defaults to `sha256-v2` (96-bit) |
| `SAFEPLAY_API_KEY` / `SAFEPLAY_WEBHOOK_SECRET` | optional | only the out-of-flow `safeplay-connect` surface |

> The platform's edge functions have their own secrets set in Supabase (already configured). The local app never needs the service-role key to render dashboards — it authenticates as the signed-in user via the anon key.

## 4. Local database & seed data
The database is the **existing Supabase project** — all migrations, edge functions, and demonstration data are already applied and verified. No local DB step is required for the standard local run.

Verified demo data (sufficient to exercise every platform): 6 casinos, demo users, 168+ immutable events, 51 player projections, 38 machine projections, active policy set v1 (22 rules), connector runs. The casino operator account is bound to a casino that has live activity; the casino dashboard also auto-triggers simulator bursts (~every 10 s) to keep the floor live.

(For a fully offline stack — recreating the DB locally — see §9.)

## 5. Startup commands

### One-command demo (recommended) — v1.2.1
```bash
npm run safebet:demo         # validate → health-check → dashboard → start the app
npm run safebet:check        # everything except starting the app (CI-friendly)
```
`safebet:demo` is **idempotent and safe to re-run**. It:
1. **Validates the environment** — Node ≥ 20, npm ≥ 10, `.env.local`, required env vars (secrets shown only as "set (N chars)", never printed), project folders.
2. **Manages dependencies** — installs `node_modules` on first run if missing (never silently edits config).
3. **Health-checks every certified layer by CONSUMING it** — Supabase connectivity, Identity Resolution, Consumer Platform, Regulator Portal, Connector Framework, Projection Platform, Digital Twin, and the in-flow Event/Intelligence/Policy read path (a reachable Consumer Platform confirms them). `🔒` = deployed and enforcing auth (healthy); `❌` = down.
4. **Verifies demo data** — counts events/projections via the platform's health RPC (never overwrites valid data).
5. **Discovers and prints all local URLs** (portals + API endpoints).
6. **Prints a startup dashboard** and shows **`READY FOR DEMONSTRATION`** only if all required checks pass.
7. **Explains any failure** as What / Why / Fix (no cryptic stack traces), then starts the app.

Startup performance: environment + dependency + connectivity + 8-layer health + demo-data checks complete in well under ~10 s on a warm machine (network-bound), then `next dev` serves in a few seconds.

### Manual (equivalent)
```bash
npm run dev        # start the app at http://localhost:3000  (development)
npm run build && npm run start   # production-style
npm run typecheck  # tsc --noEmit                     (clean)
npm test           # node --test "tests/**/*.test.mjs" (182 tests pass)
```

## 6. Demo login accounts
Open `http://localhost:3000/login` (the login page also lists demo credentials):
| Role | Email | Password |
|---|---|---|
| Casino Operator | `demo.casino@safebetiq.com` | `Casino@Demo1` |
| Regulator (National) | `demo.regulator@safebetiq.com` | `Regulator@Demo1` |
| Administrator | `demo.admin@safebetiq.com` | `Admin@SafeBet1` |

## 7. Local URLs (verified — all returned HTTP 200)
Base: **`http://localhost:3000`**

**Public / auth**
- Home: `http://localhost:3000/`
- Login: `http://localhost:3000/login`

**Casino Portal**
- Dashboard: `http://localhost:3000/casino/dashboard`
- Players: `http://localhost:3000/casino/players`
- Interventions: `http://localhost:3000/casino/interventions`
- AI Intelligence: `http://localhost:3000/casino/ai-intelligence`
- Live Feed: `http://localhost:3000/casino/live-feed`
- API Centre: `http://localhost:3000/casino/api-centre`
- **Integration (Connector Health, v1.1):** `http://localhost:3000/casino/integration`
- **Integration Onboarding Wizard:** `http://localhost:3000/casino/integration/onboarding`

**Regulator Portal**
- Regulator Dashboard: `http://localhost:3000/regulator/dashboard`
- **Regulator Intelligence (National, v1.2):** `http://localhost:3000/regulator/intelligence`
- **Investigation + Evidence (v1.2):** `http://localhost:3000/regulator/intelligence/investigation`
- Reports: `http://localhost:3000/regulator/reports`
- Wellbeing Compliance: `http://localhost:3000/regulator/wellbeing-compliance`

**Administration / Operations**
- Security: `http://localhost:3000/admin/security`
- Audit: `http://localhost:3000/admin/audit`
- Wellbeing Games: `http://localhost:3000/admin/wellbeing-games`
- Behavioural Risk Intelligence: `http://localhost:3000/behavioral-risk-intelligence`

**Enterprise API endpoints (Supabase-hosted; called by the app)**
Base: `https://uexdjngogzunjxkpxwll.supabase.co/functions/v1`
- Consumer Gateway (presentation): `/consumer-gateway?view=<view>&casino_id=<uuid>`
- Regulator Portal: `/regulator-portal?view=<view>`
- Connector ingest (producer): `/connector-ingest` (POST)
- Identity Resolution: `/identity-resolution` (POST)
- Platform Ops (admin): `/platform-ops?action=<action>`
- Projection Platform (ops): `/projection-platform?action=status|rebuild`
- Digital Twin (ops): `/digital-twin?action=snapshot|health|intelligence|decisions`
- Casino Simulator (demo producer): `/casino-simulator?action=burst`

**Health endpoint:** platform health is an authenticated RPC — `sbiq_platform_health(casino_id)` (surfaced via `platform-ops?action=monitor`). There is no unauthenticated `/health` page by design (least privilege).

## 8. Verify every route (result)
All routes below were started locally and returned **HTTP 200** (page shells render; auth guards redirect client-side after login):
`/`, `/login`, `/casino/dashboard`, `/casino/players`, `/casino/interventions`, `/casino/ai-intelligence`, `/casino/api-centre`, `/casino/integration`, `/casino/integration/onboarding`, `/casino/live-feed`, `/regulator/dashboard`, `/regulator/intelligence`, `/regulator/intelligence/investigation`, `/regulator/reports`, `/regulator/wellbeing-compliance`, `/admin/security`, `/admin/audit`, `/admin/wellbeing-games`, `/behavioral-risk-intelligence`, `/about`, `/technology`.
No missing dependencies or missing environment variables were found. Demo login (casino operator) issues a token successfully.

## 9. (Optional) Fully offline stack — no external Supabase
If you must run without any external service:
```bash
supabase start                                   # local Postgres + Auth + Edge (Docker)
supabase db reset                                # applies all migrations in supabase/migrations
supabase functions serve                         # serves edge functions locally
# point .env.local at the local stack:
#   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from `supabase start` output>
npm run dev
```
Then seed demo data (`npm run seed`) and/or trigger `casino-simulator?action=burst` to generate live events. This reproduces the entire enterprise flow locally with zero external hosting. (The standard §1–§7 path is simpler and is the recommended local demo.)

## 10. Connector verification (local)
`connector-ingest` runs on Supabase and is reachable from the local app. The end-to-end flow was verified: a slot-management batch → `CasinoEventDraft` → **Enterprise Event Platform** → Projection Platform → Digital Twin → Domain Intelligence → Policy Platform → Consumer Platform. Evidence: connector events appear in `casino_event_log` (producer `connector:slot-management`) with anonymous 96-bit identity, the raw casino reference never reaches the store, and the run shows in `http://localhost:3000/casino/integration`. Use the **Run test import** button there, or the **Onboarding Wizard**, to exercise it locally.

## 11. Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Port 3000 in use | another dev server | `npm run dev -- -p 3001`, or stop the process on 3000 |
| Pages load but no data | not signed in / expired session | log in at `/login`; JWTs expire ~1h, re-login |
| 401 from an endpoint | anon/tampered/expired token | re-authenticate (this is correct security behaviour) |
| 403 from an endpoint | wrong role/casino for the view | use the matching demo account (operator vs regulator vs admin) |
| Blank casino floor | fresh window before a burst | wait ~10 s (auto-burst) or click a refresh/test action |
| `next` not found | deps not installed | `npm install` |
| Env not picked up | edited `.env.local` while running | restart `npm run dev` |

## 12. Known limitations when AWS is unavailable
- **Application hosting only:** AWS/Elastic Beanstalk hosts the Next.js app in production; locally, `npm run dev`/`npm run start` replaces it. No functional loss.
- **Managed scheduling:** production cron (partition maintenance, monitoring) is an ops-onboarding item; locally, run those actions manually via `platform-ops` (see `OPERATIONS_MANUAL.md`).
- **The data/platform tier is Supabase, not AWS** — it remains available while AWS is suspended, so the certified enterprise flow is fully demonstrable locally. If you also want zero external dependencies, use the fully-offline stack in §9.

## 13. Confirmation — certified enterprise flow unchanged
No application code, migration, edge function, or contract was modified for local execution. The enterprise flow (Identity → Event Platform → Projection Platform → Digital Twin → Domain Intelligence → Policy Platform → Consumer Platform), the six constitutions, and the 173-test suite are all unchanged. Running locally only changes **where the Next.js app is hosted** (your machine instead of Elastic Beanstalk).
