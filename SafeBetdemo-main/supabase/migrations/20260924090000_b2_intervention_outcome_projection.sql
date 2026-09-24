-- ─── SafeBet IQ — Responsible Profitability B2: intervention-outcome projection ──
--
-- A MINIMAL governed read projection that aggregates the REAL Demo intervention
-- records (player_protection_interventions) to CASINO grain. It is the honest,
-- privacy-preserving surface for B2 Intervention Outcome Intelligence:
--
--   • CASINO grain only — NO player identifiers (no player_id, no players.id, no
--     safebet_player_id). distinct_players is a COUNT, never a list. This avoids
--     the (unverified) players.id → safebet_player_id identity bridge entirely.
--   • It reads the SMALL source table (≈586 rows), NOT the 102k-row
--     projection_player_state, so a GROUP BY casino_id is bounded and cheap
--     (idx_interventions_casino_date on (casino_id, intervention_date)).
--   • SECURITY INVOKER so the underlying table's casino-scoped RLS applies to the
--     caller; consumed by the Consumer/Responsible-Profitability API using the
--     same gateway-authorised, casino-scoped service-role pattern as B1.
--   • It does NOT invent evidence: delivered_at / acknowledged_at / risk_score_after
--     are surfaced only as populated-COUNTS (evidence completeness), never inferred.
--   • It does NOT redefine or touch the existing projection_intervention_state view,
--     projection_player_state, or any certified-financial object.
--
-- No new SECURITY DEFINER function, no PUBLIC / anon grant.

create or replace view projection_intervention_outcome_state as
select
  ppi.casino_id,
  count(*)::bigint                                                              as interventions_recorded,
  count(distinct ppi.player_id)::bigint                                         as distinct_players,
  count(*) filter (where ppi.outcome = 'accepted')::bigint                      as outcome_accepted,
  count(*) filter (where ppi.outcome = 'declined')::bigint                      as outcome_declined,
  count(*) filter (where ppi.outcome = 'pending')::bigint                       as outcome_pending,
  count(*) filter (where ppi.outcome = 'successful')::bigint                    as outcome_successful,
  count(*) filter (where ppi.outcome = 'unsuccessful')::bigint                  as outcome_unsuccessful,
  count(*) filter (where ppi.dispatch_status = 'sent')::bigint                  as status_sent,
  count(*) filter (where ppi.dispatch_status = 'delivered')::bigint             as status_delivered,
  count(*) filter (where ppi.follow_up_required is true)::bigint                as follow_up_required,
  count(*) filter (where ppi.nrgp_reported is true)::bigint                     as nrgp_reported,
  count(*) filter (where ppi.outcome is not null)::bigint                       as with_outcome,
  count(*) filter (where ppi.delivered_at is not null)::bigint                  as with_delivered_at,
  count(*) filter (where ppi.acknowledged_at is not null)::bigint               as with_acknowledged_at,
  count(*) filter (where ppi.risk_score_after is not null)::bigint              as with_risk_score_after,
  max(coalesce(ppi.intervention_date::timestamptz, ppi.triggered_at, ppi.created_at)) as last_intervention_at
from player_protection_interventions ppi
group by ppi.casino_id;

-- Run as the INVOKER so the source table's casino-scoped RLS is enforced.
alter view projection_intervention_outcome_state set (security_invoker = true);

comment on view projection_intervention_outcome_state is
  'B2 Responsible Profitability: casino-grain aggregate of player_protection_interventions (Demo records). No player identifiers. ALL_RECORDED window. Occurrence/outcome only — no delivery timing, no follow-up completion, no causal effectiveness.';

-- Least privilege: SERVICE_ROLE ONLY. The k-anonymity suppression that protects a
-- small casino's intervention cohort is applied in the API computation layer, NOT in
-- this raw aggregate. Granting `authenticated` direct SELECT would let an operator read
-- the UN-suppressed aggregate for their casino and bypass that protection, so direct
-- authenticated access is deliberately NOT granted — the view is reachable only through
-- the gateway-authorised, casino-scoped, suppression-applying API path (same posture as
-- B1's self-exclusion read). security_invoker is retained as defence-in-depth.
revoke all on projection_intervention_outcome_state from public;
revoke all on projection_intervention_outcome_state from authenticated, anon;
grant select on projection_intervention_outcome_state to service_role;
