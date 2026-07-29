# SafeBet IQ — Release Notes, Version 1.2

**Enterprise Regulator Intelligence Portal** · 2026-07-14 · Demo project (production owner-executed)

A world-class regulator oversight experience built entirely as a **consumer** of the certified enterprise platform. Regulators monitor, investigate, and audit operators with anonymous, evidence-classified intelligence — no PII, no recalculation, no new platform.

---

## Highlights
- **National Regulator Dashboard** — national risk overview, anonymous active-player counts, risk-tier distribution, compliance summary, operator health, emerging risks, intervention statistics.
- **Cross-Operator Intelligence** (aggregate) — per-operator risk distributions and intervention rates, national distribution.
- **Investigation Workspace** — anonymous player timeline (Recorded Fact) + intelligence (Derived) + policy decisions (Policy Decision) + deterministic replay reference.
- **Evidence Package Builder** — classified, attested, export-ready packages.
- **Regulatory Reporting Suite** — seven report kinds, export-ready, evidence-classified.
- All served through the existing Consumer Platform via a new `regulator-portal` endpoint.

## Architecture-compliance decision (Constitution upheld)
Workstream 2 requested "anonymous player movement *between* operators." SafeBet identity is derived **per casino** with federation **denied by default** (ADR-001) — so the same person has different SB-PLR ids at different operators, and per-individual cross-operator linkage is intentionally impossible (privacy by design). **We did not bypass this.** Cross-Operator Intelligence is delivered at the **aggregate/cohort level**, and the view explicitly reports `per-player linkage: not-available-by-design`. Per-player federation remains a future, separately-governed identity-federation ADR — not implemented here. This preserves Constitution 2 and zero-PII.

## What's new (files)
- `lib/consumerPlatform/regulator.ts` — regulator view shapers (pure composition; evidence-classified)
- `lib/consumerPlatform/gateway.ts` — `serveRegulator()` + `RegulatorSources`; `contracts.ts`/`authorization.ts` — views + grants
- `supabase/functions/regulator-portal/index.ts` — regulator consumer endpoint (jurisdiction from verified JWT)
- `supabase/migrations/20260714140000_v12_regulator_rollups.sql` — `sbiq_regulator_national` / `sbiq_regulator_operators` (compose read models; no recalculation)
- `app/regulator/intelligence/page.tsx` (National Dashboard + Cross-Operator + Operator Compliance), `app/regulator/intelligence/investigation/page.tsx` (Investigation + Evidence Package)
- `docs/REGULATOR_USER_GUIDE.md`; updates to `API_REFERENCE.md` and `REGULATOR_INTEGRATION_GUIDE.md`
- `tests/regulatorPortal.test.mjs` (9 tests)

## Validation (Constitutions)
- **Consumes the platform only:** every value comes from the certified read-model rollups, the enriched twin's intelligence, and the Policy Platform's decisions — via `serveRegulator`. **No calculation in the UI.**
- **No recalculation:** shapers read rollup values; risk tiers/monitoring come from the published catalogue views; decisions are passed through. Pure-composition test asserts identical output for identical input.
- **One runtime reality:** no duplicate state; rollups are read-only compositions.
- **Anonymous / zero PII:** anonymous SB-PLR ids only. **Live-verified:** national view contains 0 raw refs/PII; cross-operator view exposes no player ids.
- **Evidence integrity:** every value classified (Recorded Fact / Derived Intelligence / Policy Decision).
- **Scope:** jurisdiction from the verified JWT; regulators see only their operators.

## Validation evidence
- **Tests:** `node --test tests/*.test.mjs` → **173 pass, 0 fail** (164 prior — zero regressions — + 9 regulator). `tsc` clean; `next build` succeeds (both portal pages compiled).
- **Live (ZA regulator):** national-overview → 6 operators / 51 anonymous active players / risk tiers / 3 monitored (evidence `recorded-fact`); cross-operator → `perPlayerLinkage: not-available-by-design`, no SB-PLR exposure; investigation → 6-event timeline (all Recorded Fact) + intelligence + 4 policy decisions + deterministic replay reference; evidence-package → 4 classified sections + PII-free attestation; report → intervention-statistics with 6 operators.
- **Access control:** operator → `regulator-portal` = **403**; anon = **401**; regulator → operator `live-floor` = **403**.

## Performance
Regulator views are single read-model rollups (one RPC) plus pure shaping; investigation reads one player's event timeline + the enriched twin for one casino. No per-request recomputation of intelligence or policy beyond the certified evaluation.

## Remaining limitations
- Per-individual cross-operator linkage is out of scope by design (see the compliance decision above); it requires a future identity-federation ADR.
- Report export is JSON in the demo UI; PDF/CSV export formats are a UI enhancement (data is export-ready).
- Historical national-trend series over time require a time-bucketed rollup (present view is current-state); a trend rollup is a future enhancement.

## Upgrade / deployment
Apply migration `20260714140000_v12_regulator_rollups.sql`; deploy `regulator-portal` and `consumer-gateway`; deploy the app (adds the regulator portal pages). No breaking changes; the enterprise flow and all six constitutions are unchanged.
