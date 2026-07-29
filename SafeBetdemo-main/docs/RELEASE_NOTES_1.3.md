# SafeBet IQ — Release Notes, Version 1.3

**Pilot Customer Readiness & Commercial Enablement** · 2026-07-14

SafeBet IQ becomes commercially deployable: a repeatable onboarding process, a Customer Success command centre, guided pilot deployments, and commercial licensing — **all built as consumers of the certified enterprise platform, with no architectural change.**

---

## Highlights
- **Customer Onboarding Centre** (WS1) — a 10-step guided operator onboarding + first-run welcome, self-service, **no SQL / no database work**. Each step maps to a certified capability.
- **Pilot Deployment Centre** (WS2) — pilot lifecycle, an 8-item checklist, readiness score, go-live recommendation, and rollback readiness.
- **Customer Success Dashboard** (WS3) — every deployment at a glance: licences, onboarding progress, pilots, connector health, platform health, warnings.
- **Commercial Licensing** (WS4) — Trial/Pilot/Standard/Enterprise plans, trial licences, tenant lifecycle, feature entitlements, and expiry warnings — configuration-driven and separate from business logic.
- **Support & Diagnostics** (WS5) — per-operator warnings + connector diagnostics (no sensitive data).
- **Customer Reporting** (WS6) — reports that **compose the certified Consumer Platform views** (summary/compliance/integration) — no duplicate calculation.
- **Commercial Experience** (WS7) — welcome, progress indicators, health badges, readiness score, go-live recommendation.

## Architecture-compliance decision
Commercial concerns (subscriptions, onboarding progress, pilot checklists, entitlements) are **tenant/commercial metadata** — not casino runtime state. They:
- **never re-represent** players/sessions/machines (Constitution 2 — the Digital Twin remains the only runtime model);
- **never alter the enterprise flow** — identity, events, projections, twin, intelligence, and policy behave identically regardless of licence;
- **entitlements gate commercial feature ACCESS at the presentation layer only**, never the certified pipeline;
- **reports recalculate nothing** — they compose existing certified views.
This is the same compliant pattern as `policy_change_log` and `connector_runs`.

## What's new (files)
- `lib/commercial/{licensing,onboarding,customerSuccess,index}.ts` — pure commercial logic (plans, entitlements, trial/expiry, onboarding/pilot progress, Customer Success + report composition)
- `supabase/functions/commerce/index.ts` — Customer Success rollup + tenant management + entitlement (admin/operator-scoped)
- `supabase/migrations/20260714180000_v13_commercial.sql` — `operator_subscriptions`, `operator_onboarding`, `pilot_deployments` (commercial metadata, tenant RLS) + `sbiq_customer_success` rollup + seed
- `app/admin/customer-success/page.tsx` (command centre: Operators/Pilots/Licensing/Support), `app/casino/onboarding/page.tsx` (Onboarding Centre + Welcome)
- `docs/CUSTOMER_SUCCESS_GUIDE.md`, `docs/PILOT_DEPLOYMENT_GUIDE.md`
- `tests/commercial.test.mjs` (12 tests)

## Validation evidence
- **Tests:** `node --test "tests/**/*.test.mjs"` → **194 pass, 0 fail** (182 prior — zero regressions — + 12 commercial: entitlements, trial/expiry, suspended/cancelled, onboarding progress, pilot readiness + go-live gate, Customer Success rollup, report composition). `tsc` clean; `next build` succeeds (both pages compiled).
- **Live customer journey:**
  - Operator `my-status` → Trial plan, active, 30 days, entitlements (casino-portal, connector-framework, customer-reports).
  - Operator self-advances onboarding **0% → 40%** (4 steps, no SQL); pilot checklist item persists.
  - Admin Customer Success rollup → 4 plans, 6 operators, health states, event counts.
  - Access control: operator → `customer-success` **403**; anon → `commerce` **401**.

## Performance
Commercial views are single rollup reads (`sbiq_customer_success`) + pure composition; the operator status is three small metadata reads. No per-request recomputation of any enterprise value.

## Remaining limitations
- Entitlement **enforcement** is surfaced in the commercial UI/dashboards; wiring it into the Consumer Gateway (to hard-block an expired tenant) is an optional future integration kept out of the certified flow deliberately.
- Payment/billing integration is out of scope (licensing is lifecycle metadata only).
- Report export in the demo UI composes JSON; PDF/CSV are a UI enhancement.

## Upgrade / deployment
Apply migration `20260714180000_v13_commercial.sql`; deploy the `commerce` function; deploy the app (adds the two pages). No breaking changes; the enterprise flow and all six constitutions are unchanged.

---

## Final product status
With Version 1.3, SafeBet IQ is ready for its **first commercial pilot** with a casino operator and regulator: a repeatable onboarding process, operational tooling, customer success workflows, and commercial readiness — all on the certified enterprise platform, architecture unchanged.
