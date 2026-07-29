# SafeBet IQ — Release Notes, Version 1.2.1

**Developer Experience (DX) & One-Command Demo Environment** · 2026-07-14

A world-class developer experience: clone, run **one command**, and get a fully validated, health-checked, ready-to-demo SafeBet IQ environment. **No feature, platform, pipeline, runtime model, or architecture was added or changed** — this is tooling only, and its health checks *consume* the certified enterprise flow rather than bypass it.

---

## Highlights
- **One command:** `npm run safebet:demo` prepares and starts the entire demo environment; `npm run safebet:check` runs everything except starting the app (CI-friendly). Both are idempotent and safe to re-run.
- **Environment validation (WS1)** — Node/npm versions, `.env.local`, required env vars, project folders, Supabase connectivity. Secrets are shown only as `set (N chars)` — never printed.
- **Dependency management (WS2)** — installs `node_modules` on first run if missing; never silently edits project config.
- **Startup health check (WS3)** — verifies every certified layer is reachable by consuming it: Identity Resolution, Event Platform, Projection Platform, Digital Twin, Domain Intelligence, Policy Platform, Consumer Platform, Connector Framework.
- **Demo-data verification (WS4)** — counts events/projections via the platform's health RPC; never overwrites valid data.
- **Local URL discovery (WS5)** — prints every portal + API endpoint against the actual local base.
- **Startup dashboard (WS6)** — version, operating mode, Node, and per-layer status, gated by **`READY FOR DEMONSTRATION`**.
- **Friendly errors (WS7)** — every failure is explained as What / Why / Fix, with no cryptic stack traces.

## What's new (files)
- `scripts/dev/checks.mjs` — pure, dependency-free helpers (env parse, version compare, redaction, HTTP classification, URL catalogue, dashboard render, readiness gate, diagnostics)
- `scripts/dev/safebet-demo.mjs` — the one-command launcher (orchestrates WS1–WS7, then `next dev`)
- `package.json` — scripts `safebet:demo`, `safebet:check`, and a cross-platform `test`
- `tests/devLauncher.test.mjs` — 9 tests for the launcher helpers
- `docs/LOCAL_DEVELOPMENT_GUIDE.md` — one-command startup section

## Architecture compliance
- **No architecture change:** no new platform, pipeline, runtime model, or business logic. The launcher never bypasses the Event Platform, Identity Resolution, or the Consumer Platform — its health checks call the certified edge endpoints (a `401` means the layer is deployed and enforcing auth = healthy).
- **Secret-safe:** environment values are redacted in all output.
- **Six constitutions intact.**

## Validation evidence
- **Tests:** `node --test "tests/**/*.test.mjs"` → **182 pass, 0 fail** (173 prior — zero regressions — + 9 launcher). `tsc --noEmit` clean (app unchanged).
- **Live `safebet:check`** against the platform printed the startup dashboard with all checks green:
  - Node v24.14.1 ✅ · npm 11.11.0 ✅ · `.env.local` ✅ · Supabase URL/anon ✅ (anon shown as `set (208 chars)`) · dependencies ✅
  - Supabase connectivity ✅ (auth 401) · Identity Resolution / Consumer Platform / Regulator Portal / Connector Framework / Projection Platform / Digital Twin / Event-Intelligence-Policy (in-flow) all **🔒 reachable**
  - Demo data ✅ (168 events / 51 players) · all local URLs printed · **🟢 READY FOR DEMONSTRATION**

## Startup performance
Environment + dependency + connectivity + 8-layer health + demo-data checks complete in well under ~10 s on a warm machine (network-bound to Supabase), then `next dev` serves `http://localhost:3000` in a few seconds.

## Known limitations
- The health check probes the Supabase-hosted edge endpoints; if you run the fully-offline stack (`supabase start`, guide §9), point `.env.local` at the local URL and the same checks apply.
- Demo-data verification uses the well-known demo admin account (public on the login page); override with `SAFEBET_DEMO_ADMIN_EMAIL`/`SAFEBET_DEMO_ADMIN_PASSWORD` if changed. Its absence is non-fatal (reported as a note).

## Upgrade / usage
No migration or deployment required — pull the changes and run `npm run safebet:demo`. Existing `npm run dev`/`build`/`start` continue to work unchanged.
