# SafeBet IQ — Production Deployment Runbook (Version 1.0)

Enables a consistent, safe production deployment of the certified enterprise flow. Consistent with `docs/ENTERPRISE_REFERENCE_ARCHITECTURE.md` and `docs/OPERATIONS_MANUAL.md`.

**Standing constraint:** production deployment is **owner-executed**. This runbook documents the process; it does not authorise anyone else to run it against production. All prior verification occurred on the demonstration environment.

Tiers: **Data/platform** = Supabase (PostgreSQL migrations + Edge Functions). **Application** = Next.js on Elastic Beanstalk.

---

## 1. Pre-deployment checklist
- [ ] Target environment identified (project ref, EB environment) and access confirmed by the owner.
- [ ] Full test suite green on the release commit: `node --test tests/*.test.mjs` (152 tests), `npx tsc --noEmit`, `npx next build`.
- [ ] Release notes / changed ADRs reviewed; any breaking change carries an accepted ADR.
- [ ] Backups verified current (managed daily backup of the target DB).
- [ ] Operating mode decided (`staging` → `production`) and env vars prepared (§2).
- [ ] Maintenance window and rollback owner assigned.

## 2. AWS / environment prerequisites
- **Application (Elastic Beanstalk):** Node runtime; `Procfile` present; RC1 security headers configured. Env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server; secret)
  - `SAFEBET_OPERATING_MODE` = `production`
  - `SAFEBET_IDENTITY_PROVIDER` (optional; defaults to `sha256-v2`)
- **Data/platform (Supabase):** project provisioned; Edge Function secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` set; Realtime enabled; managed backups on.
- **Secrets:** service-role key server-side only (never shipped to the browser). Anon/publishable key for clients.

## 3. Database migration order [Implemented]
Apply migrations in **timestamp order** (`supabase db push`, or apply each in sequence). The enterprise-flow migrations, in order:
1. `…_create_safebet_identity_map` — identity map + `resolve_player_identity`.
2. `20260710120000_create_projection_platform` — projection tables + 7 catalogue views + RLS.
3. `20260710150000_add_floor_location_to_machine_projection` — projection v2 (floor location).
4. `20260712100000_phase41_tenant_isolation` — `casinos.jurisdiction`, `app_visible_casinos()`, tenant RLS, `security_invoker` views.
5. `20260712140000_phase42_identity_v2_96bit` — 96-bit id constraints (both widths).
6. `20260712160000_phase43_ingestion_projection_hardening` — dedupe key, `row_version`, `sbiq_write_projection_states`, `sbiq_platform_health`.
7. `20260712180000_phase43_event_store_partitioning` — partitioned `casino_event_log`, maintenance + archive functions, publish-via-partition-root.
8. `20260713100000_phase44_policy_store` — policy store tables + `sbiq_active_policy_rules`/`sbiq_activate_policy_set`.

(Earlier demo/app migrations that provision `casinos`, `users`, auth, etc. must already be applied.) **Do not reorder** — later migrations depend on earlier objects. Migrations are additive; the append-only trigger forbids UPDATE backfills (synthetic data is disposed/reseeded, not backfilled).

## 4. Deployment sequence
1. **Freeze** producers to the target (or run in a window with low ingestion).
2. **Migrate** the database (§3) in order; confirm each succeeds.
3. **Deploy edge functions:**
   `npx supabase functions deploy identity-resolution casino-simulator projection-platform digital-twin consumer-gateway platform-ops --project-ref <ref>`
4. **Deploy the application** to Elastic Beanstalk (owner's standard EB deploy; `Procfile`-driven) with the §2 env vars, `SAFEBET_OPERATING_MODE=production`.
5. **Seed the policy store:** `POST platform-ops?action=policy-seed` (admin) → activates v1 (22 shipped rules). Confirm via `policy-list`.
6. **Ensure partitions:** `POST platform-ops?action=ensure-partitions&months=2`.
7. **Enable scheduling** (managed cron / external scheduler) for `ensure-partitions` (daily) and `monitor` (1–5 min) — **[Phase 5 wiring]**; until then, schedule manually per `OPERATIONS_MANUAL.md`.

## 5. Validation checklist (post-migration, pre-traffic)
- [ ] Tenant RLS present: 4 policies referencing `app_visible_casinos` on event log + 3 projection tables.
- [ ] Catalogue views are `security_invoker`.
- [ ] Event log is partitioned (≥ current-month partition exists); immutability trigger present.
- [ ] Identity constraints accept v2 (24-hex) ids.
- [ ] Policy store: one **active** version with the expected rule count.
- [ ] `sbiq_platform_health(<casino>)` returns a snapshot.

## 6. Post-deployment verification (smoke tests)
Using an operator JWT and an admin JWT on the target:
- [ ] **Auth:** anon key → gateway = `401`; tampered token = `401`.
- [ ] **Isolation:** operator → own casino `200`; operator → other casino `403`.
- [ ] **Privilege:** operator → `platform-ops` = `403`; admin → `monitor` = `200`.
- [ ] **Identity:** resolve a reference twice → identical SB-PLR (24-hex) id.
- [ ] **Ingestion → view:** submit a session journey (producer) → appears in `consumer-gateway?view=live-floor`.
- [ ] **Idempotency:** resubmit an event with the same key → no duplicate (health event count unchanged).
- [ ] **Replay:** `projection-platform?action=rebuild` → deterministic; `validate-projections` integrity ok.
- [ ] **Decisions:** `consumer-gateway?view=summary` returns policy decisions sourced from the store.

## 7. Health checks & monitoring
- `platform-ops?action=monitor` → `platform_severity` should be `ok`; investigate any `PROJECTION_LAG_*`, `PROJECTION_DRIFT`, `INGESTION_STALL`.
- `sbiq_platform_health(<casino>)` → projection lag within the production threshold (30/120 s).
- Structured telemetry flowing to the log sink; no error spikes.

## 8. Acceptance criteria (go-live sign-off)
All §5–§7 checks pass; no critical alerts; policy store active; partitions current; monitoring green; rollback owner on standby. Record sign-off (operator + platform owner) with timestamp.

## 9. Rollback procedure
- **Application:** redeploy the previous EB application version (standard EB rollback).
- **Edge functions:** redeploy the previous function bundle (`functions deploy` from the prior release commit).
- **Database:** migrations are additive and reversible in effect — no destructive change to unwind. If a specific migration must be reverted, apply its documented reversal (see the ADR migration strategy for that change); projections can always be disposed and rebuilt from the immutable log **within the hot retention window** — for a full-history rebuild, re-attach archived partitions first (`OPERATIONS_MANUAL.md` §5, rebuild-after-archival caution). Policy configuration rolls back via `platform-ops?action=policy-activate&version=<last-good>`.
- **Events are truth:** never perform data surgery on the event log; recover read-side state by rebuild.

## 10. Emergency rollback
- **Bad policy config:** `platform-ops?action=policy-activate&version=<last-good>&reason=emergency` — minutes, no deploy, audited.
- **Projection corruption/drift:** `projection-platform?action=rebuild&casino_id=<uuid>` — deterministic, zero data loss.
- **Bad release:** EB + edge function rollback to the prior release commit.
- **Security incident:** adjust the registry (`users`/`casinos`) to revoke/rescope; RLS + edge enforce immediately.

## 11. Operational sign-off
| Role | Confirms | Sign |
|---|---|---|
| Release engineer | tests/build green; migrations applied in order; functions + app deployed | |
| SRE / operator | smoke tests pass; monitoring green; partitions + policy store ready | |
| Platform owner | acceptance criteria met; production go-live approved | |

## 12. Estimated deployment timeline
| Step | Estimate |
|---|---|
| Pre-deployment checks + backup verify | 30–45 min |
| Database migrations (in order) | 10–20 min |
| Edge function deploys | 5–10 min |
| Application (EB) deploy | 10–20 min |
| Policy seed + partition ensure | 5 min |
| Validation + smoke tests | 20–30 min |
| Sign-off | 10 min |
| **Total** | **~1.5–2.5 hours** (excluding rehearsal) |

---
*This runbook covers the certified enterprise flow. Out-of-flow surfaces (`safeplay-connect`, `wellbeing-games`) are deployed and governed separately and are not part of this runbook in v1.0.*
