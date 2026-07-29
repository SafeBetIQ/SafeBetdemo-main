# Version 2.0 — Phase 4 Operational Readiness Plan

**Phase 4.0 · PLANNING ONLY · 2026-07-16 · ADR-006 (frozen).** Covers **C2** (durable persistence +
RLS), **C3** (durable append-only audit), **C6** (backup/restore), **C8** (deployed regression),
**C9** (pilot operational readiness). Pilot requirements are separated from future production
HA/scaling.

## 1. Durable Regulator-Plane Persistence Plan (C2, C3 — Phase 4.1)
| Aspect | Plan |
|---|---|
| Persistence scope | SB-NAT Registry (records, members, versions, history); decision/appeal/override history; policy outcomes; correlation results OR reconstruction inputs; append-only audit |
| Database location | Isolated **pilot** regulator-plane store (non-production); sovereign per jurisdiction |
| Schema ownership | Regulator-plane schema owned by SafeBet IQ; **distinct** from operator operational data |
| RLS | Row-level security: regulator read within jurisdiction; **operators write-only contribution, no read**; no cross-tenant/cross-sovereign read |
| Regulator access | Regulator-plane, jurisdiction-bound, deny-by-default (matches domain access model) |
| Operator access | Write-only contribution only; **no** registry/correlation/policy read |
| Append-only audit | Durable store with **no update/delete**; attempts rejected at the store (C3) |
| SB-NAT Registry persistence | Immutable records + assignment log persisted; identifiers permanent |
| Decision/appeal/override history | Persisted append-only; immutable |
| Correlation result storage | Store reproducible results OR the references to reconstruct them (provenance preserved) |
| Policy outcome persistence | Evaluations + versions persisted (nine-part stamp) |
| Integrity verification | Registry/correlation/policy integrity verifiers run against the durable store |
| Backup / Restore | Scheduled backup; restore drill (C6) |
| Retention / Archiving / Deletion | Per C7 retention; archive; legal deletion where required (respecting immutability of audit) |
| Sovereign isolation | Per-jurisdiction store separation; no cross-sovereign query |

**Design principle:** persistence adapters sit **behind the existing domain interfaces** — no domain
redesign; the registry/correlation/policy contracts are unchanged. Preserve the distinction between
**operational operator data** and **regulator-plane correlation data**.

**Closure tests:** C2 — RLS negatives (operator denied) pass on the live store; C3 — update/delete
rejected, audit survives restart.

## 2. Deployed-Runtime Regression Plan (C8 — Phase 4.6)
Deployed application validation (library-only tests are **insufficient** for pilot):
- existing Consumer Platform route tests; operator dashboard smoke; existing API compatibility;
- Event / Projection / Digital Twin / Policy Platform validation;
- operator access-control regression; regulator access-control validation;
- **SB-NAT non-exposure to operators**; **national policy non-exposure to operators**;
- error-path testing; rollback validation; performance sanity.
**Closure (C8 / C2-5 deployed hard gate):** deployed regression + route/contract smoke pass with V2 present.

## 3. Monitoring & Incident Plan (C9 — Phase 4.7)
CloudWatch logs + metrics + alarms; audit monitoring; **registry / correlation / policy integrity
monitoring** (continuous verifier runs); connector health; incident response + escalation; support
ownership + pilot support hours; change control; evidence preservation. Alarms on: integrity
failure, isolation breach, PII-scan hit, audit-write failure, connector down, reconciliation drift.

## 4. Backup & Restore Plan (C6 — Phase 4.7)
Scheduled backups of registry + audit + policy stores; **restore drill** that reproduces registry/
audit state and **passes the integrity verifier post-restore**; documented RPO/RTO (pilot targets
`[PROPOSED]`). **Closure (C6):** restore reproduces state; integrity verifier passes post-restore.

## 5. Pilot vs Production separation
| Capability | Pilot (Phase 4) | Production (separate assessment) |
|---|---|---|
| Persistence | durable pilot store | production store + DR |
| Monitoring | metrics/alarms/incident | full observability + on-call |
| HA / scaling | **not required** for pilot | **required** for production |
| Support | pilot hours | production SLAs |
| Backup/restore | drill | full DR + failover |
| Deployment | pilot pipeline + rollback | production pipeline + change control |

## 6. Operational readiness closure (C9)
Monitoring/alarms, HA/scaling *(HA deferred to production)*, incident response, support runbook,
deployment pipeline, and rollback **present and exercised** for the pilot scope. Production HA and
scaling are explicitly **out of pilot scope** and deferred to the production readiness assessment.

## 7. Runbooks to be produced in Phase 4 (not 4.0)
Deployment runbook; rollback runbook; connector onboarding/suspension/revocation; feature-flag +
jurisdiction activation; restore drill; incident response + escalation. Phase 4.0 lists them; it
does not author or execute them.
