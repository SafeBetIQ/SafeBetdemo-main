# SafeBet IQ — Release Notes, Version 1.5.2

**Commercial Pilot Polish Release** · 2026-07-16 · Presentation polish only — the Commercial Pilot Baseline

Version 1.5.2 is the final refinement before the Commercial Pilot Baseline is frozen. It contains **no** feature, workflow, business-logic, architecture, Consumer Platform, API, Edge Function, or schema change — only presentation quality, consistency, and maintainability improvements landed from the UXE-1 backlog.

---

## 1. Commercial Pilot Polish Report (summary)
Following the UDC-1 (data completeness) and UXE-1 (UX certification) audits, this release closes the same-day polish backlog: page-gutter standardisation, page-title harmonisation, and dead-code removal. The product now reads as one cohesive premium enterprise SaaS surface across every authenticated page. Build clean; **225/225 tests pass** with zero regressions.

## 2. Visual Improvements Register
| # | Improvement | Evidence | Severity |
|---|---|---|---|
| V-1 | **Uniform page gutter** — 14 pages that rendered flush to the sidebar standardised to the `p-6` gutter (matching the rest of the product) | cases, explainability, operations, notifications, compliance-workflow, integration, live-feed, onboarding, integration/onboarding, regulator/cases, regulator/intelligence, regulator/intelligence/investigation, admin/customer-success | High (fixed) |
| V-2 | **Uniform page-title size** — 5 console-style `text-xl` titles raised to the product-standard `text-2xl` | admin, admin/audit, live-feed, api-centre, help | Medium (fixed) |
| V-3 | Two intentional layout patterns preserved (standard-gutter vs full-console) | admin & api-centre remain edge-to-edge by design | — |

## 3. UX Improvements Register
| # | Improvement | Status |
|---|---|---|
| UX-1 | Consistent header hierarchy (title `text-2xl font-bold` + `text-muted-foreground` subtitle + right-aligned Refresh) across standard pages | Done |
| UX-2 | Professional empty states retained/verified (Compliance Workflow seeded in UDC-1; interactive "Why"/investigation prompts) | Done |
| UX-3 | Fabricated content removed in UDC-1 (admin trend chart, zero KPIs, fake telemetry) — no placeholder remains | Done (prior) |
| UX-4 | Skeleton loaders — deferred (spinner + "Loading…" retained; non-blocking) | Deferred |

## 4. Performance Improvements Register
No behavioural change was permitted, so no data-fetch logic was altered. Reviewed: pages fetch once on mount via `useCallback`/`useEffect`; the live floor polls on its intentional 10 s cadence (CasinoDataContext); no duplicate requests or redundant state updates were introduced by the polish. **Net performance delta: neutral by design.** (Server-side table pagination for very large datasets remains a future contract-level enhancement — not attempted here as it is out of "presentation-only" scope.)

## 5. Code Cleanup Report
- Removed unused imports: `LineChart`, `Line` (recharts) and `Cpu, Wifi, Database, XCircle, MinusCircle, ArrowDown, Clock, CheckCircle` (lucide) from `app/admin/page.tsx` — orphaned when the fabricated telemetry/trend content was removed in UDC-1.
- Removed unused `ExternalLink` import from `components/Footer.tsx`.
- Removed dead `trendData` state + `setTrendData([])` call from `app/admin/page.tsx`.
- Verified `User` in `AppShell` is still in use (avatar/menu) — retained (corrects a UXE-1 assumption).
- No component, constant, style, or behaviour changed.

## 6. Accessibility Review
- Focus states & keyboard nav: inherited from Radix primitives (shadcn) across dialogs, sheets, tabs, selects, tables — unchanged and functional.
- Colour independence: risk is encoded with **text + badge**, never colour alone (e.g. `high 17`, tier labels), so colour-blind users retain full information.
- Icon accessibility: icons are paired with text labels throughout; decorative icons are non-interactive.
- Contrast & font sizes: title `text-2xl`, body `text-sm`, KPIs `text-3xl` with `tabular-nums`; muted text meets standard contrast on the card surface.
- Status: meets enterprise expectations for a pilot; a formal WCAG 2.1 AA audit is recommended pre-production (non-blocking).

## 7. Commercial Pilot Baseline Checklist
| Item | Status |
|---|---|
| Enterprise Architecture certified (Six Constitutions) | ✅ |
| Consumer Platform is the only presentation source (zero UI legacy reads) | ✅ (v1.5.1) |
| Commercial Pilot Readiness (CPR-1) — security, tenant isolation, data reconciliation | ✅ READY |
| UI data completeness — no empty/fabricated content | ✅ (UDC-1) |
| Enterprise UX certified — consistency, storytelling, navigation | ✅ (UXE-1) |
| Visual polish — uniform gutters + titles | ✅ (this release) |
| Dead UI code removed | ✅ (this release) |
| `next build` clean | ✅ |
| Full test suite green | ✅ 225/225 |
| Every customer-facing page demo-ready | ✅ |
| Production untouched; demo project only | ✅ |

## 8. Git Tag Recommendation
Freeze this baseline as the pilot reference. Recommended (owner-executed — not run automatically):
```bash
# from branch Demo, after reviewing the working tree
git add -A
git commit -m "v1.5.2 — Commercial Pilot Baseline (presentation polish)"
git tag -a v1.5.2-commercial-pilot -m "SafeBet IQ Commercial Pilot Baseline — architecture, convergence, CPR-1, UDC-1, UXE-1 certified"
# future feature work branches from this tag:
#   git checkout -b feature/<name> v1.5.2-commercial-pilot
```

## 9. Final Certification (objective)
The 1.5.2 changes are confined to `.tsx` files under `app/` and `components/` (page gutters, 5 titles, unused-import/dead-state removal). Verified unchanged by this release:
- **Functionality / workflows / business rules** — no logic edited; 225/225 tests pass (same suite, same assertions).
- **Enterprise Architecture** — no `lib/` platform module touched.
- **Consumer Platform contracts** — `lib/consumerPlatform/*` unchanged; no view/shape altered.
- **Edge Functions** — no file under `supabase/functions/` touched.
- **Database schema** — no migration added or altered.
- **Security model** — no auth/guard/RLS logic changed.

Only presentation quality, consistency, and maintainability improved. **The Commercial Pilot Baseline is ready to be frozen.**
