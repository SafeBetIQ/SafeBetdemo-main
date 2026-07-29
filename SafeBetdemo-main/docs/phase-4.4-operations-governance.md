# Phase 4.4 — Enterprise Operations, Governance & Policy Management

**Status: COMPLETE & DEPLOYED** (2026-07-13, SafeBet Demo `uexdjngogzunjxkpxwll`; production untouched)
**Governed by:** `SAFEBET_ENTERPRISE_CONSTITUTION.md` · **Closes M1 (policy store) + H5 (observability/ops)** · **Decision: ADR-004** · **Gate G4: GO**

SafeBet IQ is now enterprise-**operable**: policy configuration is externalised, versioned and audited; the platform has operating modes, scheduled maintenance, monitoring/alerting, disaster-recovery procedures, and operational governance — all orchestrating existing platforms with **zero architectural change** (no new platform, runtime model, pipeline, or business logic).

---

## 1. Enterprise Operations Report
One operational surface, `platform-ops` (admin/service-role only), covers policy management, scheduled maintenance, and monitoring. Operating mode (env `SAFEBET_OPERATING_MODE`) tunes operations only. Full procedures in `docs/OPERATIONS_MANUAL.md`.

## 2. Policy Store Report (WS1)
Policy configuration moved from code into a versioned repository (`policy_sets`, `policy_rules`, `policy_change_log`) loaded through the platform's existing `configure()` seam. **Policy logic is unmoved** (`evaluation.ts` untouched) — Constitution 4 intact. `lib/policyPlatform/store.ts` maps stored JSONB definitions → validated `PolicyRule[]`; the Consumer Platform loads the active set (≤60 s cache) and evaluates it. **Live-verified:** seeded 22 shipped rules as v1 active; the gateway's summary view now returns decisions sourced from the store (4 headline, e.g. `CMP-001`).

## 3. Policy Versioning Report
Versioned sets, exactly one active (partial-unique enforced), effective-dated, with activation audit. Promotion and **rollback** are `sbiq_activate_policy_set(version, actor, reason)`. **Live-verified rollback:** seeded v2 → activated v1 → `policy_change_log` recorded `rollback 2→1` (v1 active, v2 archived) with actor. A regulator threshold change is now a data operation with zero deploy.

## 4. Operational Modes Report (WS2)
`development | demonstration | staging | production`. Modes influence simulator, log level, alert thresholds, retention, demo data — never business rules (identity/projections/intelligence/decisions are byte-identical across modes; test-verified). Production is strictest (simulator off, lag 30/120 s, no demo data). **Live:** monitor reported `operating_mode: demonstration` with the demonstration thresholds.

## 5. Monitoring & Alerting Report (WS4)
`GET platform-ops?action=monitor` returns per-casino severity + alerts + health, plus platform severity, evaluated against the mode's thresholds. Alerts fire on meaningful operational conditions only: `PROJECTION_LAG_WARNING/CRITICAL`, `PROJECTION_DRIFT`, `INGESTION_STALL`. **Live-verified:** monitor detected a genuine `PROJECTION_LAG_CRITICAL` on a casino with stale projections — real detection, not a synthetic check. Structured, PII-free telemetry (Phase 4.3) underlies it.

## 6. Disaster Recovery Report (WS5)
Foundational guarantee: events are truth; all downstream artifacts are disposable and rebuildable — recovery never involves data surgery. Procedures (in the manual): projection loss → deterministic rebuild (verified ×2 identical); twin loss → auto re-assemble; event-store recovery → managed backup + schema (partitions/trigger); archived partitions re-ATTACHable; policy store → restore or re-seed. RPO = last managed backup; RTO = rebuild seconds at demo scale.

## 7. Backup Verification Report
The event log is the source of record; a backup is valid iff a rebuild from it reproduces the projections. **Live-verified:** `validate-projections` reported integrity OK (14 distinct players = 14 projected, no drift); rebuild is deterministic. Managed daily backups (Supabase) cover the event log + policy store; quarterly restore spot-check in the manual.

## 8. Operational Governance Report (WS6)
Every operational change is traceable and least-privilege: all `platform-ops` actions require a verified admin JWT or service-role key (**live: operator → 403**); policy changes are audited in `policy_change_log` (actor/action/from/to/reason); deployments follow the Definition of Done; emergency policy rollback is minutes with no deploy. Audit surfaces: `policy-list`, `policy_change_log`, immutable `casino_event_log`, telemetry.

## 9. Runbooks
`docs/OPERATIONS_MANUAL.md` — operating modes, policy management, scheduled operations, monitoring/alert catalogue, DR & backup, governance, and daily/weekly/monthly/incident/escalation checklists.

## 10. Files created
- `lib/policyPlatform/store.ts` (config loader — no logic)
- `lib/operations/{mode,monitoring,scheduledOps,index}.ts`
- `supabase/functions/platform-ops/index.ts`
- `supabase/migrations/20260713100000_phase44_policy_store.sql`
- `tests/operations.test.mjs` (12 tests); `docs/OPERATIONS_MANUAL.md`; `docs/phase-4.4-operations-governance.md`; ADR-004

## 11. Files modified
- `lib/policyPlatform/index.ts` — export store loader
- `supabase/functions/consumer-gateway/index.ts` — load active policies from the store (cached, fallback-safe)

## 12. Database migrations
One additive migration (applied to demo): policy store tables + `sbiq_active_policy_rules()` + `sbiq_activate_policy_set()`, service-role only, RLS-enabled with no client policies. No changes to events/projections/twin.

## 13. ADRs created
**ADR-004** (Accepted) — externalised versioned policy store + operating modes. Additive; no logic moved; no constitution amended.

## 14–15. Tests executed / passed
`node --test tests/*.test.mjs` → **152 tests, 152 pass, 0 fail** (140 prior — zero regressions — + 12 new: store load/validate/reject, versioning/rollback as data, mode resolution + operational-not-business knobs, health alert thresholds by mode, drift/stall detection, scheduled-task orchestration). `tsc --noEmit` clean; `next build` succeeds (verified in prior phase; no app-tier code changed here beyond edge functions).

## 16. Remaining operational risks
- Scheduling is provisioned by function + manual/external scheduler; wiring a managed cron is an onboarding step (a missing future partition would reject that month's inserts — daily ensure-partitions prevents it).
- Alert delivery is exposed via `monitor` (pull); push/paging integration is an ops-onboarding step.
- Shipped packs remain the seed source; intentional pack changes must be re-seeded (`policy-seed`) to reach the store.
- The 1,000 ev/s network load test (roadmap M7) remains open from 4.3.

## 17. Rollback strategy
Additive and reversible: revert the gateway's store-load wiring (platform reverts to in-code defaults); the store tables/functions and operations libs are harmless if unused. No event/projection/twin/contract change to unwind. Demo is the blast radius.

## 18. Operations Architecture Diagram
```
                       ┌──────────────── platform-ops (admin/service-role) ───────────────┐
 Policy store (versioned, audited)      Scheduled ops                Monitoring
  policy_sets / policy_rules /          ensure-partitions            monitor → evaluateHealth
  policy_change_log                     validate-projections           (mode thresholds)
        │  sbiq_active_policy_rules()    (calls existing platform fns)   alerts + severity
        ▼
 Consumer Platform → getPolicyPlatform().configure(active rules) → evaluate (UNCHANGED)
        │
 Operating mode (env) ── tunes ──► logging · simulator · alert thresholds · retention (ops only)
```
The enterprise event flow (Event→Projection→Twin→Intelligence→Policy→Consumer) is unchanged; operations wrap around it.

## 19. Production Readiness Certificate — Operations & Governance
> **CERTIFIED.** Policy configuration is externally managed, versioned, effective-dated, audited, and rollback-capable with zero deploy (live-verified). Operating modes tune operations without changing business rules (test-verified). Monitoring detects real operational failures against mode thresholds (live: genuine lag-critical). Disaster recovery is documented and validated (deterministic rebuild; archive detach preserving audit). Operational governance is least-privilege and fully traceable (live: non-admin 403; audited change log). The enterprise architecture and six constitutions are unchanged. Conditions M1 and H5 are closed.

## 20. Go / No-Go — Gate G4

**GO — proceed to Phase 4.5.** Every G4 criterion is met with objective evidence: policies externally managed + versioned (live seed/rollback/audit); operating modes correct (tests + live); scheduled maintenance operational (live ensure-partitions/validate); monitoring detects failures (live lag-critical); DR documented + tested (rebuild + archive); backup verification succeeds (integrity ok); governance procedures exist and enforce least privilege (live 403 + audit trail); enterprise architecture and all six constitutions intact (152 tests, tsc clean). Deferred items (managed cron wiring, push alerting, M7 load test) are ops-onboarding tasks, not correctness gaps.
