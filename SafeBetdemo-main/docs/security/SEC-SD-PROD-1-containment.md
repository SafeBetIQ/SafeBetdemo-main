# SEC-SD-PROD-1 — Production SECURITY DEFINER P0 Containment (REVIEW-READY, NOT APPLIED)

**Status: prepared for independent review + human apply. No Production ACL was changed.**
The Production application source is a **separate repository not available to this audit**,
so client-side callers cannot be verified from source. The CEO authorisation is conditioned on
functions being "**re-verified as safe**"; that precondition cannot be met autonomously for the
functions below (see evidence), so **nothing was applied**. This document + the exact SQL are the
artefact for a reviewer who has Production application knowledge.

## Evidence that blocks a blind apply
1. **No DB-side callers.** On Production none of the P0 functions are invoked by `pg_cron`,
   triggers, or other functions — except `simulate_live_feed` (1 cron job) and
   `create_monthly_partition` (called by 1 function). Their callers are therefore **external
   application/server code**, whose role (anon vs authenticated vs service_role) is unknown here.
2. **Explicit `anon` grants.** Most P0 functions carry an **explicit** `anon=X/postgres` grant
   (not mere PUBLIC inheritance): `log_auth_event`, `check_rate_limit_sliding`,
   `get_user_by_email_fast`, `get_performance_stats`, `calculate_rpi_roi`, `player_belongs_to_casino`,
   `archive_old_records`, `create_monthly_partition`, `purge_old_ingest_requests`,
   `refresh_all_materialized_views`, `refresh_realtime_views`, `simulate_live_feed`,
   `log_security_event`. A deliberate anon grant strongly implies the app calls them with the anon
   key (e.g. pre-auth rate limiting, login-attempt logging). Revoking anon would likely break Production.
3. Only `check_distributed_rate_limit` and `cleanup_rate_limit_entries` are PUBLIC-only (no explicit
   anon/authenticated grant); `fn_vault_secret_exists` is authenticated-only, no anon.

## Pre-change ACL snapshot (rollback baseline)
All 16 reviewed P0 functions: `anon`, `authenticated`, `service_role`, `postgres` = EXECUTE
(except `fn_vault_secret_exists`: anon = **no**). Full ACLs captured in the milestone evidence.

## P0 containment classification (Phase 3)
| Function | Signature | Class | Reason |
|---|---|---|---|
| `get_user_by_email_fast` | `(text)` | **D — code redesign** | login/anon flow (Demo pattern); explicit anon grant → **SEC-SD-PROD-2** |
| `log_auth_event` | `(text,text,text,jsonb,uuid,text)` | **D** | explicit anon grant → likely called during login to log attempts |
| `log_security_event` | `(uuid,text,text,text,text,jsonb)` | **D** | explicit anon grant → likely client security logging |
| `check_rate_limit_sliding` | `(text,text,uuid)` | **D** | explicit anon grant → pre-auth rate limiting (revoke breaks login throttle) |
| `check_distributed_rate_limit` | `(text,integer,integer)` | **E — do not touch** | PUBLIC-only but pre-auth rate-limit role unknown |
| `player_belongs_to_casino` | `(uuid,uuid)` | **E** | likely authorization/RLS helper; revoking authenticated may break access checks |
| `calculate_rpi_roi` | `(uuid,date)` | **E** | admin/analytics read; caller role unknown (may be authenticated dashboard) |
| `get_performance_stats` | `()` | **E** | admin read; caller role unknown |
| `fn_vault_secret_exists` | `(text)` | **E** | authenticated-only secret oracle; caller unknown |
| `refresh_all_materialized_views` | `()` | **B/C (proposed)** | maintenance; worst case a broken admin "refresh" button — **still needs prod-caller confirm** |
| `refresh_realtime_views` | `()` | **B/C (proposed)** | maintenance; same caveat |
| `cleanup_rate_limit_entries` | `()` | **B/C (proposed)** | maintenance DELETE; PUBLIC-only; keep service_role |
| `purge_old_ingest_requests` | `(integer)` | **B/C (proposed)** | maintenance DELETE; keep service_role |
| `archive_old_records` | `(integer)` | **B/C (proposed)** | maintenance; keep service_role |
| `create_monthly_partition` | `(text,integer,integer)` | **B/C (proposed)** | partition mgmt; called by 1 fn (internal, unaffected); keep service_role |
| `simulate_live_feed` | `()` | **C (proposed)** | cron-driven (postgres); could be postgres-only |

**No function reaches Class A (immediate revoke-only safe) because caller role cannot be proven
from available source.** The B/C set is *proposed* and still requires Production-caller confirmation
by someone with the Production application source before apply.

## Proposed containment SQL (maintenance B/C subset) — apply ONLY after prod-caller confirmation
```sql
-- Revoke anon/authenticated/PUBLIC; retain service_role for server/cron callers.
-- CONFIRM no admin UI calls these with a user JWT before applying.
revoke execute on function public.refresh_all_materialized_views()             from public, anon, authenticated;
revoke execute on function public.refresh_realtime_views()                     from public, anon, authenticated;
revoke execute on function public.cleanup_rate_limit_entries()                 from public, anon, authenticated;
revoke execute on function public.purge_old_ingest_requests(integer)           from public, anon, authenticated;
revoke execute on function public.archive_old_records(integer)                 from public, anon, authenticated;
revoke execute on function public.create_monthly_partition(text,integer,integer) from public, anon, authenticated;
grant  execute on function public.refresh_all_materialized_views()             to service_role;
grant  execute on function public.refresh_realtime_views()                     to service_role;
grant  execute on function public.cleanup_rate_limit_entries()                 to service_role;
grant  execute on function public.purge_old_ingest_requests(integer)           to service_role;
grant  execute on function public.archive_old_records(integer)                 to service_role;
grant  execute on function public.create_monthly_partition(text,integer,integer) to service_role;
```

## Rollback SQL (restore prior grants)
```sql
grant execute on function public.refresh_all_materialized_views()             to public, anon, authenticated;
grant execute on function public.refresh_realtime_views()                     to public, anon, authenticated;
grant execute on function public.cleanup_rate_limit_entries()                 to public, anon, authenticated;
grant execute on function public.purge_old_ingest_requests(integer)           to public, anon, authenticated;
grant execute on function public.archive_old_records(integer)                 to public, anon, authenticated;
grant execute on function public.create_monthly_partition(text,integer,integer) to public, anon, authenticated;
```

## Follow-up milestones
- **SEC-SD-PROD-2** — `get_user_by_email_fast` + auth-flow functions (`log_auth_event`,
  `log_security_event`, `check_rate_limit_sliding`): server-route / internal-authz redesign.
- **SEC-SD-PROD-1-APPLY** — apply the B/C subset above **after** a Production-app owner confirms
  callers use service_role, with monitoring + the rollback ready.
- **SEC-SD-PROD-3** — remaining HIGH/E functions once caller roles are known.
- **PROD-HEALTH-1** — EB enhanced-health Red investigation (separate).

---

## ADDENDUM — SEC-SD-PROD-1A caller verification (read-only; no ACL change)

**Source availability:** Production application source is **UNAVAILABLE** — the `SafeBetIQ`
GitHub org contains only the Demo repo; there is no prod CodeBuild project; prod EB
`safebet-iq-app` (version `safebet-prod-20260523-210842`) carries no source-build metadata;
and **Production Supabase has ZERO Edge Functions** (the prod app calls the DB directly).
Confidence that source was thoroughly sought: HIGH. → rely on DB + runtime evidence.

**Runtime capability:** `track_functions = none` → `pg_stat_user_functions` empty (per-function
call counts unavailable; not enabled, per boundary). Usage inferred from target-table activity.

**DB-side callers (proven):**
- `simulate_live_feed` ← pg_cron job `casino-live-feed-tick` (`* * * * *`, runs as postgres). No external caller evidence.
- `create_monthly_partition` ← called internally by `ensure_future_partitions` (definer). No external caller evidence.
- All other P0 functions: **no** cron/trigger/internal caller → any caller is external app/server (role unknown; source unavailable).

**Indirect runtime activity (target tables, prod):**
- `audit_events`: 28 total, 3 in last 7d, latest 2026-08-24 → `log_auth_event` is **live but low-volume** (login logging).
- `security_events`: **0 rows ever** → `log_security_event` effectively unused.
- `distributed_rate_limits`: **0 rows** → `check_distributed_rate_limit`/`cleanup_rate_limit_entries` show no activity.
- `ingest_requests`: **0 rows** → `purge_old_ingest_requests` acts on an empty table. (Production is a minimal-usage environment.)

**Refined classification (evidence-based):**
| Function | Proven caller | Verdict |
|---|---|---|
| `simulate_live_feed()` | pg_cron (postgres) | **VERIFIED revoke-safe** from anon/authenticated (cron uses owner) |
| `create_monthly_partition(text,int,int)` | internal `ensure_future_partitions` (definer) | **VERIFIED revoke-safe** from anon/authenticated (keep service_role) |
| `cleanup_rate_limit_entries()`, `purge_old_ingest_requests(int)` | none; target tables empty (0 activity) | **STRONG candidate** (unused) — keep service_role |
| `refresh_all_materialized_views()`, `refresh_realtime_views()`, `archive_old_records(int)` | none found; external caller role unknown | **CANDIDATE** — needs prod-app owner confirm |
| `log_auth_event`, `get_user_by_email_fast`, `log_security_event`, `check_rate_limit_sliding` | auth/login family (explicit anon grant) | **Class D — SEC-SD-PROD-2 redesign** |
| `check_distributed_rate_limit`, `player_belongs_to_casino`, `calculate_rpi_roi`, `get_performance_stats`, `fn_vault_secret_exists` | unknown (likely RLS/authz helper or admin read) | **Class E — needs source** |

**VERIFIED-SAFE APPLY SUBSET (caller proven, no anon/authenticated need):** `simulate_live_feed()`,
`create_monthly_partition(text,integer,integer)`. Proposed ACL: PUBLIC/anon/authenticated = FALSE;
service_role = TRUE (owner/cron/internal unaffected). **This subset is smaller than the original
proposed 6 and therefore MATERIALLY CHANGES the reviewed SQL → requires fresh independent review.**

```sql
-- SEC-SD-PROD-1A verified-safe subset (apply only after prod-app-owner APPROVED + re-review)
revoke execute on function public.simulate_live_feed()                          from public, anon, authenticated;
revoke execute on function public.create_monthly_partition(text,integer,integer) from public, anon, authenticated;
grant  execute on function public.simulate_live_feed()                          to service_role;
grant  execute on function public.create_monthly_partition(text,integer,integer) to service_role;
-- rollback:
-- grant execute on function public.simulate_live_feed() to public, anon, authenticated;
-- grant execute on function public.create_monthly_partition(text,integer,integer) to public, anon, authenticated;
```

**Apply decision (Phase 25): DO NOT APPLY YET** — no Production-app-owner APPROVED verdict obtained
(cannot self-provide), and source-level caller verification is unavailable for the broader subset.
The verified subset + rollback are ready for a reviewer with Production knowledge.
