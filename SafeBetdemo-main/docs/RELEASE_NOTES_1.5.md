# SafeBet IQ — Release Notes, Version 1.5

**Enterprise Workflow & Case Management** · 2026-07-16 · ADR-005

Version 1.5 turns SafeBet IQ from a platform that *identifies and explains* risk into one that lets casinos and regulators *manage, assign, track, resolve and audit* the recommendations it already produced. Every recommendation can now become an owned, traceable, auditable case — **while the certified enterprise architecture remains completely unchanged.**

> **Workflow is orchestration — not intelligence.** It coordinates human actions *after* the platform has decided. It consumes Recorded Facts, Derived Intelligence, Policy Decisions and Explainable Intelligence; it never recalculates risk, re-derives policy, creates runtime state, bypasses the Event Platform, or auto-executes interventions. **The platform recommends. The operator decides.**

---

## Highlights
- **Enterprise Case Management** (WS1) — cases from high-risk players, RG recommendations, compliance findings, regulatory investigations, or manual creation. Case number, status, priority, owner, due date, notes, evidence references, timeline and full audit history. Cases **reference** platform data by identifier; they never duplicate it.
- **Intervention Workflow** (WS2) — Recommendation → Operator Review → Accept/Reject → Action Recorded → Outcome Recorded → Case Closed, enforced by a strict state machine. Every step timestamped and audited. **No intervention is ever executed automatically.**
- **Compliance Workflow** (WS3) — compliance task management, each task linked to an existing **Policy Decision** (`evidence_ref`), with assignment, escalation and completion tracking.
- **Regulatory Investigation Workspace** (WS4) — jurisdiction-scoped (from the verified JWT), anonymous investigation cases with assignment, observations, timeline, evidence-package links and resolution — **zero PII**.
- **Executive Operations Dashboard** (WS5) — open/overdue/resolved cases, SLA performance, intervention & compliance completion, outstanding investigations, and bottlenecks — all composed from workflow metadata.
- **Unified Workflow Timeline** (WS6) — one honest timeline per case: Recorded Fact → Derived Intelligence → Policy Decision → Workflow Action → Recorded Outcome → Case Resolution. **Missing stages are shown as unavailable — never fabricated.**
- **Notification Centre** (WS7) — case assigned / overdue / awaiting review / deadline approaching. Notifications **inform only**; they never trigger business logic.

## Architecture-compliance decision (ADR-005)
Workflow/case/task/audit/notification records are **operational orchestration metadata** — the same class as `connector_runs` (v1.1) and `operator_subscriptions` (v1.3), *not* casino runtime state (Constitution 2) and *not* a Constitution-1 data flow. The pure `lib/workflow` module performs no I/O, no analysis and no policy evaluation — it decides only *what a human may do next*. A case links evidence **by reference**; the live value is always read back from the Consumer Platform, never trusted from the case row. The audit trail is **append-only**, enforced by a database trigger that mirrors `casino_event_log` immutability. Should a recorded human outcome ever need to enter the certified player journey, it must go through `getEventPlatform().ingest` like any other fact. No event, projection, twin, intelligence, policy or contract shape changed — additive under Constitution §9.

## What's new (files)
- `lib/workflow/{types,caseModel,stateMachine,timeline,notifications,operations,index}.ts` — pure workflow logic (case model, SLA, state machine, honest timeline composition, notifications, operations shaping)
- `lib/workflowClient.ts` — browser client for the workflow endpoint
- `supabase/functions/workflow/index.ts` — the workflow endpoint (CRUD + verified principal + audit on every mutation + timeline composition)
- `supabase/migrations/20260716120000_v15_workflow.sql` — `workflow_cases`, `workflow_tasks`, `workflow_audit` (append-only), `workflow_notifications` (tenant RLS) + case-number sequence + `sbiq_workflow_operations()`
- `app/casino/cases/page.tsx` (Case Management + intervention workflow + unified timeline), `app/casino/compliance-workflow/page.tsx`, `app/casino/operations/page.tsx`, `app/casino/notifications/page.tsx`, `app/regulator/cases/page.tsx`
- `docs/ARCHITECTURE_DECISION_RECORD.md` (ADR-005), `docs/API_REFERENCE.md` §6e
- `tests/workflow.test.mjs` (21 tests)

## Validation evidence
- **Tests:** `node --test "tests/**/*.test.mjs"` → **225 pass, 0 fail** (204 prior — zero regressions — + 21 workflow: case numbering/SLA/overdue, state-machine legality, review mapping, honest timeline with unavailable stages, evidence-by-reference (never copied), notifications/attention, outstanding tasks, operations composition, catalogue integrity). `tsc --noEmit` clean; `next build` succeeds (5 new pages compiled).
- **Live end-to-end** (demo casino `a1b2c3d4-…0001`, real player `SB-PLR-A1C9A441…`, verified operator JWT):
  - Opened case `HRP-2026-001000` from the player, linking Derived-Intelligence + Policy-Decision evidence references; SLA due date auto-computed from priority.
  - Drove the full lifecycle open → in-review → accepted → action-recorded → outcome-recorded → resolved → closed; **7 immutable audit entries** captured.
  - **Unified timeline** rendered honestly: derived-intelligence / policy-decision / workflow-action / recorded-outcome / case-resolution `available`, recorded-fact `unavailable` (not fabricated).
  - **Audit immutability proven at the DB layer:** a raw `UPDATE workflow_audit` errors with `append-only (no UPDATE permitted)`.
  - Illegal transition (closed → open) → **409**; anon → **401**; cross-tenant to another real ZA operator → **403**; unknown casino → **404**.
  - Assignment raised a `case-assigned` notification; operations rollup composed (open/resolved/SLA/completion) from metadata; every subject reference anonymous (`SB-PLR-…`, zero PII).

## Performance
Case/task/audit reads are single indexed queries scoped by casino; the operations rollup is one `sbiq_workflow_operations()` call plus pure in-memory shaping. No per-request recomputation of any enterprise value; the certified flow is untouched, so its throughput is unaffected.

## Remaining limitations
- Evidence references can become stale pointers if a referenced object is archived; mitigated because the live value is always re-read from the Consumer Platform and archival preserves the record.
- Recorded outcomes are workflow-coordination facts. If a future requirement needs an intervention outcome to become part of the certified *player journey*, that fact must be ingested through the Event Platform (a Phase-5 integration item) — it is deliberately not written to runtime state by the workflow layer.
- SLA thresholds are sensible defaults in `lib/workflow/caseModel.ts`; externalising them per jurisdiction (like the policy store) is a future enhancement.

## Success criteria — met
Every recommendation can become an auditable workflow; human ownership is preserved; workflow orchestrates existing intelligence rather than replacing it; cases stay linked to Recorded Facts, Derived Intelligence and Policy Decisions; no duplicate runtime state or business logic exists; the certified enterprise flow remains the only flow; the Enterprise Architecture is unchanged; all governing documents remain valid; all Six Constitutions remain fully satisfied.
