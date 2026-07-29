# SafeBet IQ — Release Notes, Version 1.5.1

**Enterprise UI Convergence & Consumer Platform Compliance** · 2026-07-16 · Product Integrity release

Version 1.5.1 closes the P1 blocker from the Enterprise Product Acceptance Audit: the UI no longer consumes a parallel legacy schema. **The Consumer Platform is now the only presentation source for the entire product.** There is ONE player population, ONE session/risk population, ONE intelligence layer, ONE reporting layer — every screen shows the same truth. No architecture changed; this is pure presentation convergence.

> **Before:** Operator Dashboard read legacy `players` (75) while the certified Consumer Platform served 51 — two truths on adjacent screens.
> **After:** every runtime value flows Identity → Events → Projections → Twin → Domain Intelligence → Policy → **Consumer Platform → UI**. Both certified sources report the same count (live: **151 = 151**).

---

## 1. Enterprise UI Convergence Report (summary)

- **5 legacy pages removed** (represented by certified pages): `casino/ai-intelligence` (dead, 0-row `ai_*`), `behavioral-risk-intelligence` (empty `gaming_sessions`), `casino/interventions` (legacy `intervention-engine` dispatch), `admin/compliance` (parallel controls catalogue), `regulator/provincial-dashboard` (duplicate of national).
- **8 pages repointed** to the certified gateways (rewritten as compact certified consumers): `casino/dashboard`, `casino/players`, `casino/players/[id]/investigate`, `casino/reports`, `regulator/dashboard`, `regulator/reports`, `admin/compliance-overview`, and the admin `CrossOperatorIntelligence` component + admin platform stats.
- **15 legacy components/libs deleted** (orphaned by the repoints): `PlayerHistorySheet`, `ReportViewer`, `CasinoXAIDashboard`, `AIInterventionRecommendation`, `compliance/{SessionBehaviourAnalytics,SelfExclusionCompliance,PlayerRiskMonitor,InterventionAlerts,ComplianceReports}`, `regulator/{NationalGamblingInsights,InterventionStatistics,HighRiskPlayerAnalytics}`, `lib/{aiIntelligenceService,reportGenerator,htmlReportGenerator}`.
- **New:** `lib/consumerClient.ts` — the single browser client for `consumer-gateway` (`cgGet`) and `regulator-portal` (`rpGet`). No parallel API was created.

## 2. Complete Data Source Matrix (after convergence)

| Route | Before | After (certified) | Status |
|---|---|---|---|
| `casino/dashboard` | legacy `players`,`gaming_sessions`,… | consumer-gateway `live-floor` + `summary` | **COMPLIANT** |
| `casino/live-feed` | consumer-gateway (already) | `live-floor` + `activity-feed` (`useCasinoData`) | COMPLIANT |
| `casino/players` | legacy `players` | consumer-gateway `live-floor` | **COMPLIANT** |
| `casino/players/[id]/investigate` | legacy `players`,`wellbeing_assessments` | consumer-gateway `explanation` | **COMPLIANT** |
| `casino/explainability` | consumer-gateway (already) | `explanation`/`ai-performance`/`executive-intelligence` | COMPLIANT |
| `casino/cases` · `compliance-workflow` · `operations` · `notifications` | workflow (already) | `workflow` | COMPLIANT |
| `casino/reports` | legacy `players`,`interventions`,`sessions` | consumer-gateway `summary` + `compliance` | **COMPLIANT** |
| `casino/integration` (+onboarding) · `api-centre` | edge (already) | consumer-gateway `integration` / connectors | COMPLIANT |
| `casino/onboarding` | commerce (already) | `commerce` | COMPLIANT |
| `regulator/dashboard` | legacy `players`,`compliance_snapshots` | regulator-portal `national-overview` | **COMPLIANT** |
| `regulator/intelligence` (+investigation) | regulator-portal (already) | `regulator-portal` | COMPLIANT |
| `regulator/cases` | workflow (already) | `workflow` | COMPLIANT |
| `regulator/reports` | legacy `players`,`self_exclusion_registry` | regulator-portal `national-overview` + `operator-compliance` | **COMPLIANT** |
| `admin` (Platform Overview) | legacy `players`,`cross_operator_alerts` | regulator-portal `national-overview` + `cross-operator`; LiveCasinoFeed via gateway; casinos/users = registry | **COMPLIANT** |
| `admin/customer-success` | commerce (already) | `commerce` | COMPLIANT |
| `admin/compliance-overview` | `compliance_snapshots` | regulator-portal `national-overview` + `operator-compliance` | **COMPLIANT** |
| `admin/user-roles` · `access-control` | users/staff/abac/ip registries | identity/tenant/security registry | ADMIN METADATA¹ |
| `admin/audit` · `admin/security` | `audit_logs`/`audit_events`/`security_events` | audit/security administration store | ADMIN METADATA¹ |
| `login` | auth RPC + `users` | authentication flow | AUTH¹ |

¹ **Documented exception:** the Consumer Platform presents the *enterprise runtime flow* (players, sessions, risk, policy, workflow). Identity/tenant/security **administration** (managing users, roles, IP allow-lists, viewing the security/audit log) is a separate administration plane, not runtime-intelligence presentation, and legitimately reads its own registries — consistent with the Constitution's separation of concerns. **Zero runtime-intelligence tables are read by any UI page.**

## 3. Legacy Removal Report
Removed the parallel reality entirely: the `players`/`gaming_sessions`/`ai_*`/`player_protection_interventions`/`self_exclusion_registry`/`cross_operator_*`/`compliance_snapshots`/`bri_*` schema is no longer read by any product page or by any component a product page imports. (These tables and the `intervention-engine` / `cross-operator-intelligence` / `bri-risk-score` edge functions remain in the database/backend as dead legacy — out of UI scope — and are candidates for a later backend cleanup.)

## 4. Consumer Platform Mapping Matrix
`consumer-gateway`: `live-floor` (dashboard, players, live-feed), `summary` (dashboard, reports), `activity-feed` (live-feed), `compliance` (reports), `explanation`/`ai-performance`/`executive-intelligence` (explainability, investigate), `integration` (integration). `regulator-portal`: `national-overview` (regulator dashboard/reports, admin, compliance-overview), `operator-compliance` (reports, compliance-overview), `cross-operator` (admin), `investigation`/`evidence-package`/`regulatory-report` (regulator intelligence). `workflow`: cases/compliance-workflow/operations/notifications/regulator-cases. `commerce`: onboarding/customer-success. **No new API, no duplicate contract — existing views only.**

## 5. Persona Verification Report
- **Casino Operator** — Dashboard, Player Monitor, Live Feed, Explainability, Reports all show the **same** player count and risk tiers now (all read `live-floor`/`summary`). No contradictions. ✓
- **RG Officer** — Player Monitor → Investigate (certified `explanation`) → Open Case → Workflow → Outcome → Close, all on one certified population. ✓
- **Compliance Officer** — Compliance Overview + Reports (certified) + Compliance Workflow + Audit; consistent figures. ✓
- **Regulator** — National Intelligence, Regulator Intelligence, Investigations, Regulatory Reports all from `regulator-portal`; jurisdiction from the verified JWT; anonymous; identical numbers. ✓
- **Customer Success** — Onboarding + Customer Success (certified `commerce`), unchanged and working. ✓
- **Executive** — Executive Operations + Operator Dashboard now agree. ✓

## 6. Architecture Compliance Report
All Six Constitutions satisfied: **C1** one flow (no second data path in the UI); **C2** one runtime reality (the legacy `players` duplicate is no longer presented — one population); **C3/C4** intelligence/policy consumed, never recomputed; **C5** consumers reach data only through the Consumer Platform / Regulator Portal. Evidence Integrity (§8): the fabricated admin growth-trend was removed rather than faked; every displayed runtime value classifies as Recorded Fact / Derived Intelligence / Policy Decision.

## 7. Final Navigation Map
Overview (Platform Overview · Operator Dashboard · National/Provincial Intelligence) · Live Intelligence (Live Casino Feed · Player Risk Monitor · Explainable Intelligence) · Cases & Workflow (Case Management · Compliance Workflow · Executive Operations · Notifications) · Regulator (Regulator Intelligence · Investigations · Regulatory Reports) · Compliance & Reporting (Reporting Centre · Compliance Overview · Audit Centre) · Integration (Integration Health · API Centre) · Commercial (Customer Success · Onboarding) · Administration (User Management · Access Control · Security Audit Log) · Help. Removed from nav: AI Intelligence, Session Analytics, Intervention Engine, Compliance Controls, Provincial dashboard route.

## 8–9. Tests
`node --test "tests/**/*.test.mjs"` → **225 pass, 0 fail** (no regressions — no `lib` platform, edge function, or migration was modified; `consumerClient.ts` is additive UI code). `next build` → **compiles cleanly** after a fresh `.next` build. Repository sweep for forbidden runtime-table reads in product UI → **empty**.

## 10. Remaining limitations
- `components/SelfExclusionNetwork.tsx` still reads `sen_breach_detections`, but it is imported **only** by the public marketing page `app/features/self-exclusion-network` (out of product scope, owner decision). Not in the authenticated product.
- Legacy tables and the `intervention-engine`/`cross-operator-intelligence`/`bri-risk-score` edge functions remain in the backend as dead code — harmless to the UI, recommended for a later backend-convergence pass.
- Admin secondary KPIs not present in the certified snapshot (pending-intervention/exclusion counts) now read as monitored/0 rather than from legacy tables — honest, but a future certified contract extension could enrich them.

## 11. Result
Re-running the Enterprise Product Acceptance Audit now finds one Enterprise Platform, one Consumer Platform, one Enterprise UI, one source of truth. The 75-vs-51 divergence is eliminated (151 = 151 live across every source). **The P1 blocker is cleared** — subject to the noted backend-cleanup follow-ups, the product presents one coherent enterprise reality.
