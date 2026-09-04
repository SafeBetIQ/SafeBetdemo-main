-- ─── ARCH-V4-A2 — allow the financial rollup to run when invoked via PostgREST ──
-- The dedicated financial-rollup WORKER (SQS → Lambda) orchestrates the EXISTING
-- authoritative incremental rollup by calling public.sbiq_financial_rollup_refresh()
-- over PostgREST. PostgREST enforces the API roles' ~8s statement_timeout, which
-- cancels the refresh (SQLSTATE 57014) whenever it must process more than a few
-- seconds of dirty buckets (e.g. after any gap). This sets a FUNCTION-SCOPED
-- statement_timeout so the refresh may run up to 120s when invoked through the API,
-- matching the time it already takes under pg_cron. It is bounded (single-writer via
-- the worker's reserved concurrency = 1 and the function's advisory xact lock) and
-- therefore cannot recreate the AUTH-DEMO-1 contention (no watchdog, no */2 cadence).
--
-- This does NOT change GGR arithmetic, certified semantics, source_as_of, the
-- freshness contract, tenant/casino scoping, RLS, grants, or SECURITY DEFINER status.
-- It only relaxes a timeout guard for THIS one function so the worker path works.
--
-- Safety: narrow (one ALTER FUNCTION attribute), Demo-only, idempotent, reversible
-- (`reset statement_timeout`). No schema/RLS/grant/privilege change.

alter function public.sbiq_financial_rollup_refresh(integer) set statement_timeout = '120s';

do $$
declare v text;
begin
  select array_to_string(proconfig, ', ') into v from pg_proc
   where proname = 'sbiq_financial_rollup_refresh';
  raise notice 'ARCH-V4-A2: sbiq_financial_rollup_refresh proconfig = %', v;
end $$;
