# SEC-SD-PROD-1B — Verified Maintenance P0 Least-Privilege Containment (Production)

**Scope: EXACTLY two functions.** Production Supabase `ilibvipqbkugqkppzdmh`. ACL-only change;
no function body, ownership, RLS, schema, or data change.

1. `public.simulate_live_feed()`
2. `public.create_monthly_partition(text, integer, integer)` — identity args `(p_table_name text, p_year integer, p_month integer)`

## Proven caller evidence (SEC-SD-PROD-1A + 1B recheck)
| Function | Owner | Caller | Caller executes as | Needs role grant? |
|---|---|---|---|---|
| `simulate_live_feed()` | postgres | pg_cron `casino-live-feed-tick` (`* * * * *`) | **postgres** (`cron.job.username=postgres`) | **No** — owner rights |
| `create_monthly_partition(text,int,int)` | postgres | `ensure_future_partitions()` (SECURITY DEFINER, owner postgres) | **postgres** (definer) | **No** — owner rights |

- No Edge Function caller (Production has **zero** edge functions).
- No external service caller proven; no `service_role` direct caller found → **service_role EXECUTE not required**.
- Because both callers run with the owner (postgres) privilege, revoking every role grant (PUBLIC/anon/
  authenticated/service_role) leaves the proven callers unaffected (owner retains EXECUTE inherently).

## Pre-change ACL (rollback baseline)
Both: `=X/postgres ; postgres=X/postgres ; anon=X/postgres ; authenticated=X/postgres ; service_role=X/postgres`
→ effective: PUBLIC=T, anon=T, authenticated=T, service_role=T, postgres=T.

## Forward SQL (least privilege — owner only)
```sql
revoke execute on function public.simulate_live_feed()                            from public, anon, authenticated, service_role;
revoke execute on function public.create_monthly_partition(text, integer, integer) from public, anon, authenticated, service_role;
```
Desired result: PUBLIC=FALSE, anon=FALSE, authenticated=FALSE, service_role=FALSE, postgres/owner retained.

## Rollback SQL (restore exact pre-change grants)
```sql
grant execute on function public.simulate_live_feed()                            to public, anon, authenticated, service_role;
grant execute on function public.create_monthly_partition(text, integer, integer) to public, anon, authenticated, service_role;
```

## Validation plan
- Effective-privilege proof (anon/authenticated/service_role = FALSE; postgres = TRUE).
- Observe next `casino-live-feed-tick` cron run(s): no permission-denied, cron continues.
- `ensure_future_partitions` → `create_monthly_partition` path intact (structural/permission check; no forced partition creation).
- App HTTP 200, login/session unaffected (these are not login dependencies).
- Rollback only if a proven legitimate caller breaks.

## Out of scope / next
Remaining Production CRITICAL (11) and HIGH (6) unchanged. Next: **SEC-SD-PROD-2** — auth/login
trusted-server redesign (`get_user_by_email_fast`, `log_auth_event`, `log_security_event`,
`check_rate_limit_sliding`; `check_distributed_rate_limit` after its role resolves).
