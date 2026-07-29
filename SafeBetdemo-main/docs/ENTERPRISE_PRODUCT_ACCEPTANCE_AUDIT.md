# SafeBet IQ — Enterprise Product Acceptance Audit (EPAA)

**Independent Acceptance Board · Final review before commercial pilot · 2026-07-16**
**Scope:** the live demo product (project `uexdjngogzunjxkpxwll`). Production untouched. This is an audit — no code was changed.

---

## 0. Verdict

# ⚠️ READY WITH MAJOR CHANGES — pilot is GATED, not yet approved.

SafeBet IQ has a **genuinely production-grade certified core** (identity → events → projections → twin → domain-intelligence → policy → Consumer Platform) and an excellent v1.1–v1.5 product layer (Explainability, Cases & Workflow, Operations, Integration, Regulator Intelligence, Commercial) that consume it correctly and were **live-verified during this audit**.

But the **pages a casino operator, RG officer, regulator and executive actually land on every day** — Operator Dashboard, Player Risk Monitor, Intervention Engine, AI Intelligence, Session Analytics, National/Provincial Intelligence, Reporting Centre, Compliance Overview — **bypass the Consumer Platform and read a parallel *legacy* database schema that diverges from, and in places is emptier than, the certified truth.** This breaches Constitutions 1, 2 and 5 and the Evidence Integrity Principle. For a regulator-facing acceptance, showing unauditable numbers is disqualifying **as-is**.

The good news: the fix is bounded — the correct data already exists behind the Consumer Platform; these pages must be **repointed or removed**, not rebuilt. No architecture change is required. **The certified enterprise flow and all Six Constitutions remain intact at the platform layer.**

---

## 1. The central finding — two divergent realities (objective evidence)

The product runs on **two parallel data models** for the same casino:

| Fact (demo casino `a1b2c3d4-…0001`) | Certified (Consumer Platform) | Legacy (direct DB reads) |
|---|---|---|
| Player population | **51** (`projection_player_state`, live-floor view) | **75** (`players` table) |
| Active sessions | 51 active players (live-floor) | **0** (`gaming_sessions` empty) |
| AI/Domain Intelligence | `domain-intelligence` engine, live (risk "watch", score 59) | **0 rows** (`ai_learning_metrics`, `ai_intervention_recommendations`) |
| Self-exclusion | — | **0** (`self_exclusion_registry`) |

*Evidence:* SQL row counts (executed live) + `consumer-gateway?view=live-floor` returning `active_players: 51, machines: 81` + `?view=explanation` returning `source: domain-intelligence`. The Operator Dashboard reads `players` (75); the certified Explainability/Cases/Live Feed read the projection (51). **Same casino, two different truths, on adjacent screens.**

**Data-source classification (static evidence):** of the authenticated product pages, **14 consume the Consumer Platform / certified edge functions** (compliant) and **~13 query Supabase tables directly** (bypass). The bypass set is precisely the legacy "front-door" dashboards.

---

## 2. Architecture Compliance Matrix

Legend — **Binding:** CP = Consumer Platform/certified edge · DB = direct database (bypass) · MD = admin metadata (acceptable direct). **✓/✗** = Constitution-compliant.

| Page (nav label) | Binding | Layer consumed | Capability | Persona | Verdict |
|---|---|---|---|---|---|
| `casino/live-feed` (Live Casino Feed) | CP (`useCasinoData`→gateway) | Consumer Platform | Live floor | Operator | ✓ |
| `casino/explainability` (Explainable Intelligence) | CP (`consumer-gateway`) | Consumer / Domain Intel | Explainability | Operator/Compliance | ✓ |
| `casino/cases` (Case Management) | CP (`workflow`) | Workflow | Case mgmt | Operator/RG | ✓ |
| `casino/compliance-workflow` | CP (`workflow`) | Workflow | Compliance tasks | Compliance | ✓ |
| `casino/operations` (Executive Operations) | CP (`workflow`) | Workflow | Ops KPIs | Executive | ✓ |
| `casino/notifications` | CP (`workflow`) | Workflow | Notifications | Operator | ✓ |
| `casino/integration` (+onboarding) | CP (`consumer-gateway` integration) | Consumer Platform | Connector health | Operator | ✓ |
| `casino/onboarding` | CP (`commerce`) | Commercial | Onboarding | Operator/CS | ✓ |
| `admin/customer-success` | CP (`commerce`) | Commercial | Customer success | CS | ✓ |
| `regulator/intelligence` (+investigation) | CP (`regulator-portal`) | Consumer Platform | Regulator intel | Regulator | ✓ |
| `regulator/cases` (Investigations) | CP (`workflow`) | Workflow | Investigations | Regulator | ✓ |
| `admin` → Live Casino Feed tab | CP (`useCasinoData`) | Consumer Platform | Platform overview | Admin | ✓ (partial) |
| **`casino/dashboard` (Operator Dashboard)** | **DB** | legacy `players`,`gaming_sessions`,`compliance_snapshots`,`self_exclusion_registry`,`wellbeing_assessments` | Operator home | Operator | **✗ C1/C2/C5** |
| **`casino/players` (Player Risk Monitor)** | **DB** | legacy `players` | Player risk | Operator/RG | **✗ C2/C5** |
| **`casino/players/[id]/investigate`** | **DB** | legacy `players`,`wellbeing_assessments` | Investigation | RG | **✗ C2/C5** |
| **`casino/interventions` (Intervention Engine)** | **DB + legacy edge** | `intervention_*` + `intervention-engine?action=send` | Interventions | RG/Operator | **✗ C1/C4** |
| **`casino/ai-intelligence` (AI Intelligence)** | **DB (empty)** | `ai_learning_metrics`(0),`ai_*`(0) | AI insight | Operator | **✗ C3 + dead** |
| **`casino/reports` (Reporting Centre)** | **DB** | legacy `players`,`player_protection_interventions` | Reporting | Operator/Compliance | **✗ C5** |
| **`behavioral-risk-intelligence` (Session Analytics)** | **DB** | `gaming_sessions`(0),`bri_signal_history` | Session analytics | Operator/RG | **✗ C5 + empty** |
| **`regulator/dashboard` (National Intelligence)** | **DB** | legacy `players`,`compliance_snapshots` | National intel | Regulator | **✗ C2/C5 (regulator-facing)** |
| **`regulator/provincial-dashboard`** | **DB** | legacy `players`,`gaming_sessions`(0) | Provincial intel | Regulator | **✗ C2/C5** |
| **`regulator/reports`** | **DB** | legacy `players`,`self_exclusion_registry` | Reg reports | Regulator | **✗ C5** |
| **`admin/compliance-overview`** | **DB** | `compliance_snapshots` | Compliance rollup | Admin/Regulator | **✗ C5** |
| **`admin/compliance` (Compliance Controls)** | **DB** | `compliance_frameworks`,`compliance_controls` | Controls catalogue | Admin | **✗ parallel policy model** |
| **`admin` → Cross-Operator Intelligence tab** | **DB** | `cross_operator_alerts`,`cross_operator_signal_log` | Cross-operator | Admin/Regulator | **✗ C5 (certified view exists)** |
| `admin/audit` (Audit Centre) | DB | `audit_logs`,`audit_events` (3rd audit store) | Audit | Compliance/Regulator | ⚠ fragmented |
| `admin/security` (Security Audit Log) | MD | security metadata | Security | Admin | ~ acceptable |
| `admin/user-roles`, `admin/access-control` | MD | user/role registry | Administration | Admin | ~ acceptable |

**Summary: 12 compliant certified surfaces · 13 non-compliant bypass surfaces · 3 acceptable admin-metadata.**

---

## 3. Persona Walkthrough Report

### Persona 1 — Casino Operator
Login → **Operator Dashboard**: shows player/risk cards from legacy `players` (75) and **"0 active sessions"** (empty `gaming_sessions`) — immediately contradicts the Live Casino Feed (51 active). → **Cases**: works end-to-end (certified, real). → **Explainability**: works, `domain-intelligence`, evidence-classified. → **Integration/Reports/Notifications/Onboarding**: Integration & Notifications certified/real; **Reports** legacy. **Verdict:** the operator's *home screen* undermines trust in the first 10 seconds; the certified pages are excellent. **Confusing:** two intervention paths (legacy "Intervention Engine" vs certified "Case Management") in the same menu group.

### Persona 2 — Responsible Gambling Officer
Review High-Risk Players (**Player Risk Monitor** — legacy 75, unverifiable) → Recommendations → **Open Case** (certified, works) → **Intervention Workflow → Record Outcome → Close** (certified v1.5, works, audited) → **Report** (legacy). **Every step is possible**, but the *entry point* (risk list) and the *report* are on the legacy model while the workflow is certified — the officer crosses two data worlds mid-task.

### Persona 3 — Compliance Officer
Compliance Dashboard (**Compliance Overview** — `compliance_snapshots`, legacy) → Outstanding Actions & **Compliance Workflow** (certified, works) → **Policy Decisions** (certified, referenced in cases) → **Reports** (legacy) → **Audit Trail**: *three* audit stores exist (certified `casino_event_log`, certified `workflow_audit`, legacy `audit_logs`/`audit_events` shown in Audit Centre). Compliance is *workable* on the certified side but the dashboards/reports/audit are fragmented.

### Persona 4 — Gaming Regulator (the highest bar)
Login → **National Intelligence dashboard**: legacy `players`/`compliance_snapshots`, **which the regulator cannot audit back to source events** → **Regulator Intelligence** (certified `regulator-portal`: anonymous, evidence-classified, **real** — 51 active players, risk tiers critical 0/high 3/med 16/low 32) → **Investigations** (certified, works) → Evidence Packages / Replay (certified, available). **Would a regulator trust it?** The certified `regulator/intelligence` + `regulator/cases` — **yes**. The legacy `regulator/dashboard`/`provincial-dashboard`/`regulator/reports` — **no**: numbers are unverifiable and diverge from certified (Evidence Integrity breach). **This split is the single biggest blocker.**

### Persona 5 — Customer Success
Onboarding (certified `commerce`, self-service, works — proven advancing 0→40% in prior verification) → Pilot mgmt / Licensing / **Customer Success dashboard** (certified, real rollup). **Onboarding is genuinely achievable without engineering.** ✓ Strongest persona.

### Persona 6 — Executive
**Executive Operations** (certified v1.5 — SLA, completion, bottlenecks, real: 2 open / 1 resolved cases) supports decision-making ✓. But an executive browsing the **Operator Dashboard** sees the divergent legacy numbers. Mixed.

---

## 4. UI Defect Register

### CRITICAL
- **C-1 — Two divergent player populations.** Legacy `players` (75) vs certified projection (51) for the same casino; dashboards show 75, certified shows 51. *Constitution 2 + Evidence Integrity.* Evidence: live SQL + live-floor=51.
- **C-2 — Core dashboards bypass the Consumer Platform.** 13 pages read Supabase directly (Operator Dashboard, Player Risk Monitor, Investigate, Interventions, AI Intelligence, Reports, Session Analytics, National/Provincial dashboards, Regulator Reports, Compliance Overview, Cross-Operator tab). *Constitution 1 + 5.*
- **C-3 — "AI Intelligence" is a dead dashboard.** Reads `ai_learning_metrics`/`ai_intervention_recommendations` = **0 rows**; does not consume the certified Domain Intelligence engine. A headline capability renders empty.
- **C-4 — Legacy Intervention Engine can auto-dispatch.** `casino/interventions` calls `intervention-engine?action=send`, a parallel intervention subsystem that duplicates the Policy Platform and conflicts with the certified rule *"the platform recommends; the operator decides — no auto-execution."*

### HIGH
- **H-1 — "0 active sessions" everywhere.** `gaming_sessions` empty → Operator Dashboard, Session Analytics, provincial dashboard show 0 sessions while 51 players are active. Contradictory/empty.
- **H-2 — Regulator dashboards are unauditable.** National/Provincial Intelligence + Regulator Reports read legacy tables the regulator cannot trace to recorded events. *Evidence Integrity, regulator-facing.*
- **H-3 — Fragmented audit evidence.** Three audit stores: certified `casino_event_log`, certified `workflow_audit`, legacy `audit_logs`/`audit_events` (Audit Centre). No single source of audit truth.
- **H-4 — Duplicate reporting engines.** `casino/reports` + `regulator/reports` (legacy) vs certified `regulator-portal` regulatory-report + Consumer summary. Two report models.

### MEDIUM
- **M-1 — Parallel compliance model.** `admin/compliance` edits a `compliance_controls` catalogue separate from the certified Policy Platform.
- **M-2 — Empty self-exclusion cards** (`self_exclusion_registry` = 0) across dashboards.
- **M-3 — Leftover wellbeing read.** `casino/dashboard` still queries `wellbeing_assessments` (3 rows) after the v1.5 wellbeing removal.
- **M-4 — Two intervention paradigms in one menu group.** "Intervention Engine" (legacy dispatch) sits beside "Case Management" (certified) under Cases & Workflow.

### LOW
- **L-1 — Platform Overview mixes bindings.** Live Casino Feed tab (certified) beside Cross-Operator Intelligence tab (legacy).
- **L-2 — Cosmetic dead code.** Unused imports after the v1.5 nav rationalisation (`User` in `AppShell`, `ExternalLink` in `Footer`).

---

## 5. Missing Data Report

| Surface | State | Recommendation |
|---|---|---|
| AI Intelligence (`casino/ai-intelligence`) | Empty (0 rows) | **REMOVE** — the certified equivalent is Explainable Intelligence (already live). |
| Session Analytics (`behavioral-risk-intelligence`) | `gaming_sessions` = 0 | **REPOINT** to certified session data (twin/projection) or **REMOVE**. |
| Self-exclusion cards (multiple dashboards) | 0 rows | **REPOINT** to certified data or **HIDE** until sourced. |
| Cross-Operator Intelligence (admin tab) | legacy `cross_operator_*` | **REPOINT** to certified `regulator-portal?view=cross-operator` (exists, aggregate-only by design). |
| Operator Dashboard cards | legacy `players`/`sessions` | **REPOINT** to `consumer-gateway?view=live-floor` (already serves the correct 51/81). |
| Player Risk Monitor | legacy `players` | **REPOINT** to `live-floor` players array. |
| Regulator National/Provincial | legacy tables | **REPOINT** to `regulator-portal?view=national-overview` (live, real). |
| Reporting Centre / Regulator Reports | legacy | **MERGE** onto certified report composition. |

**No fabricated random values were found** (no `Math.random`/mock generators in pages) — the integrity problem is *structural* (legacy schema), not synthetic noise. That is fixable by rebinding.

---

## 6. Navigation Rationalisation (final production recommendation)

The v1.5 nav structure is sound; the remaining work is to **eliminate the legacy-bound duplicates** so one capability = one page = one certified source:

- **Overview → Operator Dashboard:** repoint to `live-floor` (or replace with the Live Casino Feed page). Retire the legacy dashboard binding.
- **Live Intelligence:** keep Live Casino Feed, Player Risk Monitor (repointed to `live-floor`), Explainable Intelligence. **Remove "AI Intelligence"** (dead) and **"Session Analytics"** (empty) or repoint to certified data.
- **Cases & Workflow:** keep certified Case Management, Compliance Workflow, Operations, Notifications. **Fold "Intervention Engine" into Case Management** (retire the legacy dispatch engine) to resolve the two-paradigm confusion and C-4.
- **Regulator:** make Regulator Intelligence / Investigations / Regulatory Reports the *only* regulator surfaces; **retire `regulator/dashboard`, `provincial-dashboard`, `regulator/reports`** (or repoint to `regulator-portal`).
- **Compliance & Reporting:** repoint Reporting Centre and Compliance Overview to certified composition; consolidate the three audit stores into the certified `casino_event_log` + `workflow_audit`.

---

## 7. Production Readiness Score (0–10)

| Dimension | Score | Basis |
|---|---|---|
| Architecture compliance | **4** | Certified backbone strong; 13 front-door pages violate C1/C2/C5. |
| UX | **6** | v1.5 nav is coherent; two paradigms + divergent numbers hurt trust. |
| Operations | **6** | Certified Ops/Workflow excellent; legacy ops surfaces fragmented. |
| Compliance | **4** | Parallel compliance model + fragmented audit. |
| Regulator experience | **3** | Certified regulator intel is strong; legacy regulator dashboards unauditable. |
| Casino experience | **4** | Operator *home* is legacy/divergent; certified pages excellent. |
| Executive experience | **6** | Executive Operations solid; exec still exposed to legacy dashboards. |
| Performance | **7** | Pages load; some legacy queries `limit(1000–5000)` — acceptable at demo scale, watch at volume. |
| Workflow | **9** | v1.5 workflow is production-grade, certified, audited. |
| Explainability | **9** | v1.4 explainability excellent, evidence-classified, live. |
| **Overall product** | **5.5** | Excellent certified half; disqualifying front-door defects. |

---

## 8. Final Recommendation

## READY WITH MAJOR CHANGES — commercial pilot is BLOCKED until the P1 gate is cleared.

**Blocking gate (must clear before any pilot):**
1. **C-1/C-2:** Repoint the Operator Dashboard, Player Risk Monitor, and all regulator dashboards to the Consumer Platform (`live-floor` / `regulator-portal`) so every screen shows the single certified truth (51, not 75). Reconcile or retire the legacy `players`/`gaming_sessions` schema.
2. **C-3:** Remove or repoint "AI Intelligence" (dead) — Explainable Intelligence already delivers certified AI insight.
3. **C-4:** Retire the legacy `intervention-engine` dispatch path; interventions flow only through the certified Case/Workflow (human-decided).
4. **H-2:** No regulator-facing screen may present a value the regulator cannot trace to a recorded event.

**Why not "NOT READY":** the certified platform, identity, events, projections, twin, domain-intelligence, policy, Consumer Platform, workflow and commercial layers are proven, live, and Constitution-compliant; the correct data already flows through the gateway. The defects are concentrated in the *presentation binding* of legacy pages and are remediable by repointing/removing — a bounded change, no architecture rework.

**Why not "READY / MINOR":** an operator's home screen and a regulator's dashboard showing 75 vs the certified 51, from unauditable direct DB reads, breach the Evidence Integrity Principle and Constitutions 1/2/5 — unacceptable to put in front of a real regulator.

**Constitutional status:** the platform layer satisfies all Six Constitutions; the violations are at the UI-binding layer of legacy pages and do not alter the certified architecture. Clearing the gate above brings the product to READY FOR COMMERCIAL PILOT.

---

### Evidence appendix (all captured live this audit)
- Player divergence: SQL `players`=75 vs `projection_player_state`=51; `consumer-gateway?view=live-floor` → `active_players:51, machines:81`.
- Dead AI: SQL `ai_learning_metrics`=0, `ai_intervention_recommendations`=0.
- Empty sessions: SQL `gaming_sessions`=0, `self_exclusion_registry`=0.
- Certified layer live: `workflow?action=operations` → 2 open/1 resolved; `regulator-portal?view=national-overview` → 51 active, tiers {c0,h3,m16,l32}; `consumer-gateway?view=explanation` → `source: domain-intelligence`, watch/59.
- Data-source split: 14 pages consume certified edges; 13 pages call `supabase.from/rpc` directly (enumerated in §2).
