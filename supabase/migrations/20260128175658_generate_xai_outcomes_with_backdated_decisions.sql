/*
  # Generate XAI Outcomes with Backdated Decisions
  
  ## Overview
  Updates recommendation decisions to be backdated, then generates outcomes
  
  ## Changes
  1. Backdate accepted recommendations by 15-30 days
  2. Generate outcomes for those accepted recommendations
*/

-- Backdate some accepted recommendations so they can have outcomes
UPDATE ai_intervention_recommendations
SET decided_at = now() - (interval '15 days' + (random() * interval '15 days'))
WHERE staff_decision = 'accepted'
  AND decided_at IS NOT NULL
  AND id IN (
    SELECT id FROM ai_intervention_recommendations
    WHERE staff_decision = 'accepted'
    ORDER BY created_at
    LIMIT 150
  );

-- Now generate outcomes for those backdated recommendations
INSERT INTO ai_intervention_outcomes (
  recommendation_id,
  player_id,
  casino_id,
  intervention_type,
  applied_at,
  nova_iq_influenced,
  pre_risk_score,
  pre_impulsivity_score,
  post_risk_score_7d,
  post_risk_score_14d,
  post_risk_score_30d,
  outcome,
  effectiveness_score,
  time_to_impact_days,
  player_response,
  player_engagement_level,
  created_at
)
SELECT 
  air.id,
  air.player_id,
  air.casino_id,
  air.recommended_intervention_type,
  air.decided_at,
  true,
  p.risk_score,
  p.risk_score,
  GREATEST(10, p.risk_score - (10 + (RANDOM() * 15))::integer),
  GREATEST(5, p.risk_score - (15 + (RANDOM() * 20))::integer),
  GREATEST(0, p.risk_score - (20 + (RANDOM() * 25))::integer),
  CASE 
    WHEN RANDOM() > 0.2 THEN 'risk_reduced'
    WHEN RANDOM() > 0.6 THEN 'risk_stable'
    ELSE 'risk_increased'
  END,
  (60 + (RANDOM() * 35))::integer,
  (3 + (RANDOM() * 10))::integer,
  CASE 
    WHEN RANDOM() > 0.3 THEN 'Positive - player acknowledged support and reduced betting'
    WHEN RANDOM() > 0.6 THEN 'Neutral - player continued with normal patterns'
    ELSE 'Negative - player expressed frustration initially'
  END,
  (ARRAY['high', 'medium', 'low'])[floor(random() * 3 + 1)],
  air.decided_at + interval '14 days'
FROM ai_intervention_recommendations air
JOIN players p ON p.id = air.player_id
WHERE air.staff_decision = 'accepted' 
  AND air.decided_at IS NOT NULL
  AND air.decided_at < now() - interval '10 days';