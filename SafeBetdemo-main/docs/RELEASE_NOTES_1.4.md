# SafeBet IQ — Release Notes, Version 1.4

**Explainable Intelligence & Enterprise Decision Support** · 2026-07-16

Version 1.4 does **not** make SafeBet IQ more intelligent — it makes it more *explainable*. Every explanation originates from the existing certified **Domain Intelligence Platform**, which remains the ONLY intelligence engine. This release adds no engine, no Digital Twin, no runtime model, and no second API: it composes what the certified enterprise flow already produces into human, operational language and shows the operator *why*.

> **The platform recommends. The operator decides.** Interventions are never executed automatically.

---

## Highlights
- **Explainable Intelligence Centre** (WS1) — for any anonymous player, a plain-language explanation of the existing risk assessment: headline, contributing behavioural/session/machine indicators, trigger sequence, and supporting evidence. Read verbatim from `intelligenceOf(object)` — nothing recomputed.
- **Decision Timeline** (WS2) — the full chain rendered end-to-end: **Recorded Fact → Derived Intelligence → Policy Decision → Recommended Intervention → Recorded Outcome**. Stages with no recorded data are omitted, never fabricated.
- **Recommendation Centre** (WS3) — the recommended action *with its reason*, confidence, expected benefit, and historical effectiveness — every recommendation is a Policy Platform decision, carrying the standing note "the platform recommends; the operator decides."
- **AI Performance Centre** (WS4) — an *evaluation* dashboard: risk distribution, interventions recorded, confidence calibration, prediction trend. **No machine-learning training, no recalculation** — it composes the platform's existing outputs.
- **Executive Intelligence** (WS5) — strategic risks, wellbeing indicators, operational performance, and emerging trends composed from certified twin aggregates.
- **Explanation API** (WS6) — delivered as three new **Consumer Platform** views on the *existing* `consumer-gateway` (`explanation`, `ai-performance`, `executive-intelligence`). No new API surface.
- **Operational language** (WS7) — explanations speak in operator terms and carry an explicit evidence class on every value; AI jargon is avoided.

## Architecture-compliance decision
The explainer (`lib/consumerPlatform/explain.ts`) is a **pure composition** of existing platform output. It:
- **never recalculates** risk, behaviour, or policy — it reads `intel.risk / behaviour / session / ai / intervention` and projected recorded facts, then phrases them;
- **creates no competing intelligence** — Domain Intelligence remains the single engine (Constitution: *Intelligence Enriches, Policy Decides, Consumers Present*);
- **classifies every value** as Recorded Fact / Derived Intelligence / Policy Decision (Evidence Integrity Principle, Constitution §8) — absent intelligence yields an empty-but-valid explanation rather than a fabricated one;
- **lives entirely in the Consumer Platform** — the only presentation layer — behind the existing verified-principal authorization and view grants.
This is the same compliant "consume, never duplicate" pattern used by every consumer surface since Phase 3.7.

## What's new (files)
- `lib/consumerPlatform/explain.ts` — pure explainer: `explainPlayer`, `shapeAiPerformance`, `shapeExecutiveIntelligence`
- `lib/consumerPlatform/{contracts,authorization,gateway}.ts` — `explanation` / `ai-performance` / `executive-intelligence` views, grants, and gateway handlers wired into `serve()`
- `supabase/functions/consumer-gateway/index.ts` — `player_id` selector + scoped immutable player-event timeline source
- `app/casino/explainability/page.tsx` — Explainable Intelligence Centre (Why / AI Performance / Executive tabs, Decision Timeline, Recommendation)
- `docs/API_REFERENCE.md` §6d
- `tests/explainability.test.mjs` (10 tests)

## Validation evidence
- **Tests:** `node --test "tests/**/*.test.mjs"` → **204 pass, 0 fail** (194 prior — zero regressions — + 10 explainability: reads from existing intelligence without recompute, derived/recorded classification, 5-stage timeline trace, recommendation explains WHY + "operator decides", absent-intelligence → empty-but-valid, pure/deterministic, evaluation-only AI performance, executive composition). `tsc --noEmit` clean; `next build` succeeds (`/casino/explainability` compiled).
- **Live end-to-end** (demo casino `a1b2c3d4-…0001`, real player `SB-PLR-A1C9A441…`, verified operator JWT):
  - `explanation` → `source:"domain-intelligence"`, dynamicRiskScore 59 / "watch" (traced from intelligence, not recomputed), derived-classified indicators, timeline stages, recommendation with reason + operator-decides note.
  - `ai-performance` → risk distribution over 51 players (3 monitored), confidence calibration, "no model training; no recalculation".
  - `executive-intelligence` → strategic risks + wellbeing indicators + emerging trends from aggregates.
  - Access control: anon → **401**; grants enforced per profile.

## Performance
All three views are pure composition over the already-materialized twin/intelligence plus, for `explanation`, one scoped player-event read (≤500 rows). No per-request recomputation of any enterprise value.

## Remaining limitations
- Recorded-outcome timeline stages appear only where an intervention outcome is actually recorded — honest gaps are shown as gaps.
- `ai-performance` reports evaluation metrics over currently-projected state; longitudinal accuracy history is a future data-warehouse concern, not runtime.
- Explanations are only ever as rich as the certified intelligence behind them — by design, v1.4 adds phrasing, never inference.
