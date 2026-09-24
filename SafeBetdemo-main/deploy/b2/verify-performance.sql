-- SafeBet IQ — B2 performance verification (run READ-ONLY AFTER the migration
-- 20260924090000_b2_intervention_outcome_projection.sql is applied to Demo).
--
-- The projection is a single-source GROUP BY over the small player_protection_
-- interventions table (≈586 rows, 6 groups) — no worker, no cron, no join to the
-- 102k-row projection_player_state. These plans confirm the aggregation is bounded
-- and that the per-request read is a single indexed row lookup.
--
-- Expectation: no Seq Scan of any large table; HashAggregate over a few hundred
-- rows; total time in the low single-digit milliseconds. Do NOT report live
-- performance as verified until these have actually been run against the applied view.

-- 1) The view body (full aggregation over the source table).
explain (analyze, buffers, verbose)
select * from projection_intervention_outcome_state;

-- 2) The exact per-request read the API performs (one casino row).
explain (analyze, buffers, verbose)
select * from projection_intervention_outcome_state
where casino_id = 'a1b2c3d4-0000-0000-0000-000000000001';

-- 3) Row/relation sanity: source cardinality the aggregate scans.
select count(*) as source_rows, count(distinct casino_id) as casinos
from player_protection_interventions;
