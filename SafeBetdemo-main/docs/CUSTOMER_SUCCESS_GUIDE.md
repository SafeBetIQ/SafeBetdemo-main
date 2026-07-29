# SafeBet IQ — Customer Success Guide (v1.3)

For SafeBet IQ Customer Success Managers onboarding and supporting casino operators. The Customer Success surfaces are **consumers** of the certified platform — they compose commercial metadata (subscriptions, onboarding, pilots) with certified platform health. They own no runtime state and never change the enterprise flow.

Access: sign in with an administrator account → **Customer Success** (`/admin/customer-success`).

---

## 1. Command centre (`/admin/customer-success`)
Four tabs, one view of every deployment:
- **Operators** — connected casinos, plan, onboarding %, activation, and a health badge (`healthy` / `attention` / `unknown`).
- **Pilots** — each operator's pilot status and readiness %.
- **Licensing** — plan, licence status, and days-to-expiry (amber ≤ 7 days).
- **Support** — operators with warnings (trial ending, failed connector events, lag) and their diagnostics.
KPIs across the top: connected casinos, active licences, live/active pilots, operators needing attention.

## 2. Onboarding a new operator (no engineering required)
The operator self-serves through the **Onboarding Centre** (`/casino/onboarding`), a 10-step guided flow — no SQL, no database work:
1. Register operator → 2. Configure jurisdiction → 3. Select connector profile → 4. Configure authentication → 5. Map external systems → 6. Validate mappings → 7. Run connector certification → 8. Test event ingestion → 9. Review diagnostics → 10. Activate production mode.
Each step maps to a certified capability. The operator marks steps complete; the Integration Wizard (`/casino/integration/onboarding`) and Certification checklist (`docs/CASINO_INTEGRATION_CERTIFICATION.md`) support the technical steps. Progress is visible to you in the command centre.

## 3. Commercial licensing (WS4)
Plans (configuration, not behaviour): **Trial** (30-day, 2 connectors), **Pilot** (90-day, 5 connectors, regulator portal), **Standard** (report export), **Enterprise** (unlimited, priority support). Each plan grants **feature entitlements** that gate commercial feature *access* at the presentation layer only — **licensing never changes the enterprise flow**. New operators start on a dated trial. Manage a subscription (admin):
```
POST /commerce?action=set-subscription { casino_id, plan, status, trial_ends_at?, current_period_end? }
```
Licence expiry warnings appear automatically (≤ 7 days) in the command centre and the operator's onboarding centre.

## 4. Pilots (WS2)
Each operator has a pilot checklist (operator onboarded → connector certified → events flowing → dashboards verified → UAT signed off → monitoring enabled → rollback rehearsed → go-live approved). Readiness is the % complete; **go-live is recommended only when every item is done** and the pilot is not rolled back. Manage pilot status (admin): `POST /commerce?action=pilot-status { casino_id, status }` (`planned|in-progress|ready|live|rolled-back`). See `PILOT_DEPLOYMENT_GUIDE.md`.

## 5. Support & diagnostics (WS5)
The Support tab surfaces per-operator warnings and connector diagnostics (runs, failures, projection lag) — composed from `connector_runs` and platform health. For deeper diagnostics use the operator's Integration Health (`/casino/integration`) and the platform monitor (`platform-ops?action=monitor`). No sensitive information is exposed — anonymous SB-PLR ids only.

## 6. Customer reports (WS6)
Customer-facing reports (Responsible Gambling Summary, Compliance Overview, Executive Dashboard, Connector Performance, Intervention Summary, Risk Trends) **compose the certified Consumer Platform views** (`summary`, `compliance`, `integration`) — no recalculation. Every section is evidence-classified.

## 7. What Customer Success guarantees
- **Complete visibility** of every deployment (licences, onboarding, pilots, health) from one page.
- **No duplicate state** — commercial tables hold only commercial metadata; casino runtime lives solely in the Digital Twin.
- **Least privilege** — Customer Success actions require an administrator JWT (operators manage only their own onboarding; verified: operator → `403` on the rollup, anon → `401`).
- **Anonymous** — no player PII anywhere.

## Endpoints (admin/service-role unless noted)
`GET /commerce?action=customer-success` · `GET /commerce?action=my-status&casino_id=…` (operator, own) · `POST /commerce?action=onboarding-step|pilot-item` (operator, own) · `POST /commerce?action=set-subscription|pilot-status` (admin).

---

## Workflow & Case Management (v1.5)

Operators now operationalise SafeBet IQ recommendations through Case Management (`/casino/cases`), Compliance Workflow (`/casino/compliance-workflow`), Executive Operations (`/casino/operations`) and the Notification Centre (`/casino/notifications`).

Guide a pilot operator to:
- **Open a case from a recommendation** — Case Management → *New case*, link the anonymous player (SB-PLR id) so the case references the certified risk assessment, then run the intervention workflow (review → accept/reject → action → outcome → resolve → close). No intervention is executed automatically — the operator records what a human decided and did.
- **Work compliance actions** — each compliance task links to a Policy Decision (e.g. `ZA-RG-001`); track assignment and completion.
- **Watch operational health** — Executive Operations shows open/overdue cases, SLA performance, intervention and compliance completion, and bottlenecks. Rising overdue counts or an in-review bottleneck are the first coaching signals in a pilot.
- **Stay on top of work** — the Notification Centre surfaces assignments, overdue cases and approaching deadlines. Notifications inform only.

All workflow data is operational metadata — it never changes the certified enterprise flow, and every case remains linked to Recorded Facts, Derived Intelligence and Policy Decisions with a full immutable audit trail.
