# SafeBet IQ — Production Operations Manual

**Status: OPERATIONS STANDARD** (Phase 4.4) · Governed by `SAFEBET_ENTERPRISE_CONSTITUTION.md`
Audience: SRE / operators / on-call. All operational actions go through the `platform-ops` function (admin/service-role only) or documented DB functions. **No operational action changes business rules** (Constitution — one runtime reality, policy as data).

---

## 1. Operating modes (WS2)
`SAFEBET_OPERATING_MODE` ∈ `development | demonstration | staging | production` (default `demonstration`). Mode tunes OPERATIONS only — logging, simulator, alert thresholds, retention, demo data. Business rules (identity, projections, intelligence, policy decisions) are byte-identical across modes.

| Knob | dev | demo | staging | prod |
|---|---|---|---|---|
| simulator | on | on | on | **off** |
| log level | debug | info | info | warn |
| lag warn / critical (s) | 120/600 | 90/300 | 60/180 | **30/120** |
| retention hot months | 3 | 6 | 12 | 24 |
| demo data | yes | yes | yes | **no** |

---

## 2. Policy management (WS1) — runbook
Policies are DATA in a versioned store; evaluation logic is unchanged in the Policy Platform.
- **View:** `GET platform-ops?action=policy-list` → versions, active, change log.
- **Seed a new version from shipped packs:** `POST ?action=policy-seed` → creates next version, activates it (audited).
- **Promote / rollback:** `POST ?action=policy-activate&version=N&reason=…` → activates version N (rollback if N is older). Exactly one active version; change logged with actor + reason + from/to.
- **Effect:** the Consumer Platform reloads active rules (≤60 s cache) and evaluates them — no deploy.
- **Custom jurisdiction/operator rules:** insert a new `policy_rules` set + activate. Rules validate on load (reject-not-repair); a malformed rule fails the load and the platform keeps its current configuration.

**Rollback drill (verified live):** seed v2 → `policy-activate&version=1` → change log records `rollback 2→1`, v1 active, v2 archived.

---

## 3. Scheduled operations (WS3) — cadence
Driven by a scheduler invoking `platform-ops` (or the DB functions directly). All idempotent; all orchestrate existing platform capabilities.

| Task | Action | Cadence | Purpose |
|---|---|---|---|
| Partition maintenance | `POST ?action=ensure-partitions&months=2` | daily | ensure current + buffer monthly event partitions exist |
| Health verification | `GET ?action=monitor` | 1–5 min | platform/casino health + alerts |
| Projection integrity | `POST ?action=validate-projections&casino_id=…` | hourly | detect drift (distinct-players vs projected) → advise rebuild |
| Archive preparation | (dry-run in code) → `sbiq_archive_event_partitions_before(cutoff)` | monthly, **approved** | detach cold months (never delete) |
| Policy refresh | automatic (gateway TTL) | continuous | load active policy set |

> Set up scheduling with the `schedule`/cron facility or an external scheduler calling `platform-ops` with the service-role key. A **missing future partition** would reject that month's inserts — the daily ensure-partitions task prevents this.

---

## 4. Monitoring & alerting (WS4)
`GET platform-ops?action=monitor[&casino_id=…]` returns, per casino: `severity` (ok/warning/critical), `alerts`, and the raw health snapshot; plus platform-wide `platform_severity` and the active `operating_mode` thresholds.

**Alert catalogue** (fires on operational conditions only, never business content):
| Code | Severity | Meaning | Action |
|---|---|---|---|
| `PROJECTION_LAG_WARNING/CRITICAL` | warn/crit | read side behind the log beyond mode threshold | check projector; rebuild if persistent |
| `PROJECTION_DRIFT` | warn | distinct log players > projected | run projection rebuild |
| `INGESTION_STALL` | warn | active casino, no recent events | check the producer |

Structured telemetry (`lib/observability/telemetry.ts`) emits one-line JSON per ingest/apply event, PII-free by construction (redacts refs/email/payload/`demo-patron-*`).

---

## 5. Disaster recovery & backup (WS5)
**Foundational guarantee:** events are the truth; every downstream artifact is disposable and rebuildable. Recovery never involves data surgery.

- **Backup verification:** the event store is the source of record. `sbiq_platform_health` reports `events_in_log` and `distinct_players`; a backup is valid if a rebuild from it reproduces the projections (see below). Managed daily backups (Supabase) cover the event log + policy store; verify restore quarterly.
- **Projection loss / corruption:** `POST projection-platform?action=rebuild&casino_id=…` — disposes and replays the immutable log through the same reducers as the live path. **Deterministic** (verified: identical rebuild twice). Rebuild reflects the events currently **attached** to `casino_event_log` (see the two cautions below).
- **⚠ CAUTION — rebuild after archival (Red-Team finding, Medium):** a full rebuild replays only the **hot (attached) partitions**. Archived (DETACHed) months are excluded from replay, so cumulative/lifetime projection fields (`total_wagered`, `bet_count`, `session_count`) would be **understated** for players whose history spans the archive boundary. Before a **full-history** rebuild, **re-ATTACH** the required archived partitions:
  `ALTER TABLE casino_event_log ATTACH PARTITION archive_casino_event_log_YYYY_MM FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');`
  then rebuild, then (optionally) DETACH again. For routine recovery within the hot retention window, no re-attach is needed. Audit data is never lost — archived partitions remain queryable and re-attachable.
- **⚠ CAUTION — rebuild during live ingestion (Red-Team finding, Low):** run `rebuild` in a **quiesced window** (pause the producer for that casino). A rebuild disposes then re-writes projections; concurrent live applies can cause transient projection inconsistency until the next event (it self-heals, but avoid it during incidents).
- **Twin / runtime loss (service restart):** the Digital Twin is in-memory and disposable; it re-assembles from projections on next request. No action needed.
- **Event store recovery:** restore from managed backup; partitions and the immutability trigger are part of the schema. Archived (detached) partitions remain queryable and can be re-ATTACHed (required before a full-history rebuild — see above).
- **Policy store recovery:** restore from backup, or re-seed from shipped packs (`policy-seed`) and re-activate the intended version.
- **Recovery test (verified live):** rebuild ×2 from the partitioned log → identical projections; archive detach → data preserved in `archive_*`, hot parent clean; replay-after-archive returns only hot-window totals until archived partitions are re-attached (Red-Team verified — see the caution above).

**RTO/RPO (demo):** RPO = last managed backup (event log); RTO = rebuild time (seconds at demo scale). Production targets set with the managed-backup SLA in 4.5/ops onboarding.

---

## 6. Operational governance (WS6)
Every operational change is traceable and least-privilege.
- **Authorization:** all `platform-ops` actions require a verified admin JWT or the service-role key (Phase 4.1). Non-admins are refused (verified: operator → 403).
- **Change management:** policy changes are versioned + audited in `policy_change_log` (actor, action, from/to, reason). Deployments follow the Definition of Done (Constitution §11): tests + typecheck + build + live verification, demo before production.
- **Approvals:** policy activation/rollback records the actor; production activation requires a recorded reason. Emergency policy rollback = `policy-activate` to the last-good version (minutes, no deploy).
- **Audit procedures:** `policy-list` (config history), `policy_change_log` (governance trail), `casino_event_log` (immutable business audit), structured telemetry (operational audit).
- **Emergency procedures:** projection incident → rebuild; policy incident → rollback; producer incident → the flow degrades safely (no events ⇒ stale projections ⇒ lag alert), fixed by restoring the producer; tenant/security incident → see Phase 4.1 (revoke/adjust registry).

---

## 7. Operational checklists
**Daily:** ensure-partitions ok · monitor severity = ok · no unresolved alerts.
**Weekly:** projection-integrity per active casino · review change log · telemetry error rate.
**Monthly:** archive-eligible months reviewed · retention cutoff applied (approved) · backup restore spot-check.
**Incident response:** identify alert → consult §4 action → execute the platform capability (rebuild/rollback/producer) → verify via `monitor` → record in change log if config changed.
**Escalation:** warning → operator; critical (lag/drift persistent, or ingestion stall on production) → on-call SRE → platform owner.

---

*This manual is part of the production operations standard. Operational actions strengthen the existing platforms; none introduce a new platform, runtime model, or business logic.*
