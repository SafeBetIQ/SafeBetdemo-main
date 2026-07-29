# SafeBet IQ — Regulator Pilot-Readiness Scorecard

**Environment: SafeBet Demo (non-production). Statuses reflect DEMO verification, not production.**
Status: Ready / Ready-with-conditions / Partially-ready / Not-ready / N/A. "Blocker?" = blocks a real-data production pilot.

## 30-domain scorecard

| # | Domain | Status | Evidence | Gap / Required action | Blocker? |
|---|---|---|---|---|---|
| 1 | Identity & access management | Ready-with-conditions | JWT + server-side users registry; verified | Production IdP/MFA review | No |
| 2 | Tenant & casino isolation | Ready (demo) | RLS + security_invoker; 403 cross-casino verified | Production RLS on managed DB | No |
| 3 | Player identity resolution | Ready (demo) | SB-PLR resolution; projections keyed by SB-PLR | Real operator id mapping | No |
| 4 | Player-risk monitoring | Ready (demo) | risk bands + reconciliation | Real risk-model validation | No |
| 5 | Risk-band reconciliation | Ready (demo) | active = Σ bands (incl. Unclassified), green | — | No |
| 6 | RG intervention evidence | Partially-ready | intervention records present | Delivery-channel evidence not captured | No |
| 7 | Self-exclusion evidence | Partially-ready | schema present | Not exercised end-to-end in certified flow | No |
| 8 | Session lifecycle integrity | Ready (demo) | supersession + posture reconcile; SQL/TS parity | — | No |
| 9 | Player activity posture | Ready (demo) | active-now/idle/stale reconcile | — | No |
| 10 | Machine activity posture | Partially-ready | in-play/stale reconcile | offline/faulted/disconnected UNSUPPORTED (no telemetry) | No |
| 11 | Financial GGR evidence | Ready-with-conditions | period GGR = stakes−winnings, reconciles | combined-record source only | No |
| 12 | Financial event capability completeness | **Not-ready** | capability profile = Partial | no separate settlement/void/reversal/bonus events | **Yes (real-money)** |
| 13 | Evidence API | Ready (demo) | 4 endpoints, scoped, paginated, verified | — | No |
| 14 | Secure evidence exports | Ready (demo) | CSV injection-safe, row-limited, audited, chain-ref | — | No |
| 15 | Audit-event recording | Ready (demo) | audit_events + evidence/governance events | — | No |
| 16 | Cryptographic audit integrity | Ready (demo) | per-tenant SHA-256, SQL/TS parity, append-only | — | No |
| 17 | Scheduled audit verification | Ready (demo) | pg_cron observed running; checkpoints | production scheduler monitoring | No |
| 18 | Platform Health | Partially-ready | health view + regulator view | dedicated Platform-Health UI widget deferred | No |
| 19 | Data provenance & freshness | Ready (demo) | snapshots, status, unavailable≠zero | — | No |
| 20 | Incident detection & response | **Not-ready** | integrity alert table exists | no alert routing / on-call / runbook | **Yes** |
| 21 | Backup & disaster recovery | **Not-ready** | none proven | backup + restore test + DR procedure | **Yes** |
| 22 | Availability & resilience | **Not-ready** | free-tier Demo, single region, can pause | managed HA deployment | **Yes (real-data)** |
| 23 | Production deployment | **Not-ready** | no managed cloud deploy (invalid AWS session) | deploy to approved managed env | **Yes** |
| 24 | Data retention | **Not-ready** | none | retention policy + enforcement | **Yes (real-data)** |
| 25 | Privacy controls | Partially-ready | SB-PLR only, no secrets/tokens in exports | formal DPIA + field classification sign-off | Conditional |
| 26 | Regulatory reporting | Partially-ready | regulator portal + verification view | jurisdiction-specific report formats | No |
| 27 | Operational support | Not-ready | none defined | support model + SLAs | Conditional |
| 28 | Customer onboarding | Partially-ready | onboarding pages exist | real operator provisioning process | No |
| 29 | Pilot rollback & exit plan | Ready-with-conditions | documented below | sign-off | No |
| 30 | Documentation completeness | Ready-with-conditions | this pack + per-milestone docs | jurisdiction legal docs | No |

## Pilot blockers (must resolve before a real-data / production pilot)
Managed cloud deployment (#23); backup + restore proof (#21); availability/HA (#22); incident detection & response routing (#20); complete financial event lifecycle for real-money GGR (#12); data-retention policy (#24). Also required for production: penetration test, key/secret rotation, change management, DPA/legal, real casino connector, external audit anchoring.

## Pilot conditions (acceptable OPEN under a controlled NON-PRODUCTION, SYNTHETIC-DATA evaluation)
Partial financial capability (disclosed); machine telemetry states unsupported (disclosed); Platform-Health UI widget deferred (data exists); DPIA pending (no real PII in scope); no external anchoring (internal checkpoints active, honestly labeled); free-tier backend may pause.

## Post-pilot production requirements
Everything in blockers + monitoring/alert routing, load testing, support model, DPAs, jurisdiction legal requirements, retention, pen test, vuln management, secret rotation, change management, production release process, real connector, complete financial lifecycle, machine telemetry, external checkpoint anchoring.

## Pilot operating model (Phase 15)
- **Objective:** demonstrate certified dashboards, evidence API, and tamper-evident audit integrity to a regulator using SYNTHETIC data.
- **Participants:** pilot owner (SafeBet IQ), technical owner (SafeBet IQ), regulator contact (observer). **No real operator data.**
- **Data:** SafeBet Demo synthetic + seeded only; real-data explicitly **excluded** (no connector/DPA).
- **Duration:** time-boxed evaluation. **Supported use cases:** dashboard review, evidence drill-down/export, audit verification, regulator oversight view. **Excluded:** real player/financial data, production decisions, enforcement actions.
- **Access:** demo accounts provisioned per role; scope server-enforced.
- **Incident escalation:** integrity alert → SafeBet IQ technical owner (routing is manual — no on-call). **Change-freeze:** no schema/metric changes during a review window. **Rollback:** additive migrations; revert app build; append-only audit means corrections are new events. **Exit/data:** synthetic data may be reset; no real data to return/delete.

## Pilot entry criteria (Phase 16 — all mandatory)
Named pilot + technical + regulator owners; approved scope + SYNTHETIC data source + Demo environment; access matrix signed off; tenant isolation tested (✓); evidence endpoints verified (✓); audit chain verified (✓); scheduled verification operational (✓); Platform Health operational (✓ view); **backup performed + restore tested (OPEN — blocker for real data)**; incident procedure approved (OPEN); known limitations accepted; synthetic data labelled (✓); real-data agreement (N/A — excluded); security review (partial); rollback plan approved (✓). **A pilot must not begin with an unresolved mandatory blocker for its data class.**

## Pilot exit criteria (Phase 17)
Measure: dashboard reliability; reconciliation success (target 5/5 green); evidence completeness; export usability; audit verification success (target all chains verified); regulator + operator feedback; incident count; data-integrity failures (target 0); projection delays; availability; response time; security findings; required remediation. **Conclusion options:** Proceed / Proceed-with-conditions / Extend / Pause-for-remediation / Do-not-proceed.

## Formal recommendation
**Proceed-with-conditions to a controlled NON-PRODUCTION, SYNTHETIC-DATA regulator evaluation only.** A real-data or production pilot is **Not-ready** pending the blockers above.
