# SafeBet IQ — UI/UX Architecture Compliance & Product Rationalisation Audit

**Independent panel audit** · 2026-07-16 · Applied to the demo build (production untouched)

The audit's finding in one line: **the certified product was buried under a legacy demo estate.** The authenticated app carried ~85 routes, but almost none of the certified Consumer Platform (v1.1–v1.5) appeared in the navigation, while the menu pointed at superseded, duplicated, and synthetic "theatre" surfaces. We removed complexity: **37 route files and ~30 orphaned components deleted, navigation rebuilt around certified capabilities.** The certified enterprise architecture, flow, intelligence, policy, workflow and commercial platforms are **unchanged** — every deletion was a consumer/presentation surface.

Scope decisions taken with the owner: **keep** the public marketing website (separate surface); **remove entirely** the Nova IQ / wellbeing-games player experience (not part of the certified flow); **physically delete** flagged legacy/duplicate/theatre product pages and dead code.

---

## 1. Headline metrics

| | Before | After |
|---|---|---|
| Authenticated product routes | ~85 | 48 (incl. ~15 public marketing, out of scope) |
| Route files deleted | — | **37** |
| Orphaned components deleted | — | **~30** |
| Navigation groups | 8 (legacy-heavy) | 9 (certified-only) |
| Certified v1.1–v1.5 pages in nav | ~0 | **all** |
| Academy | present | **completely removed** |
| Tests (certified flow) | 225 pass | **225 pass (0 regressions)** |
| `next build` | green | **green** |

---

## 2. The core defect

`DashboardLayout` wraps `AppShell`, whose `NAV_GROUPS` was the single source of product navigation. It listed **legacy** surfaces (Training Academy, Nova IQ, SafePlay Connect, Security Command Center, Infrastructure/Performance/Threat Monitoring, Module Management, Staff Management…) and **omitted the entire certified Consumer Platform** built in v1.1–v1.5 — Case Management, Compliance Workflow, Executive Operations, Notifications, Explainable Intelligence, Integration Health, Onboarding, Customer Success, Regulator Intelligence, Investigations. Those pages were reachable only by typing the URL. The product a paying operator would see was the *old* product; the certified one was invisible. This inversion is what the audit corrects.

---

## 3. Page & route audit (classification)

### KEEP — certified product (Consumer Platform surfaces)
`admin` (Platform Overview) · `casino/dashboard` · `casino/live-feed` · `casino/players` (+`/[id]/investigate`) · `behavioral-risk-intelligence` (Session Analytics) · `casino/ai-intelligence` · `casino/explainability` (v1.4) · `casino/interventions` · `casino/cases` (v1.5) · `casino/compliance-workflow` (v1.5) · `casino/operations` (v1.5) · `casino/notifications` (v1.5) · `casino/reports` · `casino/api-centre` · `casino/integration` (+`/onboarding`) (v1.1) · `casino/onboarding` (v1.3) · `regulator/dashboard` · `regulator/provincial-dashboard` · `regulator/intelligence` (+`/investigation`) (v1.2) · `regulator/cases` (v1.5) · `regulator/reports` · `admin/customer-success` (v1.3) · `admin/compliance` · `admin/compliance-overview` · `admin/audit` · `admin/security` (audit log) · `admin/access-control` · `admin/user-roles`.

### KEEP — public marketing site (out of product scope, owner decision)
`/` · `about` · `technology` · `contact` · `terms` · `privacy` · `cookies` · `features/*` (8) · `login`. Left intact; only dead links *out* of it (to deleted product/demo pages) were pruned so it stays coherent.

### REMOVE — Academy (mandated, non-architectural)
`staff/academy` · `staff/academy/course/[id]` · `staff/profile` · `casino/training` · `casino/training-settings` · `casino/staff` · `admin/course-management`. Plus the `staff` role's home. **Justification:** the Academy is no part of the Enterprise/Consumer/Commercial/Workflow architecture; it adds training, support, and confusion cost with zero certified value.

### REMOVE — Nova IQ / wellbeing player experience (owner decision: remove entirely)
`nova-iq` (+`/play/[token]`) · `nova-iq-xai` · `casino/nova-iq-intelligence` · `wellbeing-game` (+`/play`, `/play/[token]`) · `admin/wellbeing-games` · `casino/wellbeing-games` · `regulator/wellbeing-compliance`. **Justification:** an interactive player-game surface outside the certified event→intelligence→policy→consumer flow; `nova-iq-xai` and `casino/nova-iq-intelligence` were near-identical duplicates.

### REMOVE — duplicate / superseded integration surfaces
`safeplay-connect` (+ `api-docs`, `cto-brief`, `integration-demo`, `overview`, `postman-samples`, `readme`) · `casino/safeplay-connect` · `casino/integrations` · `admin/integrations` · `health`. **Justification:** superseded by the certified **Integration Health** (v1.1 connector framework); `safeplay-connect` was a developer-marketing/demo portal; `health` a dev diagnostic.

### REMOVE — security / infrastructure "theatre"
`security-command-center` · `admin/security-centre` · `admin/threat-monitoring` · `admin/infrastructure` · `admin/performance` · `admin/data-governance` · `admin/privacy` · `admin/casino-modules`. **Justification:** these query Supabase directly (bypassing the Consumer Platform — a Constitution 5 concern) and present largely synthetic dashboards. Genuine operations live in the `platform-ops` edge function + `OPERATIONS_MANUAL`, not a synthetic UI. Real security audit is retained via `admin/security` + `admin/audit`.

---

## 4. Navigation rationalisation (the new structure)

One sidebar, role-filtered, every item a live certified route with a clear job-to-be-done:

| Group | Items (role-gated) |
|---|---|
| **Overview** | Platform Overview · Operator Dashboard · National Intelligence · Provincial Intelligence |
| **Live Intelligence** | Live Casino Feed · Player Risk Monitor · Session Analytics · AI Intelligence · Explainable Intelligence |
| **Cases & Workflow** | Case Management · Intervention Engine · Compliance Workflow · Executive Operations · Notifications |
| **Regulator** | Regulator Intelligence · Investigations · Regulatory Reports |
| **Compliance & Reporting** | Reporting Centre · Compliance Overview · Compliance Controls · Audit Centre |
| **Integration** | Integration Health · API Centre |
| **Commercial** | Customer Success · Onboarding |
| **Administration** | User Management · Access Control · Security Audit Log |
| **Help & Support** | Help Centre |

Removed menu items (dead or duplicate): Nova IQ Intelligence, Player Assessments, SafePlay Connect, Casino Integrations, Staff Management, Training Academy, My Training, My Profile, Security Centre, Security Command Center, Module Management, Data Governance, Infrastructure, Performance, Threat Monitoring, Self-Exclusion Network (→ deleted page), High-Risk Analytics (duplicate of National Intelligence), Cross-Operator Intelligence (→ deleted page; the capability remains a tab inside Platform Overview).

---

## 5. Role audit (what each role sees now)

- **Casino Operator (`casino_admin`)** — Operator Dashboard, Live Intelligence, Cases & Workflow, Reporting, Integration, Onboarding. No security-theatre or training noise.
- **Compliance Officer** — Operator Dashboard, Player/Session risk, Explainable Intelligence, Case Management, Compliance Workflow, Notifications, Reporting, Audit Centre.
- **Regulator (national/provincial)** — their Overview, Regulator Intelligence, Investigations, Regulatory Reports, Compliance Overview, Audit Centre.
- **Executive** — folded into `casino_admin`/`super_admin` operational views (Executive Operations); no separate legacy dashboards.
- **Customer Success / Administrator (`super_admin`)** — Platform Overview, Customer Success, User Management, Access Control, Security Audit Log, plus cross-cutting intelligence.
- **`staff`** — retired: its only surfaces were the deleted Academy; guards now route it to `/login`.

---

## 6. Verification

- ✓ **`next build` green** after a clean `.next` rebuild — no broken routes, no missing modules.
- ✓ **No dead navigation** — repository-wide sweep for links/`router.push` to any deleted route returns empty; `AppShell`, guards (`CasinoAdminGuard`, `ModuleGuard`), marketing `MainNavigation`/`Footer`, `login`, `help`, `admin/user-roles` all scrubbed.
- ✓ **No orphan components** — every deleted component's importers were inside the deletion set; remaining orphans (`EmployeeTrainingTracker`, `NovaIQResultsCard`, `PlayerWellbeingGamesAccess`, `WellbeingGamesDashboardWidget`, `components/security/*`, `components/wellbeing-games/*`) deleted.
- ✓ **Academy completely removed** — no `*academy*` / `*training*` route or component files remain (marketing feature pages excepted, which are unrelated).
- ✓ **No duplicate dashboards** — Nova IQ XAI/intelligence duplication removed; each remaining dashboard has one audience.
- ✓ **Certified architecture unchanged** — `node --test` → **225/225 pass, 0 regressions**. No file under `lib/eventPlatform`, `projectionPlatform`, `digitalTwin`, `domainIntelligence`, `policyPlatform`, `consumerPlatform`, `workflow`, `commercial`, or any edge function or migration was touched. All Six Constitutions remain satisfied — deletions were presentation-only.

---

## 7. Residual recommendations (not actioned — for a later pass)
- The public marketing site still markets "Nova IQ" and "SafeBet IQ Connect" conceptually in `/technology` and `/features/*` copy; if those products are retired commercially, refresh that copy (content-only).
- `casino/dashboard` still issues a `wellbeing_assessments` read for a headline metric; harmless (table intact) but can be removed when that metric is retired.
- Consider consolidating `admin/compliance` and `admin/compliance-overview` into a single Compliance workspace in a future iteration.
