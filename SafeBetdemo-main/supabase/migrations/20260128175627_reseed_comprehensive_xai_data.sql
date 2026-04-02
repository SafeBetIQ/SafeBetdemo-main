/*
  # Reseed Comprehensive XAI Data for All Casinos
  
  ## Overview
  Regenerates AI Reason Stacks, Recommendations, and Outcomes for all casinos
  to ensure complete data coverage across all risk levels.
  
  ## Changes
  1. Clears existing XAI data
  2. Seeds comprehensive AI Reason Stacks for all player risk levels
  3. Creates AI Intervention Recommendations
  4. Generates AI Intervention Outcomes with tracked effectiveness
*/

-- Clear existing XAI data
TRUNCATE TABLE ai_intervention_outcomes CASCADE;
TRUNCATE TABLE ai_intervention_recommendations CASCADE;
TRUNCATE TABLE ai_reason_stacks CASCADE;

-- Seed AI Reason Stacks for ALL players across all casinos
INSERT INTO ai_reason_stacks (
  player_id,
  casino_id,
  risk_level,
  ai_confidence_score,
  contributing_factors,
  nova_iq_weight_percent,
  casino_data_weight_percent,
  explanation_summary,
  triggers_24h,
  triggers_7d,
  triggers_30d,
  created_at
)
SELECT 
  p.id,
  p.casino_id,
  CASE 
    WHEN p.risk_score >= 75 THEN 'critical'
    WHEN p.risk_score >= 60 THEN 'high'
    WHEN p.risk_score >= 40 THEN 'moderate'
    ELSE 'low'
  END,
  (65 + (RANDOM() * 30))::numeric,
  jsonb_build_array(
    jsonb_build_object(
      'factor', CASE 
        WHEN p.risk_score >= 70 THEN 'Loss-chasing behavior detected'
        WHEN p.risk_score >= 50 THEN 'Session escalation above baseline'
        ELSE 'Moderate betting volatility'
      END,
      'weight_percent', (30 + (RANDOM() * 15))::integer,
      'source', 'live_casino',
      'time_period', '24h',
      'trend', CASE WHEN RANDOM() > 0.5 THEN 'increasing' ELSE 'stable' END
    ),
    jsonb_build_object(
      'factor', CASE 
        WHEN p.risk_score >= 70 THEN 'High impulsivity index'
        WHEN p.risk_score >= 50 THEN 'Moderate impulsivity pattern'
        ELSE 'Low impulse control concern'
      END,
      'weight_percent', (15 + (RANDOM() * 15))::integer,
      'source', 'nova_iq',
      'time_period', 'assessment',
      'trend', 'stable'
    ),
    jsonb_build_object(
      'factor', 'High spend volatility',
      'weight_percent', (10 + (RANDOM() * 15))::integer,
      'source', 'live_casino',
      'time_period', '7d',
      'trend', CASE WHEN RANDOM() > 0.6 THEN 'increasing' ELSE 'stable' END
    ),
    jsonb_build_object(
      'factor', 'Extended session duration pattern',
      'weight_percent', (8 + (RANDOM() * 12))::integer,
      'source', 'live_casino',
      'time_period', '30d',
      'trend', CASE WHEN RANDOM() > 0.7 THEN 'increasing' ELSE 'stable' END
    )
  ),
  (15 + (RANDOM() * 20))::numeric,
  (65 + (RANDOM() * 20))::numeric,
  CASE 
    WHEN p.risk_score >= 75 THEN 'Critical risk indicators detected across multiple behavioral dimensions. Nova IQ assessment shows high impulsivity combined with recent loss-chasing patterns. Immediate intervention recommended.'
    WHEN p.risk_score >= 60 THEN 'Multiple high-risk behavioral patterns detected. Nova IQ profile indicates elevated impulsivity requiring targeted intervention.'
    WHEN p.risk_score >= 40 THEN 'Moderate risk factors present. Nova IQ assessment suggests monitoring and preventive measures.'
    ELSE 'Low-risk profile with stable behavioral patterns. Routine monitoring recommended.'
  END,
  jsonb_build_array(
    jsonb_build_object('type', 'loss_chasing', 'count', (1 + (RANDOM() * 3))::integer),
    jsonb_build_object('type', 'session_escalation', 'ratio', ROUND((1.2 + (RANDOM() * 1.5))::numeric, 2))
  ),
  jsonb_build_array(
    jsonb_build_object('type', 'spend_volatility', 'coefficient', (40 + (RANDOM() * 40))::integer)
  ),
  '[]'::jsonb,
  now() - (RANDOM() * interval '7 days')
FROM players p
WHERE p.risk_score >= 30
ORDER BY p.risk_score DESC, p.created_at DESC;

-- Seed AI Intervention Recommendations
INSERT INTO ai_intervention_recommendations (
  reason_stack_id,
  player_id,
  casino_id,
  recommended_intervention_type,
  recommended_timing,
  success_probability,
  rationale,
  alternative_options,
  staff_decision,
  decision_rationale,
  staff_id,
  decided_at,
  created_at
)
SELECT 
  ars.id,
  ars.player_id,
  ars.casino_id,
  CASE 
    WHEN ars.risk_level = 'critical' THEN (ARRAY['cooling_off', 'deposit_limit', 'self_exclusion', 'escalation'])[floor(random() * 4 + 1)]
    WHEN ars.risk_level = 'high' THEN (ARRAY['cooling_off', 'deposit_limit', 'session_limit', 'soft_message'])[floor(random() * 4 + 1)]
    WHEN ars.risk_level = 'moderate' THEN (ARRAY['soft_message', 'staff_contact', 'deposit_limit', 'monitor_only'])[floor(random() * 4 + 1)]
    ELSE 'monitor_only'
  END,
  CASE 
    WHEN ars.risk_level IN ('critical', 'high') THEN 'immediate'
    WHEN ars.risk_level = 'moderate' THEN (ARRAY['immediate', 'delayed'])[floor(random() * 2 + 1)]
    ELSE 'scheduled'
  END,
  (60 + (RANDOM() * 30))::numeric,
  CASE 
    WHEN ars.risk_level = 'critical' THEN 'Critical risk indicators require immediate protective intervention. Nova IQ behavioral profile combined with recent activity patterns indicate high likelihood of harm without intervention.'
    WHEN ars.risk_level = 'high' THEN 'Multiple risk factors detected. AI recommends proactive intervention based on Nova IQ impulsivity score and recent behavioral escalation.'
    WHEN ars.risk_level = 'moderate' THEN 'Moderate risk profile suggests preventive intervention. Nova IQ assessment indicates player may benefit from supportive messaging.'
    ELSE 'Low-risk profile. Routine monitoring with periodic check-ins recommended.'
  END,
  jsonb_build_array(
    jsonb_build_object(
      'type', 'soft_message',
      'probability', (60 + (RANDOM() * 20))::integer,
      'rationale', 'Send supportive message with self-assessment tools as alternative'
    ),
    jsonb_build_object(
      'type', 'deposit_limit',
      'probability', (65 + (RANDOM() * 20))::integer,
      'rationale', 'Set deposit and bet limits as alternative protective measure'
    )
  ),
  CASE 
    WHEN RANDOM() > 0.3 THEN 'accepted'
    WHEN RANDOM() > 0.7 THEN 'overridden'
    ELSE 'pending'
  END,
  CASE 
    WHEN RANDOM() > 0.5 THEN 'AI recommendation aligned with our assessment. Proceeding as suggested.'
    WHEN RANDOM() > 0.7 THEN 'Modified intervention based on player history and recent communication.'
    ELSE NULL
  END,
  (SELECT s.id FROM staff s WHERE s.casino_id = ars.casino_id ORDER BY RANDOM() LIMIT 1),
  CASE WHEN RANDOM() > 0.3 THEN now() - (RANDOM() * interval '5 days') ELSE NULL END,
  ars.created_at + interval '5 minutes'
FROM ai_reason_stacks ars
WHERE ars.risk_level IN ('critical', 'high', 'moderate');

-- Seed AI Intervention Outcomes
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
    WHEN RANDOM() > 0.3 THEN 'Positive - player acknowledged support'
    WHEN RANDOM() > 0.6 THEN 'Neutral - player continued as normal'
    ELSE 'Negative - player expressed frustration'
  END,
  (ARRAY['high', 'medium', 'low'])[floor(random() * 3 + 1)],
  air.decided_at + interval '30 days'
FROM ai_intervention_recommendations air
JOIN players p ON p.id = air.player_id
WHERE air.staff_decision = 'accepted' 
  AND air.decided_at IS NOT NULL
  AND air.decided_at < now() - interval '10 days';